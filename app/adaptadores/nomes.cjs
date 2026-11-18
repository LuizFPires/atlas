// Adaptador real do PonteNomes (src/app/ponte-batismo.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  conferir(nome): limpa o nome (limparNome), tira o "slug" (só a-z0-9) e pergunta se <slug>.app e <slug>.com.br estão livres
//    pelos servidores RDAP OFICIAIS dos registros: .app => pubapi.registry.google (Google Registry), .com.br => rdap.registro.br
//    (Registro.br). 200 = registrado (livre:false); 404 = não registrado (livre:true); QUALQUER outra coisa (erro, timeout,
//    redirecionamento, 429/5xx, resposta estranha) = livre:null ("não consegui conferir"). Nunca vira "livre" por palpite.
//
//  ANTI-SSRF (a única parte do app que faz rede a pedido da tela, então vai bem apertada):
//   1. Host SÓ da allowlist fixa (HOSTS_RDAP, escrita no código). A tela só manda o NOME; o host nunca vem de dado. O caminho é
//      montado só com o slug [a-z0-9]{1,63} + sufixo fixo — nada de URL, barra, porta ou usuário do cliente.
//   2. DNS validado NA HORA DE CONECTAR: o `lookup` passado ao https.request resolve o nome, recusa se QUALQUER endereço não for
//      público (loopback, privado, link-local, CGNAT, multicast, documentação, 6to4/NAT64/Teredo, ULA, IPv4-mapeado) e entrega ao
//      socket justamente o IP já validado. Não há "validar e depois resolver de novo" (fecha DNS rebinding).
//   3. https obrigatório (certificado verificado), porta 443 fixa, sem agente/keep-alive, sem proxy próprio.
//   4. Sem redirecionamento: 3xx vira "não consegui conferir" (nunca se segue Location, nem para host da allowlist).
//   5. Timeout total de 8 s (e de inatividade do socket), cabeçalhos limitados (maxHeaderSize 16 KB) e o corpo NUNCA é lido: ao
//      chegar o status a conexão é derrubada. Não guarda cookie nem segredo; User-Agent genérico.
//   6. Cache de 10 min por endereço e no máximo 6 consultas ao mesmo tempo (não vira martelo no registro).
//
//  LIMITE CONHECIDO: "nomes parecidos já em uso" (marca/INPI/lojas) NÃO é conferido por aqui — não há API pública confiável. O
//  adaptador devolve `parecidos: []`. Pendência registrada em app/PENDENTE-ENTREGAR.md. Os formatos de resposta dos RDAP (200/404)
//  precisam de conferência numa máquina Windows com internet.
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (nomes.teste.cjs: lista de IPs, lookup bloqueando 127.0.0.1/10.x/::1,
// recusa de host fora da allowlist, sem rede). No app: em "Dar o nome", cada cartão mostra "nome livre · x.app livre" (ou ocupado).
'use strict'
const dns = require('node:dns')
const https = require('node:https')
const net = require('node:net')
const { limparNome, slugDominio } = require('./projeto-comum.cjs')

/** terminação -> { host oficial do RDAP, caminho }. Acrescentar é mudar o código, nunca aceitar host de dado. */
const RDAP = Object.freeze({
  app: Object.freeze({ host: 'pubapi.registry.google', caminho: (d) => `/rdap/domain/${d}` }),
  'com.br': Object.freeze({ host: 'rdap.registro.br', caminho: (d) => `/domain/${d}` }),
})
const HOSTS_RDAP = Object.freeze(Object.values(RDAP).map((r) => r.host))

// ---- IP público ----------------------------------------------------------------------------------------------------------
const bloqueio = new net.BlockList()
for (const [base, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) bloqueio.addSubnet(base, bits, 'ipv4')
for (const [base, bits] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
]) bloqueio.addSubnet(base, bits, 'ipv6')

/** true só para endereço IPv4/IPv6 literal e PÚBLICO. Qualquer outra coisa (inclusive texto que não é IP) => false. */
function ipPublico(ip) {
  const fam = net.isIP(String(ip))
  if (!fam) return false
  return !bloqueio.check(String(ip), fam === 4 ? 'ipv4' : 'ipv6')
}

/** `lookup` do https.request: resolve, recusa se QUALQUER endereço não for público e entrega só IP validado ao socket. */
function criarLookupSeguro(resolver = dns.lookup) {
  return (hostname, opcoes, cb) => {
    if (typeof opcoes === 'function') { cb = opcoes; opcoes = {} }
    resolver(hostname, { all: true, verbatim: true }, (err, enderecos) => {
      if (err) return cb(err)
      if (!Array.isArray(enderecos) || enderecos.length === 0 || !enderecos.every((e) => e && ipPublico(e.address))) return cb(new Error('ip-nao-publico'))
      if (opcoes && opcoes.all) return cb(null, enderecos.map((e) => ({ address: e.address, family: e.family })))
      return cb(null, enderecos[0].address, enderecos[0].family)
    })
  }
}

const SLUG_OK = /^[a-z0-9]{1,63}$/

/**
 * Pede só o STATUS HTTP de https://<host><caminho>. `host` precisa estar em `hostsPermitidos`; sem redirect; corpo nunca lido.
 * Rejeita em qualquer falha. (`lookup`, `hostsPermitidos` e `cliente` existem para teste; o padrão é o seguro.)
 */
function pedirStatus(host, caminho, { hostsPermitidos = HOSTS_RDAP, lookup = criarLookupSeguro(), timeoutMs = 8000, cliente = https } = {}) {
  return new Promise((resolve, reject) => {
    if (!hostsPermitidos.includes(host)) { reject(new Error('host-nao-permitido')); return }
    if (typeof caminho !== 'string' || !/^\/[a-z0-9/.-]+$/.test(caminho) || caminho.includes('..') || caminho.includes('//')) { reject(new Error('caminho-invalido')); return }
    let fim = false
    const acabar = (fn, v) => { if (fim) return; fim = true; clearTimeout(t); fn(v) }
    const req = cliente.request({
      protocol: 'https:', host, port: 443, path: caminho, method: 'GET', agent: false, lookup, timeout: timeoutMs, maxHeaderSize: 16384,
      headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'Atlas', Connection: 'close' },
    }, (res) => {
      const status = res.statusCode
      acabar(resolve, status)
      req.destroy() // o corpo nunca é lido
    })
    const t = setTimeout(() => { req.destroy(); acabar(reject, new Error('timeout')) }, timeoutMs)
    req.on('timeout', () => { req.destroy(); acabar(reject, new Error('timeout')) })
    req.on('error', (e) => acabar(reject, e))
    req.end()
  })
}

