// Teste do primeiro uso no Mac (node --test app/adaptadores/preparar-mac.teste.cjs). M47, tela M5Preparando (aprovada em 24/11/2026).
// Sem rede e sem Mac: download, tar, xcode-select e npm são simulados.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { criarPrepararMac, ultimaLts } = require('./preparar-mac.cjs')

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-prep-'))

function montar({ gitPronto = true, ghNoMac = false, claudeNoMac = false, shaErrado = false } = {}) {
  const dadosApp = tmp(); const home = tmp()
  const chamadas = []
  let git = gitPronto
  const NODE_TGZ = Buffer.from('node-tar')
  const GH_ZIP = Buffer.from('gh-zip')
  const arquivos = {
    'https://nodejs.org/dist/index.json': JSON.stringify([{ version: 'v24.1.0', lts: false }, { version: 'v22.9.0', lts: 'Jod' }]),
    'https://nodejs.org/dist/v22.9.0/SHASUMS256.txt': `${shaErrado ? 'f'.repeat(64) : sha(NODE_TGZ)}  node-v22.9.0-darwin-arm64.tar.gz\n${'a'.repeat(64)}  node-v22.9.0-darwin-x64.tar.gz\n`,
    'https://nodejs.org/dist/v22.9.0/node-v22.9.0-darwin-arm64.tar.gz': NODE_TGZ,
    'https://api.github.com/repos/cli/cli/releases/latest': JSON.stringify({ tag_name: 'v2.80.0' }),
    'https://github.com/cli/cli/releases/download/v2.80.0/gh_2.80.0_checksums.txt': `${sha(GH_ZIP)}  gh_2.80.0_macOS_arm64.zip\n`,
    'https://github.com/cli/cli/releases/download/v2.80.0/gh_2.80.0_macOS_arm64.zip': GH_ZIP,
  }
  const baixar = async (url) => { chamadas.push(`baixar ${url}`); if (!(url in arquivos)) throw new Error('404'); const v = arquivos[url]; return Buffer.isBuffer(v) ? v : Buffer.from(v) }
  const ferr = path.join(dadosApp, 'ferramentas')
  const rodar = async (cmd, args) => {
    chamadas.push(`${path.basename(cmd)} ${args.join(' ')}`)
    if (cmd.endsWith('xcode-select') && args[0] === '-p') return { codigo: git ? 0 : 2, saida: git ? '/Library/Developer/CommandLineTools' : '' }
    if (cmd.endsWith('xcode-select') && args[0] === '--install') { setTimeout(() => { git = true }, 5); return { codigo: 0, saida: '' } }
    if (cmd.endsWith('tar')) { fs.mkdirSync(path.join(ferr, 'node-v22.9.0-darwin-arm64', 'bin'), { recursive: true }); fs.writeFileSync(path.join(ferr, 'node-v22.9.0-darwin-arm64', 'bin', 'node'), ''); fs.writeFileSync(path.join(ferr, 'node-v22.9.0-darwin-arm64', 'bin', 'npm'), ''); return { codigo: 0, saida: '' } }
    if (cmd.endsWith('ditto')) { const d = args[args.length - 1]; fs.mkdirSync(path.join(d, 'gh_2.80.0_macOS_arm64', 'bin'), { recursive: true }); fs.writeFileSync(path.join(d, 'gh_2.80.0_macOS_arm64', 'bin', 'gh'), ''); return { codigo: 0, saida: '' } }
    if (cmd.endsWith('npm')) { fs.writeFileSync(path.join(ferr, 'node', 'bin', 'claude'), ''); return { codigo: 0, saida: '' } }
    return { codigo: 1, saida: '' }
  }
  const PATH = `${path.join(ferr, 'node', 'bin')}:${path.join(ferr, 'bin')}:/usr/bin`
  const existeNoSistema = (f) => (ghNoMac && f === '/usr/local/bin/gh') || (claudeNoMac && f === `${home}/.local/bin/claude`)
  const p = criarPrepararMac({ dadosApp, home, baixar, rodar, arch: 'arm64', PATH: () => `${PATH}:/usr/local/bin:${home}/.local/bin`, existe: (f) => ((f.startsWith(dadosApp) || f.startsWith(home)) && fs.existsSync(f)) || existeNoSistema(f), esperaGitMs: 1, maxEsperaGitMs: 2000 })
  return { p, chamadas, dadosApp, home, ferr }
}

test('Node: pega a última versão LTS oficial', () => {
  assert.equal(ultimaLts([{ version: 'v25.0.0', lts: false }, { version: 'v24.11.0', lts: 'Krypton' }, { version: 'v22.9.0', lts: 'Jod' }]), 'v24.11.0')
  assert.equal(ultimaLts([]), null)
})

test('Mac limpo: instala Node, Git (pelo clique da Apple), GitHub e Claude Code, e cria ~/Atlas/Obras, sem senha de administrador', async () => {
  const { p, chamadas, ferr, home } = montar({ gitPronto: false })
  const fim = await p.preparar()
  assert.equal(fim.pronto, true)
  assert.deepEqual(fim.passos.map((x) => x.estado), ['pronto', 'pronto', 'pronto', 'pronto', 'pronto'])
  assert.ok(fs.existsSync(path.join(ferr, 'node', 'bin', 'node')))
  assert.ok(fs.existsSync(path.join(ferr, 'bin', 'gh')))
  assert.ok(chamadas.includes('xcode-select --install'))
  assert.ok(chamadas.some((c) => c.startsWith('npm install -g @anthropic-ai/claude-code --prefix ')))
  assert.ok(fs.existsSync(path.join(home, 'Atlas', 'Obras')))
  assert.ok(!chamadas.some((c) => /sudo|curl|\| *sh/.test(c)), 'nada de sudo nem curl | sh')
})

test('o que já está no Mac não é instalado de novo (GitHub e Claude já instalados)', async () => {
  const { p, chamadas } = montar({ ghNoMac: true, claudeNoMac: true })
  const fim = await p.preparar()
  assert.equal(fim.pronto, true)
  assert.ok(!chamadas.some((c) => c.includes('cli/cli')))
  assert.ok(!chamadas.some((c) => c.startsWith('npm ')))
})

test('arquivo baixado que não bate com a impressão digital oficial: não instala, para com recado claro', async () => {
  const { p, ferr } = montar({ shaErrado: true })
  const fim = await p.preparar()
  assert.equal(fim.pronto, false)
  assert.equal(fim.passos[0].estado, 'erro')
  assert.match(fim.passos[0].dica, /internet|de novo/i)
  assert.ok(!fs.existsSync(path.join(ferr, 'node', 'bin', 'node')))
})

test('durante o pedido da Apple, o passo do Git fica "esperando você" com a explicação do clique', async () => {
  const { p } = montar({ gitPronto: false })
  const visto = []
  const prom = p.preparar({ aoMudar: (e) => visto.push(e.passos[1].estado) })
  await prom
  assert.ok(visto.includes('esperando-voce'))
  assert.match(p.estado().passos[1].txt, /Apple/)
})
