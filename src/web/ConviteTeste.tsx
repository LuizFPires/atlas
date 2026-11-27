import { useEffect, useState } from 'react'
import { Esperando } from '../ui/Progresso'
import { semMensagem } from './sem-mensagem'
import './ver-prototipo.css'
import './convite-teste.css'

type Convite = { app_nome: string; grupo_url: string; optin_url: string }
type Estado = { fase: 'carregando' } | { fase: 'ok'; c: Convite } | { fase: 'erro'; texto: string }

const GRUPO_RE = /^https:\/\/groups\.google\.com\/g\/[A-Za-z0-9._-]{1,80}\/?$/
const OPTIN_RE = /^https:\/\/play\.google\.com\/apps\/(internaltest|testing)\/[A-Za-z0-9._-]{1,150}\/?$/
const valido = (c: Partial<Convite>): c is Convite => typeof c.app_nome === 'string' && typeof c.grupo_url === 'string' && GRUPO_RE.test(c.grupo_url) && typeof c.optin_url === 'string' && OPTIN_RE.test(c.optin_url)

/**
 * /teste/<código> (M59): a página que o convite do WhatsApp abre para quem vai testar o app no Android (os 12 testadores do Google).
 * Três passos e "Já instalei": é por aqui que o Atlas conta as pessoas e os 14 dias. Só o nome; nada de e-mail ou telefone.
 */
export function ConviteTeste({ codigo, api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, ''), buscar = fetch }: { codigo: string; api?: string; buscar?: typeof fetch }) {
  const [e, setE] = useState<Estado>({ fase: 'carregando' })
  const [nome, setNome] = useState('')
  const [pronto, setPronto] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        if (!api) throw new Error('sem-api')
        const r = await buscar(`${api}/lojas/convite/ver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) })
        const d = (await r.json().catch(() => ({}))) as Partial<Convite> & { mensagem?: string }
        if (!vivo) return
        if (!r.ok) { setE({ fase: 'erro', texto: d.mensagem ?? 'Esse convite não existe.' }); return }
        if (!valido(d)) { setE({ fase: 'erro', texto: 'Esse convite não pôde ser aberto.' }); return }
        setE({ fase: 'ok', c: { app_nome: d.app_nome.slice(0, 40), grupo_url: d.grupo_url, optin_url: d.optin_url } })
      } catch { if (vivo) setE({ fase: 'erro', texto: 'Não consegui abrir o convite agora. Confira a internet e tente de novo.' }) }
    })()
    return () => { vivo = false }
  }, [codigo, api, buscar])

  const entrar = async () => {
    const n = nome.trim()
    if (!n || !api) { setAviso('Escreva o seu nome.'); return }
    setEnviando(true); setAviso('')
    try {
      const r = await buscar(`${api}/lojas/teste/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, nome: n }) })
      const d = (await r.json().catch(() => ({}))) as { mensagem?: string }
      if (r.ok) setPronto(n.slice(0, 40)); else setAviso(d.mensagem ?? semMensagem(r.status))
    } catch { setAviso('Sem conexão com o servidor do Atlas. Confira a internet e tente de novo.') } finally { setEnviando(false) }
  }

  if (e.fase === 'carregando') return <main className="vp vp--msg"><p role="status">Abrindo o convite…</p><div className="vp__prog"><Esperando rotulo="Abrindo o convite" agora="Buscando o convite" costume={[1, 8]} /></div></main>
  if (e.fase === 'erro') return <main className="vp vp--msg"><p role="alert">{e.texto}</p></main>
  const app = e.c.app_nome
  return (
    <main className="ct">
      <h1>Teste o app {app}</h1>
      <p className="ct__sub">Leva 2 minutos e ajuda muito. Precisa de um celular Android. Deixe o app instalado por 14 dias.</p>
      <ol className="ct__passos">
        <li><b>Entre no grupo de teste</b><span>Use a mesma conta Google do seu celular.</span><a className="ct__btn" href={e.c.grupo_url} target="_blank" rel="noopener noreferrer">Entrar no grupo</a></li>
        <li><b>Aceite ser testador</b><span>Toque em "Quero testar" (Become a tester).</span><a className="ct__btn" href={e.c.optin_url} target="_blank" rel="noopener noreferrer">Quero testar</a></li>
        <li><b>Instale o app {app}</b><span>Na mesma página do Google, toque em "Baixar no Google Play" e instale.</span></li>
      </ol>
      {pronto
        ? <p className="ct__ok" role="status">Obrigado, {pronto}! Deixe o app instalado e abra de vez em quando nos próximos 14 dias.</p>
        : (
          <div className="ct__fim">
            <label className="ct__rot" htmlFor="ct-nome">Já instalou? Escreva o seu nome:</label>
            <input id="ct-nome" aria-label="Seu nome" value={nome} maxLength={40} onChange={(x) => setNome(x.target.value)} autoComplete="given-name" />
            <button type="button" className="ct__btn ct__btn--prim" disabled={enviando} onClick={() => void entrar()}>Já instalei</button>
            {aviso && <p role="alert" className="ct__aviso">{aviso}</p>}
          </div>
        )}
      <p className="ct__nota">Só o seu nome fica guardado, para contar quem está testando.</p>
    </main>
  )
}
