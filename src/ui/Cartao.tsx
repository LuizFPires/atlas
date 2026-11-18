import type { HTMLAttributes } from 'react'
import './ui.css'

/** Informativo é neutro; `selecionado` (soft + borda lime) indica escolha. */
export function Cartao({ selecionado = false, className = '', ...resto }: HTMLAttributes<HTMLDivElement> & { selecionado?: boolean }) {
  return <div className={`at-cartao ${selecionado ? 'at-cartao--sel' : ''} ${className}`} {...resto} />
}