/** Status RDAP -> livre. Só 404 = livre; 200 = ocupado; o resto não se sabe. */
const livreDoStatus = (status) => (status === 404 ? true : status === 200 ? false : null)

/** `deps`: { pedir?, agora? } — `pedir(host, caminho)` existe para teste (padrão: pedirStatus seguro). */
function criarNomes({ pedir = (h, c) => pedirStatus(h, c), agora = () => Date.now() } = {}) {
  const cache = new Map() // dominio -> { ate, livre }
  const TTL = 10 * 60 * 1000
  const MAX_SIMULTANEAS = 6
  let emAndamento = 0

  async function conferirDominio(slug, termo) {
    const dominio = `${slug}.${termo}`
    const c = cache.get(dominio)
    if (c && c.ate > agora()) return { dominio, livre: c.livre }
    if (emAndamento >= MAX_SIMULTANEAS) return { dominio, livre: null }
    emAndamento++
    try {
      const r = RDAP[termo]
      const livre = livreDoStatus(await pedir(r.host, r.caminho(dominio)))
      if (livre !== null) cache.set(dominio, { ate: agora() + TTL, livre })
      return { dominio, livre }
    } catch { return { dominio, livre: null } } finally { emAndamento-- }
  }

  return {
    async conferir(nome) {
      const limpo = limparNome(String(nome ?? ''))
      const slug = slugDominio(limpo)
      if (!limpo || !SLUG_OK.test(slug)) throw new Error('nome-invalido')
      const enderecos = await Promise.all(Object.keys(RDAP).map((termo) => conferirDominio(slug, termo)))
      return { parecidos: [], enderecos } // parecidos: sem fonte confiável (ver "LIMITE CONHECIDO")
    },
  }
}

module.exports = { criarNomes, pedirStatus, criarLookupSeguro, ipPublico, livreDoStatus, HOSTS_RDAP, RDAP }
