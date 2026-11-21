// Item 2 — webhook da Stripe do cliente: confirma pagamento e atualiza licença/pagamentos.
// Ordem: conta → assinatura (corpo bruto) → idempotência por evento → tratamento. Falha ao tratar libera o evento
// e devolve 500 para a Stripe reenviar. Eventos desconhecidos respondem 200 (não adianta reenviar).
import type { Licenca, Pagamento, TipoPagamento } from '../tipos.ts'
import { ErroRegra } from '../tipos.ts'
import { verificarAssinaturaStripe } from './assinatura-stripe.ts'
import { type DepsPagamento, MAX_PARCELAS, planoDoTipo, SEGMENTOS_PRATELEIRA, type TipoProduto, valorBaseDoTipo } from './config.ts'
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
      // 'no_payment_required' (cupom 100%) NÃO libera: fail-closed.
      if (o.payment_status === 'paid') await sessaoPaga(d, contaId, o)
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
      await estornado(d, contaId, o)
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
    await d.store.atualizarLicencaSe(lic.id, { gateway_assinatura_ref: idDe(s.subscription), gateway_cliente_ref: lic.gateway_cliente_ref ?? idDe(s.customer), mensalidade_encerra_em: null, cancelada_em: null }, { status_diferente: 'cancelada' })
    return
  }
  if (s.mode !== 'payment') return
  // Só vale a sessão que NÓS criamos para esta conta, paga, em BRL e com o valor cheio da implantação.
  // Qualquer outra (outro produto, valor menor, cupom, outra conta) é ignorada: nunca concede licença.
  if (s.payment_status !== 'paid' || (meta.atlas_tipo !== 'implantacao' && meta.atlas_tipo !== 'prateleira') || meta.atlas_conta !== contaId) return
  const tipoProduto: TipoProduto = meta.atlas_tipo
  if (String(s.currency ?? '').toLowerCase() !== 'brl' || !(Number(s.amount_total) >= Math.round(valorBaseDoTipo(tipoProduto) * 100))) return
  const email = str(s.customer_details?.email) ?? str(s.customer_email)
  const pi = idDe(s.payment_intent)
  if (!email || !pi) throw new ErroRegra('sessao_incompleta', 'Sessão sem e-mail ou pagamento.', 400)
  // Trava de integridade do parcelamento: o cliente escolhe as parcelas na tela da Stripe, à parte do que pediu no site.
  // O valor pago tem de cobrir o preço do número de parcelas REALMENTE usado (ex.: 10x pagando preço de 3x → recusa, fail-closed).
  const conta = await d.store.contaGateway(contaId)
  const sk = conta ? await d.segredos.chaveSecreta(conta.segredo_ref) : null
  const parcelasUsadas = (sk && (await d.stripe(sk).parcelasDoPagamento(pi))) || 1
  // Acima do máximo permitido: recusa direto (não arredonda para o teto; fail-closed, sem subcobrança).
  if (parcelasUsadas > MAX_PARCELAS) return
  if (Number(s.amount_total) < Math.round(planoDoTipo(tipoProduto, parcelasUsadas).total * 100)) return
  const valor = reais(s.amount_total)
  // Qual app pronto foi comprado (só prateleira, e só um segmento conhecido; senão nulo).
  const segmento = tipoProduto === 'prateleira' && (SEGMENTOS_PRATELEIRA as readonly string[]).includes(String(meta.atlas_segmento)) ? String(meta.atlas_segmento) : null
  const emailN = email.trim().toLowerCase()
  const { licenca } = await d.store.criarCompra({
    email: emailN,
    nome: str(s.customer_details?.name)?.split(' ')[0] ?? emailN.split('@')[0],
    valor,
    conta_gateway_id: contaId,
    gateway_cliente_ref: idDe(s.customer),
    agora,
  })
  // Licença de outra conta (ou sem conta) para este e-mail: não grava nada nem mexe no estado dela.
  if (licenca.conta_gateway_id !== contaId) throw new ErroRegra('conta_divergente', 'Esse e-mail já tem licença em outra conta de pagamento.', 409)
  // gravarPagamento é atômico (upsert condicional: nunca sobrescreve 'estornado') e devolve o estado anterior.
  // A decisão de reativar usa SÓ esse resultado, não uma leitura prévia (um estorno concorrente não é desfeito).
  const prev = await d.store.gravarPagamento({ licenca_id: licenca.id, conta_gateway_id: contaId, tipo: 'implantacao', valor, status: 'pago', gateway_ref: pi, gateway_pi: pi, pago_em: agora, segmento })
  if (prev === 'estornado') {
    await d.store.atualizarStatusPagamento(contaId, pi, 'estornado') // garantia: segue estornado; reentrega de compra devolvida não reativa
    return
  }
  // Prova da compra para o cadastro (session_id da URL de sucesso). Só depois de descartar o estorno.
  if (str(s.id)) await d.store.marcarSessaoPaga(contaId, s.id, emailN)
  if (licenca.status === 'cancelada') {
    // Recompra depois do arrependimento/cancelamento: reativa com nova janela de 7 dias.
    if (prev !== 'pago') {
      await d.store.atualizarLicencaSe(
        licenca.id,
        { status: 'ativa', comprada_em: agora, pausa_prevista_em: null, avisos_atraso: 0, mensalidade_encerra_em: null, cancelada_em: null, gateway_assinatura_ref: null, gateway_cliente_ref: idDe(s.customer) ?? licenca.gateway_cliente_ref ?? null },
        { status: 'cancelada' },
      )
    }
    return
  }
  // Licença liberada: se ela já existia (reenvio/segunda compra), garante que está em dia.
  if (licenca.status !== 'ativa') await sairDoAtraso(d, licenca)
}

