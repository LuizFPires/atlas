// Item 1 — Checkout + Billing na conta Stripe DO CLIENTE.
// Implantação: pagamento único, Pix + cartão. Mensalidade: assinatura recorrente (cartão; a Stripe
// ainda não cobra Pix em modo assinatura). O dinheiro cai direto na conta do cliente.
import { ErroRegra } from '../tipos.ts'
import { type DepsPagamento, VALOR_IMPLANTACAO, VALOR_MENSALIDADE } from './config.ts'

const centavos = (v: number) => Math.round(v * 100)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function apiDaConta(d: DepsPagamento, contaId: string) {
  const conta = await d.store.contaGateway(contaId)
  if (!conta) throw new ErroRegra('conta_desconhecida', 'Conta de pagamento não encontrada.', 404)
  const sk = await d.segredos.chaveSecreta(conta.segredo_ref)
  if (!sk) throw new ErroRegra('gateway_nao_configurado', 'O pagamento ainda não está configurado.', 503)
  return { conta, api: d.stripe(sk) }
}

export interface PedidoCheckout {
  conta_id: string
  tipo: 'implantacao' | 'mensalidade'
  /** implantação: e-mail de quem compra. mensalidade: ignorado (vem da licença). */
  email?: string
  licenca_id?: string
}

/** URLs de retorno montadas no servidor a partir da origem https cadastrada na conta. A requisição não influencia. */
function urlsDeRetorno(base: string | null | undefined) {
  let u: URL | null
  try { u = base ? new URL(base) : null } catch { u = null }
  if (!u || u.protocol !== 'https:' || u.username || u.password || u.origin === 'null') {
    throw new ErroRegra('retorno_nao_configurado', 'O endereço de retorno do pagamento ainda não está configurado.', 503)
  }
  return { success_url: `${u.origin}/compra/sucesso?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${u.origin}/compra/cancelada` }
}

export async function criarCheckout(d: DepsPagamento, p: PedidoCheckout): Promise<{ url: string; sessao_id: string }> {
  const { conta, api } = await apiDaConta(d, p.conta_id)
  const meta = { atlas_conta: conta.id, atlas_tipo: p.tipo }
  const base = { ...urlsDeRetorno(conta.base_retorno), locale: 'pt-BR' }

  if (p.tipo === 'implantacao') {
    const email = (p.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail da compra.')
    const s = await api.criarCheckout(
      {
        ...base,
        mode: 'payment',
        customer_email: email,
        payment_method_types: ['card', 'pix'],
        payment_method_options: { pix: { expires_after_seconds: 3600 } },
        line_items: [{ quantity: 1, price_data: { currency: 'brl', unit_amount: centavos(VALOR_IMPLANTACAO), product_data: { name: 'Atlas — implantação' } } }],
        metadata: meta,
        payment_intent_data: { metadata: meta },
      },
      `checkout-impl-${conta.id}-${email}-${Math.floor(d.agora().getTime() / 600_000)}`,
    )
    await d.store.registrarSessao(conta.id, s.id, email) // prova da compra: o cadastro só abre com este id
    return { url: s.url, sessao_id: s.id }
  }

  // mensalidade: só para licença existente da MESMA conta (cliente Stripe já criado na implantação)
  const lic = p.licenca_id ? await d.store.licencaPorId(p.licenca_id) : null
  if (!lic || lic.conta_gateway_id !== conta.id || lic.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  if (lic.gateway_assinatura_ref && !lic.mensalidade_encerra_em) throw new ErroRegra('assinatura_existente', 'A mensalidade já está ativa.', 409)
  const s = await api.criarCheckout(
    {
      ...base,
      mode: 'subscription',
      customer: lic.gateway_cliente_ref ?? undefined,
      customer_email: lic.gateway_cliente_ref ? undefined : (await d.store.clientePorId(lic.cliente_id))?.email_compra,
      payment_method_types: ['card'],
      line_items: [{ quantity: 1, price_data: { currency: 'brl', unit_amount: centavos(VALOR_MENSALIDADE), recurring: { interval: 'month' }, product_data: { name: 'Atlas — mensalidade' } } }],
      metadata: { ...meta, atlas_licenca: lic.id },
      subscription_data: { metadata: { ...meta, atlas_licenca: lic.id } },
    },
    `checkout-mens-${lic.id}-${Math.floor(d.agora().getTime() / 600_000)}`,
  )
  return { url: s.url, sessao_id: s.id }
}
