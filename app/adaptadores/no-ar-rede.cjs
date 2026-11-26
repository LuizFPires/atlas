// Rede do "Colocar no ar" (no-ar.cjs), com a mesma cerca de nomes.cjs: host fixo, DNS conferido na conexão (só IP público),
// https na porta 443, sem seguir redirecionamento, tempo e tamanho limitados.
//  pedirApiSupabase(metodo, caminho, corpo, token): SÓ api.supabase.com, caminho /v1/... fixo do adaptador. O token vai no cabeçalho
//    (nunca no endereço) e nunca aparece em erro. Resposta 2xx = JSON; outra = erro curto ('supabase-<código>').
//  sondarDominio(dominio): só https://<domínio .br do cliente>/ (M57, o cadeado chegou?).
//  sondarSite(url): SÓ https://<nome>.vercel.app/ (ou a mesma origem). Devolve status, cabeçalhos e até 200 KB do corpo.
'use strict'
const https = require('node:https')
const { criarLookupSeguro } = require('./nomes.cjs')

const HOST_API = 'api.supabase.com'
const SITE = /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)\.vercel\.app\/?$/

function pedir({ host, metodo, caminho, corpo = null, cabecalhos = {}, timeoutMs = 20_000, maxCorpo = 1_000_000, lookup = criarLookupSeguro(), cliente = https }) {
  return new Promise((resolve, reject) => {
    let fim = false
    const acabar = (fn, v) => { if (fim) return; fim = true; clearTimeout(t); fn(v) }
    const dados = corpo === null ? null : Buffer.from(JSON.stringify(corpo), 'utf8')
    const req = cliente.request({
      protocol: 'https:', host, port: 443, path: caminho, method: metodo, agent: false, lookup, timeout: timeoutMs, maxHeaderSize: 16384,
      headers: { 'User-Agent': 'Atlas', Connection: 'close', ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': dados.length } : {}), ...cabecalhos },
    }, (res) => {
      let texto = ''
      res.setEncoding('utf8')
      res.on('data', (d) => { if (texto.length < maxCorpo) texto += d })
      res.on('end', () => acabar(resolve, { status: res.statusCode || 0, cabecalhos: res.headers || {}, corpo: texto.slice(0, maxCorpo) }))
      res.on('error', () => acabar(reject, new Error('falhou')))
    })
    const t = setTimeout(() => { req.destroy(); acabar(reject, new Error('timeout')) }, timeoutMs)
    req.on('timeout', () => { req.destroy(); acabar(reject, new Error('timeout')) })
    req.on('error', () => acabar(reject, new Error('falhou')))
    if (dados) req.write(dados)
    req.end()
  })
}

async function pedirApiSupabase(metodo, caminho, corpo, token, { enviar = pedir } = {}) {
  if (!['GET', 'POST'].includes(metodo)) throw new Error('metodo-invalido')
  if (typeof caminho !== 'string' || !/^\/v1\/[a-z0-9/_-]+$/.test(caminho) || caminho.includes('..')) throw new Error('caminho-invalido')
  if (typeof token !== 'string' || !token) throw new Error('sem-token')
  const r = await enviar({ host: HOST_API, metodo, caminho, corpo, cabecalhos: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
  if (r.status < 200 || r.status >= 300) {
    // Conta grátis com 2 projetos ativos (limite do Supabase): motivo próprio, para a tela dizer o que fazer (26/11/2026).
    if ((r.status === 400 || r.status === 402) && /maximum limits?.{0,80}free projects?|free project limit/i.test(String(r.corpo || '').slice(0, 2000))) throw new Error('supabase-limite-gratis')
    throw new Error(`supabase-${r.status}`)
  }
  try { return JSON.parse(r.corpo || 'null') } catch { throw new Error('supabase-resposta') }
}

async function sondarSite(url, { enviar = pedir } = {}) {
  const m = SITE.exec(String(url))
  if (!m) throw new Error('site-invalido')
  return enviar({ host: `${m[1]}.vercel.app`, metodo: 'GET', caminho: '/', cabecalhos: { Accept: 'text/html' }, maxCorpo: 200_000 })
}

// M57: https://<domínio do cliente>/ — só domínio do Registro.br (dominio.cjs valida), sem seguir redirect, IP público.
async function sondarDominio(dominio, { enviar = pedir } = {}) {
  const { dominioValido } = require('./dominio.cjs')
  if (!dominioValido(dominio)) throw new Error('dominio-invalido')
  return enviar({ host: dominio, metodo: 'GET', caminho: '/', cabecalhos: { Accept: 'text/html' }, maxCorpo: 1000 })
}

module.exports = { pedirApiSupabase, sondarSite, sondarDominio, pedir, HOST_API }
