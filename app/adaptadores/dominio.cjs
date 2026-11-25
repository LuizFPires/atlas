// M57 — Domínio próprio (PB6/PB7): o Atlas liga e vigia; o cliente faz UMA troca no Registro.br.
//
// O QUE FAZ
//  conferir(pasta, dominio): pergunta ao RDAP oficial do Registro.br se o nome existe (404 = livre, 200 = registrado, o resto =
//    incerto; nunca "livre" por palpite) e, se existe, olha no DNS público se o domínio tem e-mail (MX).
//  ligar(pasta, dominio): só com a obra já no ar (.atlas/no-ar.json). Liga o domínio e o www no projeto da Vercel DO CLIENTE
//    (`vercel domains add`) ANTES de mandar o cliente ao Registro.br, e lê na hora, da Vercel, o que ele precisa colar:
//      - sem e-mail: os servidores DNS da Vercel (troca no Registro.br);
//      - com e-mail: só os registros A e CNAME que faltam (não troca os servidores, o e-mail continua funcionando).
//    Grava .atlas/dominio.json (sem segredo) e começa a vigiar.
//  vigia: a cada intervalo confere no DNS público se a troca chegou; depois espera o cadeado (https responder) e avisa no celular
//    uma vez. Passou do limite sem a troca = fase 'demorando' (a tela mostra a Ajuda). retomar(pastas) volta a vigiar ao reabrir.
//  O Atlas nunca entra no Registro.br, nunca paga e nunca guarda senha: quem entra, paga e salva é o cliente.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaAtlas, pastaDaObra, gravarAtomico, lerJson } = require('./obra-fs.cjs')

