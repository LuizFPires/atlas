import { useEffect, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { juntarFalaEmail } from './compra'
import type { PerfilPortal, PortalApi } from './portal-api'
import './web.css'

/** Portal do cliente (F15) em /conta: login próprio do Atlas (e-mail + código), independente do login do Claude. */
export function Portal({ api }: { api: PortalApi }) {
  const [perfil, setPerfil] = useState<PerfilPortal | null>(null)
  const [carregando, setCarregando] = useState(api.logado())
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!api.logado()) return
    let vivo = true
    api.eu().then((r) => {
      if (!vivo) return
      if (r.ok) setPerfil(r.perfil)
      else setAviso(r.mensagem)
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [api])

  const sair = () => { api.sair(); setPerfil(null); setAviso('') }
  const rotulo = perfil ? [perfil.nome, perfil.empresa].filter(Boolean).join(' · ') : ''

  return (
    <div className="c">
      <header className="c-topo">
        <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        <span>atlas-ia.app.br/conta</span>
        {perfil && <span className="p-quem">{rotulo}</span>}
        {perfil && <button type="button" className="p-sair" onClick={sair}>Sair</button>}
      </header>
      {carregando ? (
        <main className="p-main"><p className="c-lead" role="status">Abrindo a sua conta…</p></main>
      ) : perfil ? (
        <main className="p-main"><h1>Minha conta</h1></main>
      ) : (
        <Entrada api={api} aviso={aviso} onEntrou={(p) => setPerfil(p)} />
      )}
    </div>
  )
}

function Entrada({ api, aviso, onEntrou }: { api: PortalApi; aviso: string; onEntrou: (p: PerfilPortal) => void }) {
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [erro, setErro] = useState(aviso)
  const [ocupado, setOcupado] = useState(false)

  const pedir = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro(''); setOcupado(true)
    const r = await api.pedirCodigoLogin(email)
    setOcupado(false)
    if (r.ok) setEtapa('codigo')
    else setErro(r.mensagem)
  }
  const confirmar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro(''); setOcupado(true)
    const r = await api.entrar(email, codigo)
    if (!r.ok) { setOcupado(false); setErro(r.mensagem); return }
    const eu = await api.eu()
    setOcupado(false)
    if (eu.ok) onEntrou(eu.perfil)
    else { api.sair(); setErro(eu.mensagem) }
  }

  return (
    <main className="p-entrada">
      <form className="c-form p-form" onSubmit={etapa === 'email' ? pedir : confirmar} noValidate>
        <span className="c-ok"><Icone nome="check" tamanho={26} /></span>
        <h1>Entrar na minha conta</h1>
        {etapa === 'email' ? (
          <>
            <p className="c-lead">Use o e-mail que você usou na compra. A gente manda um código de 6 números para ele. Não precisa de senha.</p>
            <CampoFalado rotulo="Qual o seu e-mail?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@suaempresa.com.br" juntar={juntarFalaEmail} />
          </>
        ) : (
          <>
            <p className="c-lead">Mandamos um código para o seu e-mail. Digite os números aqui. Ele vale por alguns minutos.</p>
            <CampoFalado rotulo="Código que chegou no e-mail" valor={codigo} onChange={(v) => setCodigo(v.replace(/[^\d\s]/g, ''))} placeholder="000000" autoComplete="one-time-code" />
          </>
        )}
        {erro && <p role="alert" className="v-erro">{erro}</p>}
        <button type="submit" className="v-acao" disabled={ocupado}>
          {ocupado ? 'Um instante…' : etapa === 'email' ? <>Receber o código <Icone nome="seta" /></> : <>Entrar <Icone nome="seta" /></>}
        </button>
        {etapa === 'codigo' && (
          <button type="button" className="p-link" onClick={() => { setEtapa('email'); setCodigo(''); setErro('') }}>Usar outro e-mail ou pedir um novo código</button>
        )}
        <span className="c-mute" style={{ fontSize: 13, lineHeight: 1.5 }}>Esta conta é só sua: ela mostra apenas a sua licença e os seus pagamentos. Qualquer dúvida, a Ajuda do Atlas te guia.</span>
      </form>
    </main>
  )
}
