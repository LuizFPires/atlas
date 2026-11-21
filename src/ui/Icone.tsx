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
  pausa: <path d="M9 5v14M15 5v14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M8 5l12 7-12 7z" />,
  lua: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  tesoura: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
    </>
  ),
  moeda: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2A2.7 2 0 0 1 9.4 15M12 6v1.5M12 16.5V18" />
    </>
  ),
  caixa: <path d="M3 8l9-5 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8" />,
  haltere: <path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />,
  aperto: <path d="M3 12l4-4 4 1 3-2 6 5-5 5-3-1-2 2-3-3M7 8l-4 4" />,
  prato: (
    <>
      <path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v8a2 2 0 0 1-2 2M7 3v6" />
      <path d="M17 21V3c-2.5 1.5-3 5-3 8h3" />
    </>
  ),
  brilho: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
  celular: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  computador: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3.2 3.2 0 0 1 0 6M18 14a6 6 0 0 1 3 6" />
    </>
  ),
  pasta: <path d="M3 6h6l2 2h10v11H3z" />,
  obra: <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />,
  martelo: <path d="M14 4l6 6-3 3-6-6zM12 8L4 16l4 4 8-8" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  clipe: <path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.5 17.3a1.7 1.7 0 0 1-2.4-2.4L15 7" />,
  imagem: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  paleta: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </>
  ),
  livro: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11" />,
  escudo: <path d="M12 3 4.5 6v6c0 4.4 3.2 7.9 7.5 9 4.3-1.1 7.5-4.6 7.5-9V6L12 3zM9 12l2.2 2.2L15.5 10" />,
  chevron: <path d="m15 6-6 6 6 6" />,
  alerta: <path d="M12 3 2 20h20L12 3zM12 10v4.5M12 17.2v.1" />,
  mapa: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  'zoom-mais': (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </>
  ),
  'zoom-menos': (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </>
  ),
  olho: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'olho-corte': (
    <>
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </>
  ),
  alvo: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  // Raio: lembra "ação" — o que você liga, bloqueia ou libera na mão.
  raio: <path d="M13 2 3 14 12 14 11 22 21 10 12 10Z" />,
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function Icone({ nome, tamanho = 20, ...resto }: { nome: NomeIcone; tamanho?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...resto}>
      {CAMINHOS[nome]}
    </svg>
  )
}
