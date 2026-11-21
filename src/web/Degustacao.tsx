import { useEffect, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { juntarFalaEmail } from './compra'
import { criarDegustacaoApi, type DegustacaoApi, type EstadoDegustacao, tokenDaUrl } from './degustacao-api'
import './web.css'

const MSG_SEM_TOKEN = 'Esse link não está completo. Abra o link direto do e-mail, ou peça o teste de novo na página inicial.'
const api_padrao = criarDegustacaoApi()

/** Bloco "Testar grátis" da página de vendas: só aparece quando o gestor deixou a oferta ligada. */
export function BlocoDegustacao({ api = api_padrao }: { api?: DegustacaoApi }) {
  const [estado, setEstado] = useState<EstadoDegustacao | null>(null)
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState('')

  useEffect(() => {
    let vivo = true
    api.estado().then((e) => { if (vivo) setEstado(e) })
    return () => { vivo = false }
  }, [api])

  if (!estado?.ativa) return null
  const pedir = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro(''); setEnviando(true)
    const r = await api.pedir(email)
    setEnviando(false)
    if (r.ok) setEnviado(email.trim().toLowerCase()); else setErro(r.mensagem)
  }
  return (
    <section id="testar" className="v-sec v-teste" aria-label="Testar grátis">
      <div className="v-cab">
        <span className="v-mono">Teste grátis</span>
        <h2>Testar {estado.dias} dias grátis</h2>
        <p>Quer ver o Atlas funcionando antes de decidir? Coloque o seu e-mail e eu mando um link para liberar o teste. Sem cartão, sem cobrança.</p>
      </div>
      {enviado ? (
        <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">Te enviei um e-mail para <b>{enviado}</b>. Clica no link que está nele pra liberar o seu teste. Não achou? Olhe também o spam.</span></p>
      ) : (
        <form className="v-teste-form" onSubmit={pedir} noValidate>
          <CampoFalado rotulo="Qual o seu e-mail?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@suaempresa.com.br" juntar={juntarFalaEmail} />
          {erro && <p role="alert" className="v-erro">{erro}</p>}
          <button type="submit" className="v-acao" disabled={enviando || !email.trim()}>{enviando ? 'Enviando…' : <>Quero testar {estado.dias} dias grátis <Icone nome="seta" /></>}</button>
          <small className="v-mute">O teste acaba sozinho depois de {estado.dias} dias. Um teste por pessoa.</small>
        </form>
      )}
    </section>
  )
}

/** Página aberta pelo link do e-mail (/degustacao?t=…): confirma e leva para a instalação. */
export function ConfirmarDegustacao({ api = api_padrao, token = tokenDaUrl() }: { api?: DegustacaoApi; token?: string }) {
  const [estado, setEstado] = useState<{ fase: 'confirmando' } | { fase: 'ok'; dias: number; linkToken: string } | { fase: 'erro'; mensagem: string }>(token ? { fase: 'confirmando' } : { fase: 'erro', mensagem: MSG_SEM_TOKEN })
  useEffect(() => {
    let vivo = true
    if (!token) return
    api.confirmar(token).then((r) => { if (vivo) setEstado(r.ok ? { fase: 'ok', dias: r.dias, linkToken: r.linkToken } : { fase: 'erro', mensagem: r.mensagem }) })
    return () => { vivo = false }
  }, [api, token])
  return (
    <div className="v v-confirmar">
      <div className="v-modal" style={{ margin: '12vh auto 0' }}>
        {estado.fase === 'confirmando' && <p role="status">Liberando o seu teste…</p>}
        {estado.fase === 'ok' && (
          <>
            <h2>Pronto, o seu teste está liberado.</h2>
            <p>Você tem {estado.dias} dias para experimentar o Atlas. Agora é só instalar no computador onde vai construir.</p>
            <a className="v-acao" href={`/instalar?t=${encodeURIComponent(estado.linkToken)}`}>Instalar o Atlas <Icone nome="seta" /></a>
          </>
        )}
        {estado.fase === 'erro' && (
          <>
            <h2>Não consegui liberar o teste.</h2>
            <p role="alert">{estado.mensagem}</p>
            <a className="v-acao v-acao--contorno" href="/">Voltar para a página inicial</a>
          </>
        )}
      </div>
    </div>
  )
}
