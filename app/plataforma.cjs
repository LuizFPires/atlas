// O que muda entre Mac e Windows (M46: o Atlas roda no Mac, aprovado pelo Luiz em 24/11/2026). Lógica pura e testável.
//  - pastasDeProgramasMac / pathCompleto: um app aberto pelo Finder recebe um PATH mínimo (/usr/bin:/bin…) e não acha claude, gh,
//    git nem node. O Atlas acrescenta as pastas certas (as dele primeiro: o Node portátil e as ferramentas que ele instala).
//  - acharPrograma: o caminho completo de um programa no PATH (null = não instalado: a tela explica, nada quebra no meio).
//  - idDoMac: o número de hardware do Mac (IOPlatformUUID) para a licença, nunca o nome do computador.
//  - pararArvore: pausar derruba a linha inteira. No Mac, o Claude e os subagentes rodam num grupo próprio de processos (spawn com
//    detached) e o grupo todo recebe o sinal; no Windows, taskkill /T. Sem isso um subagente seguiria escondido, gastando cota.
'use strict'
const fs = require('node:fs')
const path = require('node:path')

function pastasDeProgramasMac({ home, dadosApp }) {
  return [
    path.posix.join(dadosApp, 'ferramentas', 'node', 'bin'),
    path.posix.join(dadosApp, 'ferramentas', 'bin'),
    path.posix.join(home, '.local', 'bin'), // Claude Code (instalador oficial)
    path.posix.join(home, '.claude', 'local'),
    '/opt/homebrew/bin', '/usr/local/bin', // Homebrew (chip da Apple / Intel)
    '/usr/bin', '/bin', '/usr/sbin', '/sbin',
  ]
}

function pathCompleto(atual, extras, delim = ':') {
  const vistos = new Set()
  const out = []
  for (const d of [...extras, ...String(atual || '').split(delim)]) {
    if (!d || vistos.has(d)) continue
    vistos.add(d); out.push(d)
  }
  return out.join(delim)
}

function acharPrograma(nome, PATH, existe = fs.existsSync, delim = ':') {
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(String(nome))) return null
  for (const d of String(PATH || '').split(delim)) {
    if (!d || !d.startsWith('/')) continue
    const f = path.posix.join(d, nome)
    try { if (existe(f)) return f } catch { /* próxima */ }
  }
  return null
}

function idDoMac(saidaIoreg) {
  const m = /"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]{36})"/.exec(String(saidaIoreg || ''))
  return m ? m[1].toUpperCase() : null
}

function pararArvore(filho, { plataforma = process.platform, kill = process.kill, executar = null, agendar = (f) => setTimeout(f, 3000).unref?.() } = {}) {
  if (!filho || !filho.pid) { try { filho && filho.kill() } catch { /* já saiu */ } return }
  if (plataforma === 'win32') {
    const rodar = executar || ((cmd, args) => require('node:child_process').execFile(cmd, args, { windowsHide: true }, () => {}))
    try { rodar('taskkill', ['/pid', String(filho.pid), '/T', '/F']) } catch { filho.kill() }
    return
  }
  try { kill(-filho.pid, 'SIGTERM') } catch { try { filho.kill('SIGTERM') } catch { /* já saiu */ } }
  agendar(() => { try { kill(-filho.pid, 'SIGKILL') } catch { /* o grupo já acabou */ } })
}

module.exports = { pastasDeProgramasMac, pathCompleto, acharPrograma, idDoMac, pararArvore }
