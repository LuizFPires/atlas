// Processo principal do app Atlas (Electron). Reaproveita o front (dist-app/, gerado por `npm run build:app`).
'use strict'
const { app, BrowserWindow, dialog, ipcMain, Menu, Notification, powerSaveBlocker, session, shell, WebContentsView } = require('electron')
// Voz mais rápida (23/11/2026): libera o SharedArrayBuffer para o Whisper usar vários núcleos do processador.
// Precisa vir antes do app ficar pronto. O app carrega só arquivos locais e nunca páginas de fora.
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')
const { criarCofre } = require('./cofre.cjs')
const { criarObras } = require('./adaptadores/obras.cjs')
const { criarArquivos } = require('./adaptadores/arquivos.cjs')
const { criarClaude } = require('./adaptadores/claude.cjs')
const { criarModo } = require('./adaptadores/modo.cjs')
const { criarConstrucao } = require('./adaptadores/construcao.cjs')
const { criarPainel, kitDirDoApp } = require('./adaptadores/painel.cjs')
const { criarRetomar } = require('./adaptadores/retomar.cjs')
const { criarDisparo } = require('./adaptadores/projeto-comum.cjs')
const { criarEstilo } = require('./adaptadores/estilo.cjs')
const { criarPrototipo } = require('./adaptadores/prototipo.cjs')
const { criarAtualizador, PRIMEIRA_CONFERENCIA_MS, INTERVALO_CONFERENCIA_MS } = require('./adaptadores/atualizador.cjs')
const { criarLinkCelular } = require('./adaptadores/link-celular.cjs')
const { criarModelo } = require('./adaptadores/modelo.cjs')
const { criarBatismo } = require('./adaptadores/batismo.cjs')
const { criarNomes } = require('./adaptadores/nomes.cjs')
const { criarPosObra } = require('./adaptadores/posobra.cjs')
const { criarLicenca } = require('./adaptadores/licenca.cjs')
const { criarCota } = require('./adaptadores/cota.cjs')
const { criarOcorrencias } = require('./adaptadores/ocorrencias.cjs')
const { criarNavegador, urlPermitida } = require('./adaptadores/navegador.cjs')
const { criarCelular } = require('./adaptadores/celular.cjs')
const { criarImportar } = require('./adaptadores/importar.cjs')
const { criarAjuda, criarCasos } = require('./adaptadores/ajuda.cjs')
const { criarPublicar } = require('./adaptadores/publicar.cjs')
const { criarKit } = require('./adaptadores/kit.cjs')
const { criarVigia } = require('./adaptadores/vigia.cjs')
const { criarContasCli, rodarProcesso, comandoGh } = require('./adaptadores/contas-cli.cjs')
const { criarTravasAcoes, SITE_DA_TRAVA } = require('./adaptadores/travas-acoes.cjs')
const { criarPlanilhaObra } = require('./adaptadores/planilha-obra.cjs')
const { criarTampa } = require('./adaptadores/tampa.cjs')
const { envMinimo } = require('./seguro.cjs')
const { criarServidor } = require('./adaptadores/servidor.cjs')
const { tokenDoLink, comToken } = require('./link-instalacao.cjs')
const { abrirExterno } = require('./seguro.cjs')
const { HOSTS_PAGAMENTO } = require('./seguro-puro.cjs')

// Endereço do servidor de licenças: no pacote vem de app/config.json, gravado na geração do instalador (não é segredo).
// ATLAS_API_URL (ambiente) continua valendo no desenvolvimento. Sem nenhum dos dois, licença e kit negam (falha fechada).
if (!process.env.ATLAS_API_URL) {
  try { const c = require('./config.json'); if (c && typeof c.api === 'string') process.env.ATLAS_API_URL = c.api } catch { /* sem config */ }
}

const argv = process.argv.slice(1)
// O que a tela enxerga dos argumentos: o código do link (atlas://ativar?t=... ou --token=) vira sempre `--token=<código>`.
let argvTela = comToken(argv, tokenDoLink(argv))
const cofre = criarCofre()
let bloqueio = null
let janelaPrincipal = null

