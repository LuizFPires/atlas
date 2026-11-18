// Processo principal do app Atlas (Electron). Reaproveita o front (dist-app/, gerado por `npm run build:app`).
'use strict'
const { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker, session, shell } = require('electron')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { criarCofre } = require('./cofre.cjs')
const { criarObras } = require('./adaptadores/obras.cjs')
const { criarArquivos } = require('./adaptadores/arquivos.cjs')
const { criarClaude } = require('./adaptadores/claude.cjs')
const { criarModo } = require('./adaptadores/modo.cjs')
const { criarConstrucao } = require('./adaptadores/construcao.cjs')
const { criarPainel } = require('./adaptadores/painel.cjs')
const { criarRetomar } = require('./adaptadores/retomar.cjs')

const argv = process.argv.slice(1)
const cofre = criarCofre()
let bloqueio = null
let janelaPrincipal = null

// Adaptadores reais (um por porta do front). Pendentes: ver app/PENDENTE-ENTREGAR.md.
const obras = criarObras({ shell })
const arquivos = criarArquivos({ raiz: obras.raiz(), dialog, janela: () => janelaPrincipal })
const claude = criarClaude({ shell })
const modos = criarModo({ raiz: obras.raiz() })
const construcao = criarConstrucao({ raiz: obras.raiz(), modos, claudeEstado: () => claude.estado(), pluginDir: process.env.ATLAS_KIT_PLUGIN || null, dadosApp: require('node:path').join(app.getPath('userData'), 'git-isolado') })
const painel = criarPainel({ raiz: obras.raiz(), modos, construcao, shell })
// cota: sem adaptador real ainda (pendente); sem ele o Retomar só liga a linha por painel.continuar.
const retomar = criarRetomar({ raiz: obras.raiz(), painel, construcao })

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

// Só a nossa janela (página local do app) pode falar com o processo principal.
const confiavel = (e) => janelaPrincipal !== null && e.sender === janelaPrincipal.webContents && String(e.senderFrame?.url ?? '').startsWith('file://')
const protegido = (fn) => (e, ...a) => { if (!confiavel(e)) throw new Error('remetente-nao-confiavel'); return fn(...a) }
const handle = (canal, fn) => ipcMain.handle(canal, (e, ...a) => protegido(fn)(e, ...a))

ipcMain.on('atlas:argv', (e) => { e.returnValue = argv })
handle('atlas:cofre:guardar', (c, v) => cofre.guardar(String(c), String(v)))
handle('atlas:cofre:ler', (c) => cofre.ler(String(c)))
handle('atlas:cofre:apagar', (c) => cofre.apagar(String(c)))
handle('atlas:hash', () => hash())
handle('atlas:descricao', () => `${os.hostname().toUpperCase()} · Windows ${Number(os.release().split('.')[2]) >= 22000 ? '11' : '10'}`)

// Arquivos da obra, pasta das obras e Claude (portas de base).
handle('atlas:arquivos:escolher', (tipo) => arquivos.escolher(String(tipo)))
handle('atlas:arquivos:guardar', (pasta, destino, token) => arquivos.guardar(String(pasta), String(destino), String(token)))
ipcMain.on('atlas:obras:raiz', (e) => { e.returnValue = confiavel(e) ? obras.raiz() : '' })
handle('atlas:obras:listar', () => obras.listar())
handle('atlas:obras:criar', (nome) => obras.criarSubpasta(String(nome)))
handle('atlas:obras:abrir', () => obras.abrirPasta())
handle('atlas:claude:login', () => claude.abrirLogin())
handle('atlas:claude:site', (alvo) => claude.abrirSite(String(alvo)))
handle('atlas:claude:estado', () => claude.estado())
handle('atlas:claude:renovar', () => claude.renovarConexao())

// Modo da obra (automático | passo a passo): <obra>\.atlas\modo.json.
handle('atlas:modos:ler', (pasta) => modos.ler(String(pasta)))
handle('atlas:modos:gravar', (pasta, modo) => modos.gravar(String(pasta), String(modo)))

