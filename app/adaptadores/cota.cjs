// Adaptador real do PonteCota (src/app/ponte-cota.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  Pausa por cota NÃO é erro: a obra espera sozinha e volta sozinha. Este adaptador só decide TRÊS coisas, sempre fail-closed
//  (na dúvida, "pausado por cota" calmo; nunca finge que voltou):
//  1. esgotada: a linha da obra parou por cota. A fonte é <obra>\.atlas\linha.json (escrito por construcao.cjs quando o stream do
//     Claude traz um SINAL ESTRUTURADO de limite; ver detectarCota) ou uma ocorrência aberta de cota no livro do kit. Linha rodando = não esgotada.
//  2. voltaEm: hora ESTIMADA da renovação, só se o próprio Claude disse (epoch no sinal do stream ou liberar_em da ocorrência). Senão null.
//  3. renovada: o Claude voltou a responder? Só um TESTE BARATO real diz: `claude -p` com um pedido trivial, sem ferramentas, numa
//     pasta neutra do app (nunca a obra), args fixos, env mínimo, timeout. Só "resposta normal, sem erro, sem sinal de limite" vira
//     renovada=true. Erro, limite, timeout, JSON estranho, CLI ausente = false. O horário NÃO libera nada: só o teste.
//     O teste é espaçado (15 min antes do horário estimado, 3 min depois dele) para gastar quase nada da cota.
//  retomar(pasta): confere de novo (teste forçado). Se o cliente pausou à mão, respeita a pausa e não religa. Senão religa a linha
//    do ponto em que parou por painel.continuar (tira a pausa, reafirma o modo, liga /construir) e avisa (opcional).
//    Não renovou: lança 'cota-nao-renovou' e NADA muda.
//  vigiar(): para o app ligado depois (ou esquecido): varre as obras que o APP registrou como paradas por cota e retoma as que
//    renovaram, sem clique. Pausa do cliente, obra pronta (100%) e outras paradas (erro, ocorrência) NUNCA são retomadas por aqui.
//
//  EXIBIR x PERMITIR (confiança): a pasta da obra é escrita pelo Claude da obra; ele pode forjar linha.json/ocorrencias.json.
//   - EXIBIÇÃO (ler/tela de cota): pode olhar linha.json e ocorrencias.json (no máximo mostra uma tela de espera a mais).
//   - PERMISSÃO de religar SOZINHO (vigiar/automatico): vem SÓ do registro do app, FORA da obra (userData\cota\paradas.json,
//     cota-store.cjs), escrito só pelo processo principal ao fim de uma linha que o app iniciou. O clique do cliente em "Retomar"
//     é consentimento explícito: pode usar a fonte ampla, mas sempre passa pelo teste barato.
//   LIMITE honesto: sem sandbox do SO o Claude poderia escrever no userData; isto tira a confiança da obra e fecha o caso comum.
//
//  Sinal de cota do stream (detectarCota): padrões ESTRUTURADOS do `claude -p --output-format stream-json`, não "cota" solto:
//   (a) evento rate_limit_event com status 'rejected' (+ resetsAt); (b) resultado is_error com a frase de limite do Claude
//   ("Claude AI usage limit reached|<epoch>", "You've hit your limit", "5-hour limit reached"...); (c) mensagem do assistente com
//   error:'rate_limit' (sinal FRACO: só vale se a linha acabou com falha). A CONFIRMAR com o CLI do cliente: os nomes exatos dos
//   campos mudam entre versões (testado só com fixtures; versão local 2.1.322). Texto que não é desses formatos NÃO conta.
//
//  AVISO AO CELULAR ("a obra voltou sozinha"): depende da conexão do Remote Control (PonteCelular, pendência documentada em
//  celular.cjs). Sem canal, `avisar` é opcional e não finge: a obra volta mesmo assim e o app mostra no painel.
//
// COMO TESTAR (Windows, Claude logado): esgotar a cota de verdade é caro; o caminho é `node --test app/adaptadores/*.teste.cjs`
// (fixtures do stream e CLI simulado). Na máquina: com linha.json {"estado":"parou","motivo":"cota"} numa obra, abrir o app:
// a tela de cota aparece e, quando `claude -p "ok"` responde, a obra religa sozinha.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { caminhoSeguro, envMinimo, executarClaude, resolverClaude } = require('../seguro.cjs')
const { NOME_PASTA, pastaDaObra, gravarAtomico, lerJson, lerTexto } = require('./obra-fs.cjs')
const { comoDado } = require('./plan-md.cjs')
const { lerPlanoDoTexto, paradaDeOcorrencias } = require('./painel.cjs')
const { criarLojaDeParadas } = require('./cota-store.cjs')

