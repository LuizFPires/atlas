// Primitivas seguras compartilhadas pelos adaptadores do processo principal (Electron, só Windows).
//
// O QUE FAZ:
//  1. caminhoSeguro / criarArquivoExclusivo / copiarExclusivo: tudo dentro de uma raiz (Atlas\Obras), sem symlink, sem sobrescrever.
//  2. abrirExterno: shell.openExternal só para hosts oficiais da allowlist (nunca URL vinda de dado).
//  3. executarClaude: roda o Claude Code CLI de forma controlada (spawn, args fixos, sem shell, timeout, saída limitada).
//
// COMO TESTAR (Windows): `node -e "const s=require('./app/seguro.cjs'); console.log(s.caminhoSeguro('C:/r','a/b'))"`;
// tentar '..' ou um link simbólico dentro da raiz deve lançar 'caminho-fora-da-raiz' / 'caminho-com-link'.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const norm = process.platform === 'win32' ? (s) => s.toLowerCase() : (s) => s

/** Resolve `partes` dentro de `raiz`. Lança se sair da raiz ou se algum pedaço existente for link simbólico/junção. */
function caminhoSeguro(raiz, ...partes) {
  const base = path.resolve(raiz)
  const alvo = path.resolve(base, ...partes.map(String))
  const prefixo = base.endsWith(path.sep) ? base : base + path.sep
  if (norm(alvo) !== norm(base) && !norm(alvo).startsWith(norm(prefixo))) throw new Error('caminho-fora-da-raiz')
  // Confere cada degrau existente de base até alvo (lstat não segue link).
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

/** Cria um arquivo NOVO (flag 'wx': EEXIST se já existe). */
function criarArquivoExclusivo(caminho, conteudo) {
  fs.writeFileSync(caminho, conteudo, { flag: 'wx' })
}

/** Copia sem sobrescrever (COPYFILE_EXCL) e recusa origem que seja link simbólico. */
function copiarExclusivo(origem, destino) {
  if (fs.lstatSync(origem).isSymbolicLink()) throw new Error('origem-com-link')
  fs.copyFileSync(origem, destino, fs.constants.COPYFILE_EXCL)
}

// Hosts oficiais. Acrescentar é mudar o código, nunca aceitar URL de dado.
const HOSTS_OFICIAIS = Object.freeze(['claude.ai', 'www.claude.ai', 'docs.claude.com', 'support.claude.com', 'github.com', 'vercel.com'])

/** Valida (https, sem usuário/senha, host na allowlist). Devolve a URL normalizada ou lança. */
function urlOficial(url, hosts = HOSTS_OFICIAIS) {
  let u
  try { u = new URL(String(url)) } catch { throw new Error('url-invalida') }
  if (u.protocol !== 'https:' || u.username || u.password || !hosts.includes(u.hostname.toLowerCase())) throw new Error('host-nao-permitido')
  return u.toString()
}

/** shell.openExternal só para host oficial. `shell` vem do chamador (facilita teste). */
async function abrirExterno(shell, url, hosts = HOSTS_OFICIAIS) {
  await shell.openExternal(urlOficial(url, hosts))
}

/**
 * Roda o Claude Code CLI. `args` é SEMPRE uma lista fixa escrita no código (nunca montada com texto do cliente
 * como flag); texto do cliente só entra por `entrada` (stdin). Sem shell, com timeout e saída limitada.
 * `cwd` (pasta da obra) deve vir de caminhoSeguro. `exe` pode ser trocado por ATLAS_CLAUDE_EXE (ex.: caminho do claude.exe).
 * Se for .cmd/.bat (npm no Windows), roda via cmd.exe e só aceita args simples (letras, números, . / : = @ -).
 */
function executarClaude(args, { cwd, entrada, timeoutMs = 30_000, maxSaida = 1_000_000, exe = process.env.ATLAS_CLAUDE_EXE || 'claude', env = process.env } = {}) {
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string' || /[\r\n\0]/.test(a))) return Promise.reject(new Error('args-invalidos'))
  const ehCmd = /\.(cmd|bat)$/i.test(exe)
  if (ehCmd && args.some((a) => !/^[\w./:=@-]+$/.test(a))) return Promise.reject(new Error('args-invalidos'))
  return new Promise((resolve, reject) => {
    const filho = ehCmd
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', exe, ...args], { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(exe, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    let fim = false
    const t = setTimeout(() => { filho.kill(); encerrar(reject, new Error('claude-timeout')) }, timeoutMs)
    function encerrar(fn, v) { if (fim) return; fim = true; clearTimeout(t); fn(v) }
    filho.stdout.on('data', (d) => { out += d; if (out.length > maxSaida) { filho.kill(); encerrar(reject, new Error('claude-saida-grande')) } })
    filho.stderr.on('data', (d) => { err = (err + d).slice(-4000) })
    filho.on('error', (e) => encerrar(reject, new Error(e.code === 'ENOENT' ? 'claude-nao-instalado' : 'claude-falhou')))
    filho.on('close', (codigo) => encerrar(resolve, { codigo, saida: out, erro: err }))
    if (typeof entrada === 'string') filho.stdin.end(entrada)
    else filho.stdin.end()
  })
}

module.exports = { caminhoSeguro, criarArquivoExclusivo, copiarExclusivo, HOSTS_OFICIAIS, urlOficial, abrirExterno, executarClaude }
