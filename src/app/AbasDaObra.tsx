import { Icone } from '../ui'
import './abas-da-obra.css'

// Tudo de uma obra mora dentro dela (Milestone 37, Luiz em 23/11/2026): volta ao Canteiro e as partes da obra. O nome da obra
// já é o título de cada parte (painel, protótipo), então aqui não se repete.
export type ParteDaObra = 'obra' | 'prototipo' | 'posobra'
const PARTES: { id: ParteDaObra; nome: string }[] = [
  { id: 'obra', nome: 'Construção' },
  { id: 'prototipo', nome: 'Protótipo' },
  { id: 'posobra', nome: 'Pedir mudança' },
]

export function AbasDaObra({ nome, atual, onIr, onCanteiro }: { nome: string; atual: ParteDaObra; onIr: (p: ParteDaObra) => void; onCanteiro: () => void }) {
  return (
    <div className="at-abobra">
      <button type="button" className="at-abobra__voltar" onClick={onCanteiro}><Icone nome="seta-esquerda" tamanho={14} />Canteiro de obras</button>
      <div className="at-abobra__linha">
        <div className="at-abobra__abas" role="tablist" aria-label={`Partes da obra ${nome}`}>
          {PARTES.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === atual} className={`at-abobra__aba${p.id === atual ? ' at-abobra__aba--on' : ''}`} onClick={() => { if (p.id !== atual) onIr(p.id) }}>{p.nome}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