// Adaptadores reais (um por porta do front). Pendentes: ver app/PENDENTE-ENTREGAR.md.
const obras = criarObras({ shell, pararLinha: (pasta) => construcao.linha.parar(pasta) }) // construcao existe quando alguém excluir
const arquivos = criarArquivos({ raiz: obras.raiz(), dialog, janela: () => janelaPrincipal })
// Ao terminar o login do Claude Code (o cliente clicou em Autorizar no navegador), traz o Atlas de volta para a frente.
const claude = criarClaude({ shell, aoConectar: () => { const j = janelaPrincipal; if (j && !j.isDestroyed()) { if (j.isMinimized()) j.restore(); j.show(); j.focus() } } })
const modos = criarModo({ raiz: obras.raiz() })
// Kit por obra (PonteKit): plugin numa pasta temporária do app (fora da obra e do repositório), descartado ao fechar. Sem API configurada, vale ATLAS_KIT_PLUGIN.
const kit = criarKit({ dadosApp: app.getPath('userData'), cofre, hashComputador: async () => hash() })
// Modelo do Claude escolhido pelo cliente (um só para todo o Atlas; recomendado Opus 5.5).
const modelo = criarModelo({ pasta: app.getPath('userData') })
// Contas ligadas a este computador (tela C1): gh, Vercel e Supabase. A chave do Supabase fica só no cofre e chega à linha pelo ambiente.
const contasCli = criarContasCli({ dadosApp: app.getPath('userData'), cofre, env: envMinimo() })
void contasCli.recarregar()
const construcao = criarConstrucao({ envContas: () => contasCli.envDaLinha(process.env.PATH || process.env.Path || ''), modelo: () => modelo.args(), raiz: obras.raiz(), modos, claudeEstado: () => claude.estado(), pluginDir: (pasta) => kit.diretorio(pasta) || process.env.ATLAS_KIT_PLUGIN || null, exigirPlugin: true, dadosApp: app.getPath('userData') }) // userData: o MESMO da cota (registro de parada por cota fora da obra)
// Vigia (24/11/2026): linha que parou sem avançar é religada sozinha (2, 5 e 15 min, com o kit garantido) e, se não der, o painel avisa.
const vigia = criarVigia({ raiz: obras.raiz(), construcao, garantirKit: (pasta) => kit.garantir(String(pasta)), listar: () => obras.listar(),
  // Desistiu de religar sozinho: avisa NA HORA, mesmo com o Atlas minimizado (o painel também mostra o alerta com o motivo).
  aoPrecisar: (_pasta, motivo) => { try { if (Notification.isSupported()) new Notification({ title: 'A obra parou e precisa de você', body: `${motivo} Abra o Atlas para resolver.` }).show() } catch { /* aviso extra */ } } })
