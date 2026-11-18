import type { DepsPortal, IdentidadePortal } from '../functions/_shared/portal.ts'
import { type Contexto } from '../functions/_shared/http.ts'
import { CONTA, montarPag } from './helpers-pagamento.ts'

/** Sessões de fixture: jwt -> identidade confirmada (como o Supabase Auth devolveria). */
export const JWT_ANA = 'jwt-ana'
export const JWT_BETO = 'jwt-beto'
export const JWT_INTRUSO = 'jwt-intruso'

export function montarPortal(status: 'ativa' | 'atrasada' | 'pausada' | 'cancelada' = 'ativa') {
  const m = montarPag(status)
  const sessoes = new Map<string, IdentidadePortal>([
    [JWT_ANA, { auth_user_id: 'auth-ana', email: 'Ana@Loja.com' }],
    [JWT_BETO, { auth_user_id: 'auth-beto', email: 'beto@outra.com' }],
    [JWT_INTRUSO, { auth_user_id: 'auth-intruso', email: 'ninguem@nada.com' }],
  ])
  // Segundo cliente (Beto), com licença, pagamento e computador PRÓPRIOS: serve para provar que um não vê/age no outro.
  m.store.clientes.push({ id: 'c2', email_compra: 'beto@outra.com', nome_tratamento: 'Beto' })
  m.store.licencas.push({ id: 'l2', cliente_id: 'c2', status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_beto', gateway_assinatura_ref: 'sub_beto', comprada_em: m.deps.agora() })
  const removidosAuth: string[] = []
  const falhaAuth = { ligado: false }
  const boasVindas: Array<{ email: string; token: string }> = []
  const deps: DepsPortal = { ...m.deps, enviarBoasVindas: async (email, d) => { boasVindas.push({ email, token: d.token }) }, autenticarPortal: async (jwt) => sessoes.get(jwt) ?? null, removerUsuarioAuth: async (id) => { if (falhaAuth.ligado) throw new Error('auth fora'); removidosAuth.push(id); for (const [j, i] of sessoes) if (i.auth_user_id === id) sessoes.delete(j) } }
  const ctx = (extra: Partial<Contexto> = {}): Contexto => ({
    deps: m.deps,
    pagamento: m.deps,
    portal: deps,
    carregarKit: async () => { throw new Error('não usado') },
    autorizarServico: () => false,
    ...extra,
  })
  return { ...m, sessoes, deps, ctx, boasVindas, removidosAuth, falhaAuth }
}

export const chamar = (ctx: Contexto, rota: string, jwt: string | null, corpo: object = {}) =>
  import('../functions/_shared/http.ts').then(({ tratar }) =>
    tratar(ctx, new Request(`https://x.test${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }, body: JSON.stringify(corpo) })),
  )

/** Ana (c1/l1) e Beto (c2/l2) com compra paga, mensalidade e computador ativo CADA UM. Os segredos de teste começam com "SEGREDO". */
export async function comDoisClientes(status: 'ativa' | 'atrasada' | 'pausada' | 'cancelada' = 'ativa') {
  const m = montarPortal(status)
  const agora = m.deps.agora()
  Object.assign(m.store.licencas[0], { conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_ana', gateway_assinatura_ref: 'sub_ana', comprada_em: agora })
  await m.store.gravarPagamento({ licenca_id: 'l1', conta_gateway_id: CONTA, tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_ana', gateway_pi: 'pi_ana', pago_em: agora })
  await m.store.gravarPagamento({ licenca_id: 'l2', conta_gateway_id: CONTA, tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_beto', gateway_pi: 'pi_beto', pago_em: agora })
  await m.ativar('a'.repeat(64))
  await m.store.inserirAtivacao('l2', 'b'.repeat(64), agora, 'SEGREDO-token-hash-beto')
  return m
}
