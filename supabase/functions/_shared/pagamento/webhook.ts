// Item 2 — webhook da Stripe do cliente: confirma pagamento e atualiza licença/pagamentos.
// Ordem: conta → assinatura (corpo bruto) → idempotência por evento → tratamento. Falha ao tratar libera o evento
// e devolve 500 para a Stripe reenviar. Eventos desconhecidos respondem 200 (não adianta reenviar).
import type { Licenca, Pagamento, TipoPagamento } from '../tipos.ts'
import { ErroRegra } from '../tipos.ts'
import { verificarAssinaturaStripe } from './assinatura-stripe.ts'
import type { DepsPagamento } from './config.ts'
import { marcarAtraso, sairDoAtraso } from './atraso.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
/** Campo que a Stripe devolve como id ou como objeto expandido. */
const idDe = (v: unknown) => (typeof v === 'string' ? v : str((v as Obj | null)?.id))
const reais = (centavos: unknown) => Math.round(Number(centavos ?? 0)) / 100

export async function processarWebhook(d: DepsPagamento, contaId: string, corpoBruto: string, assinatura: string | null): Promise<{ ok: true; duplicado?: boolean; ignorado?: boolean }> {
  const conta = await d.store.contaGateway(contaId)
  if (!conta) throw new ErroRegra('conta_desconhecida', 'Conta de pagamento não encontrada.', 404)
  const whsec = await d.segredos.segredoWebhook(conta.segredo_ref)
  if (!whsec) throw new ErroRegra('gateway_nao_configurado', 'O pagamento ainda não está configurado.', 503)
  if (!(await verificarAssinaturaStripe(corpoBruto, assinatura, whsec, d.agora().getTime()))) {
    throw new ErroRegra('assinatura_invalida', 'Assinatura inválida.', 400)
  }
  let ev: Obj
  try { ev = JSON.parse(corpoBruto) } catch { throw new ErroRegra('corpo_invalido', 'Corpo inválido.', 400) }
  const eventoId = str(ev?.id)
  const tipo = str(ev?.type)
  const obj = ev?.data?.object as Obj | undefined
  if (!eventoId || !tipo || !obj) throw new ErroRegra('corpo_invalido', 'Evento inválido.', 400)

  if (!(await d.store.registrarEventoGateway(conta.id, eventoId))) return { ok: true, duplicado: true }
  try {
    const tratado = await tratar(d, conta.id, tipo, obj)
    return tratado ? { ok: true } : { ok: true, ignorado: true }
  } catch (e) {
    await d.store.liberarEventoGateway(conta.id, eventoId)
    throw e instanceof ErroRegra ? e : new ErroRegra('webhook_falhou', 'Falha ao processar o evento.', 500)
  }
}

async function tratar(d: DepsPagamento, contaId: string, tipo: string, o: Obj): Promise<boolean> {
  switch (tipo) {
    case 'checkout.session.completed':
      // Pix fica 'unpaid' até compensar: aí vem async_payment_succeeded. Cartão já vem 'paid'.
      if (o.payment_status === 'paid' || o.payment_status === 'no_payment_required') await sessaoPaga(d, contaId, o)
      return true
    case 'checkout.session.async_payment_succeeded':
      await sessaoPaga(d, contaId, o)
      return true
    case 'checkout.session.async_payment_failed':
      await registrarFalhaSessao(d, contaId, o)
      return true
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      await faturaPaga(d, contaId, o)
      return true
    case 'invoice.payment_failed':
      await faturaFalhou(d, contaId, o)
      return true
    case 'customer.subscription.deleted':
      await assinaturaEncerrada(d, contaId, o)
      return true
    case 'charge.refunded':
      await estornado(d, o)
      return true
    default:
      return false
  }
}

