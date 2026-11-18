// Cliente mínimo da API da Stripe (fetch injetado: testes usam fixture, nunca a rede).
// A chave secreta é SEMPRE a da conta do cliente, resolvida na hora da chamada a partir do cofre/ambiente.
import { ErroRegra } from '../tipos.ts'

export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>

export interface SessaoCheckout { id: string; url: string }

export interface StripeApi {
  criarCheckout(p: Record<string, unknown>, chaveIdempotencia: string): Promise<SessaoCheckout>
  /** imediato=false → cancela só no fim do período já pago. */
  cancelarAssinatura(subId: string, imediato: boolean): Promise<void>
  reembolsar(paymentIntent: string, chaveIdempotencia: string): Promise<void>
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
  async function chamar(metodo: string, caminho: string, corpo: Record<string, unknown> | null, idem?: string) {
    const headers: Record<string, string> = { Authorization: `Bearer ${chaveSecreta}`, 'Content-Type': 'application/x-www-form-urlencoded' }
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
      const s = await chamar('POST', '/v1/checkout/sessions', p, idem)
      if (typeof s.id !== 'string' || typeof s.url !== 'string') throw new ErroRegra('gateway_erro', 'Resposta inesperada do pagamento.', 502)
      return { id: s.id, url: s.url }
    },
    async cancelarAssinatura(subId, imediato) {
      try {
        if (imediato) await chamar('DELETE', `/v1/subscriptions/${encodeURIComponent(subId)}`, null)
        else await chamar('POST', `/v1/subscriptions/${encodeURIComponent(subId)}`, { cancel_at_period_end: true })
      } catch (e) {
        // já cancelada/inexistente: o resultado desejado já vale (idempotente)
        if ((e as { stripe?: string }).stripe === 'resource_missing') return
        throw e
      }
    },
    async reembolsar(pi, idem) {
      try {
        await chamar('POST', '/v1/refunds', { payment_intent: pi }, idem)
      } catch (e) {
        if ((e as { stripe?: string }).stripe === 'charge_already_refunded') return
        throw e
      }
    },
  }
}
