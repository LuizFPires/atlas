// Dependências e preços do pagamento. Tudo que é segredo vem do cofre/ambiente por referência.
import type { Deps } from '../tipos.ts'
import type { StripeApi } from './stripe-api.ts'

export const VALOR_IMPLANTACAO = 4800
export const VALOR_MENSALIDADE = 200
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
