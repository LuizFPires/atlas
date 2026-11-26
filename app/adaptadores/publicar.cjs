// Adaptador real do PontePublicar (src/app/ponte-publicar.ts) — processo principal do Electron (só Windows).
// Espelha em CommonJS SITES_OFICIAIS, HOSTS_OFICIAIS, enderecoOficial, dominioValido, registroDnsValido e enderecoDoSistema
// (o teste carrega o TypeScript de verdade e compara; manter em sincronia).
//
// O QUE FAZ
//  abrirSite(destino, dominio?): abre pelo navegador SÓ o site da lista fechada SITES_OFICIAIS, pelo NOME do destino; a URL é fixa aqui
//    dentro e passa por enderecoOficial + abrirExterno (https, sem porta/usuário, host exato). O domínio, se vier, só é validado
//    (dominioValido) — hoje não entra na URL (a pesquisa pré-preenchida do Registro.br é pendência).
//  nomeLivre(dominio): dominioValido ANTES; pergunta ao RDAP OFICIAL do Registro.br (rdap.registro.br) pelo mesmo caminho anti-SSRF de
//    nomes.cjs (host fixo, DNS validado na conexão, IP público, sem redirect, timeout, corpo nunca lido). 404 = livre, 200 = ocupado,
//    qualquer outra coisa = 'incerto'. Nunca 'livre' por palpite.
//  lerDns(dominio): pede à API da Vercel (api.vercel.com, host oficial) a configuração do domínio na conta DO CLIENTE; o token vem SÓ do
//    cofre (chave `vercel/token`). Sem token, resposta fora do formato ou sem registro válido (registroDnsValido) => lança. NÃO inventa
//    os valores de exemplo (76.76.21.21 etc.).
//  dnsNoAr(dominio, registros): consulta o DNS público (resolvedores 1.1.1.1/8.8.8.8, timeout curto) e confere TODOS os registros
//    esperados (já validados). Só compara texto; não conecta no IP. Falha/timeout/estranho => false.
//  gerarCartaz(endereco, pasta): PDF A4 com QR do endereço, gerado AQUI (qrcode-generator + PDF escrito à mão); nenhum serviço externo
//    recebe o endereço. Grava em <obra>\entrega\cartaz-instalar-app.pdf (nome livre, 'wx', sem link). O endereço passa por
//    enderecoDoSistema (https/http de *.vercel.app ou *.com.br, sem porta/usuário/caminho).
//  lerProgresso/gravarProgresso(pasta, {guia,passo}): <obra>\.atlas\publicar.json, atômico, caminhoSeguro, sem link; só guia
//    ([a-z0-9-]) e passo (inteiro 0..99). Nunca segredo. O arquivo é só ponto de retomada, nunca autorização.
//  publicarNoAr(slug): NÃO IMPLEMENTADO DE PROPÓSITO. O deploy na conta Vercel do cliente + ligar o Supabase dependem do token do
//    cliente (cofre) e de decisões abertas (app/PENDENTE-ENTREGAR.md). Falha honesta ('sem-token-vercel' ou 'publicar-nao-implementado');
//    nunca devolve endereço de mentira. O Atlas não paga, não cria conta, não digita credencial e não aperta "Enviar para revisão".
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (publicar.teste.cjs: sem rede, sem Electron). No Windows: no guia de
// publicação, "Abrir o Registro.br" abre o navegador; um nome já registrado volta "ocupado"; o cartaz aparece em <obra>\entrega.
'use strict'
const dns = require('node:dns')
const https = require('node:https')
const { caminhoSeguro, abrirExterno } = require('../seguro.cjs')
const { pastaAtlas, gravarAtomico, lerJson } = require('./obra-fs.cjs')
const { gravarSemSobrescrever } = require('./projeto-comum.cjs')
const { pedirStatus, criarLookupSeguro, livreDoStatus } = require('./nomes.cjs')

