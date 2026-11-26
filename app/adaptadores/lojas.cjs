// M59 — Lojas (App Store e Google Play), parte do cliente. Decisões do Luiz (25/11/2026): guiar as 3 coisas a mais (conta da Expo,
// chave da App Store Connect e o 1º envio ao Google à mão) e contar os 12 testadores pela página de convite do Atlas.
//
// O QUE FAZ
//  estado(pasta): .atlas/lojas.json (em nome de quem, contas criadas, convite) + se as chaves estão no cofre. Nunca segredo no arquivo.
//  escolher(pasta, 'pessoa'|'empresa') e marcarConta(pasta, 'apple'|'google'|'expo', sim): o que o cliente respondeu e fez.
//  guardarTokenExpo(token) e guardarChaveAsc(pasta, {keyId, issuerId, p8}): conferem o formato e guardam SÓ no cofre do computador.
//  criarConvite(pasta, appNome, grupoUrl): pede ao servidor o convite dos testadores (opt-in do Google pelo pacote do app).
//  testadores(pasta): pessoas que tocaram "Já instalei", dia do prazo (14) e se completou.
// O Atlas nunca cria conta, nunca paga, nunca digita senha e nunca aperta "Enviar para revisão".
'use strict'
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaAtlas, pastaDaObra, gravarAtomico, lerJson } = require('./obra-fs.cjs')
const { enderecoDaApi } = require('./licenca.cjs')

const CHAVE_DISPOSITIVO = 'atlas/dispositivo'
const CHAVE_EXPO = 'lojas/expo'
const CHAVE_ASC = 'lojas/asc'
const CONTAS = ['apple', 'google', 'expo', 'duns']
const GRUPO_RE = /^https:\/\/groups\.google\.com\/g\/[A-Za-z0-9._-]{1,80}\/?$/
const LINK_RE = /^https:\/\/[a-z0-9.-]+(:\d+)?\/teste\/[a-z0-9]{10,40}$/i

/** Identificador do app nas lojas (não muda depois de publicado): br.com.<nome sem hífen>.app */
function pacoteDoNome(nome) {
  let n = String(nome || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || 'meuapp'
  if (/^[0-9]/.test(n)) n = `app${n}`
  return `br.com.${n}.app`
}

function chaveAscValida(c) {
  return !!c && typeof c.keyId === 'string' && /^[A-Z0-9]{8,12}$/.test(c.keyId)
    && typeof c.issuerId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.issuerId)
    && typeof c.p8 === 'string' && c.p8.length < 5000 && /^-----BEGIN PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PRIVATE KEY-----\s*$/.test(c.p8)
}

