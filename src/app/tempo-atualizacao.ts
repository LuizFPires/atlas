/** Tempo de instalar e reabrir depois do download (instalador silencioso + abrir o Atlas). */
export const SEGUNDOS_INSTALACAO = 20

/**
 * Barra da atualização (pedido do Luiz, 23/11/2026: "para conter a ansiedade do usuário"): porcentagem do download e o tempo que
 * falta até o Atlas estar atualizado, pela velocidade real até agora, já somando a instalação.
 */
export function descreverDownload({ baixados, total, inicio, agora }: { baixados: number; total: number; inicio: number; agora: number }): { pct: number; falta: string } {
  if (!(total > 0)) return { pct: 0, falta: 'calculando o tempo…' }
  const feito = Math.min(Math.max(baixados, 0), total)
  const pct = Math.floor((feito / total) * 100)
  const passou = agora - inicio
  if (feito <= 0 || passou < 2000) return { pct, falta: 'calculando o tempo…' }
  const segundos = ((total - feito) / (feito / passou)) / 1000 + SEGUNDOS_INSTALACAO
  if (segundos < 45) return { pct, falta: 'falta menos de 1 minuto' }
  const min = Math.max(1, Math.round(segundos / 60))
  return { pct, falta: min === 1 ? 'falta cerca de 1 minuto' : `falta cerca de ${min} minutos` }
}
