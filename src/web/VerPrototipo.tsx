import { useEffect, useState } from 'react'
import './ver-prototipo.css'

type Estado = { fase: 'carregando' } | { fase: 'ok'; nome: string; documento: string; ate: string } | { fase: 'erro'; texto: string }

/** O documento tem de ser o protótipo do Atlas (CSP sem script logo no começo); qualquer outra coisa não é mostrada. */
const protegido = (d: unknown): d is string => typeof d === 'string' && /^<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'/.test(d)

/**
 * /p/<token>: o protótipo navegável que o cliente mandou para o celular (link provisório de 7 dias).
 * O HTML é NÃO confiável: só vive dentro de um iframe com sandbox vazio (sem script), em tela cheia.
 */
export function VerPrototipo({ token, api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, ''), buscar = fetch }: { token: string; api?: string; buscar?: typeof fetch }) {
  const [e, setE] = useState<Estado>({ fase: 'carregando' })
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        if (!api) throw new Error('sem-api')
        const r = await buscar(`${api}/prototipo/ver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        const d = (await r.json().catch(() => ({}))) as { nome?: string; documento?: unknown; expira_em?: string; mensagem?: string }
        if (!vivo) return
        if (!r.ok) { setE({ fase: 'erro', texto: d.mensagem ?? 'Esse link não existe.' }); return }
        if (!protegido(d.documento)) { setE({ fase: 'erro', texto: 'Esse protótipo não pôde ser aberto.' }); return }
        const ate = d.expira_em ? new Date(d.expira_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : ''
        setE({ fase: 'ok', nome: String(d.nome ?? 'Protótipo').slice(0, 60), documento: d.documento, ate })
      } catch { if (vivo) setE({ fase: 'erro', texto: 'Não consegui abrir o protótipo agora. Confira a internet e tente de novo.' }) }
    })()
    return () => { vivo = false }
  }, [token, api, buscar])

  if (e.fase === 'carregando') return <main className="vp vp--msg"><span className="vp__giro" aria-hidden="true" /><p role="status">Abrindo o protótipo…</p></main>
  if (e.fase === 'erro') return <main className="vp vp--msg"><b>ATLAS</b><p role="alert">{e.texto}</p></main>
  return (
    <main className="vp">
      <header className="vp__faixa"><b>ATLAS</b><span>Protótipo · {e.nome}{e.ate && ` · vale até ${e.ate}`}</span></header>
      <iframe className="vp__quadro" title={`Protótipo do ${e.nome}`} sandbox="" srcDoc={e.documento} referrerPolicy="no-referrer" />
    </main>
  )
}
