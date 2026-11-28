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
  if (!['GET', 'POST', 'PATCH'].includes(metodo)) throw new Error('metodo-invalido')
  if (typeof caminho !== 'string' || !/^\/v1\/[a-z0-9/_-]+(\?reveal=true)?$/.test(caminho) || caminho.includes('..')) throw new Error('caminho-invalido')
  // PATCH só para a configuração de login do projeto (links de senha e envio de e-mail).
  if (metodo === 'PATCH' && !/^\/v1\/projects\/[a-z0-9]{10,40}\/config\/auth$/.test(caminho)) throw new Error('caminho-invalido')
  if (typeof token !== 'string' || !token) throw new Error('sem-token')
  const r = await enviar({ host: HOST_API, metodo, caminho, corpo, cabecalhos: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
  if (r.status < 200 || r.status >= 300) {
    // Conta grátis com 2 projetos ativos (limite do Supabase): motivo próprio, para a tela dizer o que fazer (26/11/2026).
    if ((r.status === 400 || r.status === 402) && /maximum limits?.{0,80}free projects?|free project limit/i.test(String(r.corpo || '').slice(0, 2000))) throw new Error('supabase-limite-gratis')
    // O motivo do Supabase (ex.: o erro do SQL) vai junto para a tela; o token nunca está na resposta.
    let msg = ''
    try { const j = JSON.parse(r.corpo || '{}'); msg = String((j && (j.message || j.error || j.msg)) || '') } catch { msg = String(r.corpo || '') }
    throw Object.assign(new Error(`supabase-${r.status}`), msg ? { detalhe: msg.slice(0, 1500) } : {})
  }
  try { return JSON.parse(r.corpo || 'null') } catch { throw new Error('supabase-resposta') }
}

// Conta do dono (primeiro acesso): SÓ https://<ref>.supabase.co/auth/v1/admin/users. A chave secreta vai no cabeçalho, nunca
// no endereço nem no erro.
async function pedirAuthSupabase(ref, metodo, caminho, corpo, chave, { enviar = pedir } = {}) {
  if (typeof ref !== 'string' || !/^[a-z0-9]{10,40}$/.test(ref)) throw new Error('caminho-invalido')
  // POST cria a conta do dono; GET lista (para achar a conta pelo e-mail); PUT grava a senha que o dono digitou no Atlas.
  const ok = (metodo === 'POST' && caminho === '/auth/v1/admin/users')
    || (metodo === 'GET' && /^\/auth\/v1\/admin\/users\?page=\d{1,3}&per_page=\d{1,4}$/.test(caminho))
    || (metodo === 'PUT' && /^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}$/.test(caminho))
  if (!['POST', 'GET', 'PUT'].includes(metodo)) throw new Error('metodo-invalido')
  if (!ok) throw new Error('caminho-invalido')
  if (typeof chave !== 'string' || !chave) throw new Error('sem-token')
  const r = await enviar({ host: `${ref}.supabase.co`, metodo, caminho, corpo, cabecalhos: { Accept: 'application/json', apikey: chave, Authorization: `Bearer ${chave}` } })
  if (r.status < 200 || r.status >= 300) {
    let msg = ''
    try { const j = JSON.parse(r.corpo || '{}'); msg = String((j && (j.error_code || j.code || j.msg || j.message || j.error)) || '') } catch { msg = '' }
    throw Object.assign(new Error(`supabase-${r.status}`), msg ? { detalhe: msg.replace(/[\w.+-]+@[\w.-]+/g, '[e-mail]').slice(0, 200) } : {})
  }
  try { return JSON.parse(r.corpo || 'null') } catch { return null }
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

module.exports = { pedirApiSupabase, pedirAuthSupabase, sondarSite, sondarDominio, pedir, HOST_API }
