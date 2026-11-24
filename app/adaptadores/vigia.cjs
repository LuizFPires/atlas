// Vigia da obra (bug de 24/11/2026, obra do Guilherme: a linha parou sem avançar, o painel dizia "a obra está pronta" com 0% e
// ninguém soube por quase uma hora). O Atlas tem que QUERER construir:
//  - linha que parou sem conseguir trabalhar ("sem-avanco") ou com erro: o vigia garante o kit e religa sozinho, em 2, 5 e 15 min;
//  - depois de 3 tentativas sem avanço, para de insistir e o painel mostra o alerta com o motivo (situacao 'precisa-voce');
//  - trabalhou de verdade (rodando há mais de 5 min) ou o cliente pediu "Tentar agora": zera.
// Não mexe em pausa do cliente, cota (cota.cjs cuida), app fechado (Retomar cuida) nem obra pronta.
// Estado no .atlas/vigia.json da obra (o painel lê). Sem segredo nenhum.
'use strict'
const path = require('node:path')
const { pastaDaObra, gravarAtomico, lerJson, lerTexto } = require('./obra-fs.cjs')
const { marcaDeAvanco } = require('./retrato-obra.cjs')

const BACKOFF_MIN = [2, 5, 15]
const MAX_TENTATIVAS = BACKOFF_MIN.length
const TRABALHOU_MS = 5 * 60_000
const VIGIADOS = new Set(['sem-avanco', 'erro', 'precisa-voce'])
const MOTIVO = {
  'sem-avanco': 'A linha de produção ligou, mas não conseguiu trabalhar e parou em seguida.',
  erro: 'A linha de produção parou com um erro.',
  'kit-indisponivel': 'Não consegui baixar as instruções da obra (sem internet ou o servidor do Atlas não respondeu).',
  'kit-faltando': 'Não consegui baixar as instruções da obra (sem internet ou o servidor do Atlas não respondeu).',
  'claude-nao-logado': 'O Claude deste computador saiu da conta: é preciso entrar de novo.',
  'claude-nao-instalado': 'O Claude não está instalado neste computador.',
}
const textoDe = (cod) => MOTIVO[cod] || MOTIVO.erro
/** A conta que a fala da linha pede para ligar (o painel mostra o botão "Ligar as contas"). */
const contaDaFala = (f) => { const m = /\b(GitHub|Vercel|Supabase)\b/i.exec(String(f || '')); return m ? { github: 'GitHub', vercel: 'Vercel', supabase: 'Supabase' }[m[1].toLowerCase()] : null }
/** A fala da linha, sem o rótulo técnico "USUÁRIO:" e curta. */
/** A fala vai para o painel de um leigo: sem marcação, sem blocos de código e cortada no fim de uma frase (nunca no meio da palavra). */
const limparFala = (f) => {
  const t = String(f || '').replace(/^[\s\S]*?USU[AÁ]RIO\s*:\s*/i, '')
    .replace(/(```|''')[\s\S]*?(?:\1|$)/g, ' ')
    .replace(/[*_#`]+/g, '')
    .replace(/\s+/g, ' ').trim()
  if (t.length <= 300) return t
  const corte = t.slice(0, 300)
  const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('? '))
  return fim > 40 ? corte.slice(0, fim + 1) : corte.slice(0, corte.lastIndexOf(' ')) + '…'
}

function pctDoPlan(dir) {
  const t = lerTexto(path.join(dir, 'PLAN.md'), 400_000)
  if (t === null) return 0
  let total = 0, feitas = 0
  for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*[-*]\s+\[( |x|X)\]/); if (m) { total++; if (m[1] !== ' ') feitas++ } }
  return total ? (feitas / total) * 100 : 0
}