// ---- espelhos de src/app/ponte-publicar.ts -----------------------------------------------------------------------------------
const SITES_OFICIAIS = Object.freeze({
  registro: 'https://registro.br/',
  vercel: 'https://vercel.com/',
  'apple-inscricao': 'https://developer.apple.com/programs/enroll/',
  'app-store-connect': 'https://appstoreconnect.apple.com/apps',
  testflight: 'https://testflight.apple.com/',
  'google-console': 'https://play.google.com/console/signup',
  'apple-duns': 'https://developer.apple.com/enroll/duns-lookup/',
  'asc-chaves': 'https://appstoreconnect.apple.com/access/integrations/api',
  'expo-token': 'https://expo.dev/settings/access-tokens',
  'google-grupos': 'https://groups.google.com/my-groups',
  'google-play-console': 'https://play.google.com/console',
})
const HOSTS_OFICIAIS = Object.freeze(['registro.br', 'vercel.com', 'developer.apple.com', 'appstoreconnect.apple.com', 'testflight.apple.com', 'play.google.com', 'expo.dev', 'groups.google.com'])

function enderecoOficial(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false
    return HOSTS_OFICIAIS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch { return false }
}
const dominioValido = (d) => typeof d === 'string' && /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.com\.br$/.test(d)

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
function ipv4Publico(v) {
  if (typeof v !== 'string' || !IPV4.test(v)) return false
  const [a, b] = v.split('.').map(Number)
  if (a === 0 || a === 127 || a >= 224) return false
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return false
  return true
}
const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/
function registroDnsValido(r) {
  if (!r || typeof r !== 'object' || typeof r.nome !== 'string' || typeof r.valor !== 'string') return false
  if (r.tipo === 'A') return r.nome === '@' && ipv4Publico(r.valor)
  if (r.tipo === 'CNAME') return /^[a-z0-9-]{1,63}$/.test(r.nome) && HOST.test(r.valor)
  return false
}

// ---- espelho de enderecoDoSistema (src/app/entrega-dados.ts) -----------------------------------------------------------------
const HOST_VERCEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/
function enderecoDoSistema(bruto) {
  if (typeof bruto !== 'string') return null
  const t = bruto.trim()
  if (!t || t.length > 120 || /\s/.test(t)) return null
  let u
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password || u.port || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return null
  const h = u.hostname.toLowerCase()
  const base = h.startsWith('www.') ? h.slice(4) : h
  if (!HOST_VERCEL.test(h) && !dominioValido(base)) return null
  return `${u.protocol}//${h}`
}

const CHAVE_TOKEN_VERCEL = 'vercel/token' // cofre (DPAPI). Quem põe o token lá é o passo "contas" (ainda não ligado).
const HOST_RDAP_BR = 'rdap.registro.br'
const HOST_API_VERCEL = 'api.vercel.com'

// ---- JSON por https (só para a API da Vercel): mesma cerca de nomes.cjs, mas lê um corpo pequeno ---------------------------------
function pedirJson(host, caminho, { token, hostsPermitidos = [HOST_API_VERCEL], lookup = criarLookupSeguro(), timeoutMs = 8000, cliente = https, maxCorpo = 100_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!hostsPermitidos.includes(host) || !enderecoOficial(`https://${host}/`)) { reject(new Error('host-nao-permitido')); return }
    if (typeof caminho !== 'string' || !/^\/[a-zA-Z0-9/._-]+$/.test(caminho) || caminho.includes('..') || caminho.includes('//')) { reject(new Error('caminho-invalido')); return }
    let fim = false
    const acabar = (fn, v) => { if (fim) return; fim = true; clearTimeout(t); fn(v) }
    const req = cliente.request({
      protocol: 'https:', host, port: 443, path: caminho, method: 'GET', agent: false, lookup, timeout: timeoutMs, maxHeaderSize: 16384,
      headers: { Accept: 'application/json', 'User-Agent': 'Atlas', Connection: 'close', Authorization: `Bearer ${token}` },
    }, (res) => {
      if (res.statusCode !== 200) { acabar(reject, new Error('resposta-inesperada')); req.destroy(); return } // 3xx também: nunca segue redirect
      let corpo = ''
      res.setEncoding('utf8')
      res.on('data', (d) => { corpo += d; if (corpo.length > maxCorpo) { acabar(reject, new Error('resposta-grande')); req.destroy() } })
      res.on('end', () => { try { acabar(resolve, JSON.parse(corpo)) } catch { acabar(reject, new Error('resposta-inesperada')) } })
      res.on('error', () => acabar(reject, new Error('falhou')))
    })
    const t = setTimeout(() => { req.destroy(); acabar(reject, new Error('timeout')) }, timeoutMs)
    req.on('timeout', () => { req.destroy(); acabar(reject, new Error('timeout')) })
    req.on('error', () => acabar(reject, new Error('falhou')))
    req.end()
  })
}