const painel = criarPainel({ vigia, raiz: obras.raiz(), modos, construcao, shell, kitDir: process.env.ATLAS_KIT_DIR || kitDirDoApp({ empacotado: app.isPackaged, recursos: process.resourcesPath }) })
// Cota (F10): detecta o limite do Claude e a renovação (teste barato) e retoma sozinha; o Retomar usa o mesmo adaptador.
const cota = criarCota({ raiz: obras.raiz(), construcao, painel, claudeEstado: () => claude.estado(), dadosApp: app.getPath('userData'), garantirKit: (pasta) => kit.garantir(String(pasta)) })
// Ocorrências (F11): livro do kit da obra (docs\ocorrencias.json). A chave colada vai SÓ ao cofre (DPAPI). Canais de aviso: pendência (ver ocorrencias.cjs).
const ocorrencias = criarOcorrencias({ raiz: obras.raiz(), cofre })
// Celular (F04b): endereço do app do Claude + preferências guardadas; a CONEXÃO (Remote Control) é pendência e não é fingida (celular.cjs).
const celular = criarCelular({ dados: require('node:path').join(app.getPath('userData'), 'celular') })
// Importar (F06c): o .zip de outra IA é NÃO CONFIÁVEL; descompacta com todas as defesas (ver adaptadores/importar.cjs).
const importar = criarImportar({ raiz: obras.raiz(), dialog, janela: () => janelaPrincipal })
const retomar = criarRetomar({ raiz: obras.raiz(), painel, cota, construcao })
// Bloco "criação de projeto": o Claude destes passos é só leitor (projeto-comum.cjs); o git isolado é o mesmo da construção.
const disparo = criarDisparo({ modelo: () => modelo.args(), raiz: obras.raiz(), dadosApp: require('node:path').join(app.getPath('userData'), 'git-isolado'), claudeEstado: () => claude.estado() })
// Roteiro da ideia (caminho novo, 23/11/2026): conferência rápida a cada pausa, sempre com o modelo mais rápido (não o da obra).
// Começar por uma planilha (X1–X3): raio-X aqui no computador; "o que entendi" pelo Claude lendo planilha/raio-x.md da obra.
const planilhaObra = criarPlanilhaObra({ raiz: obras.raiz(), disparo })
const ideia = require('./adaptadores/ideia.cjs').criarIdeia({ disparo: criarDisparo({ modelo: () => ['--model', 'claude-haiku-5-5'], raiz: obras.raiz(), dadosApp: require('node:path').join(app.getPath('userData'), 'git-isolado'), claudeEstado: () => claude.estado() }) })
const estilo = criarEstilo({ raiz: obras.raiz(), disparo })
const prototipo = criarPrototipo({ raiz: obras.raiz(), disparo })
// Protótipo que parou no meio (sem internet, computador desligado; pedido do Luiz, 23/11/2026): ao abrir o Atlas e a cada 2 min,
// continua sozinho de onde parou (as telas prontas ficam salvas). Ainda sem internet: tenta de novo na próxima volta.
const retomarPrototipos = () => { void prototipo.retomarPendentes().catch(() => {}) }
setTimeout(retomarPrototipos, 20_000).unref?.()
setInterval(retomarPrototipos, 2 * 60_000).unref?.()
const batismo = criarBatismo({ raiz: obras.raiz(), disparo })
const nomes = criarNomes()
// Pós-obra: roda pela MESMA linha da obra (construcao.linha) e só com licença em dia, conferida AQUI no processo principal (token do cofre).
// O endereço da API vem de ATLAS_API_URL (https); sem ele a licença nega (fail-closed) e o pós-obra não executa.
const licenca = criarLicenca({ cofre, hashComputador: async () => hash() })
const servidor = criarServidor()
const posobra = criarPosObra({ raiz: obras.raiz(), disparo, construcao, licenca })
// Ajuda do Atlas (F17): o Claude só lê; o print é SÓ da janela do Atlas; páginas só da lista fechada. Casos não resolvidos vão à API (endpoint ainda pendente).
const ajuda = criarAjuda({
  raiz: obras.raiz(), dadosApp: app.getPath('userData'), disparo, shell, dialog, janela: () => janelaPrincipal,
  capturar: async () => { if (!janelaPrincipal) throw new Error('sem-janela'); return (await janelaPrincipal.webContents.capturePage()).toPNG() },
})
const casos = criarCasos({ cofre, hashComputador: async () => hash() })
// Publicação (F13a/b): sites e consultas só de hosts oficiais; o deploy (publicarNoAr) falha honesto até haver token/fluxo (ver publicar.cjs).
const publicar = criarPublicar({ raiz: obras.raiz(), shell, cofre })

if (!app.requestSingleInstanceLock()) app.quit()

// O cliente clicou em "Liberar o Atlas neste computador" na página do e-mail com o app já aberto: o Windows tenta abrir outro
// Atlas com atlas://ativar?t=<código>; quem recebe é este aqui. Guarda o código, avisa a tela e traz a janela para a frente.
app.setAsDefaultProtocolClient('atlas')
app.on('second-instance', (_e, argvNovo) => {
  const t = tokenDoLink(argvNovo)
  if (t) {
    argvTela = comToken(argvTela, t)
    if (janelaPrincipal) janelaPrincipal.webContents.send('atlas:link', t)
  }
  if (janelaPrincipal) { if (janelaPrincipal.isMinimized()) janelaPrincipal.restore(); janelaPrincipal.focus() }
})

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

ipcMain.on('atlas:argv', (e) => { e.returnValue = argvTela })
handle('atlas:cofre:guardar', (c, v) => cofre.guardar(String(c), String(v)))
handle('atlas:cofre:ler', (c) => cofre.ler(String(c)))
handle('atlas:cofre:apagar', (c) => cofre.apagar(String(c)))
handle('atlas:hash', () => hash())
// Compra de dentro do app: abre no navegador do cliente SÓ a página de pagamento da Stripe (o endereço vem do servidor e é revalidado aqui).
handle('atlas:pagamento:abrir', (url) => abrirExterno(shell, String(url), HOSTS_PAGAMENTO))
// Chamadas da tela ao servidor de licenças (ativação, licença): rota de lista fechada e base fixa, revalidadas em servidor.cjs.
handle('atlas:servidor:postar', (rota, corpo, cabecalhos) => servidor.postar(rota, corpo, cabecalhos))
handle('atlas:descricao', () => `${os.hostname().toUpperCase()} · Windows ${Number(os.release().split('.')[2]) >= 22000 ? '11' : '10'}`)

