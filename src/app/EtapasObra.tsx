import { useEffect, useState } from 'react'
import '../ui/progresso.css'
import type { ProgressoProto } from './ponte-prototipo'
import './etapas-obra.css'

export type EtapaDoCaminho = 'ideia' | 'estilo' | 'batismo' | 'telas' | 'contas' | 'aprovar'
const ETAPAS: { id: EtapaDoCaminho; rot: string }[] = [
  { id: 'ideia', rot: '1 · A ideia' },
  { id: 'estilo', rot: '2 · O visual' },
  { id: 'batismo', rot: '3 · O nome' },
  { id: 'telas', rot: '4 · O protótipo' },
  { id: 'contas', rot: '5 · As contas' },
  { id: 'aprovar', rot: '6 · Começar' },
]

const recado = (a: ProgressoProto): string | null => {
  if (a.fase === 'mapeando') return 'montando o mapa de telas'
  if (a.fase === 'mapa') return `mapa pronto · ${a.mapa.length} telas`
  if (a.fase === 'pintando') return `pintando ${a.telas.length} de ${a.mapa.length}`
  return null
}

interface Props {
  atual: EtapaDoCaminho
  /** Andamento do protótipo da obra aberta (segundo plano). Sem ele, o aviso não aparece. */
  progresso?: () => Promise<ProgressoProto | null>
  onVerTelas?: () => void
  intervaloMs?: number
  /** A etapa mais adiantada que a obra já alcançou: até ela, cada etapa vira botão (Luiz, 23/11/2026: navegar entre etapas). */
  alcancada?: EtapaDoCaminho
  onIr?: (e: EtapaDoCaminho) => void
}

/** Faixa do caminho novo (prototipo/caminho-novo): as 6 etapas e o aviso do protótipo que roda em segundo plano. */
export function EtapasObra({ atual, progresso, onVerTelas, intervaloMs = 3000, alcancada, onIr }: Props) {
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!progresso) return
    let vivo = true
    const ler = () => { void progresso().then((a) => { if (vivo) setAviso(a ? recado(a) : null) }, () => {}) }
    ler()
    const t = setInterval(ler, intervaloMs)
    return () => { vivo = false; clearInterval(t) }
  }, [progresso, intervaloMs])
  const i = ETAPAS.findIndex((e) => e.id === atual)
  const ate = Math.max(i, ETAPAS.findIndex((e) => e.id === alcancada))
  return (
    <div className="at-etapas">
      <ol className="at-etapas__lista" aria-label="Etapas da obra">
        {ETAPAS.map((e, k) => (
          <li key={e.id} data-estado={k === i ? 'agora' : k <= ate ? 'feito' : 'depois'} aria-current={!onIr && k === i ? 'step' : undefined}>
            {onIr && k <= ate
              ? <button type="button" className="at-etapas__ir" aria-current={k === i ? 'step' : undefined} onClick={() => { if (k !== i) onIr(e.id) }}><span className="at-etapas__barra" aria-hidden="true" />{e.rot}</button>
              : <><span className="at-etapas__barra" aria-hidden="true" />{e.rot}</>}
          </li>
        ))}
      </ol>
      {aviso && onVerTelas && (
        <button type="button" className="at-etapas__aviso" onClick={onVerTelas}>
          <span className="at-prog__vivo" aria-hidden="true" />Protótipo: {aviso}
        </button>
      )}
    </div>
  )
}
