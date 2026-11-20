// App-modelo ACADEMIA (M32 d4): shell com navegação simples. É um MODELO: o app do cliente nasce dele (a obra é do cliente).
import { useState, type ReactNode } from 'react'
import { LEI } from '../../kit/entrega-kit'
import { personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'
import './academia.css'

export interface LicencaDoApp { cliente: string; marca: string }

/** Aviso de licença que vai no topo (mesmo texto do kit entregue, M26). */
export const avisoDeLicenca = (l: LicencaDoApp): string =>
  `Software proprietário do Atlas, licenciado a ${l.cliente} (marca ${l.marca}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`

export type TelaAcademia = 'alunos' | 'treino' | 'checkin' | 'evolucao'
type Conteudo = ReactNode | ((ir: (t: TelaAcademia) => void) => ReactNode)

interface Props {
  personalizacao: PersonalizacaoApp
  telaInicial?: TelaAcademia
  /** Licença do comprador: vira aviso no topo e marca d'água por cliente. */
  licenca?: LicencaDoApp
  telas?: Partial<Record<TelaAcademia, Conteudo>>
}

const ABAS = [['alunos', 'Alunos'], ['treino', 'Treino'], ['checkin', 'Check-in'], ['evolucao', 'Evolução']] as const

export function Academia({ personalizacao, telaInicial = 'alunos', telas = {}, licenca }: Props) {
  const p = personalizacaoSegura(personalizacao)
  const [tela, setTela] = useState<TelaAcademia>(telaInicial)
  const c = telas[tela]
  return (
    <div className="ac" data-testid="app-academia" style={variaveisDoTema(p)}>
      {licenca && <p className="ac-aviso" role="note">{avisoDeLicenca(licenca)}</p>}
      <header className="ac-topo">
        <h1 className="ac-nome">{p.nome}</h1>
        <nav className="ac-nav" aria-label="Menu do app">
          {ABAS.map(([id, rotulo]) => (
            <button key={id} type="button" aria-current={tela === id ? 'page' : undefined} onClick={() => setTela(id)}>{rotulo}</button>
          ))}
        </nav>
      </header>
      <main className="ac-main">{typeof c === 'function' ? c(setTela) : c}</main>
      {licenca && <Marca licenca={licenca} />}
    </div>
  )
}

/** Marca d'água por cliente: texto da marca repetido por cima, sem atrapalhar o toque. */
export function Marca({ licenca }: { licenca: LicencaDoApp }) {
  return (
    <div className="ac-marca" aria-hidden="true" data-testid="marca-dagua">
      {Array.from({ length: 24 }, (_, i) => <span key={i}>{licenca.cliente} · {licenca.marca}</span>)}
    </div>
  )
}