/** Implantação paga → cria cliente+licença (ativa) e registra o pagamento. Mensalidade via Checkout → guarda a assinatura. */
async function sessaoPaga(d: DepsPagamento, contaId: string, s: Obj) {
  const meta = (s.metadata ?? {}) as Obj
  const agora = d.agora()
  if (s.mode === 'subscription') {
    const lic = (str(meta.atlas_licenca) && (await d.store.licencaPorId(meta.atlas_licenca))) || (await d.store.licencaPorGateway(contaId, { cliente: idDe(s.customer) }))
    if (!lic || lic.conta_gateway_id !== contaId) return // sessão que não é nossa
    await d.store.salvarLicenca({ ...lic, gateway_assinatura_ref: idDe(s.subscription), gateway_cliente_ref: lic.gateway_cliente_ref ?? idDe(s.customer), mensalidade_encerra_em: null })
    return
  }
  if (s.mode !== 'payment') return
  const email = str(s.customer_details?.email) ?? str(s.customer_email)
  const pi = idDe(s.payment_intent)
  if (!email || !pi) throw new ErroRegra('sessao_incompleta', 'Sessão sem e-mail ou pagamento.', 400)
  const valor = reais(s.amount_total)
  const emailN = email.trim().toLowerCase()
  const { licenca } = await d.store.criarCompra({
    email: emailN,
    nome: str(s.customer_details?.name)?.split(' ')[0] ?? emailN.split('@')[0],
    valor,
    conta_gateway_id: contaId,
    gateway_cliente_ref: idDe(s.customer),
    agora,
  })
  await d.store.gravarPagamento({ licenca_id: licenca.id, tipo: 'implantacao', valor, status: 'pago', gateway_ref: pi, gateway_pi: pi, pago_em: agora })
  // Licença liberada: se ela já existia (reenvio/segunda compra), garante que está em dia.
  if (licenca.status !== 'ativa' && licenca.status !== 'cancelada') await sairDoAtraso(d, licenca)
}

async function registrarFalhaSessao(d: DepsPagamento, contaId: string, s: Obj) {
  const pi = idDe(s.payment_intent)
  const email = str(s.customer_details?.email) ?? str(s.customer_email)
  if (!pi || !email) return
  const cli = await d.store.clientePorEmail(email.trim().toLowerCase())
  const lic = cli && (await d.store.licencaDoCliente(cli.id))
  if (!lic || lic.conta_gateway_id !== contaId) return // compra nunca liberada: nada a desfazer
  await d.store.gravarPagamento({ licenca_id: lic.id, tipo: 'implantacao', valor: reais(s.amount_total), status: 'falhou', gateway_ref: pi, gateway_pi: pi, pago_em: null })
}

async function licencaDaFatura(d: DepsPagamento, contaId: string, f: Obj): Promise<Licenca | null> {
  return d.store.licencaPorGateway(contaId, { assinatura: idDe(f.subscription), cliente: idDe(f.customer) })
}
const dadosFatura = (f: Obj, tipo: TipoPagamento = 'mensalidade') => ({
  tipo,
  gateway_ref: String(f.id),
  gateway_pi: idDe(f.payment_intent),
})

async function faturaPaga(d: DepsPagamento, contaId: string, f: Obj) {
  const lic = await licencaDaFatura(d, contaId, f)
  if (!lic) throw new ErroRegra('licenca_nao_encontrada', 'Fatura de licença desconhecida (pode chegar antes do checkout).', 409) // 409 → Stripe reenvia
  const agora = d.agora()
  const p: Pagamento = { licenca_id: lic.id, ...dadosFatura(f), valor: reais(f.amount_paid), status: 'pago', pago_em: agora }
  const antes = await d.store.gravarPagamento(p)
  if (antes === 'estornado') await d.store.atualizarStatusPagamento(p.gateway_ref, 'estornado') // estorno não é desfeito por reentrega
  if (lic.status === 'cancelada') return
  if (!lic.gateway_assinatura_ref && idDe(f.subscription)) await d.store.salvarLicenca({ ...lic, gateway_assinatura_ref: idDe(f.subscription) })
  await sairDoAtraso(d, (await d.store.licencaPorId(lic.id)) ?? lic)
}

async function faturaFalhou(d: DepsPagamento, contaId: string, f: Obj) {
  const lic = await licencaDaFatura(d, contaId, f)
  if (!lic) throw new ErroRegra('licenca_nao_encontrada', 'Fatura de licença desconhecida.', 409)
  const antes = await d.store.pagamentoPorRef(String(f.id))
  if (antes?.status !== 'pago') {
    await d.store.gravarPagamento({ licenca_id: lic.id, ...dadosFatura(f), valor: reais(f.amount_due), status: 'falhou', pago_em: null })
  }
  if (antes?.status === 'pago') return // reentrega atrasada de falha antiga: já foi paga
  await marcarAtraso(d, lic)
}

async function assinaturaEncerrada(d: DepsPagamento, contaId: string, sub: Obj) {
  const lic = await d.store.licencaPorGateway(contaId, { assinatura: idDe(sub) })
  if (!lic || lic.status === 'cancelada') return
  await d.store.salvarLicenca({ ...lic, status: 'cancelada', pausa_prevista_em: null })
}

async function estornado(d: DepsPagamento, ch: Obj) {
  const pi = idDe(ch.payment_intent)
  if (!pi) return
  // só estorno total muda o status (parcial não derruba a licença)
  if (Number(ch.amount_refunded ?? 0) < Number(ch.amount ?? 1)) return
  for (const p of await d.store.pagamentosPorPi(pi)) await d.store.atualizarStatusPagamento(p.gateway_ref, 'estornado')
}
