// Andamento real do desenho das telas (pedido do Luiz, 23/11/2026: "Leva uns 8 minutos" era fixo e errava muito).
// Usa o que o Claude já entregou: o mapa de telas (total) e as telas prontas. O tempo restante sai da velocidade real
// desde que o mapa saiu; antes da 1ª tela, usa uma média. A barra segue as telas, não o relógio.

export type AndamentoDesenho = { pct: number; etapa: number; nota: string }

const POR_TELA = 50 // média antes da 1ª tela ficar pronta (segundos)
const CONFERENCIA = 60 // ligar as telas e conferir, depois da última (segundos)

const minutos = (s: number) => (s < 60 ? 'menos de 1 minuto' : `mais ou menos ${Math.max(1, Math.round(s / 60))} ${Math.round(s / 60) <= 1 ? 'minuto' : 'minutos'}`)

/** segundos = desde que começou; total = telas no mapa (0 = mapa ainda não saiu); segundosAteMapa = quando o mapa saiu. */
export function andamentoDoDesenho({ segundos, total, prontas, segundosAteMapa }: { segundos: number; total: number; prontas: number; segundosAteMapa: number | null }): AndamentoDesenho {
  if (total <= 0 || segundosAteMapa === null) {
    return { pct: Math.round(10 * (1 - Math.exp(-segundos / 60))), etapa: segundos < 15 ? 0 : 1, nota: 'Montando o mapa de telas. Assim que ele sair, o Atlas mostra quantas telas são e quanto falta.' }
  }
  const feitas = Math.max(0, Math.min(prontas, total))
  if (feitas >= total) return { pct: 96, etapa: 4, nota: `Todas as ${total} telas desenhadas. Quase lá: o Claude está conferindo tudo.` }
  const porTela = feitas > 0 ? Math.max(5, (segundos - segundosAteMapa) / feitas) : POR_TELA
  const faltam = total - feitas
  const restante = faltam * porTela + CONFERENCIA
  return {
    pct: Math.round(10 + (85 * feitas) / total),
    etapa: 2,
    nota: `${faltam === 1 ? 'Falta' : 'Faltam'} ${faltam} de ${total} telas · ${minutos(restante)}.`,
  }
}
