import { useEffect, useRef, useState } from 'react'
import { CampoFalado, falaParaEmail, Icone } from '../ui'
import { iniciarCompra } from './compra'

/** Pede só o e-mail e leva ao pagamento (Pix ou cartão) no gateway. */
export function ModalCompra({ aberto, onFechar, abrirPagamento = (url) => window.location.assign(url) }: { aberto: boolean; onFechar: () => void; abrirPagamento?: (url: string) => void }) {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', tecla)
    ref.current?.querySelector('input')?.focus()
    return () => document.removeEventListener('keydown', tecla)
  }, [aberto, onFechar])

  if (!aberto) return null
  const ir = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro('')
    setIndo(true)
    const r = await iniciarCompra(email)
    if (r.ok) abrirPagamento(r.url)
    else { setErro(r.mensagem); setIndo(false) }
  }
  return (
    <div className="v-fundo" onClick={onFechar}>
      <div ref={ref} className="v-modal" role="dialog" aria-modal="true" aria-labelledby="v-modal-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="v-modal-t">Para onde mandamos o seu acesso?</h2>
        <p>Coloque o e-mail que você abre no computador onde vai construir. Em seguida você paga com Pix ou cartão, em uma página segura.</p>
        <form onSubmit={ir} noValidate>
          <CampoFalado rotulo="Qual o seu e-mail?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@suaempresa.com.br" juntar={(atual, falado) => falaParaEmail(atual + falado)} />
          {erro && <p role="alert" className="v-erro">{erro}</p>}
          <button type="submit" className="v-acao" disabled={indo}>{indo ? 'Abrindo o pagamento…' : <>Ir para o pagamento <Icone nome="seta" /></>}</button>
          <button type="button" className="v-acao v-acao--contorno" onClick={onFechar}>Agora não</button>
        </form>
      </div>
    </div>
  )
}