const PASSOS_DOMINIO = ['ligado', 'troca', 'internet', 'cadeado']
const SLDS = 'com|net|org|app|art|blog|dev|eco|emp|eng|adv|arq|tec|log|med|ind|inf|srv|tur|vet|wiki|seg|rec|esp|ong|psi|mus|odo|fot|imb|nom|agr|esc|edu|gov'
const DOMINIO = new RegExp(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.(${SLDS})\\.br$`)
const HOST_NS = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const NOME_PROJETO = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

const dominioValido = (d) => typeof d === 'string' && d.length <= 80 && DOMINIO.test(d)
const semPonto = (s) => String(s).replace(/\.$/, '').toLowerCase()
const umaHora = 60 * 60 * 1000

function jsonDaSaida(saida) {
  const t = String(saida || '')
  const i = t.indexOf('{'); const f = t.lastIndexOf('}')
  if (i < 0 || f < i) return null
  try { return JSON.parse(t.slice(i, f + 1)) } catch { return null }
}

/** Resposta de GET /v6/domains/<d>/config -> registros A (@) e CNAME (www). */
function registrosDaConfig(cfg) {
  const melhor = (l) => (Array.isArray(l) ? l.filter((x) => x && typeof x === 'object').sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99))[0] : undefined)
  const out = []
  const v4 = melhor(cfg && cfg.recommendedIPv4)
  const ip = v4 && (Array.isArray(v4.value) ? v4.value[0] : v4.value)
  if (typeof ip === 'string' && IPV4.test(ip)) out.push({ tipo: 'A', nome: '@', valor: ip })
  const cn = melhor(cfg && cfg.recommendedCNAME)
  const alvo = cn && (Array.isArray(cn.value) ? cn.value[0] : cn.value)
  if (typeof alvo === 'string' && HOST_NS.test(semPonto(alvo))) out.push({ tipo: 'CNAME', nome: 'www', valor: semPonto(alvo) })
  return out
}

/**
 * deps: raiz; vercel(args,{cwd,timeoutMs}) -> {codigo,saida} (CLI do cliente); rdap(caminho) -> status HTTP (rdap.registro.br);
 * resolvedor() -> dns.promises.Resolver (DNS público); sondar(dominio) -> {status} (https://<dominio>/, sem seguir redirect);
 * avisar(titulo, texto) (celular); esperar(ms); intervaloMs (5 min); tentativas (72 h).
 */
function criarDominio({ raiz, vercel, rdap, resolvedor, sondar, avisar = async () => {}, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), agora = () => new Date(), intervaloMs = 5 * 60_000, tentativas = 864 }) {
  const vigias = new Map() // pasta -> promessa

  const arquivo = (pasta) => caminhoSeguro(raiz, String(pasta), '.atlas', 'dominio.json')
  const ler = (pasta) => {
    let j = null
    try { j = lerJson(arquivo(pasta)) } catch { j = null }
    if (!j || typeof j !== 'object' || !dominioValido(j.dominio) || !['servidores', 'registros'].includes(j.modo)) return null
    const fases = ['esperando', 'cadeado', 'noar', 'demorando']
    return {
      dominio: j.dominio, modo: j.modo, fase: fases.includes(j.fase) ? j.fase : 'esperando',
      servidores: Array.isArray(j.servidores) ? j.servidores.filter((s) => typeof s === 'string' && HOST_NS.test(s)).slice(0, 4) : [],
      registros: Array.isArray(j.registros) ? registrosDaConfig({ recommendedIPv4: j.registros.filter((r) => r && r.tipo === 'A').map((r) => ({ value: r.valor })), recommendedCNAME: j.registros.filter((r) => r && r.tipo === 'CNAME').map((r) => ({ value: r.valor })) }) : [],
      desde: typeof j.desde === 'string' ? j.desde.slice(0, 40) : null,
      avisado: j.avisado === true,
    }
  }
  const gravar = (pasta, r) => { pastaAtlas(raiz, String(pasta)); gravarAtomico(arquivo(pasta), JSON.stringify({ versao: 1, ...r }) + '\n') }
  const projetoNoAr = (pasta) => {
    let j = null
    try { j = lerJson(caminhoSeguro(raiz, String(pasta), '.atlas', 'no-ar.json')) } catch { j = null }
    return j && NOME_PROJETO.test(String(j.nome || '')) && typeof j.endereco === 'string' ? j.nome : null
  }
  const time = (cwd) => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(cwd, '.vercel', 'project.json'), 'utf8'))
      return typeof j.orgId === 'string' && /^team_[A-Za-z0-9]{1,60}$/.test(j.orgId) ? j.orgId : null
    } catch { return null }
  }

  const publico = (r) => {
    if (!r) return { fase: 'nenhum', dominio: null, modo: null, servidores: [], registros: [], passos: PASSOS_DOMINIO.map((id) => ({ id, estado: 'falta' })), endereco: null }
    const ordem = { esperando: 1, demorando: 1, cadeado: 3, noar: 4 }[r.fase]
    const passos = PASSOS_DOMINIO.map((id, i) => ({ id, estado: i < ordem ? 'feito' : i === ordem ? (r.fase === 'demorando' ? 'demorando' : 'agora') : 'falta' }))
    if (r.fase === 'cadeado') { passos[1].estado = 'feito'; passos[2].estado = 'feito'; passos[3].estado = 'agora' }
    return { fase: r.fase, dominio: r.dominio, modo: r.modo, servidores: [...r.servidores], registros: r.registros.map((x) => ({ ...x })), passos, endereco: r.fase === 'noar' ? `https://${r.dominio}` : null }
  }

  async function temEmail(dominio) {
    try { const mx = await resolvedor().resolveMx(dominio); return Array.isArray(mx) && mx.some((m) => m && typeof m.exchange === 'string' && m.exchange) } catch { return false }
  }

  async function trocaChegou(r) {
    try {
      const res = resolvedor()
      if (r.modo === 'servidores') {
        const ns = (await res.resolveNs(r.dominio)).map(semPonto)
        return r.servidores.length > 0 && r.servidores.every((s) => ns.includes(semPonto(s)))
      }
      for (const reg of r.registros) {
        if (reg.tipo === 'A') { const ips = await res.resolve4(r.dominio); if (!ips.includes(reg.valor)) return false }
        else { const alvos = await res.resolveCname(`${reg.nome}.${r.dominio}`); if (!alvos.some((a) => semPonto(a) === reg.valor)) return false }
      }
      return r.registros.length > 0
    } catch { return false }
  }

  async function cadeadoOk(dominio) {
    try { const s = await sondar(dominio); return s && s.status >= 200 && s.status < 500 } catch { return false }
  }

  function vigiar(pasta) {
    pasta = String(pasta)
    if (vigias.has(pasta)) return vigias.get(pasta)
    const p = (async () => {
      for (let i = 0; i < tentativas; i++) {
        const r = ler(pasta)
        if (!r || r.fase === 'noar') return
        if (r.fase !== 'cadeado' && await trocaChegou(r)) { r.fase = 'cadeado'; gravar(pasta, r) }
        if (r.fase === 'cadeado' && await cadeadoOk(r.dominio)) {
          r.fase = 'noar'
          if (!r.avisado) { r.avisado = true; gravar(pasta, r); await avisar('Seu domínio está no ar', `O sistema já abre em ${r.dominio}, com cadeado. O QR e o link do WhatsApp foram atualizados.`) }
          else gravar(pasta, r)
          return
        }
        await esperar(intervaloMs)
      }
      const r = ler(pasta)
      if (r && r.fase !== 'noar') { r.fase = r.fase === 'cadeado' ? 'cadeado' : 'demorando'; gravar(pasta, r) }
    })().finally(() => vigias.delete(pasta))
    vigias.set(pasta, p)
    return p
  }

  return {
    async conferir(pasta, dominio) {
      pastaDaObra(raiz, String(pasta))
      if (!dominioValido(dominio)) throw new Error('dominio-invalido')
      let status = 0
      try { status = await rdap(`/domain/${dominio}`) } catch { status = 0 }
      if (status === 404) return { dominio, situacao: 'livre', temEmail: false, registrador: null }
      if (status !== 200) return { dominio, situacao: 'incerto', temEmail: false, registrador: null }
      return { dominio, situacao: 'registrado', temEmail: await temEmail(dominio), registrador: 'Registro.br' }
    },

    async ligar(pasta, dominio) {
      pasta = String(pasta)
      const cwd = pastaDaObra(raiz, pasta)
      if (!dominioValido(dominio)) throw new Error('dominio-invalido')
      const projeto = projetoNoAr(pasta)
      if (!projeto) throw new Error('obra-fora-do-ar')
      for (const d of [dominio, `www.${dominio}`]) {
        const r = await vercel(['domains', 'add', d, projeto], { cwd, timeoutMs: 60_000 })
        if (r.codigo !== 0 && !/already (been )?(added|assigned)|already exists/i.test(String(r.saida))) throw new Error('vercel-dominio')
      }
      const t = time(cwd)
      const q = `projectIdOrName=${projeto}${t ? `&teamId=${t}` : ''}`
      const email = await temEmail(dominio)
      const base = { dominio, fase: 'esperando', desde: agora().toISOString(), avisado: false }
      let r
      if (email) {
        const c = await vercel(['api', `/v6/domains/${dominio}/config?${q}`, '--raw'], { cwd, timeoutMs: 60_000 })
        const registros = c.codigo === 0 ? registrosDaConfig(jsonDaSaida(c.saida)) : []
        if (registros.length < 2) throw new Error('vercel-dns')
        r = { ...base, modo: 'registros', servidores: [], registros }
      } else {
        const c = await vercel(['api', `/v5/domains/${dominio}${t ? `?teamId=${t}` : ''}`, '--raw'], { cwd, timeoutMs: 60_000 })
        const j = c.codigo === 0 ? jsonDaSaida(c.saida) : null
        const ns = j && j.domain && Array.isArray(j.domain.intendedNameservers) ? j.domain.intendedNameservers.map(semPonto).filter((s) => HOST_NS.test(s)).slice(0, 4) : []
        if (ns.length < 2) throw new Error('vercel-dns')
        r = { ...base, modo: 'servidores', servidores: ns, registros: [] }
      }
      gravar(pasta, r)
      void vigiar(pasta)
      return publico(ler(pasta))
    },

    estado(pasta) {
      const r = ler(String(pasta))
      return publico(r)
    },

    /** O cliente disse que já salvou no Registro.br (ou abriu a tela de novo): confere agora, sem esperar o intervalo. */
    conferirAgora(pasta) {
      const r = ler(String(pasta))
      if (r && r.fase === 'demorando') { r.fase = 'esperando'; gravar(String(pasta), r) }
      if (r && r.fase !== 'noar') void vigiar(pasta)
      return publico(ler(String(pasta)))
    },

    /** Ao abrir o Atlas: volta a vigiar os domínios que ainda esperam. */
    retomar(pastas) {
      for (const p of pastas || []) {
        let r = null
        try { r = ler(String(p)) } catch { r = null }
        if (r && (r.fase === 'esperando' || r.fase === 'cadeado')) void vigiar(p)
      }
    },

    _esperar: (pasta) => vigias.get(String(pasta)),
  }
}

module.exports = { criarDominio, dominioValido, registrosDaConfig, PASSOS_DOMINIO, umaHora }
