import { useState } from 'react'
import { Icone } from '../ui'
import { Monograma } from '../marca/Marca'
import { useTema } from '../tema/tema'
import type { Dica } from './dicas-do-atlas'

/** Cartão "Dica do Atlas" (prototipo/caminho-novo/P2Dicas): uma dica por vez, "Outra dica", e o X dispensa. */
export function DicaDoAtlas({ dicas, onUsar, onDispensar }: { dicas: Dica[]; onUsar: (d: Dica) => void; onDispensar: () => void }) {
  const [i, setI] = useState(0)
  const { tema } = useTema()
  if (dicas.length === 0) return null
  const d = dicas[i % dicas.length]
  return (
    <section className="at-dica" aria-label="Dica do Atlas">
      <div className="at-dica__cab">
        <span className="at-dica__marca" aria-hidden="true"><Monograma fundo={tema === 'claro' ? 'claro' : 'escuro'} largura={22} altura={12} /></span>
        <span className="at-dica__rot">DICA DO ATLAS · {(i % dicas.length) + 1} DE {dicas.length}</span>
        <button type="button" className="at-dica__x" aria-label="Dispensar as dicas" onClick={onDispensar}><Icone nome="x" tamanho={16} /></button>
      </div>
      <b className="at-dica__tit">{d.titulo}</b>
      <p className="at-dica__txt">{d.texto}</p>
      <div className="at-dica__acoes">
        <button type="button" className="at-dica__usar" onClick={() => onUsar(d)}>{d.acao}</button>
        {dicas.length > 1 && <button type="button" className="at-dica__outra" onClick={() => setI((x) => x + 1)}>Outra dica</button>}
      </div>
    </section>
  )
}
