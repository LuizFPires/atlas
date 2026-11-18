import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' }

export function Botao({ variante = 'principal', className = '', type = 'button', ...resto }: Props) {
  return <button type={type} className={`at-botao at-botao--${variante} ${className}`} {...resto} />
}
