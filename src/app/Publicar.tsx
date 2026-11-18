import { useState } from 'react'
import { Botao, Icone } from '../ui'
import { OPCOES, SELECAO_INICIAL, custoTotal, passosLateral, type IdOpcao, type Selecao } from './publicar-dados'
import './publicar.css'

interface Props {
  /** Nome da obra: troca o exemplo do protótipo ("cadeira1") pelo endereço desta obra. */
  slug?: string
  /** "Publicar agora": segue para o guia passo a passo (F13b) das opções marcadas. */
  onPublicar: (selecao: Selecao) => void
  onVoltar?: () => void
}

/**
 * F13a: "Onde o seu sistema vai morar?" (prototipo/F13aPublicar). 4 opções em multiescolha; a lista do lado muda com o que marca.
 * Pagamento e assinatura são sempre do cliente: o Atlas mostra o botão certo e espera.
 */
export function Publicar({ slug = 'cadeira1', onPublicar, onVoltar }: Props) {
  const [sel, setSel] = useState<Selecao>(SELECAO_INICIAL)
  const marcadas = OPCOES.filter((o) => sel[o.id])
  const exemplo = (id: IdOpcao, ex: string) => (id === 'gratis' ? `${slug}.vercel.app` : id === 'dominio' ? `${slug}.com.br` : ex)

  return (
    <div className="at-pub">
      <div className="at-pub__col">
        <div className="at-pub__cab">
          <span className="at-pub__rotulo">OBRA PRONTA · {slug.toUpperCase()}</span>
          <h1>Onde o seu sistema vai morar?</h1>
          <span className="at-pub__sub">Toque em tudo o que você quer. Dá para começar simples e acrescentar depois, a qualquer momento.</span>
        </div>
        <div className="at-pub__grade" role="group" aria-label="Onde o sistema vai morar">
          {OPCOES.map((o) => {
            const on = !!sel[o.id]
            return (
              <button key={o.id} type="button" role="checkbox" aria-checked={on} className={`at-pub__opcao ${on ? 'at-pub__opcao--on' : ''}`} onClick={() => setSel({ ...sel, [o.id]: !on })}>
                <span className="at-pub__opcao-cab">
                  <span className="at-pub__bola"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={o.ic} /></svg></span>
                  <b>{o.nome}</b>
                  <span className="at-pub__caixa">{on && <Icone nome="check" tamanho={14} />}</span>
                </span>
                <span className="at-pub__exemplo">{exemplo(o.id, o.exemplo)}</span>
                <span className="at-pub__txt">{o.txt}</span>
                <span className="at-pub__custo">{o.custo}</span>
              </button>
            )
          })}
        </div>
        <div className="at-pub__rodape">
          <Botao onClick={() => onPublicar(sel)} disabled={marcadas.length === 0}>Publicar agora →</Botao>
          <span>{marcadas.length === 0 ? 'Marque pelo menos uma opção para começar.' : 'O que for pagamento ou assinatura, quem faz é você. O Atlas mostra o botão certo e espera.'}</span>
        </div>
        {onVoltar && <button type="button" className="at-pub__link" onClick={onVoltar}>Voltar ao painel da obra</button>}
      </div>
      <aside className="at-pub__lado" aria-label="O que vai acontecer">
        <span className="at-pub__rotulo">O QUE VAI ACONTECER</span>
        <ol>
          {passosLateral(sel).map((p, i) => (
            <li key={`${i}-${p.txt}`}><span className={`at-pub__quem at-pub__quem--${p.quem}`} aria-label={p.quem === 'A' ? 'O Atlas faz' : 'É com você'}>{p.quem}</span><span>{p.txt}</span></li>
          ))}
        </ol>
        <div className="at-pub__legenda"><span><b>A</b> o Atlas faz</span><span><b>V</b> é com você</span></div>
        <div className="at-pub__custo-total">
          <span>Custo extra para publicar</span>
          <b>{custoTotal(sel)}</b>
          <small>Pago direto a quem cobra. O Atlas não cobra nada a mais.</small>
        </div>
      </aside>
    </div>
  )
}
