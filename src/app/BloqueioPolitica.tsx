import { useState } from 'react'
import { textoDaTrava } from './explicar-trava'
import { CampoFalado } from '../ui'
import { NAO_PODE, PODE, type PontePolitica } from './ponte-politica'
import './bloqueio-politica.css'

interface Props {
  /** ideia: a ideia foi bloqueada (AC1); pedido: um pedido do pós-obra (AC3); embargada: a obra está embargada (AC5). */
  modo: 'ideia' | 'pedido' | 'embargada'
  sinais?: string[]
  /** Identificação da obra para a análise ('nova-obra' na ideia). */
  obra: string
  politica: PontePolitica
  /** Ideia: "Contar outra ideia". Pedido: "Voltar à obra sem este pedido". */
  onVoltar?: () => void
}

const ALERTA = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" /></svg>
const CADEADO = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>

/**
 * M65: o Atlas não constrói outro Atlas (prototipo/caminho-novo/AC1Politica, AC2Engano, AC3Obra, AC5Embargada).
 * Sempre claro, sem acusar: o que pode, o que não pode e "Acha que é engano? Explique" (vai para a análise da equipe).
 */
export function BloqueioPolitica({ modo, sinais = [], obra, politica, onVoltar }: Props) {
  const [explicar, setExplicar] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviado, setEnviado] = useState<'nao' | 'enviando' | 'sim' | 'erro'>('nao')
  const [motivoErro, setMotivoErro] = useState('')

  const enviar = async () => {
    if (!texto.trim()) return
    setEnviado('enviando')
    try { await politica.analise(obra, texto.trim()); setEnviado('sim') } catch (e) { setMotivoErro(textoDaTrava(e, 'Não consegui enviar.')); setEnviado('erro') }
  }

  if (explicar) {
    return (
      <section className="at-pol at-pol--analise" aria-label="Pedir análise">
        <b className="at-pol__tit">Conte em poucas palavras para que serve o seu sistema.</b>
        <span className="at-pol__txt">Uma pessoa da equipe do Atlas lê e responde em até 1 dia útil, no seu e-mail e aqui no Atlas. Se estiver liberado, a obra segue de onde parou.</span>
        {enviado === 'sim' ? (
          <p className="at-pol__ok" role="status">Recebido. A equipe do Atlas vai analisar e responder em até 1 dia útil.</p>
        ) : (
          <>
            <CampoFalado rotulo="Para que serve o seu sistema" valor={texto} onChange={setTexto} placeholder="Toque no microfone ou escreva…" />
            <button type="button" className="at-pol__prim" disabled={!texto.trim() || enviado === 'enviando'} onClick={() => void enviar()}>Enviar para análise →</button>
            {enviado === 'erro' && <p className="at-pol__nota" role="alert">{motivoErro}</p>}
          </>
        )}
        <button type="button" className="at-pol__sec" onClick={() => setExplicar(false)}>Voltar</button>
      </section>
    )
  }

  if (modo === 'embargada') {
    return (
      <section className="at-pol at-pol--embargo" aria-label="Obra embargada">
        <span className="at-pol__rot at-pol__rot--embargo">{CADEADO}OBRA EMBARGADA</span>
        <b className="at-pol__tit">Esta obra está parada enquanto a equipe do Atlas analisa se ela pode seguir.</b>
        <span className="at-pol__txt">Vários pedidos desta obra tentaram transformá-la num sistema que constrói outros sistemas, como o Atlas. Por isso ela foi embargada, como uma obra de verdade parada pela fiscalização. Nada foi apagado.</span>
        <ul className="at-pol__lista">
          <li className="at-pol__sim">As suas outras obras continuam normalmente.</li>
          <li className="at-pol__sim">Você pode começar uma obra nova, com outra ideia.</li>
          <li className="at-pol__nao">Esta obra só volta a andar se a análise liberar.</li>
        </ul>
        <span className="at-pol__nota">A resposta chega no seu e-mail e aqui no Atlas. Tentar de novo por outro caminho pode levar ao encerramento do uso do Atlas, como dizem os termos de uso.</span>
        <button type="button" className="at-pol__sec" onClick={() => setExplicar(true)}>Explicar o meu projeto para a análise</button>
      </section>
    )
  }

  return (
    <section className="at-pol" aria-label="Política do Atlas">
      <span className="at-pol__rot">{ALERTA}{modo === 'ideia' ? 'ESTA OBRA NÃO PODE SER FEITA NO ATLAS' : 'ESTE PEDIDO NÃO PODE SER FEITO'}</span>
      <b className="at-pol__tit">{modo === 'ideia' ? 'Este projeto se parece com o próprio Atlas.' : 'Somados, os pedidos transformam a obra num sistema que constrói outros sistemas, como o Atlas.'}</b>
      <span className="at-pol__txt">{modo === 'ideia'
        ? 'Um sistema que recebe ideias e protótipos, monta um plano de construção e coloca agentes de IA para construir outros sistemas é o que o Atlas faz. Construir isso com o Atlas vai contra as políticas de desenvolvimento do Atlas, que você aceitou nos termos de uso.'
        : 'Isso vai contra as políticas de desenvolvimento do Atlas. O pedido não foi feito e nada da obra foi apagado: o que já estava pronto continua funcionando.'}</span>
      {sinais.length > 0 && (
        <div className="at-pol__caixa">
          <span className="at-pol__rot at-pol__rot--mudo">O QUE O ATLAS RECONHECEU</span>
          <ul className="at-pol__lista">{sinais.map((s) => <li key={s} className="at-pol__ponto">{s}</li>)}</ul>
        </div>
      )}
      <div className="at-pol__duas">
        <div className="at-pol__caixa"><span className="at-pol__rot at-pol__rot--lime">PODE, À VONTADE</span><ul className="at-pol__lista">{PODE.map((p) => <li key={p} className="at-pol__sim">{p}</li>)}</ul></div>
        <div className="at-pol__caixa"><span className="at-pol__rot">NÃO PODE</span><ul className="at-pol__lista">{NAO_PODE.map((p) => <li key={p} className="at-pol__nao">{p}</li>)}</ul></div>
      </div>
      {onVoltar && <button type="button" className="at-pol__prim" onClick={onVoltar}>{modo === 'ideia' ? 'Contar outra ideia →' : 'Voltar à obra sem este pedido'}</button>}
      <button type="button" className="at-pol__sec" onClick={() => setExplicar(true)}>Acha que é engano? Explique</button>
    </section>
  )
}
