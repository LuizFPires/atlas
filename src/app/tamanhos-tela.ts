import { useEffect, useState, type RefObject } from 'react'

/** Tamanho real de um telefone (iPhone 14/15) e de um notebook: as telas são desenhadas para isso e reduzidas para caber. */
export const LARGURA_CELULAR = 390
export const ALTURA_CELULAR = 844
export const LARGURA_COMPUTADOR = 1280
export const ALTURA_COMPUTADOR = 800

/** Quanto reduzir para caber INTEIRO na caixa (Luiz, 23/11/2026: nada de rolar para o lado). Nunca aumenta. */
export function escalaPara(largura: number, altura: number, w: number, h: number): number {
  if (!(largura > 0) || !(altura > 0)) return 1
  return Math.min(1, largura / w, altura / h)
}

/** Mede a caixa e devolve a escala, acompanhando quando ela muda de tamanho. */
export function useEscala(ref: RefObject<HTMLElement | null>, w: number, h: number): number {
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setEscala(escalaPara(el.clientWidth, el.clientHeight, w, h))
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [ref, w, h])
  return escala
}