const MIN = 60_000
// Palavra inteira (não casa "cotação", "escota").
const RE_COTA = /(?<!\p{L})(?:cota|limite de uso|usage limit|rate.?limit)(?!\p{L})/iu
const FRASES_LIMITE = [
  /^\s*claude(?: ai)? usage limit reached/i,
  /\byou(?:'|’)ve (?:hit|reached) your (?:[\w-]+ ){0,3}limit/i,
  /\b(?:5-hour|five-hour|weekly|session|usage) limit (?:reached|hit|exceeded)\b/i,
  /\bout of (?:extra )?usage\b/i,
]

/** epoch (segundos ou milissegundos) -> ISO, só se for uma data plausível (de ontem a 35 dias). */
function epochParaIso(valor, agora = new Date()) {
  const n = typeof valor === 'string' && /^\d{9,13}$/.test(valor) ? Number(valor) : valor
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  const ms = n > 1e11 ? n : n * 1000
  const t = agora.getTime()
  if (ms < t - 86_400_000 || ms > t + 35 * 86_400_000) return null
  return new Date(ms).toISOString()
}

/**
 * Uma linha do stream-json já parseada -> null (nada de cota) ou { forca: 'forte'|'fraca', voltaEm: ISO|null }.
 * Só formatos estruturados; um texto qualquer que fale de "cota" NÃO é sinal.
 */
function detectarCota(j, agora = new Date()) {
  if (!j || typeof j !== 'object') return null
  if (j.type === 'rate_limit_event') {
    const info = j.rate_limit_info
    if (info && typeof info === 'object' && info.status === 'rejected') return { forca: 'forte', voltaEm: epochParaIso(info.resetsAt, agora) }
    return null
  }
  if (j.type === 'result' && j.is_error === true && typeof j.result === 'string') {
    const t = j.result.slice(0, 600)
    if (FRASES_LIMITE.some((re) => re.test(t))) {
      const m = /\|\s*(\d{9,13})\s*$/.exec(t)
      return { forca: 'forte', voltaEm: m ? epochParaIso(m[1], agora) : null }
    }
    return null
  }
  if (j.type === 'assistant' && j.error === 'rate_limit') return { forca: 'fraca', voltaEm: null }
  return null
}

/** O que a saída `--output-format json` do teste barato significa. 'renovada' só com resposta normal e sem nenhum sinal de limite. */
function lerResultadoDoTeste(saida, agora = new Date()) {
  let j
  try { j = JSON.parse(String(saida)) } catch { return { estado: 'incerto', voltaEm: null } }
  if (Array.isArray(j)) j = j.find((x) => x && x.type === 'result') || null
  if (!j || typeof j !== 'object') return { estado: 'incerto', voltaEm: null }
  const c = detectarCota(j, agora)
  if (c) return { estado: 'esgotada', voltaEm: c.voltaEm }
  if (j.type === 'result' && j.is_error === false && typeof j.result === 'string' && j.result.trim()) return { estado: 'renovada', voltaEm: null }
  return { estado: 'incerto', voltaEm: null }
}

const PEDIDO_TESTE = 'Responda somente com a palavra: ok'
const ARGS_TESTE = ['-p', '--output-format', 'json', '--max-turns', '1', '--setting-sources', 'user', '--strict-mcp-config',
  '--disallowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Task,WebFetch,WebSearch,NotebookEdit']

/** Primeira tarefa pendente da etapa em que a obra está (DADO da obra: normalizado para uma linha). */
function ondeParou(textoPlan) {
  const p = lerPlanoDoTexto(textoPlan)
  const m = p.milestones.find((x) => x.n === p.proximo)
  if (!m) return null
  let dentro = false
  let tarefa = ''
  for (const l of textoPlan.split(/\r?\n/)) {
    const h = l.match(/^##\s+(?:Milestone\s+|M)(\d+)\s*[—–:-]/i)
    if (h) { dentro = Number(h[1]) === m.n; continue }
    if (dentro && /^\s*[-*]\s+\[ \]/.test(l)) { tarefa = l.replace(/^\s*[-*]\s+\[ \]\s*/, ''); break }
  }
  return { etapa: `M${m.n}`, tarefa: comoDado(tarefa, 240).join(' ').slice(0, 120) || comoDado(m.titulo, 240).join(' ').slice(0, 120) }
}

const isoValido = (s) => (typeof s === 'string' && !Number.isNaN(new Date(s).getTime()) ? new Date(s).toISOString() : null)

/**
 * `deps`: { raiz, construcao (.linha), painel (continuar/ler), claudeEstado, dadosApp, avisar?, agora?, executar?, resolver? }
 * `garantirKit(pasta)` (kit.garantir): chamado ANTES de religar a linha (retomada sozinha incluída); se falhar, nada é religado.
 * `executar`/`resolver` existem para teste (padrão: seguro.cjs).
 */
function criarCota({ raiz, construcao, painel, claudeEstado, dadosApp = path.join(path.dirname(raiz), '.atlas-app'), avisar = async () => {}, garantirKit = null, agora = () => new Date(), executar = executarClaude, resolver = resolverClaude }) {
  /** pasta -> { quando: ms, estado, voltaEm } (último teste barato) */
  const testes = new Map()
  const paradas = criarLojaDeParadas({ raiz, dadosApp }) // registro do APP (fora da obra): só ele autoriza religar sozinho
  const lerLinha = (pasta) => {
    const l = lerJson(caminhoSeguro(raiz, pasta, '.atlas', 'linha.json'))
    return l && typeof l === 'object' ? l : null
  }

  /** O Claude voltou a responder? Nunca lança: qualquer dúvida = 'incerto'. */
  async function sondar() {
    try {
      if (!resolver(process.env)) return { estado: 'incerto', voltaEm: null }
      let e = null
      try { e = await claudeEstado() } catch { /* sem estado: tenta assim mesmo */ }
      if (e && e.conectado === false) return { estado: 'incerto', voltaEm: null }
      fs.mkdirSync(dadosApp, { recursive: true })
      const neutra = path.join(dadosApp, 'cota', 'cota-teste')
      fs.mkdirSync(neutra, { recursive: true })
      const r = await executar(ARGS_TESTE, { cwd: neutra, entrada: PEDIDO_TESTE, timeoutMs: 90_000, maxSaida: 200_000, env: envMinimo() })
      return lerResultadoDoTeste(r.saida, agora())
    } catch { return { estado: 'incerto', voltaEm: null } }
  }

  async function testarSePrecisa(pasta, voltaEm, { forcar = false } = {}) {
    const t = testes.get(pasta)
    const agoraMs = agora().getTime()
    const antesDoHorario = voltaEm && new Date(voltaEm).getTime() - 2 * MIN > agoraMs
    // Economia (24/11/2026): cada teste é uma chamada ao Claude. Com a hora da volta conhecida, não testa antes dela.
    if (!forcar && antesDoHorario) return t && t.estado !== 'renovada' ? t : { quando: agoraMs, estado: 'esgotada', voltaEm }
    const intervalo = 3 * MIN
    if (!forcar && t && agoraMs - t.quando < intervalo) return t
    const r = await sondar()
    const novo = { quando: agoraMs, estado: r.estado, voltaEm: r.voltaEm }
    testes.set(pasta, novo)
    return novo
  }

  /** EXIBIÇÃO: parece parada por cota (e não está rodando)? Fonte ampla (linha.json, ocorrência aberta). NÃO autoriza religar sozinho. */
  function paradaPorCota(pasta) {
    if (construcao.linha.rodando(pasta)) return null
    const fim = lerLinha(pasta)
    if (fim && fim.estado === 'parou' && fim.motivo === 'cota') return { voltaEm: isoValido(fim.voltaEm) }
    const livro = lerJson(caminhoSeguro(raiz, pasta, 'docs', 'ocorrencias.json'))
    if (paradaDeOcorrencias(livro) === 'cota') {
      const o = (livro.ocorrencias || []).find((x) => x && x.status === 'aberta' && RE_COTA.test(`${x.servico ?? ''} ${x.motivo ?? ''}`))
      return { voltaEm: isoValido(o && o.liberar_em) }
    }
    return null
  }

  /** PERMISSÃO: o app registrou esta parada por cota? (e a linha não roda). Devolve { voltaEm } ou null. */
  function registroDoApp(pasta) {
    if (construcao.linha.rodando(pasta)) return null
    const r = paradas.obter(pasta)
    return r ? { voltaEm: isoValido(r.voltaEm) } : null
  }

  const pctDa = (pasta) => {
    const t = lerTexto(path.join(pastaDaObra(raiz, pasta), 'PLAN.md'))
    return t === null ? null : lerPlanoDoTexto(t).pct
  }

  /**
   * true se religou a linha; false se não havia o que retomar, a obra está pronta ou o cliente tinha pausado; lança 'cota-nao-renovou'.
   * `automatico` (vigia, sem clique): EXIGE o registro do app. Sem ele (clique do cliente), vale a fonte ampla.
   */
  async function religar(pasta, { automatico = false } = {}) {
    pastaDaObra(raiz, pasta)
    const parada = automatico ? registroDoApp(pasta) : (registroDoApp(pasta) || paradaPorCota(pasta))
    if (!parada) return false // nada a retomar (já voltou, nunca foi cota, ou o app não registrou)
    const pct = pctDa(pasta)
    if (pct !== null && pct >= 100) { paradas.apagar(pasta); return false }
    if (automatico && (await painel.ler(pasta)).pausadaPorVoce) return false
    const t = await testarSePrecisa(pasta, null, { forcar: !automatico })
    if (t.estado !== 'renovada') throw new Error('cota-nao-renovou') // fail-closed: nada muda
    const estado = await painel.ler(pasta)
    if (estado.pausadaPorVoce) return false // o cliente pausou à mão: a retomada respeita
    if (typeof garantirKit === 'function') await garantirKit(pasta) // sem o kit não religa (lança = nada muda, registro de parada fica)
    await painel.continuar(pasta)
    paradas.apagar(pasta)
    testes.delete(pasta)
    try { await avisar(pasta, 'A obra voltou sozinha.') } catch { /* sem canal: o painel já mostra */ }
    return true
  }

  const api = {
    async ler(pasta) {
      const cwd = pastaDaObra(raiz, pasta)
      const parada = paradaPorCota(pasta)
      const textoPlan = lerTexto(path.join(cwd, 'PLAN.md'))
      const parouEm = parada && textoPlan !== null ? ondeParou(textoPlan) : null
      let plano = null
      try { const e = await claudeEstado(); if (e && (e.plano === 'pro' || e.plano === 'max')) plano = e.plano } catch { /* plano desconhecido */ }
      if (!parada) return { esgotada: false, voltaEm: null, renovada: false, plano, parouEm: null }
      const t = await testarSePrecisa(pasta, parada.voltaEm)
      return { esgotada: true, voltaEm: t.voltaEm || parada.voltaEm, renovada: t.estado === 'renovada', plano, parouEm }
    },

    async retomar(pasta) { await religar(pasta) },

    /** Para o app ligado depois / esquecido: retoma sozinho as obras paradas POR COTA cujo Claude já respondeu. Devolve as pastas retomadas. */
    async vigiar() {
      let nomes
      try { nomes = fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.isSymbolicLink() && NOME_PASTA.test(d.name)).map((d) => d.name) } catch { return [] }
      const feitas = []
      for (const pasta of nomes) {
        try {
          const parada = registroDoApp(pasta) // só pastas COM registro do app; linha.json/ocorrências da obra não autorizam
          if (!parada) continue
          const pct = pctDa(pasta)
          if (pct === null || pct >= 100) { if (pct !== null) paradas.apagar(pasta); continue }
          if ((await painel.ler(pasta)).pausadaPorVoce) continue
          const t = await testarSePrecisa(pasta, parada.voltaEm)
          if (t.estado !== 'renovada') continue
          if (await religar(pasta, { automatico: true })) feitas.push(pasta)
        } catch { /* uma obra com problema não derruba a vigia */ }
      }
      return feitas
    },
  }
  return api
}

module.exports = { criarCota, detectarCota, epochParaIso, lerResultadoDoTeste, ondeParou, ARGS_TESTE, FRASES_LIMITE }
