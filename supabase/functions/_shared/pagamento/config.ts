// Dependências e preços do pagamento. Tudo que é segredo vem do cofre/ambiente por referência.
import type { Deps } from '../tipos.ts'
import type { StripeApi } from './stripe-api.ts'

export const VALOR_IMPLANTACAO = 4800
export const VALOR_MENSALIDADE = 200
/** Parcelamento da implantação no cartão: até 10x; 1–3x sem juros; 4x+ com juros de 2% a.m. (PMT). A mensalidade é à parte. */
export const MAX_PARCELAS = 10
export const PARCELAS_SEM_JUROS = 3
export const JUROS_PARCELA_AM = 0.02

const centavosRedondos = (v: number) => Math.round(v * 100) / 100
/** Valor da parcela e total da implantação para N parcelas (1–3x sem juros; 4x+ PMT a 2% a.m.). Fonte da verdade do preço. */
export function planoImplantacao(parcelas: number): { parcelas: number; parcela: number; total: number; temJuros: boolean } {
  const n = Math.min(MAX_PARCELAS, Math.max(1, Math.round(Number(parcelas) || 1)))
  if (n <= PARCELAS_SEM_JUROS) return { parcelas: n, parcela: centavosRedondos(VALOR_IMPLANTACAO / n), total: VALOR_IMPLANTACAO, temJuros: false }
  const i = JUROS_PARCELA_AM
  const parcela = centavosRedondos((VALOR_IMPLANTACAO * i) / (1 - Math.pow(1 + i, -n)))
  return { parcelas: n, parcela, total: centavosRedondos(parcela * n), temJuros: true }
}
/** Carência do atraso (Smart Retries da Stripe + 3 avisos) antes de pausar o pipeline. */
export const CARENCIA_ATRASO_MS = 7 * 24 * 3600_000
/** Dias (a partir do início do atraso) em que saem os avisos 1, 2 e 3. */
export const MARCOS_AVISO_MS = [0, 3 * 24 * 3600_000, 6 * 24 * 3600_000]
/** CDC art. 49: arrependimento em 7 dias corridos. */
export const PRAZO_ARREPENDIMENTO_MS = 7 * 24 * 3600_000

/** Cofre/ambiente de segredos. Nunca arquivo. Produção: Deno.env (STRIPE_<ref>_SK / STRIPE_<ref>_WHSEC). */
export interface Segredos {
  chaveSecreta(ref: string): Promise<string | null>
  segredoWebhook(ref: string): Promise<string | null>
}

export interface AvisoAtraso { n: 1 | 2 | 3; pausa_em: Date; nome: string }

export interface DepsPagamento extends Deps {
  segredos: Segredos
  /** Monta o cliente da Stripe com a chave da conta do cliente. */
  stripe: (chaveSecreta: string) => StripeApi
  enviarAvisoAtraso: (email: string, aviso: AvisoAtraso) => Promise<void>
}
