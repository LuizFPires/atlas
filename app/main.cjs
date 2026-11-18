// Processo principal do app Atlas (Electron). Reaproveita o front (dist-app/, gerado por `npm run build:app`).
'use strict'
const { app, BrowserWindow, ipcMain, powerSaveBlocker, session } = require('electron')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { criarCofre } = require('./cofre.cjs')

const argv = process.argv.slice(1)
const cofre = criarCofre()
let bloqueio = null

if (!app.requestSingleInstanceLock()) app.quit()

function idDaMaquina() {
  try {
    const s = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8' })
    const m = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(s)
    if (m) return m[1]
  } catch { /* sem registro: cai no nome */ }
  return `${os.hostname()}|${os.userInfo().username}`
}

// Impressão digital: o id da máquina nunca sai em claro, só o SHA-256.
const hash = () => crypto.createHash('sha256').update(`atlas:${idDaMaquina()}`).digest('hex')

ipcMain.on('atlas:argv', (e) => { e.returnValue = argv })
ipcMain.handle('atlas:cofre:guardar', (_e, c, v) => cofre.guardar(String(c), String(v)))
ipcMain.handle('atlas:cofre:ler', (_e, c) => cofre.ler(String(c)))
ipcMain.handle('atlas:cofre:apagar', (_e, c) => cofre.apagar(String(c)))
ipcMain.handle('atlas:hash', () => hash())
ipcMain.handle('atlas:descricao', () => `${os.hostname().toUpperCase()} · Windows ${Number(os.release().split('.')[2]) >= 22000 ? '11' : '10'}`)
// O computador é o canteiro: durante a obra ele não pode dormir.
ipcMain.handle('atlas:sono', (_e, ligado) => {
  if (ligado && bloqueio === null) bloqueio = powerSaveBlocker.start('prevent-app-suspension')
  if (!ligado && bloqueio !== null) { powerSaveBlocker.stop(bloqueio); bloqueio = null }
})

function abrir() {
  // Abre junto com o Windows.
  app.setLoginItemSettings({ openAtLogin: true })
  // Microfone liberado só para o próprio app (tudo pode ser falado).
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, ok) => ok(permissao === 'media'))
  const janela = new BrowserWindow({
    width: 1100, height: 780, backgroundColor: '#141619', title: 'Atlas',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  janela.loadFile(path.join(__dirname, '..', 'dist-app', 'index.html'))
}

app.whenReady().then(abrir)
app.on('window-all-closed', () => app.quit())
