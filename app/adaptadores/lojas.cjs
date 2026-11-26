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
//
// PARTE 2 (montar e enviar):
//  montar(pasta): pede à linha da obra (agente corretor) a versão de app (Expo em apps/mobile, ícone, textos, privacidade) SEM build;
//    depois o PRÓPRIO Atlas roda o EAS na nuvem com a chave da Expo e a da App Store Connect no ambiente (a .p8 vai para um arquivo
//    temporário fora da obra, só durante o comando, e é apagada). iPhone vai ao TestFlight sozinho; o 1º envio do Google é do cliente
//    (regra do Google), com o arquivo .aab que o Atlas mostra; depois o cliente marca googleEnviado e as duas lojas ficam em teste.
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
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
    && (c.teamId === undefined || c.teamId === '' || (typeof c.teamId === 'string' && /^[A-Z0-9]{10}$/.test(c.teamId)))
    && typeof c.p8 === 'string' && c.p8.length < 5000 && /^-----BEGIN PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PRIVATE KEY-----\s*$/.test(c.p8)
}

const PEDIDO_APP = [
  'Monte a versão de app deste sistema para as lojas (App Store e Google Play), seguindo o agente corretor:',
  'Expo em apps/mobile (mesmas telas e regras do sistema, mesma marca), app.json e eas.json prontos (perfis preview e production,',
  'appVersionSource remote, autoIncrement), bundleIdentifier e package = {PACOTE}, ícone 1024x1024 sem transparência, textos e',
  'materiais em apps/mobile/store/ e a política de privacidade publicada no site em /privacidade.',
  'NÃO rode o build nem o envio (eas build/submit): o Atlas faz isso depois, com as chaves do cliente. Nunca grave chave em arquivo.',
].join(' ')
const BUILD_ID = /^[A-Za-z0-9-]{4,80}$/
const AAB_RE = /^https:\/\/(expo\.dev|[a-z0-9-]+\.expo\.dev)\/artifacts\/[A-Za-z0-9/._-]{1,200}\.aab$/
const jsonDe = (s) => { const t = String(s || ''); const i = Math.min(...['[', '{'].map((c) => (t.indexOf(c) < 0 ? Infinity : t.indexOf(c)))); if (!Number.isFinite(i)) return null; try { return JSON.parse(t.slice(i)) } catch { return null } }

