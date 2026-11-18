import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

export function Chip({ ativo = false, className = '', type = 'button', ...resto }: ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return <button type={type} aria-pressed={ativo} className={`at-chip ${ativo ? 'at-chip--ativo' : ''} ${className}`} {...resto} />
}
