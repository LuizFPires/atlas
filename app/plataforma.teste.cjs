// Teste do que muda entre Mac e Windows (node --test app/plataforma.teste.cjs). M46: o Atlas roda no Mac.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { pastasDeProgramasMac, pathCompleto, acharPrograma, idDoMac, pararArvore } = require('./plataforma.cjs')

test('Mac: o Atlas aberto pelo Finder enxerga as pastas onde ficam claude, gh, git e node (as do próprio Atlas primeiro)', () => {
  const p = pastasDeProgramasMac({ home: '/Users/ze', dadosApp: '/Users/ze/Library/Application Support/Atlas' })
  assert.equal(p[0], '/Users/ze/Library/Application Support/Atlas/ferramentas/node/bin')
  for (const d of ['/Users/ze/.local/bin', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']) assert.ok(p.includes(d), d)
  const path = pathCompleto('/usr/bin:/bin:/usr/sbin:/sbin', p)
  assert.ok(path.startsWith('/Users/ze/Library/Application Support/Atlas/ferramentas/node/bin:'))
  assert.equal(path.split(':').filter((x) => x === '/usr/bin').length, 1, 'sem repetir pasta')
})

test('acha o programa pelo caminho completo (ou null: aí o Atlas mostra "o Claude não está instalado")', () => {
  const existe = (f) => f === '/Users/ze/.local/bin/claude'
  assert.equal(acharPrograma('claude', '/usr/bin:/Users/ze/.local/bin', existe), '/Users/ze/.local/bin/claude')
  assert.equal(acharPrograma('gh', '/usr/bin:/Users/ze/.local/bin', existe), null)
  assert.equal(acharPrograma('../claude', '/usr/bin', () => true), null, 'nome com caminho é recusado')
})

test('licença: o Mac é identificado pelo número do hardware, não pelo nome do computador (que muda fácil)', () => {
  const saida = '+-o MacBookAir10,1  <class IOPlatformExpertDevice>\n    {\n      "IOPlatformSerialNumber" = "C02XXXX"\n      "IOPlatformUUID" = "8A3F1C2E-1B2D-4C5E-9F10-ABCDEF123456"\n    }'
  assert.equal(idDoMac(saida), '8A3F1C2E-1B2D-4C5E-9F10-ABCDEF123456')
  assert.equal(idDoMac('nada aqui'), null)
})

test('pausar no Mac derruba o grupo inteiro (Claude e subagentes); no Windows usa o taskkill da árvore', () => {
  const sinais = []
  const kill = (pid, s) => sinais.push([pid, s])
  let agendado = null
  pararArvore({ pid: 4321, kill: () => sinais.push(['filho']) }, { plataforma: 'darwin', kill, agendar: (f) => { agendado = f } })
  assert.deepEqual(sinais, [[-4321, 'SIGTERM']])
  agendado()
  assert.deepEqual(sinais[1], [-4321, 'SIGKILL'])
  const chamadas = []
  pararArvore({ pid: 99, kill: () => {} }, { plataforma: 'win32', executar: (cmd, args) => chamadas.push([cmd, ...args]) })
  assert.deepEqual(chamadas[0], ['taskkill', '/pid', '99', '/T', '/F'])
})

test('Mac (M48): a troca do Atlas.app roda depois que o Atlas fecha, num processo à parte, e desfaz se algo falhar', () => {
  const { trocarAppMac, SCRIPT_TROCA } = require('./plataforma.cjs')
  const chamadas = []
  const spawn = (cmd, args, o) => { chamadas.push({ cmd, args, o }); return { unref: () => {} } }
  assert.equal(trocarAppMac('/u/Atlas-0.1.42.zip', { reabrir: true }, { spawn, execPath: '/Applications/Atlas.app/Contents/MacOS/Atlas', pid: 123 }), true)
  const c = chamadas[0]
  assert.equal(c.cmd, '/bin/sh')
  assert.deepEqual(c.args.slice(2), ['atlas-atualizar', '123', '/u/Atlas-0.1.42.zip', '/Applications/Atlas.app', '1'])
  assert.equal(c.o.detached, true)
  assert.match(SCRIPT_TROCA, /kill -0/)
  assert.match(SCRIPT_TROCA, /ditto -x -k/)
  assert.match(SCRIPT_TROCA, /\.old" "\$app"/, 'volta a versão antiga se a nova não entrar')
  assert.equal(trocarAppMac('/u/x.zip', {}, { spawn, execPath: '/usr/local/bin/electron', pid: 1 }), false, 'fora de um Atlas.app (modo dev): não mexe em nada')
})