// Arquivos da obra, pasta das obras e Claude (portas de base).
handle('atlas:arquivos:escolher', (tipo) => arquivos.escolher(String(tipo)))
handle('atlas:arquivos:guardar', (pasta, destino, token) => arquivos.guardar(String(pasta), String(destino), String(token)))
handle('atlas:arquivos:guardarImagem', (pasta, nome, dataUrl) => arquivos.guardarImagem(String(pasta), String(nome), String(dataUrl)))
ipcMain.on('atlas:obras:raiz', (e) => { e.returnValue = confiavel(e) ? obras.raiz() : '' })
handle('atlas:obras:listar', () => obras.listar())
handle('atlas:obras:criar', (nome) => obras.criarSubpasta(String(nome)))
handle('atlas:obras:abrir', () => obras.abrirPasta())
handle('atlas:obras:situacao', (pasta) => obras.situacao(String(pasta)))
handle('atlas:obras:excluir', (pasta) => obras.excluir(String(pasta)))
handle('atlas:claude:login', () => claude.abrirLogin())
handle('atlas:claude:site', (alvo) => claude.abrirSite(String(alvo)))
handle('atlas:claude:estado', () => claude.estado())
handle('atlas:claude:renovar', () => claude.renovarConexao())

// Modo da obra (automático | passo a passo): <obra>\.atlas\modo.json.
handle('atlas:modos:ler', (pasta) => modos.ler(String(pasta)))
handle('atlas:modos:gravar', (pasta, modo) => modos.gravar(String(pasta), String(modo)))

// Planejar e iniciar a construção (PLAN.md + linha de produção do kit na pasta da obra).
handle('atlas:construcao:planejar', (pasta, nome) => construcao.planejar(String(pasta), String(nome)))
handle('atlas:construcao:iniciar', async (pasta, nome, modo, etapas) => { await kit.garantir(String(pasta)); return construcao.iniciar(String(pasta), String(nome), String(modo), Array.isArray(etapas) ? etapas : []) })

// Painel da obra: andamento, pausa/continua, OK da etapa, modo, canteiro 3D (só 127.0.0.1) e versão de teste.
handle('atlas:painel:ler', (pasta) => painel.ler(String(pasta)))
handle('atlas:painel:pausar', (pasta) => painel.pausar(String(pasta)))
handle('atlas:painel:continuar', async (pasta) => { vigia.zerar(String(pasta)); await kit.garantir(String(pasta)); return painel.continuar(String(pasta)) })
handle('atlas:painel:aprovar', async (pasta) => { await kit.garantir(String(pasta)); return painel.aprovarEtapa(String(pasta)) })
handle('atlas:painel:modo', (pasta, modo) => painel.aplicarModo(String(pasta), String(modo)))
ipcMain.on('atlas:painel:endereco', (e, pasta) => { e.returnValue = confiavel(e) ? painel.enderecoCanteiro(String(pasta)) : null })
handle('atlas:painel:teste', (pasta) => painel.abrirTeste(String(pasta)))

// Retomar (F12): obra em andamento ao abrir o app e "Continuar obra".
handle('atlas:retomar:andamento', () => retomar.obraEmAndamento())
handle('atlas:retomar:continuar', async (pasta) => { await kit.garantir(String(pasta)); return retomar.continuar({ pasta: String(pasta) }) })

// Cota do plano (F10): ler o estado, retomar quando o Claude voltou a responder. A vigia retoma sozinha (sem clique) as obras paradas por cota.
handle('atlas:cota:ler', (pasta) => cota.ler(String(pasta)))
handle('atlas:cota:retomar', async (pasta) => { await kit.garantir(String(pasta)); return cota.retomar(String(pasta)) })

// Ocorrências (F11): o único tipo de parada que exige o cliente. resolver recebe a chave (se houver) e a entrega direto ao cofre.
handle('atlas:ocorrencias:ler', (pasta) => ocorrencias.ler(String(pasta)))
handle('atlas:ocorrencias:avisar', (pasta, id) => ocorrencias.avisar(String(pasta), Number(id)))
handle('atlas:ocorrencias:resolver', (pasta, id, segredo) => ocorrencias.resolver(String(pasta), Number(id), segredo === undefined || segredo === null ? undefined : String(segredo)))
handle('atlas:ocorrencias:adiar', (pasta, id) => ocorrencias.adiar(String(pasta), Number(id)))

