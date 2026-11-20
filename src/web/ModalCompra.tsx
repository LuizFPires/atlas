import { useEffect, useRef, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { CHAVE_EMAIL_COMPRA } from './Cadastro'
import { iniciarCompra, juntarFalaEmail } from './compra'
import { opcoesParcelas, planoImplantacao, reais, rotuloParcela } from './parcelas'
import { DOCS_LEGAIS, VERSAO_TERMOS } from './textos-legais'

/** Pede só o e-mail e leva ao pagamento (Pix ou cartão) no gateway. */
export function ModalCompra({ aberto, onFechar, abrirPagamento = (url) => window.location.assign(url) }: { aberto: boolean; onFechar: () => void; abrirPagamento?: (url: string) => void }) {
  const [email, setEmail] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  const [aceito, setAceito] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const plano = planoImplantacao(parcelas)

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
    if (!aceito) { setErro('Para continuar, marque que você leu e aceita a Política de Privacidade e os Termos de Uso.'); return }
    setIndo(true)
    const r = await iniciarCompra(email, undefined, undefined, VERSAO_TERMOS, parcelas)
    if (r.ok) {
      try { localStorage.setItem(CHAVE_EMAIL_COMPRA, email.trim().toLowerCase()) } catch { /* sem armazenamento: o e-mail é pedido de novo */ }
      abrirPagamento(r.url)
    }
    else { setErro(r.mensagem); setIndo(false) }
  }
  return (
    <div className="v-fundo" onClick={onFechar}>
      <div ref={ref} className="v-modal" role="dialog" aria-modal="true" aria-labelledby="v-modal-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="v-modal-t">Para onde mandamos o seu acesso?</h2>
        <p>Coloque o e-mail que você abre no computador onde vai construir. Em seguida você paga com Pix ou cartão, em uma página segura.</p>
        <form onSubmit={ir} noValidate>
          <CampoFalado rotulo="Qual o seu e-mail?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@suaempresa.com.br" juntar={juntarFalaEmail} />
          <label className="v-parcelas">
            <span>Em quantas vezes? <small>(no cartão)</small></span>
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
              {opcoesParcelas().map((p) => <option key={p.parcelas} value={p.parcelas}>{rotuloParcela(p)}</option>)}
            </select>
          </label>
          <p className="v-parcelas-nota">
            {plano.parcelas > 1 ? `${plano.parcelas}x de ${reais(plano.parcela)} — total ${reais(plano.total)}. ` : `À vista: ${reais(plano.total)}. `}
            {plano.temJuros ? 'Acima de 3x, com juros de 2% ao mês.' : 'Até 3x sem juros.'} No Pix, é à vista. A mensalidade de R$ 200/mês é cobrada à parte, a partir do 2º mês.
          </p>
          <label className="v-consent">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Li e aceito a <a href={DOCS_LEGAIS.privacidade.caminho} target="_blank" rel="noopener noreferrer">Política de Privacidade</a> e os <a href={DOCS_LEGAIS.termos.caminho} target="_blank" rel="noopener noreferrer">Termos de Uso</a>.</span>
          </label>
          {erro && <p role="alert" className="v-erro">{erro}</p>}
          <button type="submit" className="v-acao" disabled={indo || !aceito}>{indo ? 'Abrindo o pagamento…' : <>Ir para o pagamento <Icone nome="seta" /></>}</button>
          <button type="button" className="v-acao v-acao--contorno" onClick={onFechar}>Agora não</button>
        </form>
      </div>
    </div>
  )
}
