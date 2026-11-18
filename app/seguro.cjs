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

const { caminhoSeguro, urlOficial, HOSTS_OFICIAIS } = require('./seguro-puro.cjs')

/** Cria um arquivo NOVO (flag 'wx': EEXIST se já existe). */
function criarArquivoExclusivo(caminho, conteudo) {
  fs.writeFileSync(caminho, conteudo, { flag: 'wx' })
}

/** Copia sem sobrescrever (COPYFILE_EXCL) e recusa origem que seja link simbólico. */
function copiarExclusivo(origem, destino) {
  if (fs.lstatSync(origem).isSymbolicLink()) throw new Error('origem-com-link')
  fs.copyFileSync(origem, destino, fs.constants.COPYFILE_EXCL)
}

/** shell.openExternal só para host oficial. `shell` vem do chamador (facilita teste). */
async function abrirExterno(shell, url, hosts = HOSTS_OFICIAIS) {
  await shell.openExternal(urlOficial(url, hosts))
}

/**
 * Localiza o Claude Code CLI de forma segura (sem shell, sem `where`). Devolve { cmd, prefixo, env } ou null.
 * Ordem: ATLAS_CLAUDE_EXE; no PATH, claude.exe; ou claude.cmd do npm -> usa o binário/cli.js que o shim aponta
 * (node_modules/@anthropic-ai/claude-code), pois .cmd não roda sem shell. Funciona com espaço no caminho (args em array).
 */
function resolverClaude(env = process.env) {
  const fixo = env.ATLAS_CLAUDE_EXE
  if (fixo) return /\.(cmd|bat)$/i.test(fixo) ? null : { cmd: fixo, prefixo: [], env }
  if (process.platform !== 'win32') return { cmd: 'claude', prefixo: [], env }
  const dirs = String(env.PATH || env.Path || '').split(path.delimiter).filter((d) => d && path.isAbsolute(d))
  for (const d of dirs) {
    const exe = path.join(d, 'claude.exe')
    if (fs.existsSync(exe)) return { cmd: exe, prefixo: [], env }
    if (fs.existsSync(path.join(d, 'claude.cmd'))) {
      const pkg = path.join(d, 'node_modules', '@anthropic-ai', 'claude-code')
      const bin = path.join(pkg, 'bin', 'claude.exe')
      if (fs.existsSync(bin)) return { cmd: bin, prefixo: [], env }
      const cli = path.join(pkg, 'cli.js')
      if (fs.existsSync(cli)) return { cmd: process.execPath, prefixo: [cli], env: { ...env, ELECTRON_RUN_AS_NODE: '1' } }
    }
  }
  return null
}

/**
 * Roda o Claude Code CLI. `args` é SEMPRE uma lista fixa escrita no código (nunca montada com texto do cliente
 * como flag); texto do cliente só entra por `entrada` (stdin). Sem shell (nunca), com timeout e saída limitada.
 * `cwd` (pasta da obra) deve vir de caminhoSeguro. Executável: resolverClaude (ou `resolvido` injetado em teste).
 */
function executarClaude(args, { cwd, entrada, timeoutMs = 30_000, maxSaida = 1_000_000, env = process.env, resolvido } = {}) {
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string' || /[\r\n\0]/.test(a))) return Promise.reject(new Error('args-invalidos'))
  const r = resolvido || resolverClaude(env)
  if (!r) return Promise.reject(new Error('claude-nao-instalado'))
  return new Promise((resolve, reject) => {
    let filho
    try { filho = spawn(r.cmd, [...r.prefixo, ...args], { cwd, env: r.env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }) } catch (e) {
      reject(new Error(e && e.code === 'ENOENT' ? 'claude-nao-instalado' : 'claude-falhou')); return
    }
    let out = ''
    let err = ''
    let fim = false
    const t = setTimeout(() => { filho.kill(); encerrar(reject, new Error('claude-timeout')) }, timeoutMs)
    function encerrar(fn, v) { if (fim) return; fim = true; clearTimeout(t); fn(v) }
    filho.stdout.on('data', (d) => { out += d; if (out.length > maxSaida) { filho.kill(); encerrar(reject, new Error('claude-saida-grande')) } })
    filho.stderr.on('data', (d) => { err = (err + d).slice(-4000) })
    filho.on('error', (e) => encerrar(reject, new Error(e.code === 'ENOENT' ? 'claude-nao-instalado' : 'claude-falhou')))
    filho.stdin.on('error', () => encerrar(reject, new Error('claude-indisponivel'))) // EPIPE: CLI fechou cedo
    filho.on('close', (codigo) => encerrar(resolve, { codigo, saida: out, erro: err }))
    try {
      if (typeof entrada === 'string') filho.stdin.end(entrada)
      else filho.stdin.end()
    } catch { encerrar(reject, new Error('claude-indisponivel')) }
  })
}

module.exports = { caminhoSeguro, criarArquivoExclusivo, copiarExclusivo, HOSTS_OFICIAIS, urlOficial, abrirExterno, executarClaude, resolverClaude }
