// M65 — O Atlas não constrói outro Atlas (decisão do Luiz, 25/11/2026; telas prototipo/caminho-novo/AC1Politica … AC5Embargada).
// O que é bloqueado: um sistema que transforma ideia/protótipo em plano de construção e põe agentes de IA para construir software.
// O que pode: chatbot, app ou site que USA IA (atendimento, textos, orçamento, resumo).
//
// Camadas (todas aprovadas pelo Luiz):
//  1. Termos de uso (servidor/web).
//  2. Porteiro na ideia e no pós-obra: o próprio Claude que já lê o pedido responde também "politica" (ideia.cjs, posobra.cjs) —
//     sem chamada a mais. O texto de REGRA_POLITICA é o mesmo nos dois.
//  3. O porteiro olha a obra inteira: no pós-obra o Claude lê a obra (telas, regras, código) e o histórico dos pedidos.
//  4. Sinais no código, sem IA (conferirCodigo): a obra passa a usar agentes de programação (SDK do Claude Code/Agent SDK, CLI do
//     Claude em modo não interativo, Codex, Aider…). Conferido antes de ligar a linha (garantirObra no main). O SDK comum da Anthropic
//     ou da OpenAI (chatbot) NÃO é sinal.
//  5. Registro e embargo no SERVIDOR (fonte da verdade): registrar() a cada bloqueio; a partir do 2º bloqueio da mesma obra o servidor
//     embarga aquela obra e para de entregar o kit dela (kit.cjs → 'obra-embargada'). A equipe decide no painel.
// Nunca guarda o texto do cliente em disco; o servidor limpa segredos de novo.
//
// COMO TESTAR: `node --test app/adaptadores/politica.teste.cjs`.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { caminhoSeguro } = require('../seguro.cjs')

const CHAVE_COFRE = 'atlas/dispositivo'
const ONDES = ['ideia', 'prototipo', 'planilha', 'posobra', 'codigo']

/** Regra mostrada ao Claude (ideia e pós-obra). O cliente nunca vê isto; é só a pergunta da política. */
const REGRA_POLITICA = [
  'POLÍTICA DO ATLAS: julgue também se o sistema pedido (somado a tudo o que a obra já é) vira um SISTEMA QUE CONSTRÓI SISTEMAS:',
  'recebe ideias ou protótipos de outras pessoas, monta um plano/etapas de construção de software e põe agentes de IA para programar',
  'e construir esse software (com ou sem painel de andamento). Isso é BLOQUEADO. NÃO é bloqueado: chatbot, atendimento, site, loja,',
  'orçamento, resumo, textos ou imagens feitos por IA, nem qualquer sistema que USA IA para o próprio negócio do cliente.',
  'Na dúvida entre os dois, NÃO bloqueie.',
].join(' ')

/** {bloqueia, sinais} a partir do JSON do Claude. Qualquer coisa estranha = não bloqueia (as outras camadas seguem valendo). */
function politicaDoJson(j) {
  const p = j && typeof j === 'object' ? j.politica : null
  if (!p || typeof p !== 'object' || p.bloqueia !== true) return { bloqueia: false, sinais: [] }
  const sinais = (Array.isArray(p.sinais) ? p.sinais : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 5).map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 120))
  return { bloqueia: true, sinais: sinais.length ? sinais : ['Constrói outros sistemas com agentes de IA'] }
}

