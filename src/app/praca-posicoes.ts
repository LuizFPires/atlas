import type { AgenteNaCena } from './ponte-testar'

export interface Pos { x: number; y: number; alt: number; grupo: number }

/** Posições estáveis: espiral dourada, setores por grupo (o mapa de calor pinta os setores). */
export function posicoes(agentes: AgenteNaCena[], grupo: string): { pos: Map<string, Pos>; grupos: string[] } {
  const grupos = [...new Set(agentes.map((a) => a.tracos[grupo] ?? '—'))]
  const pos = new Map<string, Pos>()
  const ouro = Math.PI * (3 - Math.sqrt(5))
  // ordena por grupo para cada grupo ocupar um setor; dentro do setor, espiral
  const porGrupo = grupos.map((g) => agentes.filter((a) => (a.tracos[grupo] ?? '—') === g))
  let k = 0
  porGrupo.forEach((lista, gi) => {
    const a0 = (gi / grupos.length) * Math.PI * 2 - Math.PI
    const a1 = ((gi + 1) / grupos.length) * Math.PI * 2 - Math.PI
    lista.forEach((ag, j) => {
      const r = 3.1 + Math.sqrt((j + 0.5) / Math.max(1, lista.length)) * 8.6
      const frac = ((j * ouro) / (Math.PI * 2)) % 1
      const a = a0 + (a1 - a0) * (0.06 + frac * 0.88)
      const h = (k++ * 9301 + 49297) % 233280 / 233280
      pos.set(ag.id, { x: Math.cos(a) * r, y: Math.sin(a) * r, alt: 0.85 + h * 0.3, grupo: gi })
    })
  })
  return { pos, grupos }
}
