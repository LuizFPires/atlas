// Regras PURAS de segurança (sem electron, sem spawn): caminho dentro da raiz e URL oficial.
// Compartilhado por app/seguro.cjs e pelo teste vitest (src/app/seguro-puro.test.ts).
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const norm = process.platform === 'win32' ? (s) => s.toLowerCase() : (s) => s

/** Resolve `partes` dentro de `raiz`. Lança se sair da raiz, tiver fluxo ADS (a:b) ou algum pedaço existente for link/junção. */
function caminhoSeguro(raiz, ...partes) {
  const base = path.resolve(raiz)
  for (const p of partes.map(String)) {
    if (path.isAbsolute(p) || /^[a-z]:/i.test(p) || p.includes('\0')) throw new Error('caminho-fora-da-raiz')
    if (/:/.test(p)) throw new Error('caminho-invalido')
  }
  const alvo = path.resolve(base, ...partes.map(String))
  const prefixo = base.endsWith(path.sep) ? base : base + path.sep
  if (norm(alvo) !== norm(base) && !norm(alvo).startsWith(norm(prefixo))) throw new Error('caminho-fora-da-raiz')
  const resto = path.relative(base, alvo)
  let atual = base
  for (const p of ['', ...(resto ? resto.split(path.sep) : [])]) {
    atual = p ? path.join(atual, p) : atual
    let st
    try { st = fs.lstatSync(atual) } catch (e) { if (e.code === 'ENOENT') break; throw e }
    if (st.isSymbolicLink()) throw new Error('caminho-com-link')
  }
  return alvo
}

// Hosts oficiais. Acrescentar é mudar o código, nunca aceitar URL de dado.
const HOSTS_OFICIAIS = Object.freeze(['claude.ai', 'www.claude.ai', 'docs.claude.com', 'support.claude.com', 'github.com', 'vercel.com'])

// Pagamento: a compra de dentro do app abre SÓ a página de pagamento da Stripe (lista separada da dos sites oficiais).
const HOSTS_PAGAMENTO = Object.freeze(['checkout.stripe.com'])

/** Valida (https, sem usuário/senha, sem porta, host na allowlist). Devolve a URL normalizada ou lança. */
function urlOficial(url, hosts = HOSTS_OFICIAIS) {
  let u
  try { u = new URL(String(url)) } catch { throw new Error('url-invalida') }
  if (u.protocol !== 'https:' || u.username || u.password || u.port !== '' || !hosts.includes(u.hostname.toLowerCase())) throw new Error('host-nao-permitido')
  return u.toString()
}

module.exports = { caminhoSeguro, urlOficial, HOSTS_OFICIAIS, HOSTS_PAGAMENTO }
