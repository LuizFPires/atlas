import { useEffect, useState } from 'react'
import { Icone } from '../ui'
import { criarInstalarApi, type InstalarApi, type ResultadoAbertura } from './instalar-api'
import { tokenDaUrl } from './degustacao-api'
import { sistemaDoNavegador, type Sistema } from './sistema'
import type { Idioma } from '../i18n/idioma'
import './web.css'

// M31: a mesma página em inglês para quem comprou em dólar (o link do e-mail traz ?idioma=en).
const TX = {
  pt: {
    semToken: 'Esse link não está completo. Abra o link direto do e-mail que eu te mandei.', abrindo: 'Abrindo o seu acesso…', erroT: 'Não consegui abrir o seu acesso.',
    erroDica: 'Se o link venceu ou já foi usado, é só pedir o acesso de novo na página inicial.', voltar: 'Voltar para a página inicial', inicio: '/', liberado: 'Seu acesso está liberado!',
    celular: 'Abra no computador onde você vai construir. O Atlas se instala no computador, não no celular.', enviando: 'Enviando…', enviarPc: 'Enviar para o meu computador',
    reenviado: 'Mandei o acesso de novo para o seu e-mail. Abra o e-mail no computador onde vai construir.',
    semArqPronto: 'O Atlas se instala neste computador, e o seu acesso já está pronto: você não precisa fazer mais nada para liberar.',
    semArqDica: 'O botão para baixar o instalador ainda não está disponível aqui. Assim que ele abrir, vai aparecer nesta mesma página, e o seu link continua valendo até lá.',
    reconhecemos: (x: string) => `Reconhecemos o seu computador: ${x}`, emBreve: (x: string) => `A versão do Atlas para ${x} fica pronta em breve. O seu acesso já está liberado e o link continua valendo até lá.`,
    naoE: (x: string, o: string) => `Não é um ${x}? Baixar para ${o}`, passos: 'Passos para instalar', baixou: 'Baixou! Agora são 2 toques.',
    arrasteB: 'Arraste o Atlas para a pasta Aplicativos.', arraste: 'Abriu uma janelinha com o Atlas e uma pasta azul: segure o Atlas e solte em cima da pasta.', sumiu: 'A janelinha sumiu? Abra a pasta Downloads e clique duas vezes em "Atlas".',
    abraB: 'Abra o Atlas por aqui.', abra1: 'Ele já abre sabendo que é você. Na primeira vez, o Mac pergunta se pode abrir um app baixado da internet: clique em', abrir: 'Abrir', jaArrastei: 'Já arrastei: abrir o Atlas',
    naoEscolher: 'Você não precisa escolher nada: este botão já é o do seu computador. Leva uns 10 minutos, e o Atlas instala o resto sozinho.', baixeB: 'Baixe o Atlas.', preparando: 'Preparando…',
    baixarDeNovo: (x: string) => `Baixar o Atlas para ${x} de novo`, baixar: (x: string) => `Baixar o Atlas para ${x}`, comecou: 'O download começou.',
    macB: 'Arraste para Aplicativos e abra o Atlas por aqui.', mac: 'Depois de baixar, esta página mostra os 2 toques que faltam.',
    abraArqB: 'Abra o arquivo que você baixou', abraArq: '(ele fica na pasta Downloads e o nome começa com Atlas-Instalador). O Atlas abre sozinho e segue com você dali.',
    avisoWin: 'Aviso do Windows', avisoWinB: 'O Windows vai pedir uma confirmação.', avisoWinT: 'Ao abrir o instalador, aparece uma tela azul dizendo "O Windows protegeu o computador". Ela aparece porque o Atlas é um programa novo e o Windows ainda não o conhece.',
    clique: 'Clique em', mais: 'Mais informações', executar: 'Executar assim mesmo', liberarQ: 'O Atlas pediu para liberar este computador?', liberarT: 'Clique no botão abaixo. O navegador vai perguntar se pode abrir o Atlas: diga que sim.', liberar: 'Liberar o Atlas neste computador',
  },
  en: {
    semToken: 'This link is incomplete. Open the link straight from the email I sent you.', abrindo: 'Opening your access…', erroT: 'I couldn’t open your access.',
    erroDica: 'If the link expired or was already used, just ask for access again on the home page.', voltar: 'Back to the home page', inicio: '/en', liberado: 'Your access is ready!',
    celular: 'Open it on the computer where you’ll build. Atlas installs on the computer, not on the phone.', enviando: 'Sending…', enviarPc: 'Send to my computer',
    reenviado: 'I sent your access to your email again. Open the email on the computer where you’ll build.',
    semArqPronto: 'Atlas installs on this computer, and your access is ready: there’s nothing else to unlock.',
    semArqDica: 'The installer download button isn’t available here yet. As soon as it is, it shows up on this same page, and your link stays valid until then.',
    reconhecemos: (x: string) => `We recognized your computer: ${x}`, emBreve: (x: string) => `The ${x} version of Atlas is coming soon. Your access is ready and the link stays valid until then.`,
    naoE: (x: string, o: string) => `Not a ${x}? Download for ${o}`, passos: 'Steps to install', baixou: 'Downloaded! Just 2 taps left.',
    arrasteB: 'Drag Atlas into the Applications folder.', arraste: 'A small window opened with Atlas and a blue folder: hold Atlas and drop it on the folder.', sumiu: 'Window gone? Open your Downloads folder and double-click "Atlas".',
    abraB: 'Open Atlas from here.', abra1: 'It opens already knowing it’s you. The first time, the Mac asks if it can open an app downloaded from the internet: click', abrir: 'Open', jaArrastei: 'Done dragging: open Atlas',
    naoEscolher: 'You don’t need to pick anything: this button is already the one for your computer. It takes about 10 minutes, and Atlas installs the rest on its own.', baixeB: 'Download Atlas.', preparando: 'Getting it ready…',
    baixarDeNovo: (x: string) => `Download Atlas for ${x} again`, baixar: (x: string) => `Download Atlas for ${x}`, comecou: 'The download started.',
    macB: 'Drag it into Applications and open Atlas from here.', mac: 'After the download, this page shows the 2 taps left.',
    abraArqB: 'Open the file you downloaded', abraArq: '(it’s in your Downloads folder and its name starts with Atlas-Instalador). Atlas opens on its own and takes it from there.',
    avisoWin: 'Windows notice', avisoWinB: 'Windows will ask you to confirm.', avisoWinT: 'When you open the installer, a blue screen says "Windows protected your PC". It shows up because Atlas is a new program that Windows doesn’t know yet.',
    clique: 'Click', mais: 'More info', executar: 'Run anyway', liberarQ: 'Did Atlas ask you to unlock this computer?', liberarT: 'Click the button below. Your browser will ask if it can open Atlas: say yes.', liberar: 'Unlock Atlas on this computer',
  },
}
type Textos = (typeof TX)['pt']
const idiomaDaUrl = (): Idioma => { try { return new URLSearchParams(window.location.search).get('idioma') === 'en' ? 'en' : 'pt' } catch { return 'pt' } }
const api_padrao = criarInstalarApi()

