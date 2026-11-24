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
const limparFala = (f) => String(f || '').replace(/^[\s\S]*?USU[AÁ]RIO\s*:\s*/i, '').trim().slice(0, 300)

function pctDoPlan(dir) {
  const t = lerTexto(path.join(dir, 'PLAN.md'), 400_000)
  if (t === null) return 0
  let total = 0, feitas = 0
  for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*[-*]\s+\[( |x|X)\]/); if (m) { total++; if (m[1] !== ' ') feitas++ } }
  return total ? (feitas / total) * 100 : 0
}

function criarVigia({ raiz, construcao, garantirKit, listar, agora = () => new Date(), aoPrecisar = () => {} }) {
  const arq = (pasta) => path.join(pastaDaObra(raiz, pasta), '.atlas', 'vigia.json')
  const ler = (pasta) => { try { const v = lerJson(arq(pasta)); return v && typeof v === 'object' ? v : null } catch { return null } }
  const gravar = (pasta, v) => {
    try { gravarAtomico(arq(pasta), JSON.stringify(v) + '\n') } catch { /* sem registro: tenta na próxima */ }
    if (v.situacao === 'precisa-voce') { try { aoPrecisar(pasta, v.motivo) } catch { /* aviso é extra */ } }
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
    if (l.estado !== 'parou' || !VIGIADOS.has(l.motivo) || pctDoPlan(dir) >= 100) { if (v && l.motivo !== l.motivoVisto) zerar(pasta); return }
    const fim = String(l.fimEm || '')
    if (v && v.situacao === 'precisa-voce') return
    // Esperando a pessoa: pede na hora, com o que a linha disse (tentar de novo sozinho não resolve).
    if (l.motivo === 'precisa-voce') {
      const fala = limparFala(l.fala)
      const conta = contaDaFala(fala)
      gravar(pasta, { situacao: 'precisa-voce', tentativa: 0, de: MAX_TENTATIVAS, motivo: fala ? 'A obra está esperando uma coisa que só você pode fazer.' : 'A obra está esperando você.', ...(fala ? { fala } : {}), ...(conta ? { conta } : {}), fimVisto: fim })
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
    const tentativa = estado.tentativa + 1
    try {
      await garantirKit(pasta)
      construcao.linha.religar(pasta)
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
      return { situacao: v.situacao === 'precisa-voce' ? 'precisa-voce' : 'tentando', tentativa: Number(v.tentativa) || 0, de: MAX_TENTATIVAS, motivo: String(v.motivo || ''), ...(v.proximaEm ? { proximaEm: v.proximaEm } : {}), ...(typeof v.fala === 'string' && v.fala ? { fala: v.fala } : {}), ...(v.conta ? { conta: v.conta } : {}) }
    },
    /** "Tentar agora" do cliente: começa do zero. */
    zerar,
  }
}

module.exports = { criarVigia, BACKOFF_MIN, MAX_TENTATIVAS }
