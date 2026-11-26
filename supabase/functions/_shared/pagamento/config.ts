// Dependências e preços do pagamento. Tudo que é segredo vem do cofre/ambiente por referência.
import type { Deps } from '../tipos.ts'
import type { StripeApi } from './stripe-api.ts'

export const VALOR_IMPLANTACAO = 4800
/** App pronto da prateleira (M32): preço único; a mensalidade (R$ 200) é a mesma e cobrada à parte. */
export const VALOR_PRATELEIRA = 7300
export const VALOR_MENSALIDADE = 200
/** Parcelamento no cartão: até 10x; 1–3x sem juros; 4x+ com juros de 2% a.m. (PMT). A mensalidade é à parte. */
export const MAX_PARCELAS = 10
export const PARCELAS_SEM_JUROS = 3
export const JUROS_PARCELA_AM = 0.02

export type TipoProduto = 'implantacao' | 'prateleira'
export const SEGMENTOS_PRATELEIRA = ['barbearia', 'restaurante', 'mercearia', 'academia'] as const
export type SegmentoPrateleira = (typeof SEGMENTOS_PRATELEIRA)[number]

const centavosRedondos = (v: number) => Math.round(v * 100) / 100
export interface PlanoParcelado { parcelas: number; parcela: number; total: number; temJuros: boolean }
/** Mecânica única do parcelamento (1–3x sem juros; 4x+ PMT a 2% a.m.) para qualquer valor-base. */
export function planoParcelado(valor: number, parcelas: number): PlanoParcelado {
  const n = Math.min(MAX_PARCELAS, Math.max(1, Math.round(Number(parcelas) || 1)))
  if (n <= PARCELAS_SEM_JUROS) return { parcelas: n, parcela: centavosRedondos(valor / n), total: valor, temJuros: false }
  const i = JUROS_PARCELA_AM
  const parcela = centavosRedondos((valor * i) / (1 - Math.pow(1 + i, -n)))
  return { parcelas: n, parcela, total: centavosRedondos(parcela * n), temJuros: true }
}
/** Valor da parcela e total da implantação para N parcelas. Fonte da verdade do preço. */
export const planoImplantacao = (parcelas: number): PlanoParcelado => planoParcelado(VALOR_IMPLANTACAO, parcelas)
/** Idem para o app pronto da prateleira (R$ 7.300). */
export const planoPrateleira = (parcelas: number): PlanoParcelado => planoParcelado(VALOR_PRATELEIRA, parcelas)
/** Preço do tipo de produto + parcelas. Usado pelo checkout e pela trava do webhook. */
export const planoDoTipo = (tipo: TipoProduto, parcelas: number): PlanoParcelado => (tipo === 'prateleira' ? planoPrateleira(parcelas) : planoImplantacao(parcelas))
export const valorBaseDoTipo = (tipo: TipoProduto): number => (tipo === 'prateleira' ? VALOR_PRATELEIRA : VALOR_IMPLANTACAO)
/** M31 (Luiz, 26/11/2026): fora do Brasil, preço próprio em dólar (não é câmbio). Só cartão, à vista. */
export type Mercado = 'br' | 'us'
export const mercadoDe = (v: unknown): Mercado => (v === 'us' ? 'us' : 'br')
export const PRECOS_USD = { implantacao: 1700, prateleira: 2400, mensalidade: 70 } as const
export const moedaDo = (m: Mercado): 'brl' | 'usd' => (m === 'us' ? 'usd' : 'brl')
/** Preço-base do produto no mercado (em reais ou dólares). */
export const valorBaseNoMercado = (tipo: TipoProduto, m: Mercado): number => (m === 'us' ? PRECOS_USD[tipo] : valorBaseDoTipo(tipo))
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
