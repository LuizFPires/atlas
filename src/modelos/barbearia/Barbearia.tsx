// App-modelo BARBEARIA (M32 d1): shell com navegação simples. É um MODELO: o app do cliente nasce dele (a obra é do cliente).
import { useState, type ReactNode } from 'react'
import { personalizacaoSegura, variaveisDoTema, type PersonalizacaoApp } from './personalizacao'
import './barbearia.css'

export type TelaBarbearia = 'agenda' | 'clientes'

interface Props {
  personalizacao: PersonalizacaoApp
  telaInicial?: TelaBarbearia
  /** Conteúdo de cada tela. */
  telas?: Partial<Record<TelaBarbearia, ReactNode>>
}

export function Barbearia({ personalizacao, telaInicial = 'agenda', telas = {} }: Props) {
  const p = personalizacaoSegura(personalizacao)
  const [tela, setTela] = useState<TelaBarbearia>(telaInicial)
  return (
    <div className="bb" data-testid="app-barbearia" style={variaveisDoTema(p)}>
      <header className="bb-topo">
        <h1 className="bb-nome">{p.nome}</h1>
        <nav className="bb-nav" aria-label="Menu do app">
          {([['agenda', 'Agenda'], ['clientes', 'Clientes']] as const).map(([id, rotulo]) => (
            <button key={id} type="button" aria-current={tela === id ? 'page' : undefined} onClick={() => setTela(id)}>{rotulo}</button>
          ))}
        </nav>
      </header>
      <main className="bb-main">{telas[tela]}</main>
    </div>
  )
}