/** Milestones do PLAN (só contagem), para saber se uma etapa inteira acabou e espera o OK no passo a passo. */
function etapasDoPlan(dir) {
  const t = lerTexto(path.join(dir, 'PLAN.md'), 400_000)
  const ms = []
  let atual = null
  for (const l of (t || '').split(/\r?\n/)) {
    const m = l.match(/^##\s+(?:Milestone\s+|M)(\d+)/i)
    if (m) { atual = { n: Number(m[1]), total: 0, feitas: 0 }; ms.push(atual); continue }
    if (/^##\s/.test(l)) { atual = null; continue }
    const x = atual && l.match(/^\s*[-*]\s+\[( |x|X)\]/)
    if (x) { atual.total++; if (x[1] !== ' ') atual.feitas++ }
  }
  return ms
}
const SEGUIR_EM_MS = 60_000
// Economia de tokens (24/11/2026, obra do Guilherme: 65 religadas). Religar só com avanço ou motivo novo:
//  - turno religado sozinho que terminou sem tarefa, commit, etapa ou PR novo: espera 5 min e tenta UMA vez mais; no segundo
//    seguido, para e pede você (religar de novo só gastaria a cota).
//  - sem internet, sem Claude ou sem espaço (preCondicoes): não religa nem gasta tentativa; espera voltar.
const ESPERA_SEM_AVANCO_MS = 5 * 60_000
const MAX_SEM_AVANCO = 2
const MOTIVO_SEM_AVANCO = 'A obra terminou dois turnos seguidos sem avançar. Para não gastar sua cota à toa, o Atlas parou de religar sozinho.'

function criarVigia({ raiz, construcao, garantirKit, listar, agora = () => new Date(), aoPrecisar = () => {}, diario = null, diagnosticar = null, preCondicoes = null }) {
  /** O que falta para valer a pena religar (internet, Claude, disco). null = pode. Nunca lança. */
  const falta = async (pasta) => {
    if (!preCondicoes) return null
    try { const r = await preCondicoes(pasta); return r && r.ok === false ? String(r.motivo || 'Esperando o computador ficar pronto.') : null } catch { return null }
  }
  // M41: o que o vigia faz sozinho vai para o diário da obra.
  const anotar = (pasta, tipo, texto) => { if (!diario) return; try { diario.registrar(pastaDaObra(raiz, pasta), { tipo, texto }) } catch { /* diário é extra */ } }
  const arq = (pasta) => path.join(pastaDaObra(raiz, pasta), '.atlas', 'vigia.json')
  const ler = (pasta) => { try { const v = lerJson(arq(pasta)); return v && typeof v === 'object' ? v : null } catch { return null } }
  const gravar = (pasta, v) => {
    try { gravarAtomico(arq(pasta), JSON.stringify(v) + '\n') } catch { /* sem registro: tenta na próxima */ }
    if (v.situacao === 'precisa-voce') { try { aoPrecisar(pasta, v.motivo) } catch { /* aviso é extra */ } }
    if (v.situacao === 'precisa-voce' && Number(v.tentativa) > 0) {
      anotar(pasta, 'defeito', `O Atlas tentou ${v.tentativa} vezes e não conseguiu continuar sozinho. ${v.motivo || ''}`)
      // M41 (O4): as 10 conferências, uma vez, guardadas junto (sem avisar de novo).
      if (diagnosticar) {
        Promise.resolve().then(() => diagnosticar(pasta)).then((checagens) => {
          const atual = ler(pasta)
          if (Array.isArray(checagens) && atual && atual.situacao === 'precisa-voce' && atual.fimVisto === v.fimVisto) {
            try { gravarAtomico(arq(pasta), JSON.stringify({ ...atual, checagens: checagens.slice(0, 12) }) + '\n') } catch { /* sem lista: o alerta já está lá */ }
          }
        }, () => {})
      }
    }
  }
  const zerar = (pasta) => { try { const a = arq(pasta); if (require('node:fs').existsSync(a)) require('node:fs').unlinkSync(a) } catch { /* nada a apagar */ } }
  let ocupado = false

  async function olhar(pasta) {
    const dir = pastaDaObra(raiz, pasta)
    const l = lerJson(path.join(dir, '.atlas', 'linha.json'))
    const v = ler(pasta)
    const t = agora().getTime()
    if (!l || typeof l !== 'object') return
    if (l.estado === 'rodando' || construcao.linha.rodando(pasta)) {
      if (v && Date.parse(l.desde) && t - Date.parse(l.desde) >= TRABALHOU_MS) zerar(pasta) // trabalhou de verdade
      return
    }
    // A linha encerrou o turno ("concluiu") com a obra por terminar: no automático a obra segue sozinha (e no passo a passo também,
    // se a etapa ainda não acabou). Sem isto, a obra do Guilherme ficou "Ninguém trabalhando" depois de abrir a revisão da M1.
    if (l.estado === 'parou' && l.motivo === 'concluiu' && pctDoPlan(dir) < 100) {
      const local = lerJson(path.join(dir, '.atlas', 'estado.json')) || {}
      if (local.pausada === true) return
      const modo = (lerJson(path.join(dir, '.atlas', 'modo.json')) || {}).modo
      if (modo !== 'automatico' && modo !== 'passo-a-passo') return // sem modo escolhido: não adivinha
      const aprovadaAte = Number.isInteger(local.aprovadaAte) ? local.aprovadaAte : 0
      const completas = etapasDoPlan(dir).filter((m) => m.total && m.feitas === m.total).map((m) => m.n)
      const esperaOk = modo !== 'automatico' && completas.some((n) => n > aprovadaAte)
      if (esperaOk) return
      const fimC = String(l.fimEm || '')
      const arqSeguir = path.join(dir, '.atlas', 'seguir.json')
      const s = lerJson(arqSeguir) || {}
      if (s.fimVisto === fimC || t < (Date.parse(fimC) || 0) + SEGUIR_EM_MS) return
      if (v && v.situacao === 'precisa-voce') return
      const marca = marcaDeAvanco(dir)
      const semAvanco = s.marca && s.marca === marca ? (Number(s.semAvanco) || 0) + 1 : 0
      if (semAvanco >= MAX_SEM_AVANCO) {
        gravarAtomico(arqSeguir, JSON.stringify({ fimVisto: fimC, marca, semAvanco, em: new Date(t).toISOString() }) + '\n')
        gravar(pasta, { situacao: 'precisa-voce', tentativa: 0, de: MAX_TENTATIVAS, motivo: MOTIVO_SEM_AVANCO, fimVisto: fimC })
        anotar(pasta, 'parada', MOTIVO_SEM_AVANCO)
        return
      }
      if (semAvanco > 0 && t < (Date.parse(fimC) || 0) + ESPERA_SEM_AVANCO_MS) return
      if (await falta(pasta)) return
      try {
        await garantirKit(pasta)
        construcao.linha.religar(pasta)
        anotar(pasta, 'retomada', semAvanco ? 'O último turno não avançou; o Atlas esperou um pouco e tentou mais uma vez' : 'Seguiu sozinho para a próxima parte da obra')
        gravarAtomico(arqSeguir, JSON.stringify({ fimVisto: fimC, marca, semAvanco, em: new Date(t).toISOString() }) + '\n')
      } catch (e) {
        if (e && e.message === 'ja-rodando') return
        const falhas = (s.falhas || 0) + 1
        gravarAtomico(arqSeguir, JSON.stringify({ falhas, em: new Date(t).toISOString() }) + '\n')
        if (falhas >= MAX_TENTATIVAS) gravar(pasta, { situacao: 'precisa-voce', tentativa: falhas, de: MAX_TENTATIVAS, motivo: textoDe((e && e.message) || 'erro'), fimVisto: fimC })
      }
      return
    }
    if (l.estado !== 'parou' || !VIGIADOS.has(l.motivo) || pctDoPlan(dir) >= 100) { if (v && l.motivo !== l.motivoVisto) zerar(pasta); return }
    const fim = String(l.fimEm || '')
    if (v && v.situacao === 'precisa-voce') return
    // Esperando a pessoa: pede na hora, com o que a linha disse (tentar de novo sozinho não resolve).
    if (l.motivo === 'precisa-voce') {
      const fala = limparFala(l.fala)
      const conta = contaDaFala(fala)
      const opcoes = Array.isArray(l.opcoes) ? l.opcoes.filter((o) => o && typeof o.rotulo === 'string' && o.rotulo).slice(0, 4).map((o) => ({ rotulo: String(o.rotulo).slice(0, 80), explica: String(o.explica || '').slice(0, 200), recomendada: !!o.recomendada })) : []
      gravar(pasta, { situacao: 'precisa-voce', tentativa: 0, de: MAX_TENTATIVAS, motivo: opcoes.length ? 'A obra precisa que você escolha como seguir.' : fala ? 'A obra está esperando uma coisa que só você pode fazer.' : 'A obra está esperando você.', ...(fala ? { fala } : {}), ...(conta ? { conta } : {}), ...(opcoes.length ? { opcoes } : {}), fimVisto: fim })
      return
    }
    let estado = v && v.fimVisto === fim ? v : null
    if (!estado) {
      const tentativa = v ? v.tentativa : 0
      if (tentativa >= MAX_TENTATIVAS) { gravar(pasta, { situacao: 'precisa-voce', tentativa, de: MAX_TENTATIVAS, motivo: textoDe(v && v.codigo ? v.codigo : l.motivo), fimVisto: fim }); return }
      const base = Number.isFinite(Date.parse(fim)) ? Date.parse(fim) : t // conta a espera a partir de quando parou
      estado = { situacao: 'tentando', tentativa, de: MAX_TENTATIVAS, motivo: textoDe(l.motivo), codigo: l.motivo, fimVisto: fim, proximaEm: new Date(base + BACKOFF_MIN[tentativa] * 60_000).toISOString() }
      gravar(pasta, estado)
    }
    if (t < Date.parse(estado.proximaEm)) return
    const motivoFalta = await falta(pasta)
    if (motivoFalta) { // sem condição de trabalhar: espera sem gastar tentativa (religar agora só queimaria cota)
      gravar(pasta, { ...estado, motivo: motivoFalta, proximaEm: new Date(t + 60_000).toISOString() })
      return
    }
    const tentativa = estado.tentativa + 1
    try {
      await garantirKit(pasta)
      construcao.linha.religar(pasta)
      anotar(pasta, 'retomada', `O Atlas religou a obra sozinho (tentativa ${tentativa} de ${MAX_TENTATIVAS})`)
      gravar(pasta, { situacao: 'tentando', tentativa, de: MAX_TENTATIVAS, motivo: estado.motivo, codigo: estado.codigo, fimVisto: 'religou', religouEm: new Date(t).toISOString() })
    } catch (e) {
      const cod = e && e.message === 'ja-rodando' ? null : (e && e.message) || 'erro'
      if (!cod) return // outra obra está construindo: espera a vez sem gastar tentativa
      const prox = tentativa < MAX_TENTATIVAS ? new Date(t + BACKOFF_MIN[tentativa] * 60_000).toISOString() : null
      gravar(pasta, prox
        ? { situacao: 'tentando', tentativa, de: MAX_TENTATIVAS, motivo: textoDe(cod), codigo: cod, fimVisto: fim, proximaEm: prox }
        : { situacao: 'precisa-voce', tentativa, de: MAX_TENTATIVAS, motivo: textoDe(cod), codigo: cod, fimVisto: fim })
    }
  }

  return {
    /** Uma passada em todas as obras (o main chama a cada minuto). Nunca lança. */
    async rodada() {
      if (ocupado) return
      ocupado = true
      try { for (const p of await listar()) { try { await olhar(p) } catch { /* uma obra com problema não para as outras */ } } } finally { ocupado = false }
    },
    /** O que o painel mostra: null (nada a dizer), 'tentando' (com tentativa e próxima hora) ou 'precisa-voce' (com o motivo). */
    estado(pasta) {
      const v = ler(pasta)
      if (!v) return null
      return { situacao: v.situacao === 'precisa-voce' ? 'precisa-voce' : 'tentando', tentativa: Number(v.tentativa) || 0, de: MAX_TENTATIVAS, motivo: String(v.motivo || ''), ...(v.proximaEm ? { proximaEm: v.proximaEm } : {}), ...(typeof v.fala === 'string' && v.fala ? { fala: v.fala } : {}), ...(v.conta ? { conta: v.conta } : {}), ...(Array.isArray(v.opcoes) && v.opcoes.length ? { opcoes: v.opcoes.map((o) => ({ rotulo: String(o.rotulo), explica: String(o.explica || ''), recomendada: !!o.recomendada })) } : {}), ...(Array.isArray(v.checagens) ? { checagens: v.checagens.filter((c) => c && typeof c.nome === 'string').map((c) => ({ nome: String(c.nome), ok: !!c.ok, ...(c.dica ? { dica: String(c.dica) } : {}) })) } : {}) }
    },
    /** "Tentar agora" do cliente: começa do zero (inclusive a conta de turnos sem avanço). */
    zerar(pasta) { zerar(pasta); try { require('node:fs').unlinkSync(path.join(pastaDaObra(raiz, pasta), '.atlas', 'seguir.json')) } catch { /* não havia */ } },
  }
}

module.exports = { criarVigia, limparFala, BACKOFF_MIN, MAX_TENTATIVAS }