// ── Camada 4: sinais no código (determinístico, sem IA) ─────────────────────────────────────────────────────────────────────
const PACOTES = [/^@anthropic-ai\/claude-code$/, /^@anthropic-ai\/claude-agent-sdk$/, /^@anthropic-ai\/claude-code-sdk$/, /^@openai\/codex/, /^aider/, /^@?openhands/, /^gpt-engineer/, /^@?smol-ai\/developer/]
const TRECHOS = [
  { re: /["'`]claude["'`]\s*,\s*\[[^\]]*["'`]-p["'`]/, sinal: 'O sistema roda o Claude Code para programar' },
  { re: /\bclaude\s+(-p|--print)\b[^\n]{0,80}--(permission-mode|dangerously-skip-permissions|allowedTools)/, sinal: 'O sistema roda o Claude Code para programar' },
  { re: /\bfrom\s+["']@anthropic-ai\/claude-(agent|code)-sdk["']|require\(\s*["']@anthropic-ai\/claude-(agent|code)-sdk["']\s*\)/, sinal: 'O sistema usa o kit de agentes que programam' },
  { re: /\bcodex\s+exec\b/, sinal: 'O sistema roda um agente que programa' },
]
const PASTAS_CODIGO = ['src', 'app', 'api', 'server', 'lib', 'supabase/functions', 'functions', 'scripts']
const EXT = /\.(c|m)?(j|t)sx?$|\.py$/

function* arquivosDeCodigo(raizObra, limite = 3000) {
  let n = 0
  const pilha = PASTAS_CODIGO.map((p) => path.join(raizObra, p)).filter((p) => { try { return fs.lstatSync(p).isDirectory() } catch { return false } })
  while (pilha.length && n < limite) {
    const dir = pilha.pop()
    let itens = []
    try { itens = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const it of itens) {
      if (it.isSymbolicLink() || it.name === 'node_modules' || it.name.startsWith('.')) continue
      const p = path.join(dir, it.name)
      if (it.isDirectory()) pilha.push(p)
      else if (it.isFile() && EXT.test(it.name)) { n++; yield p }
    }
  }
}

/** Sinais de "sistema que constrói sistemas" no código da obra (lista vazia = nada). */
function sinaisNoCodigo(raizObra) {
  const sinais = new Set()
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(raizObra, 'package.json'), 'utf8'))
    const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.optionalDependencies || {}) })
    if (deps.some((d) => PACOTES.some((re) => re.test(d)))) sinais.add('O sistema usa um agente de IA que programa')
  } catch { /* sem package.json */ }
  for (const arq of arquivosDeCodigo(raizObra)) {
    let t = ''
    try { const st = fs.statSync(arq); if (st.size > 400_000) continue; t = fs.readFileSync(arq, 'utf8') } catch { continue }
    for (const { re, sinal } of TRECHOS) if (re.test(t)) sinais.add(sinal)
    if (sinais.size >= 3) break
  }
  return [...sinais]
}

/**
 * deps: { raiz, cofre, hashComputador, api = ATLAS_API_URL, buscar = fetch }
 */
function criarPolitica({ raiz, cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch }) {
  const base = (() => {
    if (typeof api !== 'string' || !api) return null
    try { const u = new URL(api); return u.protocol === 'https:' && !u.username && !u.password ? u.toString().replace(/\/+$/, '') : null } catch { return null }
  })()

  async function chamar(rota, corpo) {
    if (!base || typeof buscar !== 'function') throw new Error('indisponivel')
    let ativ = null
    try { const g = JSON.parse((await cofre.ler(CHAVE_COFRE)) ?? 'null'); if (g && typeof g.token === 'string' && g.token) ativ = g } catch { /* sem licença */ }
    if (!ativ) throw new Error('indisponivel')
    const r = await buscar(`${base}${rota}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': ativ.token },
      body: JSON.stringify({ email: typeof ativ.email === 'string' ? ativ.email : '', computador_hash: await hashComputador(), ...corpo }),
    })
    let d = null
    try { d = await r.json() } catch { d = null }
    if (!r.ok) throw new Error(d && typeof d.erro === 'string' ? d.erro : 'indisponivel')
    return d
  }
  const obraValida = (o) => typeof o === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(o)

  return {
    /** Pedido bloqueado: anota no servidor. Devolve 'livre' | 'embargada' | 'recusada' (null = servidor fora: segue só o bloqueio local). */
    async registrar(obraId, onde, texto) {
      if (!obraValida(obraId) || !ONDES.includes(onde)) return null
      try { return (await chamar('/politica/registrar', { obra_id: obraId, onde, texto: String(texto || '').slice(0, 1200) || '(sem texto)' })).situacao || null } catch { return null }
    },
    /** "Acha que é engano? Explique". */
    async analise(obraId, texto) {
      if (!obraValida(obraId)) throw new Error('obra-invalida')
      const t = String(texto || '').trim().slice(0, 1200)
      if (!t) throw new Error('texto-vazio')
      await chamar('/politica/analise', { obra_id: obraId, texto: t })
      return { ok: true }
    },
    async situacao(obraId) {
      if (!obraValida(obraId)) return 'livre'
      try { return (await chamar('/politica/situacao', { obra_id: obraId })).situacao || 'livre' } catch { return 'livre' }
    },
    /** Camada 4: antes de ligar a linha. Sinal no código => registra e recusa ('politica-bloqueado'). */
    async conferirCodigo(pasta) {
      let cwd
      try { cwd = caminhoSeguro(raiz, String(pasta)) } catch { return [] }
      const sinais = sinaisNoCodigo(cwd)
      if (sinais.length === 0) return []
      const s = await this.registrar(String(pasta), 'codigo', `Sinais no código: ${sinais.join('; ')}`)
      throw new Error(s === 'embargada' ? 'obra-embargada' : s === 'recusada' ? 'uso-recusado' : 'politica-bloqueado')
    },
  }
}

module.exports = { criarPolitica, sinaisNoCodigo, politicaDoJson, REGRA_POLITICA }