async function registrarFalhaSessao(d: DepsPagamento, contaId: string, s: Obj) {
  const pi = idDe(s.payment_intent)
  const email = str(s.customer_details?.email) ?? str(s.customer_email)
  if (!pi || !email) return
  const cli = await d.store.clientePorEmail(email.trim().toLowerCase())
  const lic = cli && (await d.store.licencaDoCliente(cli.id))
  if (!lic || lic.conta_gateway_id !== contaId) return // compra nunca liberada: nada a desfazer
  await d.store.gravarPagamento({ licenca_id: lic.id, conta_gateway_id: contaId, tipo: 'implantacao', valor: reais(s.amount_total), status: 'falhou', gateway_ref: pi, gateway_pi: pi, pago_em: null })
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
  const p: Pagamento = { licenca_id: lic.id, conta_gateway_id: contaId, ...dadosFatura(f), valor: reais(f.amount_paid), status: 'pago', pago_em: agora }
  const antes = await d.store.gravarPagamento(p)
  if (antes === 'estornado') await d.store.atualizarStatusPagamento(contaId, p.gateway_ref, 'estornado') // estorno não é desfeito por reentrega
  if (lic.status === 'cancelada') return
  if (!lic.gateway_assinatura_ref && idDe(f.subscription)) await d.store.atualizarLicencaSe(lic.id, { gateway_assinatura_ref: idDe(f.subscription) }, { status_diferente: 'cancelada' })
  await sairDoAtraso(d, (await d.store.licencaPorId(lic.id)) ?? lic)
}

async function faturaFalhou(d: DepsPagamento, contaId: string, f: Obj) {
  const lic = await licencaDaFatura(d, contaId, f)
  if (!lic) throw new ErroRegra('licenca_nao_encontrada', 'Fatura de licença desconhecida.', 409)
  const antes = await d.store.pagamentoPorRef(contaId, String(f.id))
  if (antes?.status !== 'pago') {
    await d.store.gravarPagamento({ licenca_id: lic.id, conta_gateway_id: contaId, ...dadosFatura(f), valor: reais(f.amount_due), status: 'falhou', pago_em: null })
  }
  if (antes?.status === 'pago') return // reentrega atrasada de falha antiga: já foi paga
  await marcarAtraso(d, lic)
}

async function assinaturaEncerrada(d: DepsPagamento, contaId: string, sub: Obj) {
  const lic = await d.store.licencaPorGateway(contaId, { assinatura: idDe(sub) })
  if (!lic || lic.status === 'cancelada') return
  await d.store.atualizarLicencaSe(lic.id, { status: 'cancelada', pausa_prevista_em: null, cancelada_em: lic.cancelada_em ?? d.agora() }, { status_diferente: 'cancelada' }) // vale o PRIMEIRO pedido
}

async function estornado(d: DepsPagamento, contaId: string, ch: Obj) {
  const pi = idDe(ch.payment_intent)
  if (!pi) return
  // só estorno total muda o status (parcial não derruba a licença)
  if (Number(ch.amount_refunded ?? 0) < Number(ch.amount ?? 1)) return
  // escopo da conta do webhook: o mesmo pi_ em outra conta nunca é tocado
  for (const p of await d.store.pagamentosPorPi(contaId, pi)) {
    const lic = await d.store.licencaPorId(p.licenca_id)
    if (lic?.conta_gateway_id === contaId) await d.store.atualizarStatusPagamento(contaId, p.gateway_ref, 'estornado')
  }
}
