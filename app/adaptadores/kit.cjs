// Adaptador real do PonteKit (src/kit/entrega-kit.ts) — processo principal do Electron (só Windows).
// Espelha em CommonJS a validação de montarKitDaObra/avisoNoTopo/caminhoSeguro do kit (manter em sincronia; o teste compara com o TypeScript).
//
// O QUE FAZ
//  entregar(obraId): baixa o kit DAQUELA obra do servidor de licenças (POST {ATLAS_API_URL}/entregar-kit, token do dispositivo SÓ do
//    cofre, https, sem redirect, timeout), confere que TODO arquivo tem o aviso de licença (Lei 9.609/98) e a mesma marca do cliente
//    no topo e que cada caminho é seguro, e monta um PLUGIN do Claude Code numa pasta TEMPORÁRIA do app: <userData>\kit-temp\<hash>\
//    (fora do repositório e da pasta da obra do cliente). `.claude/agents|skills|hooks|commands/x` vira `<plugin>/agents|skills|hooks|
//    commands/x`; qualquer outro caminho derruba a entrega (falha fechada). O app escreve só `.claude-plugin/plugin.json`.
//  diretorio(obraId): caminho do plugin (síncrono) ou null. É o que a linha de produção recebe em `--plugin-dir` (construcao.cjs).
//    O caminho NUNCA vai ao renderer; a tela só recebe { ok, obraId, marca } e `descartar`.
//  garantir(obraId): usado ANTES de ligar/religar a linha (o app pode ter fechado e o kit foi descartado): baixa de novo se faltar.
//    Sem ATLAS_API_URL devolve null (modo antigo: ATLAS_KIT_PLUGIN); com API e falha lança 'kit-indisponivel' (não roda sem kit).
//  descartar(obraId) / descartarTudo(): apagam a pasta. descartarTudo roda ao abrir e ao fechar o app (sobra de queda de energia).
//
// LIMITE HONESTO: o Claude Code só carrega agentes/skills de uma PASTA, então o kit precisa existir em disco enquanto a linha roda
// (pasta do app, apagada ao fechar). Não existe "só em memória" nem plugin sem arquivo. Isto NÃO impede o cliente de abrir essa pasta
// enquanto a obra roda; a proteção real é a marca d'água HMAC por cliente + aviso em cada arquivo (Lei 9.609/98).
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (kit.teste.cjs: servidor simulado). No Windows (pendência de máquina real):
// com ATLAS_API_URL e o app ativado, iniciar uma obra deve criar <userData>\kit-temp\<hash>\ com agents/skills/hooks e, ao fechar o
// app, a pasta some; a pasta da obra continua sem .claude.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')

const LEI = 'Lei 9.609/98'
const CHAVE_COFRE = 'atlas/dispositivo' // igual a CHAVE_COFRE de src/app/ativacao-api.ts
const OBRA_ID = /^[\w.-]{1,80}$/
const RAIZES = ['agents', 'skills', 'hooks', 'commands']
/** Os scripts do kit que a /construir e os agentes rodam (etapa, livro de ocorrências, avanço). */
const FERRAMENTAS_DO_KIT = ['etapa', 'ocorrencias', 'progresso', 'revisores']

/** As instruções do kit foram escritas para um projeto com .claude; na obra do Atlas não há .claude (a linha nem liga com ele):
 *  os scripts e as skills ficam no plugin, e o estado da construção vai para .atlas/roteiro.json. A pasta do usuário (~/.claude) fica. */
