// Porta da COTA do plano do Claude (F10, pausa por cota). Pausa por cota NÃO é erro: a obra espera sozinha e volta sozinha
// quando a cota renova, sem nenhuma ação do cliente. Aqui só existe o mock do modo fixture; o adaptador real (detectar o limite
// e a renovação no Claude Code do cliente, retomar a linha de produção, avisar o celular) é pendência de /entregar
// (app/PENDENTE-ENTREGAR.md, M20). Nenhum segredo passa por aqui. Texto que vem de fora (tarefa em que parou) é DADO.

import { comoDado } from './ponte-estilo'
import type { Plano } from './ponte-claude'

export interface EstadoCota {
  /** A cota do plano acabou e a obra está esperando. */
  esgotada: boolean
  /** Quando a cota deve renovar (ISO). É uma estimativa: quem confirma é `renovada`. */
  voltaEm: string | null
  /** O Claude já voltou a responder (teste barato do adaptador). Só com isso a retomada acontece. */
  renovada: boolean
  plano: Plano | null
  /** Onde a obra parou ("M5" e a tarefa). Texto vindo da obra: DADO. */
  parouEm: { etapa: string; tarefa: string } | null
}

export interface PonteCota {
  ler(pasta: string): Promise<EstadoCota>
  /** Continua a obra do ponto em que parou e avisa o celular. Sozinha: nunca depende de um clique do cliente. */
  retomar(pasta: string): Promise<void>
}

/** Hora de volta no jeito de gente: "14h", "14h30". */
export function horaDeVolta(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const m = d.getMinutes()
  return m ? `${d.getHours()}h${String(m).padStart(2, '0')}` : `${d.getHours()}h`
}

/** Contagem "2:47" (horas e minutos até a cota renovar); nunca negativa. */
export function contagemAteVolta(iso: string | null, agora: Date): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const min = Math.max(0, Math.ceil((t - agora.getTime()) / 60000))
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

/** Só retoma quando o Claude JÁ respondeu de novo (`renovada`). O horário é estimativa: passar dele não basta e não é preciso esperar por ele. */
export const deveRetomar = (e: EstadoCota): boolean => e.esgotada && e.renovada

/** Texto de tela vindo da obra: uma linha, sem marcação, tamanho limitado. */
export const textoDaObra = (t: string | undefined | null, max = 120): string => comoDado(t ?? '', max).join(' ').slice(0, max).trim()

export interface CotaFixture extends PonteCota {
  readonly chamadas: string[]
  /** Avisos que iriam ao celular. */
  readonly avisos: string[]
  readonly simular: {
    /** A cota acaba agora e volta em `voltaEm`. */
    esgotar(voltaEm: Date, opcoes?: { plano?: Plano | null; etapa?: string; tarefa?: string }): void
    /** O Claude voltou a responder. */
    renovar(): void
  }
}

/** `aoMudar` liga o mock ao painel do fixture (parada 'cota' liga/desliga). */
export function criarCotaFixture(aoMudar?: (esgotada: boolean) => void): CotaFixture {
  const chamadas: string[] = []
  const avisos: string[] = []
  let e: EstadoCota = { esgotada: false, voltaEm: null, renovada: false, plano: null, parouEm: null }
  return {
    chamadas,
    avisos,
    simular: {
      esgotar(voltaEm, o = {}) {
        e = { esgotada: true, voltaEm: voltaEm.toISOString(), renovada: false, plano: o.plano === undefined ? 'pro' : o.plano, parouEm: { etapa: o.etapa ?? 'M5', tarefa: o.tarefa ?? 'aviso de confirmação' } }
        aoMudar?.(true)
      },
      renovar() { e = { ...e, renovada: true } },
    },
    async ler() { chamadas.push('ler'); return { ...e } },
    async retomar() {
      chamadas.push('retomar')
      if (!e.esgotada) return
      e = { ...e, esgotada: false }
      avisos.push('A obra voltou sozinha.')
      aoMudar?.(false)
    },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que sabe da cota. */
export const cotaIndisponivel: PonteCota = {
  async ler() { throw new Error('indisponivel') },
  async retomar() { throw new Error('indisponivel') },
}
