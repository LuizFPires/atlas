// App-modelo RESTAURANTE (M32 d2): shell com navegação simples. É um MODELO: o app do cliente nasce dele (a obra é do cliente).
import { useState, type ReactNode } from 'react'
import { LEI } from '../../kit/entrega-kit'
import { personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'
import './restaurante.css'

export interface LicencaDoApp { cliente: string; marca: string }

/** Aviso de licença que vai no topo (mesmo texto do kit entregue, M26). */
export const avisoDeLicenca = (l: LicencaDoApp): string =>
  `Software proprietário do Atlas, licenciado a ${l.cliente} (marca ${l.marca}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`

export type TelaRestaurante = 'cardapio' | 'pedidos' | 'cozinha'

interface Props {
  personalizacao: PersonalizacaoApp
  telaInicial?: TelaRestaurante
  /** Licença do comprador: vira aviso no topo e marca d'água por cliente. */
  licenca?: LicencaDoApp
  telas?: Partial<Record<TelaRestaurante, ReactNode>>
}

const ABAS = [['cardapio', 'Cardápio'], ['pedidos', 'Pedidos'], ['cozinha', 'Cozinha']] as const

export function Restaurante({ personalizacao, telaInicial = 'cardapio', telas = {}, licenca }: Props) {
  const p = personalizacaoSegura(personalizacao)
  const [tela, setTela] = useState<TelaRestaurante>(telaInicial)
  return (
    <div className="rt" data-testid="app-restaurante" style={variaveisDoTema(p)}>
      {licenca && <p className="rt-aviso" role="note">{avisoDeLicenca(licenca)}</p>}
      <header className="rt-topo">
        <h1 className="rt-nome">{p.nome}</h1>
        <nav className="rt-nav" aria-label="Menu do app">
          {ABAS.map(([id, rotulo]) => (
            <button key={id} type="button" aria-current={tela === id ? 'page' : undefined} onClick={() => setTela(id)}>{rotulo}</button>
          ))}
        </nav>
      </header>
      <main className="rt-main">{telas[tela]}</main>
      {licenca && <Marca licenca={licenca} />}
    </div>
  )
}

/** Marca d'água por cliente: texto da marca repetido por cima, sem atrapalhar o toque. */
export function Marca({ licenca }: { licenca: LicencaDoApp }) {
  return (
    <div className="rt-marca" aria-hidden="true" data-testid="marca-dagua">
      {Array.from({ length: 24 }, (_, i) => <span key={i}>{licenca.cliente} · {licenca.marca}</span>)}
    </div>
  )
}