/** deps: { raiz, cofre, hashComputador, api, buscar } */
function criarLojas({ raiz, cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch }) {
  const base = enderecoDaApi(api)
  const arquivo = (pasta) => caminhoSeguro(raiz, String(pasta), '.atlas', 'lojas.json')
  const ler = (pasta) => {
    let j = null
    try { j = lerJson(arquivo(pasta)) } catch { j = null }
    const o = j && typeof j === 'object' ? j : {}
    const contas = Object.fromEntries(CONTAS.map((c) => [c, !!(o.contas && o.contas[c] === true)]))
    const convite = o.convite && typeof o.convite.link === 'string' && LINK_RE.test(o.convite.link) ? { link: o.convite.link, grupo: GRUPO_RE.test(String(o.convite.grupo)) ? o.convite.grupo : null } : null
    return { caminho: o.caminho === 'pessoa' || o.caminho === 'empresa' ? o.caminho : null, contas, convite }
  }
  const gravar = (pasta, r) => { pastaAtlas(raiz, String(pasta)); gravarAtomico(arquivo(pasta), JSON.stringify({ versao: 1, ...r }) + '\n') }
  const nomeNoAr = (pasta) => {
    let j = null
    try { j = lerJson(caminhoSeguro(raiz, String(pasta), '.atlas', 'no-ar.json')) } catch { j = null }
    return j && typeof j.nome === 'string' && /^[a-z0-9-]{1,63}$/.test(j.nome) ? j.nome : null
  }
  const temNoCofre = async (k) => { try { const v = await cofre.ler(k); return typeof v === 'string' && v.length > 0 } catch { return false } }

  async function chamar(rota, corpo) {
    if (!base || typeof buscar !== 'function') throw new Error('indisponivel')
    let ativ = null
    try { const g = JSON.parse((await cofre.ler(CHAVE_DISPOSITIVO)) ?? 'null'); if (g && typeof g.token === 'string' && g.token) ativ = g } catch { /* sem licença */ }
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

  return {
    async estado(pasta) {
      pastaDaObra(raiz, String(pasta))
      const r = ler(pasta)
      const nome = nomeNoAr(pasta)
      const expo = await temNoCofre(CHAVE_EXPO)
      return { ...r, contas: { ...r.contas, expo: r.contas.expo || expo }, chaveAsc: await temNoCofre(CHAVE_ASC), noAr: !!nome, pacote: nome ? pacoteDoNome(nome) : null }
    },
    async escolher(pasta, caminho) {
      pastaDaObra(raiz, String(pasta))
      if (caminho !== 'pessoa' && caminho !== 'empresa') throw new Error('caminho-invalido')
      gravar(pasta, { ...ler(pasta), caminho })
      return this.estado(pasta)
    },
    async marcarConta(pasta, conta, sim) {
      pastaDaObra(raiz, String(pasta))
      if (!CONTAS.includes(conta)) throw new Error('conta-invalida')
      const r = ler(pasta)
      gravar(pasta, { ...r, contas: { ...r.contas, [conta]: sim === true } })
      return this.estado(pasta)
    },
    async guardarTokenExpo(token) {
      const t = String(token || '').trim()
      if (!/^[A-Za-z0-9_-]{30,120}$/.test(t)) throw new Error('token-invalido')
      await cofre.guardar(CHAVE_EXPO, t)
      return true
    },
    async guardarChaveAsc(pasta, c) {
      pastaDaObra(raiz, String(pasta))
      const chave = c && typeof c === 'object' ? { keyId: String(c.keyId || '').trim(), issuerId: String(c.issuerId || '').trim(), p8: String(c.p8 || '') } : null
      if (!chaveAscValida(chave)) throw new Error('chave-invalida')
      await cofre.guardar(CHAVE_ASC, JSON.stringify(chave))
      return true
    },
    async criarConvite(pasta, appNome, grupoUrl) {
      pastaDaObra(raiz, String(pasta))
      if (typeof grupoUrl !== 'string' || !GRUPO_RE.test(grupoUrl.trim())) throw new Error('grupo-invalido')
      const nome = nomeNoAr(pasta)
      if (!nome) throw new Error('obra-fora-do-ar')
      const grupo = grupoUrl.trim()
      const d = await chamar('/lojas/convite', { obra_id: String(pasta), app_nome: String(appNome || nome).slice(0, 40), grupo_url: grupo, optin_url: `https://play.google.com/apps/testing/${pacoteDoNome(nome)}` })
      if (!d || typeof d.link !== 'string' || !LINK_RE.test(d.link)) throw new Error('indisponivel')
      gravar(pasta, { ...ler(pasta), convite: { link: d.link, grupo } })
      return { link: d.link }
    },
    async testadores(pasta) {
      pastaDaObra(raiz, String(pasta))
      const d = await chamar('/lojas/testadores', { obra_id: String(pasta) })
      const n = (v, max) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0)
      return { pessoas: n(d && d.pessoas, 10_000), faltam: n(d && d.faltam, 12), dia: n(d && d.dia, 14), completo: !!(d && d.completo === true), nomes: Array.isArray(d && d.nomes) ? d.nomes.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 50) : [] }
    },
  }
}

module.exports = { criarLojas, pacoteDoNome, chaveAscValida, CHAVE_EXPO, CHAVE_ASC }
