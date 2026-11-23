// Cliente mínimo da API da Stripe (fetch injetado: testes usam fixture, nunca a rede).
// A chave secreta é SEMPRE a da conta do cliente, resolvida na hora da chamada a partir do cofre/ambiente.
import { ErroRegra } from '../tipos.ts'

export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>

/** branding_settings (cores e nome na página de pagamento) só existe a partir desta versão. Fixada só na criação do checkout. */
export const VERSAO_CHECKOUT = '2025-09-30.clover'

export interface SessaoCheckout { id: string; url: string }

export interface StripeApi {
  criarCheckout(p: Record<string, unknown>, chaveIdempotencia: string): Promise<SessaoCheckout>
  /** imediato=false → cancela só no fim do período já pago. */
  cancelarAssinatura(subId: string, imediato: boolean): Promise<{ encerra_em: Date | null }>
  reembolsar(paymentIntent: string, chaveIdempotencia: string): Promise<void>
  /** Portal de cobrança da Stripe (trocar cartão/forma de pagamento) do cliente final. Devolve a URL https. */
  criarPortalCobranca(clienteRef: string, urlRetorno: string): Promise<string>
  /** Em quantas parcelas o cartão foi cobrado (do plano de installments). null quando à vista/sem installments. */
  parcelasDoPagamento(paymentIntent: string): Promise<number | null>
}

/** Codifica objeto aninhado no formato form-urlencoded da Stripe: a[b][0]=c. */
export function codificarForm(obj: Record<string, unknown>, prefixo = ''): string[] {
  const partes: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const chave = prefixo ? `${prefixo}[${k}]` : k
    if (Array.isArray(v)) v.forEach((x, i) => {
      if (typeof x === 'object' && x !== null) partes.push(...codificarForm(x as Record<string, unknown>, `${chave}[${i}]`))
      else partes.push(`${encodeURIComponent(`${chave}[${i}]`)}=${encodeURIComponent(String(x))}`)
    })
    else if (typeof v === 'object') partes.push(...codificarForm(v as Record<string, unknown>, chave))
    else partes.push(`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`)
  }
  return partes
}

export function criarStripeApi(chaveSecreta: string, fetchFn: FetchFn, base = 'https://api.stripe.com'): StripeApi {
  async function chamar(metodo: string, caminho: string, corpo: Record<string, unknown> | null, idem?: string, versao?: string) {
    const headers: Record<string, string> = { Authorization: `Bearer ${chaveSecreta}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    if (versao) headers['Stripe-Version'] = versao
    if (idem) headers['Idempotency-Key'] = idem
    const r = await fetchFn(`${base}${caminho}`, { method: metodo, headers, body: corpo ? codificarForm(corpo).join('&') : undefined })
    const dados = (await r.json().catch(() => ({}))) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    if (r.status >= 400) {
      const codigo = dados?.error?.code as string | undefined
      throw Object.assign(new ErroRegra('gateway_erro', 'O pagamento não respondeu agora. Tente de novo em instantes.', 502), { stripe: codigo })
    }
    return dados
  }
  return {
    async criarCheckout(p, idem) {
      const s = await chamar('POST', '/v1/checkout/sessions', p, idem, VERSAO_CHECKOUT)
      if (typeof s.id !== 'string' || typeof s.url !== 'string') throw new ErroRegra('gateway_erro', 'Resposta inesperada do pagamento.', 502)
      return { id: s.id, url: s.url }
    },
    async cancelarAssinatura(subId, imediato) {
      try {
        const caminho = `/v1/subscriptions/${encodeURIComponent(subId)}`
        const s = imediato ? await chamar('DELETE', caminho, null) : await chamar('POST', caminho, { cancel_at_period_end: true })
        // fim do período já pago: campo antigo (current_period_end) ou novo (items.data[0].current_period_end)
        const fim = Number(s.current_period_end ?? s.items?.data?.[0]?.current_period_end)
        return { encerra_em: !imediato && Number.isFinite(fim) && fim > 0 ? new Date(fim * 1000) : null }
      } catch (e) {
        // já cancelada/inexistente: o resultado desejado já vale (idempotente)
        if ((e as { stripe?: string }).stripe === 'resource_missing') return { encerra_em: null }
        throw e
      }
    },
    async criarPortalCobranca(clienteRef, urlRetorno) {
      const s = await chamar('POST', '/v1/billing_portal/sessions', { customer: clienteRef, return_url: urlRetorno })
      if (typeof s.url !== 'string' || !s.url.startsWith('https://')) throw new ErroRegra('gateway_erro', 'Resposta inesperada do pagamento.', 502)
      return s.url
    },
    async reembolsar(pi, idem) {
      try {
        await chamar('POST', '/v1/refunds', { payment_intent: pi }, idem)
      } catch (e) {
        if ((e as { stripe?: string }).stripe === 'charge_already_refunded') return
        throw e
      }
    },
    async parcelasDoPagamento(pi) {
      if (!pi) return null
      const p = await chamar('GET', `/v1/payment_intents/${encodeURIComponent(pi)}?expand[]=latest_charge`, null)
      const n = Number(p?.latest_charge?.payment_method_details?.card?.installments?.plan?.count)
      return Number.isFinite(n) && n > 0 ? n : null
    },
  }
}
