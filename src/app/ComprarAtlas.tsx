// Compra de dentro do Atlas instalado (teste grátis ou cortesia): mesmas regras do site (preço, parcelas, aceite dos termos),
// com o e-mail da ativação fixo. O pagamento abre no navegador do cliente, na página da Stripe; o Atlas nunca vê dado de cartão.
import { useEffect, useRef, useState } from 'react'
import { textoDaTrava } from './explicar-trava'
import { CampoFalado, Icone } from '../ui'
import { mascaraDocumento } from '../web/documento'
import type { ResultadoCompra } from '../web/compra'
import { Markdown } from '../web/Markdown'
import { opcoesParcelas, planoDoTipo, reais, rotuloParcela } from '../web/parcelas'
import { DOCS_LEGAIS, VERSAO_TERMOS } from '../web/textos-legais'
import '../web/web.css'

export interface PedidoCompraNoApp { email: string; parcelas: number; versaoTermos: string; origem: 'app'; documento: string }

type Props = {
  aberto: boolean
  /** E-mail da ativação deste computador: a compra converte a licença dele. */
  email: string
  onFechar: () => void
  iniciar: (p: PedidoCompraNoApp) => Promise<ResultadoCompra>
  /** Abre a página de pagamento no navegador do cliente (o processo principal só aceita a da Stripe). */
  abrirPagamento: (url: string) => Promise<void>
  /** A página de pagamento abriu: o app passa a conferir a licença de perto. */
  onPagamentoAberto: () => void
}

const MSG_NAO_ABRIU = 'Não consegui abrir a página de pagamento. Tente de novo em instantes.'

export function ComprarAtlas({ aberto, email, onFechar, iniciar, abrirPagamento, onPagamentoAberto }: Props) {
  const [parcelas, setParcelas] = useState(1)
  const [documento, setDocumento] = useState('')
  const [aceito, setAceito] = useState(false)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState('')
  const [abriu, setAbriu] = useState(false)
  const [lendo, setLendo] = useState<'privacidade' | 'termos' | null>(null)
  const enviando = useRef(false)
  const plano = planoDoTipo('implantacao', parcelas)

  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [aberto, onFechar])

  if (!aberto) return null

  const ir = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!aceito || enviando.current) return
    enviando.current = true
    setErro(''); setIndo(true)
    try {
      const r = await iniciar({ email, parcelas, versaoTermos: VERSAO_TERMOS, origem: 'app', documento })
      if (!r.ok) { setErro(r.mensagem); return }
      try { await abrirPagamento(r.url) } catch (e) { setErro(textoDaTrava(e, MSG_NAO_ABRIU.replace(' Tente de novo em instantes.', ''))); return }
      setAbriu(true)
      onPagamentoAberto()
    } finally { enviando.current = false; setIndo(false) }
  }

  return (
    <div className="v-fundo" onClick={onFechar}>
      <div className="v-modal" role="dialog" aria-modal="true" aria-labelledby="comprar-atlas-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="comprar-atlas-t">Ficar com o Atlas</h2>
        <p>Você continua de onde está: as suas obras e este computador seguem iguais. O pagamento é feito com Pix ou cartão, em uma página segura que abre no seu navegador.</p>
        <p>A compra vale para <b>{email}</b>, o e-mail deste Atlas.</p>
        <form onSubmit={ir} noValidate>
          <CampoFalado rotulo="CPF ou CNPJ de quem compra" valor={documento} onChange={(v) => setDocumento(mascaraDocumento(v))} placeholder="000.000.000-00" juntar={(a, f) => mascaraDocumento(`${a} ${f}`)} ajuda="Vai na nota da compra. O preço em real é para quem tem documento brasileiro." />
          <label className="v-parcelas">
            <span>Em quantas vezes? <small>(no cartão)</small></span>
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
              {opcoesParcelas('implantacao').map((p) => <option key={p.parcelas} value={p.parcelas}>{rotuloParcela(p)}</option>)}
            </select>
          </label>
          <p className="v-parcelas-nota">
            {plano.parcelas > 1 ? `${plano.parcelas}x de ${reais(plano.parcela)} — total ${reais(plano.total)}. ` : `À vista: ${reais(plano.total)}. `}
            {plano.temJuros ? 'Acima de 3x, com juros de 2% ao mês.' : 'Até 3x sem juros.'} No Pix, é à vista. A mensalidade de R$ 200/mês é cobrada à parte, a partir do 2º mês.
          </p>
          <label className="v-consent">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Li e aceito a Política de Privacidade e os Termos de Uso.</span>
          </label>
          <p className="v-mute">
            Para ler: <button type="button" className="v-link" aria-expanded={lendo === 'privacidade'} onClick={() => setLendo(lendo === 'privacidade' ? null : 'privacidade')}>{DOCS_LEGAIS.privacidade.titulo}</button>
            {' · '}
            <button type="button" className="v-link" aria-expanded={lendo === 'termos'} onClick={() => setLendo(lendo === 'termos' ? null : 'termos')}>{DOCS_LEGAIS.termos.titulo}</button>
          </p>
          {lendo && (
            <section role="region" aria-label={DOCS_LEGAIS[lendo].titulo} className="v-legal-no-app" tabIndex={0}>
              <Markdown texto={DOCS_LEGAIS[lendo].md} />
            </section>
          )}
          {erro && <p role="alert" className="v-erro">{erro}</p>}
          {abriu && <p role="status" className="v-teste-ok"><Icone nome="check" tamanho={18} /><span className="v-teste-ok-txt">Abri a página de pagamento no seu navegador. Quando você pagar, eu aviso aqui.</span></p>}
          <button type="submit" className="v-acao" disabled={indo || !aceito}>{indo ? 'Abrindo o pagamento…' : abriu ? <>Abrir o pagamento de novo <Icone nome="seta" /></> : <>Ir para o pagamento <Icone nome="seta" /></>}</button>
          <button type="button" className="v-acao v-acao--contorno" onClick={onFechar}>{abriu ? 'Fechar' : 'Agora não'}</button>
        </form>
      </div>
    </div>
  )
}
