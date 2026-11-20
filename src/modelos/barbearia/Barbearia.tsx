// App-modelo BARBEARIA (M32 d1): shell com navegação simples. É um MODELO: o app do cliente nasce dele (a obra é do cliente).
import { useState, type ReactNode } from 'react'
import { LEI } from '../../kit/entrega-kit'
import { personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'
import './barbearia.css'

export interface LicencaDoApp { cliente: string; marca: string }

/** Aviso de licença que vai no topo (mesmo texto do kit entregue, M26). */
export const avisoDeLicenca = (l: LicencaDoApp): string =>
  `Software proprietário do Atlas, licenciado a ${l.cliente} (marca ${l.marca}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`

export type TelaBarbearia = 'agenda' | 'clientes'

interface Props {
  personalizacao: PersonalizacaoApp
  telaInicial?: TelaBarbearia
  /** Licença do comprador: vira aviso no topo e marca d'água por cliente. */
  licenca?: LicencaDoApp
  /** Conteúdo de cada tela. */
  telas?: Partial<Record<TelaBarbearia, ReactNode>>
}

export function Barbearia({ personalizacao, telaInicial = 'agenda', telas = {}, licenca }: Props) {
  const p = personalizacaoSegura(personalizacao)
  const [tela, setTela] = useState<TelaBarbearia>(telaInicial)
  return (
    <div className="bb" data-testid="app-barbearia" style={variaveisDoTema(p)}>
      {licenca && <p className="bb-aviso" role="note">{avisoDeLicenca(licenca)}</p>}
      <header className="bb-topo">
        <h1 className="bb-nome">{p.nome}</h1>
        <nav className="bb-nav" aria-label="Menu do app">
          {([['agenda', 'Agenda'], ['clientes', 'Clientes']] as const).map(([id, rotulo]) => (
            <button key={id} type="button" aria-current={tela === id ? 'page' : undefined} onClick={() => setTela(id)}>{rotulo}</button>
          ))}
        </nav>
      </header>
      <main className="bb-main">{telas[tela]}</main>
      {licenca && <Marca licenca={licenca} />}
    </div>
  )
}

/** Marca d'água por cliente: texto da marca repetido por cima, sem atrapalhar o toque. */
export function Marca({ licenca }: { licenca: LicencaDoApp }) {
  return (
    <div className="bb-marca" aria-hidden="true" data-testid="marca-dagua">
      {Array.from({ length: 24 }, (_, i) => <span key={i}>{licenca.cliente} · {licenca.marca}</span>)}
    </div>
  )
}
