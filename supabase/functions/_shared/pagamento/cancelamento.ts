// Item 4 — cancelar compra (arrependimento de 7 dias, CDC art. 49) e cancelar mensalidade (sem fidelidade).
// Quem chama é o portal já autenticado (credencial de serviço na borda HTTP). O estorno sai da conta Stripe DO CLIENTE.
import { ErroRegra, type Licenca } from '../tipos.ts'
import { type DepsPagamento, PRAZO_ARREPENDIMENTO_MS } from './config.ts'

async function licencaDoEmail(d: DepsPagamento, email: string): Promise<Licenca> {
  const cli = await d.store.clientePorEmail(email.trim().toLowerCase())
  const lic = cli && (await d.store.licencaDoCliente(cli.id))
  if (!cli || !lic) throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  return lic
}

async function apiDaLicenca(d: DepsPagamento, lic: Licenca) {
  const conta = lic.conta_gateway_id ? await d.store.contaGateway(lic.conta_gateway_id) : null
  if (!conta) throw new ErroRegra('gateway_nao_configurado', 'Essa compra não está ligada a uma conta de pagamento.', 503)
  const sk = await d.segredos.chaveSecreta(conta.segredo_ref)
  if (!sk) throw new ErroRegra('gateway_nao_configurado', 'O pagamento ainda não está configurado.', 503)
  return d.stripe(sk)
}

/** Arrependimento: dentro de 7 dias da compra, devolve tudo e encerra a licença. */
export async function cancelarCompra(d: DepsPagamento, email: string) {
  const lic = await licencaDoEmail(d, email)
  if (lic.status === 'cancelada') throw new ErroRegra('ja_cancelada', 'Essa compra já foi cancelada.', 409)
  const compra = lic.comprada_em
  if (!compra) throw new ErroRegra('sem_compra_paga', 'Não achei um pagamento confirmado para cancelar.', 409)
  const limite = new Date(compra.getTime() + PRAZO_ARREPENDIMENTO_MS)
  if (d.agora() > limite) {
    throw new ErroRegra('fora_do_prazo', 'O prazo de 7 dias para desistir da compra já passou. Você ainda pode cancelar a mensalidade quando quiser.', 409)
  }
  const api = await apiDaLicenca(d, lic)
  // Primeiro o gateway (falha aqui não muda nada no nosso lado e dá para repetir: as chamadas são idempotentes).
  if (lic.gateway_assinatura_ref) await api.cancelarAssinatura(lic.gateway_assinatura_ref, true)
  // Só a compra atual: pagamentos de compras anteriores (antes de uma recompra) nunca são devolvidos aqui.
  const pagos = (await d.store.pagamentosDa(lic.id)).filter((p) => p.status === 'pago' && !!p.pago_em && p.pago_em >= compra)
  const pis = [...new Set(pagos.map((p) => p.gateway_pi).filter((x): x is string => !!x))]
  for (const pi of pis) await api.reembolsar(pi, `arrependimento-${lic.id}-${pi}`)
  for (const p of pagos) await d.store.atualizarStatusPagamento(p.conta_gateway_id, p.gateway_ref, 'estornado')
  await d.store.atualizarLicencaSe(lic.id, { status: 'cancelada', pausa_prevista_em: null, mensalidade_encerra_em: null, cancelada_em: d.agora() }, { status_diferente: 'cancelada' })
  await d.store.inserirOcorrencia({ cliente_id: lic.cliente_id, tipo: 'compra_cancelada', descricao: `Arrependimento (CDC art. 49): ${pagos.length} pagamento(s) estornado(s).` })
  return { ok: true, estornados: pagos.length }
}

/** Sem fidelidade: para de cobrar já; a licença vale até o fim do período pago (ou encerra já, se estiver em atraso). */
export async function cancelarMensalidade(d: DepsPagamento, email: string) {
  const lic = await licencaDoEmail(d, email)
  if (lic.status === 'cancelada') throw new ErroRegra('ja_cancelada', 'Essa licença já está cancelada.', 409)
  if (!lic.gateway_assinatura_ref) throw new ErroRegra('sem_mensalidade', 'Não há mensalidade ativa para cancelar.', 409)
  if (lic.mensalidade_encerra_em) return { ok: true, encerra_em: lic.mensalidade_encerra_em } // já pedido: repetir não muda nada
  const api = await apiDaLicenca(d, lic)
  const emDia = lic.status === 'ativa'
  const { encerra_em } = await api.cancelarAssinatura(lic.gateway_assinatura_ref, !emDia)
  if (!emDia || !encerra_em) {
    await d.store.atualizarLicencaSe(lic.id, { status: 'cancelada', pausa_prevista_em: null, cancelada_em: d.agora() }, { status_diferente: 'cancelada' })
    return { ok: true, encerra_em: d.agora() }
  }
  await d.store.atualizarLicencaSe(lic.id, { mensalidade_encerra_em: encerra_em, cancelada_em: d.agora() }, { status_diferente: 'cancelada' })
  return { ok: true, encerra_em }
}