// Celular (F04b): o endereço é fixo (síncrono, como obras.raiz); aplicar guarda as preferências e diz a verdade sobre a conexão.
ipcMain.on('atlas:celular:endereco', (e) => { e.returnValue = confiavel(e) ? celular.enderecoApp() : '' })
handle('atlas:celular:aplicar', (prefs) => celular.aplicar(prefs))

// Trazer protótipo de outra IA (F06c): escolher o .zip (token opaco), validar SEM gravar e receber (descompactar com as defesas).
handle('atlas:importar:escolher', () => importar.escolherZip())
handle('atlas:importar:validar', (token) => importar.validar(String(token)))
handle('atlas:importar:receber', (pasta, token) => importar.receber(String(pasta), String(token)))

// Estilo do sistema (F06b): o Claude propõe 3 estilos; materializar grava o design-system.md (nunca sobrescreve).
handle('atlas:estilo:propor', (entrada, pasta) => estilo.propor(entrada, pasta === undefined ? undefined : String(pasta)))
handle('atlas:estilo:materializar', (pasta, origem) => estilo.materializar(String(pasta), origem))

// Protótipo (F07): o Claude devolve as telas, o app grava versões imutáveis em <obra>/prototipo/versoes/vNNN; desfazer = ponteiro.
handle('atlas:prototipo:estado', (pasta) => prototipo.estado(String(pasta)))
handle('atlas:prototipo:desenhar', (pasta, nome, estilo, relato) => prototipo.desenhar(String(pasta), String(nome), estilo, String(relato ?? '')))
handle('atlas:prototipo:ajustar', (pasta, pedido) => prototipo.ajustar(String(pasta), String(pedido)))
handle('atlas:prototipo:voltar', (pasta, numero) => prototipo.voltar(String(pasta), Number(numero)))
// 3 versões de uma tela (Milestone 36): comparar e escolher. A escolha vira versão nova.
handle('atlas:prototipo:relato', (pasta) => prototipo.relato(String(pasta)))
handle('atlas:prototipo:versoes', (pasta, telaId) => prototipo.versoesDaTela(String(pasta), String(telaId)))
handle('atlas:prototipo:marcacao', (pasta, telaId, x, y) => prototipo.sugerirMarcacao(String(pasta), String(telaId), Number(x), Number(y)))
handle('atlas:prototipo:escolher', (pasta, telaId, html, titulo) => prototipo.escolherVersao(String(pasta), String(telaId), String(html), String(titulo)))
// Link provisório para o celular (7 dias, servidor do Atlas): só o protótipo protegido sai; WhatsApp só do link recém-gerado.
const linkCelular = criarLinkCelular({ cofre, hashComputador: async () => hash(), shell })
handle('atlas:prototipo:link', (nome, documento) => linkCelular.publicar(String(nome), String(documento)))
handle('atlas:prototipo:whatsapp', (url) => linkCelular.abrirWhatsApp(String(url)))
handle('atlas:modelo:ler', () => ({ atual: modelo.ler(), lista: modelo.lista() }))
handle('atlas:modelo:gravar', (id) => modelo.gravar(String(id)))
handle('atlas:prototipo:progresso', (pasta) => prototipo.progresso(String(pasta)))
handle('atlas:ideia:conferir', (relato, fim) => ideia.conferir(String(relato ?? ''), { fim: fim === true }))
handle('atlas:prototipo:mapear', (pasta, nome, relato) => prototipo.mapear(String(pasta), String(nome), String(relato ?? '')))
handle('atlas:prototipo:pintar', (pasta, nome, estilo) => prototipo.pintar(String(pasta), String(nome), estilo))

// Batismo (F07b): 3 nomes (logo só de lista fechada) e marca/marca.md sem sobrescrever.
handle('atlas:batismo:sugerir', (pasta, nome, pedido) => batismo.sugerir(String(pasta), String(nome), pedido))
handle('atlas:batismo:batizar', (pasta, marca) => batismo.batizar(String(pasta), marca))

// Nomes: conferir endereço livre (.app / .com.br) só por RDAP oficial, anti-SSRF (host fixo, IP público, sem redirect, timeout).
handle('atlas:nomes:conferir', (nome) => nomes.conferir(String(nome)))

// Pós-obra (F14): entender (só explica) e executar (exige licença em dia; mesmo pipeline da obra).
handle('atlas:posobra:entender', (pasta, pedido) => posobra.entender(String(pasta), pedido))
handle('atlas:posobra:executar', async (pasta, pedido, plano) => { await kit.garantir(String(pasta)); return posobra.executar(String(pasta), pedido, plano) })
handle('atlas:posobra:historico', (pasta) => posobra.historico(String(pasta)))

