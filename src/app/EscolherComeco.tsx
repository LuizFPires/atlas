import { useState } from 'react'
import { Botao } from '../ui'
import type { ComoComecar } from './ponte-construcao'
import type { Plano } from './ponte-claude'
import { diferenca, estimarCaminhos, quando, recomendado } from './fila-obras'
import './escolher-comeco.css'

// M51 (Q1Escolher aprovado pelo Luiz em 25/11/2026): outra obra já está trabalhando; o cliente escolhe como começar esta, vendo
// antes o que muda na cota do Claude e no prazo de cada obra.

interface Props {
  nova: string
  atual: { nome: string; restanteMin: number | null }
  /** Horas estimadas da obra nova inteira (pelo plano dela); null sem estimativa. */
  novaH: number | null
  plano: Plano
  ocupado?: boolean
  /** Texto do botão de cancelar (no Canteiro, "Deixar como está"). */
  textoCancelar?: string
  onEscolher: (como: ComoComecar) => void
  onCancelar: () => void
  agora?: () => Date
}

type Cor = 'bom' | 'atencao' | 'neutro'
const TITULO: Record<ComoComecar, string> = { fila: 'Colocar na fila', juntas: 'Trabalhar ao mesmo tempo', primeiro: 'Esta primeiro' }
const BOTAO: Record<ComoComecar, string> = { fila: 'Colocar na fila', juntas: 'Começar ao mesmo tempo', primeiro: 'Começar esta primeiro' }

export function EscolherComeco({ nova, atual, novaH, plano, ocupado, textoCancelar = 'Agora não', onEscolher, onCancelar, agora = () => new Date() }: Props) {
  const rec = recomendado(plano)
  const [escolha, setEscolha] = useState<ComoComecar>(rec)
  const max = plano === 'max'
  const atualH = atual.restanteMin !== null ? atual.restanteMin / 60 : null
  const fins = atualH !== null && novaH !== null ? estimarCaminhos(atualH, novaH, plano) : null
  const agoraD = agora()
  const pronto = (h: number) => `Pronta ${quando(agoraD, h)}`
  const efeitos: Record<ComoComecar, { rot: string; txt: string; cor: Cor }[]> = {
    fila: [
      { rot: 'COTA DO CLAUDE', txt: 'Gasta no mesmo ritmo de hoje.', cor: 'bom' },
      { rot: atual.nome.toLocaleUpperCase('pt-BR'), txt: fins ? `${pronto(fins.fila.atual)} (como previsto).` : 'Termina como previsto.', cor: 'bom' },
      { rot: nova.toLocaleUpperCase('pt-BR'), txt: fins ? `Começa ${quando(agoraD, fins.fila.atual)} · ${pronto(fins.fila.nova).toLocaleLowerCase('pt-BR')}.` : `Começa sozinha quando ${atual.nome} ficar pronta.`, cor: 'neutro' },
    ],
    juntas: [
      { rot: 'COTA DO CLAUDE', txt: max ? 'Gasta umas 2× mais rápido. No Max ainda costuma sobrar.' : 'Acaba umas 2× mais rápido. As duas param juntas esperando ela voltar.', cor: 'atencao' },
      { rot: atual.nome.toLocaleUpperCase('pt-BR'), txt: fins ? `${pronto(fins.juntas.atual)} (${diferenca(fins.juntas.atual - fins.fila.atual)}).` : 'Fica mais lenta enquanto as duas trabalham.', cor: 'atencao' },
      { rot: nova.toLocaleUpperCase('pt-BR'), txt: fins ? `Começa agora · ${pronto(fins.juntas.nova).toLocaleLowerCase('pt-BR')} (${diferenca(fins.juntas.nova - fins.fila.nova)}).` : 'Começa agora, num ritmo mais lento.', cor: fins && fins.fila.nova - fins.juntas.nova >= 2 ? 'bom' : 'neutro' },
    ],
    primeiro: [
      { rot: 'COTA DO CLAUDE', txt: 'Gasta no mesmo ritmo de hoje.', cor: 'bom' },
      { rot: nova.toLocaleUpperCase('pt-BR'), txt: fins ? `Começa agora · ${pronto(fins.primeiro.nova).toLocaleLowerCase('pt-BR')}.` : 'Começa agora.', cor: 'bom' },
      { rot: atual.nome.toLocaleUpperCase('pt-BR'), txt: fins ? `Pausa e volta ${quando(agoraD, fins.primeiro.nova)} · ${pronto(fins.primeiro.atual).toLocaleLowerCase('pt-BR')}.` : `Pausa agora e volta sozinha quando ${nova} ficar pronta.`, cor: 'atencao' },
    ],
  }
  const frase: Record<ComoComecar, string> = {
    fila: `${atual.nome} termina primeiro. ${nova} começa sozinha logo depois, sem você fazer nada.`,
    juntas: 'As duas obras andam juntas, cada uma com a sua equipe. O canteiro mostra os dois prédios subindo.',
    primeiro: `${atual.nome} pausa no ponto em que está e volta sozinha quando ${nova} terminar.`,
  }
  return (
    <div className="at-esc__fundo">
      <section className="at-esc" role="dialog" aria-modal="true" aria-label="Como começar esta obra" onKeyDown={(e) => { if (e.key === 'Escape') onCancelar() }}>
        <div className="at-esc__cab">
          <div className="at-esc__tit">
            <span className="at-esc__rot"><span className="at-esc__pulso" aria-hidden="true" />O ATLAS JÁ ESTÁ TRABALHANDO NA OBRA {atual.nome.toLocaleUpperCase('pt-BR')}</span>
            <b>Como você quer começar {nova}?</b>
            <span className="at-esc__texto">As obras usam a mesma cota do seu plano do Claude. Escolha o que importa mais agora. O Atlas mostra antes o que muda em cada caminho.</span>
          </div>
          <span className="at-esc__plano"><span>SEU PLANO DO CLAUDE</span><b>{max ? 'Max' : 'Pro'}</b></span>
        </div>
        <div className="at-esc__opcoes" role="radiogroup" aria-label="Como começar">
          {(['fila', 'juntas', 'primeiro'] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={escolha === c} className={`at-esc__op${escolha === c ? ' at-esc__op--on' : ''}`} onClick={() => setEscolha(c)}>
              <span className="at-esc__op-cab"><span className="at-esc__anel" aria-hidden="true"><span /></span><b>{TITULO[c]}</b>{c === rec && <span className="at-esc__rec">RECOMENDADO</span>}</span>
              <span className="at-esc__frase">{frase[c]}</span>
              <span className="at-esc__efeitos">
                {efeitos[c].map((e) => <span key={e.rot} className={`at-esc__ef at-esc__ef--${e.cor}`}><span className="at-esc__ponto" aria-hidden="true" /><span><em>{e.rot}</em>{e.txt}</span></span>)}
              </span>
            </button>
          ))}
        </div>
        <div className="at-esc__pe">
          <span className="at-esc__nota">{fins ? 'Os prazos são uma estimativa pelo ritmo das últimas horas. ' : ''}Dá para mudar a qualquer momento no Canteiro de obras, sem perder nada.</span>
          <Botao variante="secundario" className="at-esc__btn" onClick={onCancelar}>{textoCancelar}</Botao>
          <Botao className="at-esc__btn" disabled={ocupado} onClick={() => onEscolher(escolha)}>{BOTAO[escolha]} →</Botao>
        </div>
      </section>
    </div>
  )
}