/** deps: { raiz, cofre, hashComputador, api, buscar, eas, pedirConstrucao, linhaRodando, esperar, avisar } */
function criarLojas({ raiz, cofre, hashComputador, api = process.env.ATLAS_API_URL, buscar = globalThis.fetch, eas = null, pedirConstrucao = null, linhaRodando = () => false, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), avisar = async () => {}, intervaloMs = 120_000, tentativas = 180 }) {
  const trabalhos = new Map()
  const base = enderecoDaApi(api)
  const arquivo = (pasta) => caminhoSeguro(raiz, String(pasta), '.atlas', 'lojas.json')
  const ler = (pasta) => {
    let j = null
    try { j = lerJson(arquivo(pasta)) } catch { j = null }
    const o = j && typeof j === 'object' ? j : {}
    const contas = Object.fromEntries(CONTAS.map((c) => [c, !!(o.contas && o.contas[c] === true)]))
    const convite = o.convite && typeof o.convite.link === 'string' && LINK_RE.test(o.convite.link) ? { link: o.convite.link, grupo: GRUPO_RE.test(String(o.convite.grupo)) ? o.convite.grupo : null } : null
    const v = o.envio && typeof o.envio === 'object' ? o.envio : {}
    const fases = ['nada', 'preparando', 'montando', 'enviando', 'google-primeiro', 'teste', 'erro']
    const envio = {
      fase: fases.includes(v.fase) ? v.fase : 'nada',
      ios: ['nada', 'falta-chave', 'montando', 'testflight', 'erro'].includes(v.ios) ? v.ios : 'nada',
      android: ['nada', 'montando', 'pronto', 'enviado', 'erro'].includes(v.android) ? v.android : 'nada',
      aab: typeof v.aab === 'string' && AAB_RE.test(v.aab) ? v.aab : null,
      builds: v.builds && typeof v.builds === 'object' ? { ios: BUILD_ID.test(String(v.builds.ios)) ? v.builds.ios : null, android: BUILD_ID.test(String(v.builds.android)) ? v.builds.android : null } : { ios: null, android: null },
      erro: typeof v.erro === 'string' ? v.erro.slice(0, 40) : null,
    }
    return { caminho: o.caminho === 'pessoa' || o.caminho === 'empresa' ? o.caminho : null, contas, convite, envio }
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

  const mudarEnvio = (pasta, m) => { const r = ler(pasta); gravar(pasta, { ...r, envio: { ...r.envio, ...m } }) }

  /** Roda o EAS com as chaves do cofre no ambiente. A .p8 existe só durante o comando, num arquivo temporário FORA da obra. */
  async function rodarEas(pasta, args, timeoutMs) {
    const cwd = path.join(pastaDaObra(raiz, pasta), 'apps', 'mobile')
    const env = { EXPO_TOKEN: String(await cofre.ler(CHAVE_EXPO) || ''), EAS_NO_VCS: '0', CI: '1' }
    let dir = null
    try {
      let asc = null
      try { asc = JSON.parse((await cofre.ler(CHAVE_ASC)) || 'null') } catch { asc = null }
      if (asc && chaveAscValida(asc)) {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-asc-${crypto.randomBytes(4).toString('hex')}-`))
        const arq = path.join(dir, `AuthKey_${asc.keyId}.p8`)
        fs.writeFileSync(arq, asc.p8, { mode: 0o600, flag: 'wx' })
        Object.assign(env, { EXPO_ASC_API_KEY_PATH: arq, EXPO_ASC_KEY_ID: asc.keyId, EXPO_ASC_ISSUER_ID: asc.issuerId })
        if (asc.teamId) env.EXPO_APPLE_TEAM_ID = asc.teamId
        env.EXPO_APPLE_TEAM_TYPE = ler(pasta).caminho === 'empresa' ? 'COMPANY_OR_ORGANIZATION' : 'INDIVIDUAL'
      }
      return await eas(args, { cwd, env, timeoutMs })
    } finally {
      if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* temporário */ } }
    }
  }

  async function rodarEnvio(pasta, nome) {
    const falhou = (erro) => mudarEnvio(pasta, { fase: 'erro', erro })
    try {
      mudarEnvio(pasta, { fase: 'preparando', erro: null })
      await pedirConstrucao(pasta, PEDIDO_APP.replace('{PACOTE}', pacoteDoNome(nome)))
      await esperar(15_000)
      for (let i = 0; i < 2880 && linhaRodando(pasta); i++) await esperar(15_000)
      const app = path.join(pastaDaObra(raiz, pasta), 'apps', 'mobile')
      if (!fs.existsSync(path.join(app, 'app.json')) || !fs.existsSync(path.join(app, 'eas.json'))) return falhou('sem-app')
      let asc = null
      try { asc = JSON.parse((await cofre.ler(CHAVE_ASC)) || 'null') } catch { asc = null }
      const comIos = !!(asc && chaveAscValida(asc) && asc.teamId)
      mudarEnvio(pasta, { fase: 'montando', ios: comIos ? 'montando' : 'falta-chave', android: 'montando' })
      const b = await rodarEas(pasta, ['build', '--platform', comIos ? 'all' : 'android', '--profile', 'production', '--non-interactive', '--no-wait', '--json'], 900_000)
      const lista = b.codigo === 0 ? jsonDe(b.saida) : null
      const ids = { ios: null, android: null }
      for (const x of Array.isArray(lista) ? lista : []) if (x && BUILD_ID.test(String(x.id))) ids[String(x.platform).toLowerCase() === 'ios' ? 'ios' : 'android'] = x.id
      if (!ids.android || (comIos && !ids.ios)) return falhou('eas-build')
      mudarEnvio(pasta, { builds: ids })
      const fim = {}
      for (let i = 0; i < tentativas && Object.keys(fim).length < (comIos ? 2 : 1); i++) {
        for (const plat of comIos ? ['ios', 'android'] : ['android']) {
          if (fim[plat]) continue
          const v = await rodarEas(pasta, ['build:view', ids[plat], '--json'], 60_000)
          const j = v.codigo === 0 ? jsonDe(v.saida) : null
          if (j && ['FINISHED', 'ERRORED', 'CANCELED'].includes(j.status)) fim[plat] = j
        }
        if (Object.keys(fim).length < (comIos ? 2 : 1)) await esperar(intervaloMs)
      }
      if (!fim.android || fim.android.status !== 'FINISHED' || (comIos && (!fim.ios || fim.ios.status !== 'FINISHED'))) return falhou('eas-build')
      const aab = fim.android.artifacts && AAB_RE.test(String(fim.android.artifacts.buildUrl)) ? fim.android.artifacts.buildUrl : null
      if (comIos) {
        mudarEnvio(pasta, { fase: 'enviando' })
        const s = await rodarEas(pasta, ['submit', '--platform', 'ios', '--id', ids.ios, '--non-interactive'], 900_000)
        if (s.codigo !== 0) return mudarEnvio(pasta, { fase: 'erro', erro: 'eas-submit-ios', ios: 'erro', android: 'pronto', aab })
      }
      const r = ler(pasta)
      const androidJa = r.envio.android === 'enviado'
      mudarEnvio(pasta, { fase: androidJa ? 'teste' : 'google-primeiro', ios: comIos ? 'testflight' : 'falta-chave', android: androidJa ? 'enviado' : 'pronto', aab })
      await avisar('A versão de app ficou pronta', comIos ? 'O iPhone já está no TestFlight. Falta o 1º envio ao Google, com o passo a passo.' : 'A versão Android está pronta. Falta o envio ao Google, com o passo a passo.')
    } catch { falhou('eas-build') }
  }

  return {
    async estado(pasta) {
      pastaDaObra(raiz, String(pasta))
      const r = ler(pasta)
      const nome = nomeNoAr(pasta)
      const expo = await temNoCofre(CHAVE_EXPO)
      const { envio, ...resto } = r
      return { ...resto, contas: { ...r.contas, expo: r.contas.expo || expo }, chaveAsc: await temNoCofre(CHAVE_ASC), noAr: !!nome, pacote: nome ? pacoteDoNome(nome) : null,
        envio: { fase: envio.fase, ios: envio.ios, android: envio.android, aab: !!envio.aab, erro: envio.erro } }
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
      const chave = c && typeof c === 'object' ? { keyId: String(c.keyId || '').trim(), issuerId: String(c.issuerId || '').trim(), teamId: String(c.teamId || '').trim().toUpperCase(), p8: String(c.p8 || '') } : null
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
    /** Começa a montar a versão de app e a mandar aos testes das lojas. Não espera: a tela acompanha por estado(). */
    async montar(pasta) {
      pasta = String(pasta)
      pastaDaObra(raiz, pasta)
      const nome = nomeNoAr(pasta)
      if (!nome) throw new Error('obra-fora-do-ar')
      if (!(await temNoCofre(CHAVE_EXPO))) throw new Error('falta-expo')
      if (!eas || !pedirConstrucao) throw new Error('indisponivel')
      if (trabalhos.has(pasta)) throw new Error('ja-montando')
      const p = rodarEnvio(pasta, nome).finally(() => trabalhos.delete(pasta))
      trabalhos.set(pasta, p)
      return this.estado(pasta)
    },
    /** O arquivo .aab do 1º envio ao Google (só endereço de artefato da Expo). */
    async linkAab(pasta) { const r = ler(String(pasta)); return r.envio.aab },
    /** O cliente fez o 1º envio no Google Play Console. */
    async googleEnviado(pasta) {
      const r = ler(String(pasta))
      gravar(pasta, { ...r, envio: { ...r.envio, android: 'enviado', fase: r.envio.ios === 'testflight' || r.envio.ios === 'falta-chave' ? 'teste' : r.envio.fase } })
      return this.estado(pasta)
    },
    _esperar: (pasta) => trabalhos.get(String(pasta)),
    async testadores(pasta) {
      pastaDaObra(raiz, String(pasta))
      const d = await chamar('/lojas/testadores', { obra_id: String(pasta) })
      const n = (v, max) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0)
      return { pessoas: n(d && d.pessoas, 10_000), faltam: n(d && d.faltam, 12), dia: n(d && d.dia, 14), completo: !!(d && d.completo === true), nomes: Array.isArray(d && d.nomes) ? d.nomes.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 50) : [] }
    },
  }
}

module.exports = { criarLojas, pacoteDoNome, chaveAscValida, CHAVE_EXPO, CHAVE_ASC }