// Ajuda do Atlas (F17): conversar (Claude só leitor), print da janela do Atlas, anexar imagem, abrir página da lista fechada; casos -> API.
handle('atlas:ajuda:conversar', (contexto, historico, mensagem) => ajuda.conversar(contexto, historico, mensagem))
handle('atlas:ajuda:pagina', (id) => ajuda.abrirPagina(String(id)))
handle('atlas:ajuda:print', (pasta) => ajuda.tirarPrint(pasta ? String(pasta) : undefined))
handle('atlas:ajuda:anexar', (pasta) => ajuda.anexarImagem(pasta ? String(pasta) : undefined))
handle('atlas:casos:enviar', (caso) => casos.enviar(caso))

// Publicação: só o NOME do destino vai ao processo principal; a URL é fixa lá dentro.
handle('atlas:publicar:site', (destino, dominio) => publicar.abrirSite(String(destino), dominio === undefined || dominio === null ? undefined : String(dominio)))
handle('atlas:publicar:nome', (dominio) => publicar.nomeLivre(String(dominio)))
handle('atlas:publicar:dns', (dominio) => publicar.lerDns(String(dominio)))
handle('atlas:publicar:dnsnoar', (dominio, registros) => publicar.dnsNoAr(String(dominio), registros))
handle('atlas:publicar:noar', (slug) => publicar.publicarNoAr(String(slug)))
handle('atlas:publicar:cartaz', (endereco, pasta) => publicar.gerarCartaz(String(endereco), pasta === undefined ? undefined : String(pasta)))
handle('atlas:publicar:ler', (pasta) => publicar.lerProgresso(String(pasta)))
handle('atlas:publicar:gravar', (pasta, p) => publicar.gravarProgresso(String(pasta), p))

// Kit por obra: a tela só recebe { ok, obraId, marca }; o caminho do plugin nunca sai do processo principal.
handle('atlas:kit:entregar', (obraId) => kit.entregar(String(obraId)))
handle('atlas:kit:descartar', (obraId) => kit.descartar(String(obraId)))