function paraOPlugin(texto, raizKit) {
  return texto
    .replace(/node \.claude\/hooks\/([a-z][a-z0-9-]*\.cjs)/g, (_m, arq) => `node "${raizKit}/hooks/${arq}"`)
    .replace(/(^|[^~\w/])\.claude\/skills\//g, (_m, antes) => `${antes}${raizKit}/skills/`)
    .replace(/(^|[^~\w/])\.claude\/roteiro\.json/g, (_m, antes) => `${antes}.atlas/roteiro.json`)
}
const LIM = { arquivos: 400, arquivo: 1_000_000, total: 8_000_000, resposta: 12_000_000, profundidade: 6 }
const RESERVADO = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i
const NOME_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

/** hooks.json do plugin: cada evento do Claude vira uma linha em <obra>/.canteiro/eventos.jsonl (evento.cjs; nunca bloqueia). */
function hooksDoCanteiro() {
  const cmd = { type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/evento.cjs"', timeout: 5 }
  const hooks = {}
  for (const ev of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'UserPromptSubmit']) hooks[ev] = [{ hooks: [cmd] }]
  return { description: 'Atlas: andamento da obra no canteiro', hooks }
}

/** Espelho de avisoNoTopo (src/kit/entrega-kit.ts). */
function avisoNoTopo(caminho, conteudo, marca) {
  if (caminho.toLowerCase().endsWith('.json')) {
    try {
      const o = JSON.parse(conteudo)
      return typeof o._licenca === 'string' && o._licenca.includes(LEI) && o._marca === marca && Object.keys(o)[0] === '_licenca'
    } catch { return false }
  }
  const topo = conteudo.split(/\r?\n/).slice(0, 4).join('\n')
  return topo.includes(LEI) && topo.includes(marca)
}

/** `.claude/<raiz>/...` -> partes dentro do plugin (`[raiz, ...]`) ou null. Rígido: o kit nunca escreve fora do lugar combinado. */
function destinoNoPlugin(caminho) {
  if (typeof caminho !== 'string' || !caminho || caminho.length > 300 || /[\\\0:]/.test(caminho) || caminho.startsWith('/')) return null
  const partes = caminho.split('/')
  if (partes.length < 3 || partes.length > LIM.profundidade + 2 || partes[0] !== '.claude' || !RAIZES.includes(partes[1])) return null
  const resto = partes.slice(1)
  for (const p of resto) if (!NOME_OK.test(p) || p.endsWith('.') || RESERVADO.test(p)) return null
  return resto
}

/** Valida a resposta do servidor. Devolve { marca, arquivos:[{partes, conteudo}] } ou lança 'kit-invalido'. */
function validarResposta(resp) {
  const invalido = () => new Error('kit-invalido')
  if (!resp || typeof resp.marca_dagua !== 'string' || resp.marca_dagua.length < 8 || resp.marca_dagua.length > 200 || !Array.isArray(resp.arquivos) || !resp.arquivos.length || resp.arquivos.length > LIM.arquivos) throw invalido()
  const marca = resp.marca_dagua
  const vistos = new Set()
  let total = 0
  const arquivos = []
  for (const a of resp.arquivos) {
    if (!a || typeof a.caminho !== 'string' || typeof a.conteudo !== 'string') throw invalido()
    const partes = destinoNoPlugin(a.caminho)
    if (!partes) throw invalido()
    const tam = Buffer.byteLength(a.conteudo, 'utf8')
    total += tam
    if (tam > LIM.arquivo || total > LIM.total) throw invalido()
    const chave = partes.join('/').toLowerCase()
    if (vistos.has(chave)) throw invalido()
    vistos.add(chave)
    if (!avisoNoTopo(a.caminho, a.conteudo, marca)) throw invalido()
    arquivos.push({ partes, conteudo: a.conteudo })
  }
  // Arquivo x pasta com o mesmo nome (a/b e a/b/c) quebraria a gravação: recusa antes.
  for (const c of vistos) for (const d of vistos) if (c !== d && d.startsWith(`${c}/`)) throw invalido()
  return { marca, arquivos }
}

/**
 * Lê o corpo da resposta com TETO de bytes (não deixa um corpo gigante/malicioso estourar a memória). Passou do teto: lança 'kit-grande'.
 * Usa o stream quando existe; sem stream (ex.: teste), cai em text() e confere o tamanho depois.
 */
async function lerComTeto(r, max) {
  const cl = Number(r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-length') : NaN)
  if (Number.isFinite(cl) && cl > max) throw new Error('kit-grande')
  if (!r.body || typeof r.body.getReader !== 'function') {
    const t = await r.text()
    if (Buffer.byteLength(t, 'utf8') > max) throw new Error('kit-grande')
    return t
  }
  const leitor = r.body.getReader()
  const partes = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > max) { try { await leitor.cancel() } catch { /* já encerrado */ } throw new Error('kit-grande') }
    partes.push(Buffer.from(value))
  }
  return Buffer.concat(partes).toString('utf8')
}

