// Porta de RETOMAR a obra (F12). Ao ligar o computador o Atlas abre sozinho (login item do Windows) e, se há obra em andamento,
// a tela inicial é esta (regra em tela.ts: `telaInicial`). Aqui moram: a detecção da obra em andamento, o "Continuar obra"
// (religa a linha de produção por PontePainel/PonteCota) e os textos de tempo. O adaptador real (olhar a pasta das obras, o
// PLAN.md e as paradas; religar a linha do ponto em que parou) é pendência de /entregar (app/PENDENTE-ENTREGAR.md, M21).
// Nenhum segredo passa por aqui. Texto que vem da obra (nome, etapa) é DADO.

import { textoDaObra, type PonteCota } from './ponte-cota'
import type { PontePainel } from './ponte-painel'

export interface ObraParada {
  /** Nome da obra, como o cliente batizou (DADO). */
  nome: string
  /** Pasta da obra dentro de Atlas\Obras. */
  pasta: string
  /** Quanto já foi feito (0 a 100). */
  pct: number
  /** Etapa em que ficou ("M5" e o título). DADO. */
  etapa: { n: number; nome: string } | null
  /** Quando a obra parou (ISO), ou null se não dá para saber. */
  paradaEm: string | null
}

export interface PonteRetomar {
  /** A obra em andamento que ficou parada (a mais recente), ou null. É o que decide a tela inicial (F12 em vez de F05). */
  obraEmAndamento(): Promise<ObraParada | null>
  /** M37: todas as obras paradas, a mais recente primeiro (o F12 oferece "Continuar todas"). */
  paradas?(): Promise<ObraParada[]>
  /** "Continuar obra": religa a linha de produção do ponto em que parou. UM clique; sem perguntas. */
  continuar(obra: Pick<ObraParada, 'pasta'>): Promise<void>
}

/** A regra, testável: obra em andamento = ainda não chegou a 100%. */
export const estaEmAndamento = (pct: number): boolean => Number.isFinite(pct) && pct < 100

/** Cliques entre abrir o Atlas e ver o painel rodando: 1 ("Continuar obra"). O critério do milestone é no máximo 2. */
export const CLIQUES_PARA_RETOMAR = 1

export function saudacao(hora: number, nome: string): string {
  const q = hora < 12 ? 'BOM DIA' : hora < 18 ? 'BOA TARDE' : 'BOA NOITE'
  const n = textoDaObra(nome, 30).toUpperCase()
  return n ? `${q}, ${n}` : q
}

const hm = (d: Date) => (d.getMinutes() ? `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : `${d.getHours()}h`)
const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** "ontem às 22h14", "hoje às 9h", "anteontem às 22h14" ou "em 12/11 às 22h14"; null se não houver data. */
export function quandoParou(iso: string | null, agora: Date): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const dif = Math.round((dia(agora) - dia(d)) / 86400000)
  const h = hm(d)
  if (dif <= 0) return `hoje às ${h}`
  if (dif === 1) return `ontem às ${h}`
  if (dif === 2) return `anteontem às ${h}`
  return `em ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${h}`
}

/**
 * Religa a linha de produção usando as portas que já existem: se a parada era a cota e o Claude já voltou a responder, retoma pela
 * `PonteCota`; depois tira a pausa do cliente (`PontePainel.continuar`). Ocorrência que exige o cliente (F11) NÃO é contornada: o
 * painel a mostra. Não decide o modo da obra (automático/passo a passo): o `recomendado.json` continua valendo.
 */
export async function religarLinha(pontes: { painel: PontePainel; cota?: PonteCota }, pasta: string): Promise<void> {
  const estado = await pontes.painel.ler(pasta)
  if (estado.parada === 'cota' && pontes.cota) {
    const c = await pontes.cota.ler(pasta)
    if (c.esgotada && c.renovada) await pontes.cota.retomar(pasta)
  }
  await pontes.painel.continuar(pasta)
}

export interface RetomarFixture extends PonteRetomar {
  readonly chamadas: string[]
  /** Liga/desliga "há uma obra em andamento" (o computador foi desligado no meio da obra). */
  simular: { obra: ObraParada | null }
}

export const OBRA_PARADA_EXEMPLO: ObraParada = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze', pct: 62, etapa: { n: 5, nome: 'Confirmação por WhatsApp' }, paradaEm: null }

/** Mock do modo fixture. Sem `obra`, não há nada em andamento (o app abre em Minhas obras, como antes). */
export function criarRetomarFixture(obra: ObraParada | null = null, pontes?: { painel: PontePainel; cota?: PonteCota }): RetomarFixture {
  const chamadas: string[] = []
  const f: RetomarFixture = {
    chamadas,
    simular: { obra },
    async obraEmAndamento() { chamadas.push('obraEmAndamento'); return f.simular.obra && estaEmAndamento(f.simular.obra.pct) ? f.simular.obra : null },
    async continuar(o) {
      chamadas.push(`continuar:${o.pasta}`)
      if (pontes) await religarLinha(pontes, o.pasta)
    },
  }
  return f
}

/** Sem adaptador real e fora do modo fixture: não finge obra em andamento nem religa nada. */
export const retomarIndisponivel: PonteRetomar = {
  async obraEmAndamento() { return null },
  async continuar() { throw new Error('indisponivel') },
}
