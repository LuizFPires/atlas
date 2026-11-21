import { useEffect, useState } from 'react'
import { Icone } from '../ui'
import { criarInstalarApi, type InstalarApi, type ResultadoAbertura } from './instalar-api'
import { tokenDaUrl } from './degustacao-api'
import './web.css'

const MSG_SEM_TOKEN = 'Esse link não está completo. Abra o link direto do e-mail que eu te mandei.'
const api_padrao = criarInstalarApi()

type Fase = { fase: 'abrindo' } | { fase: 'erro'; mensagem: string } | { fase: 'ok'; a: Extract<ResultadoAbertura, { ok: true }> }
type Reenvio = { s: 'parado' } | { s: 'enviando' } | { s: 'ok' } | { s: 'erro'; mensagem: string }
type Download = { s: 'parado' } | { s: 'pedindo' } | { s: 'ok' } | { s: 'erro'; mensagem: string }
const irPadrao = (url: string) => window.location.assign(url)

/** Página aberta pelo link do e-mail (/instalar?t=…): confirma o acesso e mostra o próximo passo. Pública: o token é a prova. */
export function Instalar({ api = api_padrao, token = tokenDaUrl(), ir = irPadrao }: { api?: InstalarApi; token?: string; /** Leva o navegador ao endereço do arquivo (troca nos testes). */ ir?: (url: string) => void }) {
  const [estado, setEstado] = useState<Fase>(token ? { fase: 'abrindo' } : { fase: 'erro', mensagem: MSG_SEM_TOKEN })
  const [reenvio, setReenvio] = useState<Reenvio>({ s: 'parado' })
  const [download, setDownload] = useState<Download>({ s: 'parado' })
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
    const r = await api.baixar(token)
    if (!r.ok) { setDownload({ s: 'erro', mensagem: r.mensagem }); return }
    // O endereço é temporário e baixa o arquivo sem sair desta página.
    ir(r.url)
    setDownload({ s: 'ok' })
  }

  return (
    <div className="v v-confirmar">
      <div className="v-modal" style={{ margin: '12vh auto 0' }}>
        {estado.fase === 'abrindo' && <p role="status">Abrindo o seu acesso…</p>}
        {estado.fase === 'erro' && (
          <>
            <h2>Não consegui abrir o seu acesso.</h2>
            <p role="alert">{estado.mensagem}</p>
            <p className="v-mute">Se o link venceu ou já foi usado, é só pedir o acesso de novo na página inicial.</p>
            <a className="v-acao v-acao--contorno" href="/">Voltar para a página inicial</a>
          </>
        )}
        {estado.fase === 'ok' && (
          <>
            <h2>Seu acesso está liberado!</h2>
            {estado.a.celular ? (
              <>
                <p>{estado.a.aviso ?? 'Abra no computador onde você vai construir. O Atlas se instala no computador, não no celular.'}</p>
                {estado.a.podeReenviar && reenvio.s !== 'ok' && (
                  <button type="button" className="v-acao" onClick={reenviar} disabled={reenvio.s === 'enviando'}>
                    {reenvio.s === 'enviando' ? 'Enviando…' : <>Enviar para o meu computador <Icone nome="seta" /></>}
                  </button>
                )}
                {reenvio.s === 'ok' && <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">Mandei o acesso de novo para o seu e-mail. Abra o e-mail no computador onde vai construir.</span></p>}
                {reenvio.s === 'erro' && <p role="alert" className="v-erro">{reenvio.mensagem}</p>}
              </>
            ) : estado.a.instalador ? (
              <>
                <p>O Atlas se instala neste computador. Baixe o instalador, abra o arquivo e eu cuido do resto. Leva uns 10 minutos.</p>
                <button type="button" className="v-acao" onClick={baixar} disabled={download.s === 'pedindo'}>
                  {download.s === 'pedindo' ? 'Preparando…' : download.s === 'ok' ? <>Baixar o instalador de novo <Icone nome="seta" /></> : <>Baixar o instalador <Icone nome="seta" /></>}
                </button>
                {download.s === 'ok' && (
                  <>
                    <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">O download começou.</span></p>
                    <p className="v-mute">Quando terminar, abra o arquivo Atlas-Instalador.exe (ele fica na pasta Downloads) e siga as instruções na tela.</p>
                  </>
                )}
                {download.s === 'erro' && <p role="alert" className="v-erro">{download.mensagem}</p>}
              </>
            ) : (
              <>
                <p>O Atlas se instala neste computador, e o seu acesso já está pronto: você não precisa fazer mais nada para liberar.</p>
                <p className="v-mute" data-testid="download-pendente">O botão para baixar o instalador ainda não está disponível aqui. Assim que ele abrir, vai aparecer nesta mesma página, e o seu link continua valendo até lá.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
