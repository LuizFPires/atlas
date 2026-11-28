import { Icone } from '../ui'
import './abas-da-obra.css'

// Tudo de uma obra mora dentro dela (Milestone 37, Luiz em 23/11/2026): volta ao Canteiro e as partes da obra. O nome da obra
// já é o título de cada parte (painel, protótipo), então aqui não se repete.
export type ParteDaObra = 'obra' | 'cronograma' | 'desempenho' | 'prototipo' | 'posobra' | 'usar'
const PARTES: { id: ParteDaObra; nome: string }[] = [
  { id: 'obra', nome: 'Construção' },
  { id: 'cronograma', nome: 'Cronograma' }, // M41 (O6 aprovado em 24/11/2026)
  { id: 'desempenho', nome: 'Desempenho' }, // O7 (aprovado pelo Luiz em 26/11/2026): curva S do consumo do plano
  { id: 'prototipo', nome: 'Protótipo' },
  { id: 'posobra', nome: 'Pedir mudança' },
  { id: 'usar', nome: 'Usar o sistema' }, // U1UsarSistema (Luiz, 28/11/2026): existe desde o início da obra; o pontinho fica verde quando está no ar
]

export function AbasDaObra({ nome, atual, onIr, onCanteiro, so, comUsar = false }: { nome: string; atual: ParteDaObra; onIr: (p: ParteDaObra) => void; onCanteiro: () => void; so?: 'abas'; comUsar?: boolean }) {
  const abas = (
    <div className="at-abobra__abas" role="tablist" aria-label={`Partes da obra ${nome}`}>
      {PARTES.map((p) => (
        <button key={p.id} type="button" role="tab" aria-selected={p.id === atual} className={`at-abobra__aba${p.id === atual ? ' at-abobra__aba--on' : ''}`} onClick={() => { if (p.id !== atual) onIr(p.id) }}>{p.id === 'usar' && <span className={`at-abobra__pto${comUsar ? '' : ' at-abobra__pto--off'}`} aria-hidden="true" />}{p.nome}</button>
      ))}
    </div>
  )
  if (so === 'abas') return abas // M50: dentro da linha do título do Painel
  return (
    <div className="at-abobra">
      <button type="button" className="at-abobra__voltar" onClick={onCanteiro}><Icone nome="seta-esquerda" tamanho={14} />Canteiro de obras</button>
      <div className="at-abobra__linha">
        {abas}
      </div>
    </div>
  )
}
