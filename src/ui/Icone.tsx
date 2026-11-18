import type { SVGProps } from 'react'

/** Ícones de traço (stroke 2,2). Nunca emoji. */
const CAMINHOS = {
  microfone: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  ajuda: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  obra: <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />,
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function Icone({ nome, tamanho = 20, ...resto }: { nome: NomeIcone; tamanho?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...resto}>
      {CAMINHOS[nome]}
    </svg>
  )
}
