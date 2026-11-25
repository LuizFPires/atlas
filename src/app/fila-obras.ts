// M51 (prototipo/caminho-novo/Q1Escolher): o que muda em cada caminho quando outra obra já está trabalhando.
// Conta simples e honesta, em horas de relógio:
//  - fila:     A termina no prazo dela; B começa quando A termina.
//  - primeiro: B começa agora; A volta quando B termina.
//  - juntas:   enquanto as duas andam, cada uma anda a uma fração do ritmo (Pro 0,5: a mesma cota dividida por duas; Max 0,85: a cota
//              maior quase não segura). Depois que uma termina, a outra volta ao ritmo normal.
import type { ComoComecar } from './ponte-construcao'
import type { Plano } from './ponte-claude'

export const RITMO_JUNTAS: Record<Plano, number> = { pro: 0.5, max: 0.85 }

export interface Fins { atual: number; nova: number }

/** Horas até cada obra ficar pronta, em cada caminho. `atualH` = o que falta da obra que trabalha; `novaH` = a obra nova inteira. */
export function estimarCaminhos(atualH: number, novaH: number, plano: Plano): Record<ComoComecar, Fins> {
  const k = RITMO_JUNTAS[plano]
  const juntas = atualH <= novaH
    ? { atual: atualH / k, nova: atualH / k + (novaH - atualH) }
    : { nova: novaH / k, atual: novaH / k + (atualH - novaH) }
  return {
    fila: { atual: atualH, nova: atualH + novaH },
    juntas,
    primeiro: { nova: novaH, atual: novaH + atualH },
  }
}

const DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
/** "hoje, ~18h", "amanhã, ~9h" ou "sexta, ~14h" (até 6 dias; depois a data). */
export function quando(agora: Date, horas: number): string {
  const d = new Date(agora.getTime() + horas * 3600_000)
  const h = `~${d.getHours()}h`
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()) / 86_400_000)
  if (dias <= 0) return `hoje, ${h}`
  if (dias === 1) return `amanhã, ${h}`
  if (dias < 7) return `${DIA[d.getDay()]}, ${h}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${h}`
}

/** Diferença em palavras: "≈ 16 h depois", "mais de 1 dia antes", "quase igual". */
export function diferenca(horas: number): string {
  const a = Math.abs(horas)
  if (a < 2) return 'quase igual'
  const quanto = a >= 24 ? `mais de ${Math.floor(a / 24)} ${Math.floor(a / 24) === 1 ? 'dia' : 'dias'}` : `≈ ${Math.round(a)} h`
  return `${quanto} ${horas > 0 ? 'depois' : 'antes'}`
}

/** O caminho recomendado: no Pro a fila (não divide a cota); no Max, ao mesmo tempo. */
export const recomendado = (plano: Plano): ComoComecar => (plano === 'max' ? 'juntas' : 'fila')