// Planejar e iniciar a construção (PLAN.md + linha de produção do kit na pasta da obra).
handle('atlas:construcao:planejar', (pasta, nome) => construcao.planejar(String(pasta), String(nome)))
handle('atlas:construcao:iniciar', (pasta, nome, modo, etapas) => construcao.iniciar(String(pasta), String(nome), String(modo), Array.isArray(etapas) ? etapas : []))

// Painel da obra: andamento, pausa/continua, OK da etapa, modo, canteiro 3D (só 127.0.0.1) e versão de teste.
handle('atlas:painel:ler', (pasta) => painel.ler(String(pasta)))
handle('atlas:painel:pausar', (pasta) => painel.pausar(String(pasta)))
handle('atlas:painel:continuar', (pasta) => painel.continuar(String(pasta)))
handle('atlas:painel:aprovar', (pasta) => painel.aprovarEtapa(String(pasta)))
handle('atlas:painel:modo', (pasta, modo) => painel.aplicarModo(String(pasta), String(modo)))
ipcMain.on('atlas:painel:endereco', (e, pasta) => { e.returnValue = confiavel(e) ? painel.enderecoCanteiro(String(pasta)) : null })
handle('atlas:painel:teste', (pasta) => painel.abrirTeste(String(pasta)))

// Retomar (F12): obra em andamento ao abrir o app e "Continuar obra".
handle('atlas:retomar:andamento', () => retomar.obraEmAndamento())
handle('atlas:retomar:continuar', (pasta) => retomar.continuar({ pasta: String(pasta) }))

// Ao fechar: derruba a linha de produção e o canteiro que o Atlas subiu (o PLAN guarda o ponto; Retomar religa depois).
app.on('before-quit', () => { construcao.encerrar(); painel.encerrar() })

// O computador é o canteiro: durante a obra ele não pode dormir.
handle('atlas:sono', (ligado) => {
  if (ligado && bloqueio === null) bloqueio = powerSaveBlocker.start('prevent-app-suspension')
  if (!ligado && bloqueio !== null) { powerSaveBlocker.stop(bloqueio); bloqueio = null }
})

function abrir() {
  // Abre junto com o Windows (ao ligar o computador). Com obra em andamento, a tela inicial é Retomar (F12): a regra está em
  // src/app/tela.ts (telaInicial). Para desligar: Configurações → Abrir com o Windows (a tela F12 avisa o cliente).
  app.setLoginItemSettings({ openAtLogin: true })
  // Microfone liberado só para o próprio app (tudo pode ser falado).
  // Só a página do próprio app (file:// dentro de dist-app) recebe o microfone; iframes/outras origens não.
  const origemDoApp = require('node:url').pathToFileURL(path.join(__dirname, '..', 'dist-app') + path.sep).href
  const doApp = (url) => typeof url === 'string' && url.startsWith(origemDoApp)
  session.defaultSession.setPermissionRequestHandler((wc, permissao, ok, detalhes) => ok(permissao === 'media' && doApp(wc.getURL()) && doApp((detalhes && detalhes.requestingUrl) || wc.getURL())))
  session.defaultSession.setPermissionCheckHandler((wc, permissao, origem) => permissao === 'media' && doApp((wc && wc.getURL()) || '') && String(origem).startsWith('file://'))
  const janela = new BrowserWindow({
    width: 1100, height: 780, backgroundColor: '#141619', title: 'Atlas',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  janelaPrincipal = janela
  janela.on('closed', () => { janelaPrincipal = null })
  // Links e janelas novas nunca abrem dentro do app nem fora da allowlist.
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  janela.webContents.on('will-navigate', (ev) => ev.preventDefault())
  janela.loadFile(path.join(__dirname, '..', 'dist-app', 'index.html'))
}

app.whenReady().then(abrir)
app.on('window-all-closed', () => app.quit())