type Fase = { fase: 'abrindo' } | { fase: 'erro'; mensagem: string } | { fase: 'ok'; a: Extract<ResultadoAbertura, { ok: true }> }
type Reenvio = { s: 'parado' } | { s: 'enviando' } | { s: 'ok' } | { s: 'erro'; mensagem: string }
type Download = { s: 'parado' } | { s: 'pedindo' } | { s: 'ok' } | { s: 'erro'; mensagem: string }
const irPadrao = (url: string) => window.location.assign(url)

/** Página aberta pelo link do e-mail (/instalar?t=…): confirma o acesso e mostra o próximo passo. Pública: o token é a prova. */
export function Instalar({ api = api_padrao, token = tokenDaUrl(), ir = irPadrao, sistemaInicial = sistemaDoNavegador(), idioma = idiomaDaUrl() }: { api?: InstalarApi; token?: string; idioma?: Idioma; /** Leva o navegador ao endereço do arquivo (troca nos testes). */ ir?: (url: string) => void; /** M47: reconhecido pelo navegador (troca nos testes). */ sistemaInicial?: Sistema }) {
  const T = TX[idioma]
  const [estado, setEstado] = useState<Fase>(token ? { fase: 'abrindo' } : { fase: 'erro', mensagem: T.semToken })
  const [reenvio, setReenvio] = useState<Reenvio>({ s: 'parado' })
  const [download, setDownload] = useState<Download>({ s: 'parado' })
  const [sistema, setSistema] = useState<Sistema>(sistemaInicial)
  useEffect(() => {
    let vivo = true
    if (!token) return
    api.abrir(token).then((r) => { if (vivo) setEstado(r.ok ? { fase: 'ok', a: r } : { fase: 'erro', mensagem: r.mensagem }) })
    return () => { vivo = false }
  }, [api, token])

  const reenviar = async () => {
    setReenvio({ s: 'enviando' })
    const r = await api.enviarParaComputador(token)
    setReenvio(r.ok ? { s: 'ok' } : { s: 'erro', mensagem: r.mensagem })
  }

  const baixar = async () => {
    setDownload({ s: 'pedindo' })
    const r = await api.baixar(token, sistema)
    if (!r.ok) { setDownload({ s: 'erro', mensagem: r.mensagem }); return }
    // O endereço é temporário e baixa o arquivo sem sair desta página.
    ir(r.url)
    setDownload({ s: 'ok' })
  }

  return (
    <div className="v v-confirmar" lang={idioma === 'en' ? 'en-US' : 'pt-BR'}>
      <div className="v-modal" style={{ margin: '12vh auto 0' }}>
        {estado.fase === 'abrindo' && <p role="status">{T.abrindo}</p>}
        {estado.fase === 'erro' && (
          <>
            <h2>{T.erroT}</h2>
            <p role="alert">{estado.mensagem}</p>
            <p className="v-mute">{T.erroDica}</p>
            <a className="v-acao v-acao--contorno" href={T.inicio}>{T.voltar}</a>
          </>
        )}
        {estado.fase === 'ok' && (
          <>
            <h2>{T.liberado}</h2>
            {estado.a.celular ? (
              <>
                <p>{idioma === 'en' ? T.celular : estado.a.aviso ?? T.celular}</p>
                {estado.a.podeReenviar && reenvio.s !== 'ok' && (
                  <button type="button" className="v-acao" onClick={reenviar} disabled={reenvio.s === 'enviando'}>
                    {reenvio.s === 'enviando' ? T.enviando : <>{T.enviarPc} <Icone nome="seta" /></>}
                  </button>
                )}
                {reenvio.s === 'ok' && <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">{T.reenviado}</span></p>}
                {reenvio.s === 'erro' && <p role="alert" className="v-erro">{reenvio.mensagem}</p>}
              </>
            ) : estado.a.instalador || estado.a.instaladorMac ? (
              <PaginaDoComputador sistema={sistema} trocar={() => { setSistema(sistema === 'mac' ? 'windows' : 'mac'); setDownload({ s: 'parado' }) }}
                temArquivo={sistema === 'mac' ? !!estado.a.instaladorMac : !!estado.a.instalador} download={download} baixar={baixar} token={token} T={T} />
            ) : (
              <>
                <p>{T.semArqPronto}</p>
                <p className="v-mute" data-testid="download-pendente">{T.semArqDica}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const ROTULO: Record<Sistema, string> = { mac: 'Mac', windows: 'Windows' }

/** M47 (telas M1Pagina, M1bWindows e M2Arrastar, aprovadas pelo Luiz em 24/11/2026): a página já reconhece o computador e mostra
 *  só o botão dele. Mac: arrastar para Aplicativos e "Já arrastei: abrir o Atlas" (o código do link vai pelo atlas://).
 *  Windows: o caminho de sempre (abrir o arquivo baixado, com o aviso da tela azul). */
function PaginaDoComputador({ sistema, trocar, temArquivo, download, baixar, token, T }: { sistema: Sistema; trocar: () => void; temArquivo: boolean; download: Download; baixar: () => void; token: string; T: Textos }) {
  const mac = sistema === 'mac'
  const outro = mac ? 'Windows' : 'Mac'
  const abrirAtlas = `atlas://ativar?t=${encodeURIComponent(token)}`
  return (
    <div className="v-inst">
      <span className="v-inst__selo" data-testid="sistema-reconhecido">{T.reconhecemos(ROTULO[sistema])}</span>
      {!temArquivo ? (
        <>
          <p>{T.emBreve(ROTULO[sistema])}</p>
          <button type="button" className="v-acao v-acao--contorno" onClick={trocar}>{T.naoE(ROTULO[sistema], outro)}</button>
        </>
      ) : mac && download.s === 'ok' ? (
        <>
          <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">{T.baixou}</span></p>
          <ol aria-label={T.passos} className="v-passos-instalar">
            <li>
              <p><b>{T.arrasteB}</b> {T.arraste}</p>
              <p className="v-mute">{T.sumiu}</p>
            </li>
            <li>
              <p><b>{T.abraB}</b> {T.abra1} <b>{T.abrir}</b>.</p>
              <a className="v-acao" href={abrirAtlas}>{T.jaArrastei} <Icone nome="seta" /></a>
            </li>
          </ol>
        </>
      ) : (
        <>
          <p>{T.naoEscolher}</p>
          <ol aria-label={T.passos} className="v-passos-instalar">
            <li>
              <p><b>{T.baixeB}</b></p>
              <button type="button" className="v-acao" onClick={baixar} disabled={download.s === 'pedindo'}>
                {download.s === 'pedindo' ? T.preparando : download.s === 'ok' ? <>{T.baixarDeNovo(ROTULO[sistema])} <Icone nome="seta" /></> : <>{T.baixar(ROTULO[sistema])} <Icone nome="seta" /></>}
              </button>
              {download.s === 'ok' && <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">{T.comecou}</span></p>}
              {download.s === 'erro' && <p role="alert" className="v-erro">{download.mensagem}</p>}
            </li>
            {mac ? (
              <li><p><b>{T.macB}</b> {T.mac}</p></li>
            ) : (
              <li>
                <p><b>{T.abraArqB}</b> {T.abraArq}</p>
                {/* O instalador ainda não é assinado: o cliente é avisado ANTES de ver a tela azul do Windows (mesmo texto do e-mail). */}
                <div role="note" aria-label={T.avisoWin} className="v-aviso-windows">
                  <p><b>{T.avisoWinB}</b> {T.avisoWinT}</p>
                  <ol>
                    <li>{T.clique} <b>{T.mais}</b>.</li>
                    <li>{T.clique} <b>{T.executar}</b>.</li>
                  </ol>
                </div>
              </li>
            )}
          </ol>
          <button type="button" className="v-inst__outro" onClick={trocar}>{T.naoE(ROTULO[sistema], outro)}</button>
        </>
      )}
      {!mac && (
        /* O código do link vai no nome do arquivo baixado. Se o cliente mudar o nome, o Atlas pede para liberar: este link resolve. */
        <details className="v-reserva">
          <summary>{T.liberarQ}</summary>
          <p>{T.liberarT}</p>
          <a className="v-acao v-acao--contorno" href={abrirAtlas}>{T.liberar}</a>
        </details>
      )}
    </div>
  )
}