// Navegador de verdade dentro do Atlas, na tela das contas (navegador.cjs; pedido do Luiz, 23/11/2026). Isolado: sessão própria
// (o login nos sites fica guardado só nela), sandbox, sem preload nem Node, sem nenhuma permissão (câmera, microfone, arquivos,
// notificações) e sem download. Só os sites das contas abrem aqui; o resto vai para o navegador do computador.
const PARTICAO_CONTAS = 'persist:atlas-contas'
let sessaoContasPronta = false
const sessaoContas = () => {
  const ses = session.fromPartition(PARTICAO_CONTAS)
  if (!sessaoContasPronta) {
    ses.setPermissionRequestHandler((_wc, _p, ok) => ok(false))
    ses.setPermissionCheckHandler(() => false)
    ses.on('will-download', (e) => e.preventDefault())
    sessaoContasPronta = true
  }
  return ses
}
const navegador = criarNavegador({
  criarView: () => {
    if (!janelaPrincipal) throw new Error('sem-janela')
    sessaoContas()
    const v = new WebContentsView({ webPreferences: { partition: PARTICAO_CONTAS, sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false, devTools: false } })
    const wc = v.webContents
    wc.setWindowOpenHandler(({ url }) => {
      if (urlPermitida(url)) void wc.loadURL(url).catch(() => {})
      else if (/^https:\/\//.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    janelaPrincipal.contentView.addChildView(v)
    return {
      loadURL: (u) => { void wc.loadURL(u).catch(() => {}) },
      setBounds: (b) => v.setBounds(b),
      setVisible: (sim) => v.setVisible(sim),
      on: (n, f) => wc.on(n, f),
      voltar: () => { if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack() },
      recarregar: () => wc.reload(),
      destruir: () => { try { janelaPrincipal?.contentView.removeChildView(v) } catch { /* janela já fechou */ } wc.close() },
    }
  },
  avisar: (d) => { if (janelaPrincipal && !janelaPrincipal.isDestroyed()) janelaPrincipal.webContents.send('atlas:navegador:pagina', d) },
  abrirFora: (u) => { if (/^https:\/\//.test(u)) void shell.openExternal(u) },
  logadoNoGithub: async () => (await sessaoContas().cookies.get({ url: 'https://github.com', name: 'logged_in' })).some((c) => c.value === 'yes'),
})
handle('atlas:navegador:abrir', (conta, b) => navegador.abrir(String(conta), b))
handle('atlas:navegador:posicionar', (b) => navegador.posicionar(b))
handle('atlas:navegador:mostrar', (sim) => navegador.mostrar(sim === true))
handle('atlas:navegador:voltar', () => navegador.voltar())
handle('atlas:navegador:recarregar', () => navegador.recarregar())
handle('atlas:navegador:fora', (conta) => navegador.abrirNoComputador(String(conta)))
handle('atlas:navegador:pronta', (conta) => navegador.pronta(String(conta)))
handle('atlas:navegador:fechar', () => navegador.fechar())

// Ligar as contas a este computador (C1Contas). A tela recebe só o código e o estado; o endereço vem da CLI e é conferido aqui.
const garantirFerramentas = async () => { if (!contasCli.ferramentasProntas() && !(await contasCli.instalarFerramentas())) throw new Error('ferramentas-indisponiveis') }
handle('atlas:planilha:ler', (pasta, nome) => planilhaObra.ler(String(pasta), String(nome)))
handle('atlas:planilha:entender', (pasta, fala) => planilhaObra.entender(String(pasta), fala === undefined || fala === null ? undefined : String(fala)))
handle('atlas:planilha:levar', (pasta, sim) => planilhaObra.levarDados(String(pasta), sim === true))
handle('atlas:planilha:relato', (pasta) => planilhaObra.relato(String(pasta)))
handle('atlas:contas:situacao', () => contasCli.situacao())
handle('atlas:contas:estado', (conta) => contasCli.estado(String(conta)))
handle('atlas:contas:ligar', async (conta, b) => {
  const c = String(conta)
  if (c === 'hosp') await garantirFerramentas()
  const r = await contasCli.ligar(c)
  try { await navegador.abrirEndereco(r.url, b) } catch { /* sem painel ao lado: a tela oferece abrir no navegador do computador */ }
  return { codigo: r.codigo }
})
handle('atlas:contas:siteFora', (conta) => {
  const u = { github: 'https://github.com/login/device', hosp: 'https://vercel.com/device', supabase: 'https://supabase.com/dashboard/account/tokens' }[String(conta)]
  if (u) void shell.openExternal(u)
})
handle('atlas:contas:abrirChaves', (b) => navegador.abrirEndereco('https://supabase.com/dashboard/account/tokens', b))
handle('atlas:contas:chaveSupabase', async (chave) => { await garantirFerramentas(); return contasCli.guardarChaveSupabase(String(chave ?? '')) })
handle('atlas:contas:cancelar', (conta) => contasCli.cancelar(String(conta)))

// Fichas de trava (T1Travas): site fixo de cada trava e "deixar público até o GitHub voltar" (só depois da confirmação na tela).
// De hora em hora (e ao abrir), obra que ficou pública volta para privado sozinha quando a trava do GitHub fecha.
const travasAcoes = criarTravasAcoes({ raiz: obras.raiz(), rodarGh: (args, cwd) => rodarProcesso(comandoGh(envMinimo()), args, { env: envMinimo(), cwd, timeoutMs: 30_000 }) })
handle('atlas:travas:site', (tipo, b) => { const u = SITE_DA_TRAVA[String(tipo)]; if (!u) throw new Error('trava-invalida'); return navegador.abrirEndereco(u, b) })
handle('atlas:travas:siteFora', (tipo) => { const u = SITE_DA_TRAVA[String(tipo)]; if (u) void shell.openExternal(u) })
handle('atlas:travas:publico', (pasta) => travasAcoes.deixarPublico(String(pasta)))
handle('atlas:travas:ehPublico', (pasta) => travasAcoes.publico(String(pasta)))
// O notebook é o canteiro (TP1Tampa): a tampa na tomada vira "não fazer nada" com o clique da pessoa e volta ao normal quando
// nenhuma obra está em construção (todas com o PLAN em 100% ou sem obra).
const powercfg = require('node:path').join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'powercfg.exe')
const tampa = criarTampa({ dadosApp: app.getPath('userData'), rodar: (args) => rodarProcesso(powercfg, args, { env: envMinimo(), timeoutMs: 15_000 }) })
handle('atlas:tampa:ajustada', () => tampa.ajustada())
handle('atlas:tampa:ajustar', () => tampa.ajustar())
const { lerPlanoDoTexto } = require('./adaptadores/painel.cjs')
const algumaObraEmConstrucao = async () => {
  for (const p of await obras.listar()) {
    try { const t = require('node:fs').readFileSync(require('node:path').join(obras.raiz(), p, 'PLAN.md'), 'utf8'); if (lerPlanoDoTexto(t).pct < 100) return true } catch { /* sem PLAN: obra ainda não começou */ }
  }
  return false
}
const revisarTravas = () => {
  void obras.listar().then((l) => travasAcoes.revisar(l)).catch(() => {})
  if (tampa.ajustada()) void algumaObraEmConstrucao().then((sim) => { if (!sim) return tampa.restaurar() }).catch(() => {})
}
setTimeout(revisarTravas, 15_000)
setInterval(revisarTravas, 60 * 60 * 1000).unref()

// Ao fechar: derruba a linha de produção e o canteiro que o Atlas subiu (o PLAN guarda o ponto; Retomar religa depois). O kit é apagado.
// Atualização automática (atualizador.cjs): só no Atlas instalado no Windows. Confere 10 s depois de abrir e a cada 2 min;
// baixa em silêncio e instala quando o Atlas fecha (decisão do Luiz, 22/11/2026).
const atualizador = criarAtualizador({
  versaoAtual: app.getVersion(), cofre, hashComputador: async () => hash(), api: process.env.ATLAS_API_URL,
  pasta: require('node:path').join(app.getPath('userData'), 'atualizacao'),
  executar: (cmd, args) => spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref(),
})
if (app.isPackaged && process.platform === 'win32') {
  const conferir = () => { void atualizador.verificarEBaixar().catch(() => {}) }
  setTimeout(conferir, PRIMEIRA_CONFERENCIA_MS)
  setInterval(conferir, INTERVALO_CONFERENCIA_MS).unref()
}

// Faixa "Nova versão" no topo (NovaVersao.tsx): a tela só recebe o número da versão já baixada e conferida, e pede "atualizar agora".
const atualizaAqui = app.isPackaged && process.platform === 'win32'
handle('atlas:atualizacao:pronta', () => (atualizaAqui ? (atualizador.pronta()?.versao ?? null) : null))
handle('atlas:atualizacao:situacao', () => (atualizaAqui ? atualizador.ultima() : null))
handle('atlas:atualizacao:andamento', () => (atualizaAqui ? atualizador.andamento() : null))
handle('atlas:atualizacao:procurar', async () => { if (!atualizaAqui) return { estado: 'atual', versaoAtual: app.getVersion() }; const r = await atualizador.verificarEBaixar(); return atualizador.ultima() ?? { ...r, versaoAtual: app.getVersion() } })
handle('atlas:atualizacao:instalar', () => atualizaAqui && atualizador.instalarAgora(() => setTimeout(() => app.quit(), 300)))

app.on('before-quit', () => { contasCli.encerrar(); construcao.encerrar(); painel.encerrar(); kit.descartarTudo(); if (app.isPackaged && process.platform === 'win32') atualizador.instalarAoSair() })
kit.descartarTudo() // sobra de uma queda anterior

// O computador é o canteiro: durante a obra ele não pode dormir.
handle('atlas:sono', (ligado) => {
  if (ligado && bloqueio === null) bloqueio = powerSaveBlocker.start('prevent-app-suspension')
  if (!ligado && bloqueio !== null) { powerSaveBlocker.stop(bloqueio); bloqueio = null }
})

function abrir() {
  // Sem o menu padrão do Electron (File, Edit, View, Window): o cliente é leigo e o app tem o próprio menu lateral.
  Menu.setApplicationMenu(null)
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
    width: 1100, height: 780, backgroundColor: '#141619', title: 'Atlas', icon: path.join(__dirname, 'icone.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  janelaPrincipal = janela
  janela.on('closed', () => { navegador.fechar(); janelaPrincipal = null })
  // Links e janelas novas nunca abrem dentro do app nem fora da allowlist.
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  janela.webContents.on('will-navigate', (ev) => ev.preventDefault())
  janela.loadFile(path.join(__dirname, '..', 'dist-app', 'index.html'))
}

app.whenReady().then(abrir)
// Vigia da cota: 20 s depois de abrir (o app pode ter sido ligado com o Windows) e a cada 2 min; só obras paradas POR COTA.
setTimeout(() => { const v = () => cota.vigiar().catch(() => {}); v(); setInterval(v, 120_000).unref() }, 20_000).unref()
setTimeout(() => { const v = () => vigia.rodada().catch(() => {}); v(); setInterval(v, 60_000).unref() }, 30_000).unref()
app.on('window-all-closed', () => app.quit())
