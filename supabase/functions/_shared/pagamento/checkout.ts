// Item 1 — Checkout + Billing na conta Stripe DO CLIENTE.
// Implantação: pagamento único, Pix + cartão. Mensalidade: assinatura recorrente (cartão; a Stripe
// ainda não cobra Pix em modo assinatura). O dinheiro cai direto na conta do cliente.
import { ErroRegra } from '../tipos.ts'
import { type DepsPagamento, planoDoTipo, SEGMENTOS_PRATELEIRA, type SegmentoPrateleira, VALOR_MENSALIDADE } from './config.ts'

/** A página de pagamento da Stripe com a cara do Atlas (tokens do tema escuro A; Geist não está na lista da Stripe, Inter é a mais próxima). */
export const MARCA_CHECKOUT = { display_name: 'Atlas', background_color: '#141619', button_color: '#C6F135', border_style: 'rounded', font_family: 'inter' } as const

const VERSAO_RE = /^[0-9A-Za-z._-]{1,20}$/
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
  tipo: 'implantacao' | 'prateleira' | 'mensalidade'
  /** prateleira: segmento do app pronto escolhido (obrigatório). */
  segmento?: string
  /** implantação: e-mail de quem compra. mensalidade: ignorado (vem da licença). */
  email?: string
  /** implantação: parcelas no cartão (1–10). 1–3x sem juros; 4x+ com juros de 2% a.m. (PMT). */
  parcelas?: number
  licenca_id?: string
  /** LGPD: versão dos Termos/Política que o comprador aceitou. Obrigatória na implantação (sem aceite, sem pagamento). */
  aceite_termos_versao?: string
  /** 'app' = compra feita de dentro do Atlas instalado: o retorno vai para /compra/pelo-app (sem cadastro de novo). */
  origem?: 'app'
}

/** URLs de retorno montadas no servidor a partir da origem https cadastrada na conta. A requisição não influencia. */
function urlsDeRetorno(base: string | null | undefined, origem?: 'app') {
  let u: URL | null
  try { u = base ? new URL(base) : null } catch { u = null }
  if (!u || u.protocol !== 'https:' || u.username || u.password || u.origin === 'null') {
    throw new ErroRegra('retorno_nao_configurado', 'O endereço de retorno do pagamento ainda não está configurado.', 503)
  }
  // Compra de dentro do app: o cliente já tem o Atlas instalado e ativado; a licença vira paga pelo webhook, sem cadastro de novo.
  if (origem === 'app') return { success_url: `${u.origin}/compra/pelo-app`, cancel_url: `${u.origin}/compra/pelo-app/cancelada` }
  return { success_url: `${u.origin}/compra/sucesso?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${u.origin}/compra/cancelada` }
}

export async function criarCheckout(d: DepsPagamento, p: PedidoCheckout): Promise<{ url: string }> {
  const { conta, api } = await apiDaConta(d, p.conta_id)
  const meta: Record<string, string> = { atlas_conta: conta.id, atlas_tipo: p.tipo }
  const base = { ...urlsDeRetorno(conta.base_retorno, p.tipo === 'implantacao' ? p.origem : undefined), locale: 'pt-BR', branding_settings: MARCA_CHECKOUT }

  if (p.tipo === 'implantacao' || p.tipo === 'prateleira') {
    if (p.tipo === 'prateleira') {
      if (!(SEGMENTOS_PRATELEIRA as readonly string[]).includes(p.segmento ?? '')) throw new ErroRegra('segmento_invalido', 'Escolha um dos apps prontos da vitrine.', 400)
      meta.atlas_segmento = p.segmento as SegmentoPrateleira
    }
    const email = (p.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail da compra.')
    const versao = typeof p.aceite_termos_versao === 'string' ? p.aceite_termos_versao.trim() : ''
    if (!VERSAO_RE.test(versao)) throw new ErroRegra('aceite_obrigatorio', 'Para continuar, marque que você leu e aceita a Política de Privacidade e os Termos de Uso.', 400)
    // Fail-closed: se o aceite não ficou registrado, o pagamento nem é aberto.
    await d.store.registrarConsentimento(email, versao, 'checkout', d.agora())
    // Parcelamento: o total é o preço de verdade (1–3x sem juros; 4x+ PMT a 2% a.m.). Parcelado com juros é só cartão (sem Pix).
    const plano = planoDoTipo(p.tipo, p.parcelas ?? 1)
    const rotulo = p.tipo === 'prateleira' ? `Atlas — app pronto (${p.segmento})` : 'Atlas — implantação'
    const nome = plano.parcelas > 1 ? `${rotulo} (${plano.parcelas}x)` : rotulo
    const s = await api.criarCheckout(
      {
        ...base,
        mode: 'payment',
        customer_email: email,
        payment_method_types: plano.temJuros ? ['card'] : ['card', 'pix'],
        payment_method_options: { card: { installments: { enabled: true } }, ...(plano.temJuros ? {} : { pix: { expires_after_seconds: 3600 } }) },
        line_items: [{ quantity: 1, price_data: { currency: 'brl', unit_amount: centavos(plano.total), product_data: { name: nome } } }],
        metadata: { ...meta, atlas_parcelas: String(plano.parcelas) },
        payment_intent_data: { metadata: { ...meta, atlas_parcelas: String(plano.parcelas) } },
      },
      `checkout-impl-${crypto.randomUUID()}`,
    )
    await d.store.registrarSessao(conta.id, s.id, email) // prova da compra: o cadastro só abre com este id. Nunca sai na resposta pública; só o redirect da Stripe a entrega
    return { url: s.url }
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
    `checkout-mens-${crypto.randomUUID()}`,
  )
  return { url: s.url }
}