/** Resposta de GET /v6/domains/<dominio>/config -> registros válidos. Formato não confirmado numa conta real (ver PENDENTE). */
function registrosDaConfigVercel(cfg) {
  const out = []
  const melhor = (lista) => (Array.isArray(lista) ? lista.filter((x) => x && typeof x === 'object').sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99))[0] : undefined)
  const v4 = melhor(cfg && cfg.recommendedIPv4)
  const ip = v4 && (Array.isArray(v4.value) ? v4.value[0] : v4.value)
  if (typeof ip === 'string') out.push({ tipo: 'A', nome: '@', valor: ip })
  const cn = melhor(cfg && cfg.recommendedCNAME)
  const alvo = cn && (Array.isArray(cn.value) ? cn.value[0] : cn.value)
  if (typeof alvo === 'string') out.push({ tipo: 'CNAME', nome: 'www', valor: alvo.replace(/\.$/, '').toLowerCase() })
  return out.filter(registroDnsValido)
}

// ---- DNS público -----------------------------------------------------------------------------------------------------------
function resolvedorPublico() {
  const r = new dns.promises.Resolver({ timeout: 3000, tries: 1 })
  r.setServers(['1.1.1.1', '8.8.8.8'])
  return r
}
const semPonto = (s) => String(s).replace(/\.$/, '').toLowerCase()

// ---- PDF do cartaz (escrito à mão: 1 página A4, Helvetica, QR em retângulos) ---------------------------------------------------
const esc = (t) => String(t).replace(/[^\x20-\xFF]/g, '?').replace(/[\\()]/g, (c) => `\\${c}`)
function montarPdf({ titulo, linhas, endereco, matriz }) {
  const W = 595; const H = 842
  const n = matriz.length
  const mod = Math.floor(360 / (n + 8)) || 1 // 4 módulos de silêncio de cada lado
  const lado = mod * n
  const x0 = Math.round((W - lado) / 2); const y0 = 330
  const c = []
  const centro = (txt, tam, y, fonte) => c.push(`BT /${fonte} ${tam} Tf ${Math.max(20, Math.round((W - String(txt).length * tam * 0.52) / 2))} ${y} Td (${esc(txt)}) Tj ET`)
  centro(titulo, 40, 740, 'F1')
  linhas.forEach((l, i) => centro(l, 16, 690 - i * 26, 'F2'))
  c.push('0 g')
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (matriz[y][x]) c.push(`${x0 + x * mod} ${y0 + (n - 1 - y) * mod} ${mod} ${mod} re f`)
  centro(endereco, 22, 280, 'F1')
  const fluxo = c.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(fluxo, 'latin1')} >>\nstream\n${fluxo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offs = []
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

function matrizQrPadrao(texto) {
  const qrcode = require('qrcode-generator')
  const q = qrcode(0, 'M')
  q.addData(texto, 'Byte')
  q.make()
  const n = q.getModuleCount()
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => q.isDark(y, x)))
}

/**
 * `deps`: { raiz, shell, cofre, pedirRdap?, pedirVercel?, resolvedor?, matrizQr? } (os quatro últimos: teste; padrão = o seguro).
 */
