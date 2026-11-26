import { useEffect, useRef, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { CHAVE_EMAIL_COMPRA } from './Cadastro'
import { prateleira } from './conteudo'
import { iniciarCompra, juntarFalaEmail } from './compra'
import { mascaraDocumento } from './documento'
import { opcoesParcelas, planoDoTipo, reais, rotuloParcela } from './parcelas'
import { DOCS_LEGAIS, DOCS_LEGAIS_EN, VERSAO_TERMOS } from './textos-legais'
import { TEXTOS_VENDAS } from './textos-vendas'
import type { Idioma } from '../i18n/idioma'

/** Pede só o e-mail e leva ao pagamento (Pix ou cartão) no gateway. Com `segmento`, é a compra de um app pronto da prateleira. */
export function ModalCompra({ aberto, onFechar, segmento, abrirPagamento = (url) => window.location.assign(url), idioma = 'pt' }: { aberto: boolean; onFechar: () => void; segmento?: string; abrirPagamento?: (url: string) => void; idioma?: Idioma }) {
  const en = idioma === 'en'
  const [email, setEmail] = useState('')
  const [documento, setDocumento] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  const [aceito, setAceito] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tipo = segmento ? 'prateleira' : 'implantacao'
  const plano = planoDoTipo(tipo, parcelas)

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
    if (!aceito) { setErro(en ? 'To continue, check that you have read and accept the Privacy Policy and the Terms of Use.' : 'Para continuar, marque que você leu e aceita a Política de Privacidade e os Termos de Uso.'); return }
    setIndo(true)
    const r = await iniciarCompra(email, undefined, undefined, VERSAO_TERMOS, en ? 1 : parcelas, segmento, undefined, en ? 'us' : undefined, en ? undefined : documento)
    if (r.ok) {
      try { localStorage.setItem(CHAVE_EMAIL_COMPRA, email.trim().toLowerCase()) } catch { /* sem armazenamento: o e-mail é pedido de novo */ }
      abrirPagamento(r.url)
    }
    else { setErro(r.mensagem); setIndo(false) }
  }
  if (en) {
    // M31: em dólar é à vista, só cartão. Os textos legais ainda estão em português (o link avisa).
    const nomePronto = TEXTOS_VENDAS.en.prateleira.find((x) => x.segmento === segmento)?.nome.toLowerCase() ?? segmento
    return (
      <div className="v-fundo" onClick={onFechar}>
        <div ref={ref} className="v-modal" role="dialog" aria-modal="true" aria-labelledby="v-modal-t" lang="en-US" onClick={(e) => e.stopPropagation()}>
          <h2 id="v-modal-t">Where should we send your access?</h2>
          {segmento && <p>You picked the ready-made <b>{nomePronto}</b> app. It belongs to one business only: yours.</p>}
          <p>{segmento ? 'Use the email you check the most: that’s where your app access arrives. Next' : 'Use the email you open on the computer where you’ll build. Next'} you pay by card on a secure page.</p>
          <form onSubmit={ir} noValidate>
            <CampoFalado rotulo="What’s your email?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="you@yourcompany.com" juntar={juntarFalaEmail} en />
            <p className="v-parcelas-nota">{segmento ? TEXTOS_VENDAS.en.precoPronto.avista : TEXTOS_VENDAS.en.preco.valorImplantacao}, one payment. The {TEXTOS_VENDAS.en.preco.valorMensal}/month plan is billed separately, starting in month 2.</p>
            <label className="v-consent">
              <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
              <span>I have read and accept the <a href={DOCS_LEGAIS_EN.privacidade.caminho} target="_blank" rel="noopener noreferrer">Privacy Policy</a> and the <a href={DOCS_LEGAIS_EN.termos.caminho} target="_blank" rel="noopener noreferrer">Terms of Use</a>.</span>
            </label>
            {erro && <p role="alert" className="v-erro">{erro}</p>}
            <button type="submit" className="v-acao" disabled={indo || !aceito}>{indo ? 'Opening the payment page…' : <>Go to payment <Icone nome="seta" /></>}</button>
            <button type="button" className="v-acao v-acao--contorno" onClick={onFechar}>Not now</button>
          </form>
        </div>
      </div>
    )
  }
  return (
    <div className="v-fundo" onClick={onFechar}>
      <div ref={ref} className="v-modal" role="dialog" aria-modal="true" aria-labelledby="v-modal-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="v-modal-t">Para onde mandamos o seu acesso?</h2>
        {segmento && <p>Você escolheu o app pronto de <b>{prateleira.find((x) => x.segmento === segmento)?.nome.toLowerCase() ?? segmento}</b>. Ele é de uma empresa só: a sua.</p>}
        <p>{segmento ? 'Coloque o e-mail que você mais usa: é nele que chega o acesso ao seu app. Em seguida' : 'Coloque o e-mail que você abre no computador onde vai construir. Em seguida'} você paga com Pix ou cartão, em uma página segura.</p>
        <form onSubmit={ir} noValidate>
          <CampoFalado rotulo="Qual o seu e-mail?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@suaempresa.com.br" juntar={juntarFalaEmail} />
          <CampoFalado rotulo="CPF ou CNPJ de quem compra" valor={documento} onChange={(v) => setDocumento(mascaraDocumento(v))} placeholder="000.000.000-00" juntar={(a, f) => mascaraDocumento(`${a} ${f}`)} ajuda="Vai na nota da compra. O preço em real é para quem tem documento brasileiro; de fora do Brasil, a compra é pela página em inglês, em dólar." />
          <label className="v-parcelas">
            <span>Em quantas vezes? <small>(no cartão)</small></span>
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
              {opcoesParcelas(tipo).map((p) => <option key={p.parcelas} value={p.parcelas}>{rotuloParcela(p)}</option>)}
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