function enderecoDaApi(bruto) {
  if (typeof bruto !== 'string' || !bruto) return null
  let u
  try { u = new URL(bruto) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  return u.toString().replace(/\/+$/, '')
}

const MSG = {
  fora: 'A entrega do kit ainda não está aberta por aqui. Volte daqui a pouco.',
  ativar: 'Ative este computador antes de começar a obra.',
  incompleto: 'O kit chegou incompleto. Tente de novo em instantes; nada foi guardado.',
  rede: 'Sem internet no momento. Confira a conexão e tente de novo.',
  negado: 'Não foi possível liberar o kit agora. Confira a sua licença.',
}

/** `deps`: { dadosApp, cofre, hashComputador (async () => hex), api (string|null), buscar? (fetch) }. */
function criarKit({ dadosApp, cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch }) {
  const base = path.join(dadosApp, 'kit-temp')
  const dirs = new Map() // obraId -> pasta do plugin (só memória)
  const nomeDir = (obraId) => crypto.createHash('sha256').update(`kit:${obraId}`).digest('hex').slice(0, 24)
  const limpar = (dir) => { try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* melhor esforço */ } }

  function montarPlugin(obraId, { arquivos }) {
    fs.mkdirSync(base, { recursive: true })
    const baseReal = caminhoSeguro(dadosApp, 'kit-temp') // sem link no caminho
    const dir = path.join(baseReal, nomeDir(obraId))
    limpar(dir)
    fs.mkdirSync(dir)
    try {
      const gravar = (partes, conteudo) => {
        let atual = dir
        for (const p of partes.slice(0, -1)) {
          atual = path.join(atual, p)
          try { fs.mkdirSync(atual) } catch (e) { if (e.code !== 'EEXIST') throw e }
          if (!fs.lstatSync(atual).isDirectory()) throw new Error('kit-invalido')
        }
        fs.writeFileSync(path.join(atual, partes[partes.length - 1]), conteudo, { flag: 'wx' })
      }
      gravar(['.claude-plugin', 'plugin.json'], JSON.stringify({ name: 'atlas-kit', version: '1.0.0', description: `Kit do Atlas entregue por obra. Software proprietário (${LEI}).` }, null, 2) + '\n')
      // As instruções mandam rodar "node .claude/hooks/X.cjs", mas o kit fica aqui (fora da obra): aponta para a pasta do plugin,
      // com aspas (o caminho pode ter espaço) e barras normais (o Claude no Windows usa o Git Bash). Bug da obra do Guilherme, 24/11.
      const raizKit = dir.split(path.sep).join('/')
      for (const a of arquivos) gravar(a.partes, /\.md$/i.test(a.partes[a.partes.length - 1]) ? paraOPlugin(a.conteudo, raizKit) : a.conteudo)
      // Hooks do canteiro: um plugin só liga hooks por hooks/hooks.json. Sem ele, o progresso e o 3D da obra ficam parados.
      const temEvento = arquivos.some((a) => a.partes.join('/') === 'hooks/evento.cjs')
      const temHooksJson = arquivos.some((a) => a.partes.join('/') === 'hooks/hooks.json')
      if (temEvento && !temHooksJson) gravar(['hooks', 'hooks.json'], JSON.stringify(hooksDoCanteiro(), null, 2) + '\n')
    } catch (e) { limpar(dir); throw e }
    return dir
  }

  const api0 = enderecoDaApi(api)

  const self = {
    /** true se há endereço de servidor configurado (senão a linha usa só ATLAS_KIT_PLUGIN, se houver). */
    configurado: () => api0 !== null,

    async entregar(obraId) {
      if (typeof obraId !== 'string' || !OBRA_ID.test(obraId)) return { ok: false, mensagem: MSG.incompleto }
      if (!api0 || typeof buscar !== 'function') return { ok: false, mensagem: MSG.fora }
      let ativ = null
      try {
        const g = JSON.parse((await cofre.ler(CHAVE_COFRE)) ?? 'null')
        if (g && typeof g.token === 'string' && g.token) ativ = { token: g.token, email: typeof g.email === 'string' ? g.email : '' }
      } catch { /* cofre indisponível = sem licença */ }
      if (!ativ) return { ok: false, mensagem: MSG.ativar }
      let texto
      let ok
      try {
        const r = await buscar(`${api0}/entregar-kit`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': ativ.token },
          body: JSON.stringify({ email: ativ.email, computador_hash: await hashComputador(), obra_id: obraId }),
        })
        ok = r.ok
        try { texto = await lerComTeto(r, LIM.resposta) } catch (e) { if (e && e.message === 'kit-grande') return { ok: false, mensagem: MSG.incompleto }; throw e }
      } catch { return { ok: false, mensagem: MSG.rede } }
      let d = null
      try { d = JSON.parse(texto) } catch { /* resposta estranha */ }
      if (!ok) return { ok: false, mensagem: d && typeof d.mensagem === 'string' ? d.mensagem.slice(0, 300) : MSG.negado }
      let v
      try { v = validarResposta(d) } catch { return { ok: false, mensagem: MSG.incompleto } }
      try {
        const dir = montarPlugin(obraId, v)
        dirs.set(obraId, dir)
      } catch { return { ok: false, mensagem: MSG.incompleto } }
      return { ok: true, obraId, marca: v.marca }
    },

    /** As ferramentas do canteiro que a linha pode rodar (permissão exata, uma por script do kit). Sem kit: nenhuma. */
    comandos(obraId) {
      const d = self.diretorio(obraId)
      if (!d) return []
      const raizKit = d.split(path.sep).join('/')
      return FERRAMENTAS_DO_KIT.filter((s) => fs.existsSync(path.join(d, 'hooks', `${s}.cjs`))).map((s) => `Bash(node "${raizKit}/hooks/${s}.cjs":*)`)
    },

    diretorio(obraId) {
      const d = dirs.get(String(obraId))
      return d && fs.existsSync(d) ? d : null
    },

    async garantir(obraId) {
      if (self.diretorio(obraId)) return self.diretorio(obraId)
      if (!api0) return null
      const r = await self.entregar(String(obraId))
      if (!r.ok) throw new Error('kit-indisponivel')
      return self.diretorio(obraId)
    },

    descartar(obraId) {
      const d = dirs.get(String(obraId))
      dirs.delete(String(obraId))
      if (d) limpar(d)
    },

    /** Apaga o kit de todas as obras e qualquer sobra de uma queda (ao abrir e ao fechar o app). */
    descartarTudo() {
      dirs.clear()
      limpar(base)
    },
  }
  return self
}

module.exports = { lerComTeto, criarKit, validarResposta, destinoNoPlugin, avisoNoTopo, enderecoDaApi, LEI }
