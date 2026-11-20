// App-modelo MERCEARIA (M32 d3): shell com navegação simples. É um MODELO: o app do cliente nasce dele (a obra é do cliente).
import { useState, type ReactNode } from 'react'
import { LEI } from '../../kit/entrega-kit'
import { personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'
import './mercearia.css'

export interface LicencaDoApp { cliente: string; marca: string }

/** Aviso de licença que vai no topo (mesmo texto do kit entregue, M26). */
export const avisoDeLicenca = (l: LicencaDoApp): string =>
  `Software proprietário do Atlas, licenciado a ${l.cliente} (marca ${l.marca}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`

export type TelaMercearia = 'estoque' | 'vender' | 'avisos'

interface Props {
  personalizacao: PersonalizacaoApp
  telaInicial?: TelaMercearia
  /** Licença do comprador: vira aviso no topo e marca d'água por cliente. */
  licenca?: LicencaDoApp
  telas?: Partial<Record<TelaMercearia, ReactNode>>
}

const ABAS = [['estoque', 'Estoque'], ['vender', 'Vender'], ['avisos', 'Avisos']] as const

export function Mercearia({ personalizacao, telaInicial = 'estoque', telas = {}, licenca }: Props) {
  const p = personalizacaoSegura(personalizacao)
  const [tela, setTela] = useState<TelaMercearia>(telaInicial)
  return (
    <div className="mc" data-testid="app-mercearia" style={variaveisDoTema(p)}>
      {licenca && <p className="mc-aviso" role="note">{avisoDeLicenca(licenca)}</p>}
      <header className="mc-topo">
        <h1 className="mc-nome">{p.nome}</h1>
        <nav className="mc-nav" aria-label="Menu do app">
          {ABAS.map(([id, rotulo]) => (
            <button key={id} type="button" aria-current={tela === id ? 'page' : undefined} onClick={() => setTela(id)}>{rotulo}</button>
          ))}
        </nav>
      </header>
      <main className="mc-main">{telas[tela]}</main>
      {licenca && <Marca licenca={licenca} />}
    </div>
  )
}

/** Marca d'água por cliente: texto da marca repetido por cima, sem atrapalhar o toque. */
export function Marca({ licenca }: { licenca: LicencaDoApp }) {
  return (
    <div className="mc-marca" aria-hidden="true" data-testid="marca-dagua">
      {Array.from({ length: 24 }, (_, i) => <span key={i}>{licenca.cliente} · {licenca.marca}</span>)}
    </div>
  )
}
