import { hmac } from '../functions/_shared/cripto.ts'
import type { AvisoAtraso, DepsPagamento } from '../functions/_shared/pagamento/config.ts'
import { criarStripeApi, type FetchFn } from '../functions/_shared/pagamento/stripe-api.ts'
import { montar } from './helpers.ts'

export const CONTA = 'conta-1'
export const SK_TESTE = 'sk_test_fixture_da_conta_1'
export const WHSEC_TESTE = 'whsec_fixture_da_conta_1'

export interface ChamadaStripe { url: string; method: string; headers: Record<string, string>; body?: string }

/** Monta deps de pagamento 100% em memória: segredos de fixture, Stripe falsa (fetch gravado), e-mails gravados. */
export function montarPag(status: 'ativa' | 'atrasada' | 'pausada' | 'cancelada' = 'ativa') {
  const m = montar(status)
  m.store.contas.push({ id: CONTA, conta_stripe_id: 'acct_cliente1', segredo_ref: 'CLIENTE1', modo: 'teste', base_retorno: 'https://loja.atlas.test' })
  const chamadas: ChamadaStripe[] = []
  const avisos: Array<{ email: string; aviso: AvisoAtraso }> = []
  const falhar = { proxima: false }
  const sessoesPorChave = new Map<string, string>()
  const fetchFalso: FetchFn = async (url, init) => {
    chamadas.push({ url, ...init })
    if (falhar.proxima) { falhar.proxima = false; return { status: 500, json: async () => ({ error: { code: 'api_error' } }) } }
    if (url.endsWith('/v1/checkout/sessions')) {
      const chave = String((init as { headers?: Record<string, string> } | undefined)?.headers?.['Idempotency-Key'] ?? '')
      if (!sessoesPorChave.has(chave)) sessoesPorChave.set(chave, `cs_test_${sessoesPorChave.size + 1}`)
      const id = sessoesPorChave.get(chave)!
      return { status: 200, json: async () => ({ id, url: `https://checkout.stripe.com/c/pay/${id}` }) }
    }
    if (url.includes('/v1/subscriptions/')) return { status: 200, json: async () => ({ id: 'sub_1', current_period_end: Math.floor(Date.parse('2026-12-05T00:00:00Z') / 1000) }) }
    return { status: 200, json: async () => ({ id: 'ok' }) }
  }
  const deps: DepsPagamento = {
    ...m.deps,
    segredos: {
      chaveSecreta: async (ref) => (ref === 'CLIENTE1' ? SK_TESTE : null),
      segredoWebhook: async (ref) => (ref === 'CLIENTE1' ? WHSEC_TESTE : null),
    },
    stripe: (sk) => criarStripeApi(sk, fetchFalso),
    enviarAvisoAtraso: async (email, aviso) => { avisos.push({ email, aviso }) },
  }
  return { ...m, deps, chamadas, avisos, falhar }
}

/** Assina um corpo como a Stripe faz: t=<ts>,v1=HMAC_SHA256(segredo, `${ts}.${corpo}`). */
export async function assinarStripe(corpo: string, segredo = WHSEC_TESTE, ts = Math.floor(Date.parse('2026-11-18T12:00:00Z') / 1000)) {
  return `t=${ts},v1=${await hmac(segredo, `${ts}.${corpo}`)}`
}

let seq = 0
export const evento = (type: string, object: Record<string, unknown>, id = `evt_${++seq}`) => ({ id, type, data: { object } })