function criarPublicar({ raiz, shell, cofre, pedirRdap = (c) => pedirStatus(HOST_RDAP_BR, c, { hostsPermitidos: [HOST_RDAP_BR] }), pedirVercel = pedirJson, resolvedor = resolvedorPublico, matrizQr = matrizQrPadrao }) {
  const tokenVercel = async () => {
    let t = null
    try { t = await cofre.ler(CHAVE_TOKEN_VERCEL) } catch { /* cofre indisponível = sem token */ }
    return typeof t === 'string' && t ? t : null
  }

  return {
    async abrirSite(destino, dominio) {
      if (typeof destino !== 'string' || !Object.hasOwn(SITES_OFICIAIS, destino)) throw new Error('destino-invalido')
      if (dominio !== undefined && dominio !== null && !dominioValido(dominio)) throw new Error('dominio-invalido')
      const url = SITES_OFICIAIS[destino]
      if (!enderecoOficial(url)) throw new Error('host-nao-permitido')
      await abrirExterno(shell, url, HOSTS_OFICIAIS)
    },

    async nomeLivre(dominio) {
      if (!dominioValido(dominio)) return 'incerto'
      try {
        const livre = livreDoStatus(await pedirRdap(`/domain/${dominio}`))
        return livre === true ? 'livre' : livre === false ? 'ocupado' : 'incerto'
      } catch { return 'incerto' }
    },

    async lerDns(dominio) {
      if (!dominioValido(dominio)) throw new Error('dominio-invalido')
      const token = await tokenVercel()
      if (!token) throw new Error('sem-token-vercel')
      let cfg
      try { cfg = await pedirVercel(HOST_API_VERCEL, `/v6/domains/${dominio}/config`, { token }) } catch { throw new Error('dns-indisponivel') }
      const regs = registrosDaConfigVercel(cfg)
      if (!regs.length) throw new Error('dns-indisponivel')
      return regs
    },

    async dnsNoAr(dominio, registros) {
      if (!dominioValido(dominio) || !Array.isArray(registros) || registros.length === 0 || registros.length > 10) return false
      if (!registros.every(registroDnsValido)) return false
      try {
        const r = resolvedor()
        for (const reg of registros) {
          if (reg.tipo === 'A') {
            const ips = await r.resolve4(dominio)
            if (!Array.isArray(ips) || !ips.includes(reg.valor)) return false
          } else {
            const alvos = await r.resolveCname(`${reg.nome}.${dominio}`)
            if (!Array.isArray(alvos) || !alvos.some((a) => semPonto(a) === semPonto(reg.valor))) return false
          }
        }
        return true
      } catch { return false }
    },

    async publicarNoAr(slug) {
      if (typeof slug !== 'string' || !/^[a-z0-9]{1,40}$/.test(slug)) throw new Error('slug-invalido')
      if (!(await tokenVercel())) throw new Error('sem-token-vercel')
      // Com token ainda falta o fluxo de deploy (build, envio, projeto, ligar o Supabase vazio): não finge.
      throw new Error('publicar-nao-implementado')
    },

    async gerarCartaz(endereco, pasta) {
      const origem = enderecoDoSistema(endereco)
      if (!origem) throw new Error('endereco-invalido')
      const matriz = matrizQr(origem)
      const pdf = montarPdf({
        titulo: 'Instale o nosso app',
        linhas: ['1. Aponte a câmera do celular para o código abaixo.', '2. Abra o link que aparecer.', '3. Toque em "Adicionar à tela inicial".'],
        endereco: origem.replace(/^https?:\/\//, ''),
        matriz,
      })
      const r = gravarSemSobrescrever(raiz, pasta, ['entrega'], 'cartaz-instalar-app.pdf', pdf)
      return { arquivo: r.nome }
    },

    async lerProgresso(pasta) {
      let alvo
      try { alvo = caminhoSeguro(raiz, String(pasta), '.atlas', 'publicar.json') } catch { return null }
      const j = lerJson(alvo)
      if (!j || typeof j !== 'object' || typeof j.guia !== 'string' || !/^[a-z0-9-]{1,40}$/.test(j.guia) || !Number.isInteger(j.passo) || j.passo < 0 || j.passo > 99) return null
      return { guia: j.guia, passo: j.passo }
    },

    async gravarProgresso(pasta, p) {
      if (!p || typeof p.guia !== 'string' || !/^[a-z0-9-]{1,40}$/.test(p.guia) || !Number.isInteger(p.passo) || p.passo < 0 || p.passo > 99) throw new Error('progresso-invalido')
      pastaAtlas(raiz, String(pasta))
      gravarAtomico(caminhoSeguro(raiz, String(pasta), '.atlas', 'publicar.json'), JSON.stringify({ versao: 1, guia: p.guia, passo: p.passo }) + '\n')
    },
  }
}

module.exports = { criarPublicar, enderecoOficial, dominioValido, registroDnsValido, enderecoDoSistema, registrosDaConfigVercel, pedirJson, montarPdf, SITES_OFICIAIS, HOSTS_OFICIAIS, CHAVE_TOKEN_VERCEL }
