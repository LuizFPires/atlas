// M6 — Portal do cliente (F15), lado do servidor.
// Regra de ouro: TUDO aqui parte do cliente AUTENTICADO. Nenhuma função recebe id de cliente, licença,
// pagamento ou e-mail do corpo da requisição: o dono é sempre descoberto pelo login (anti-IDOR).
// O portal também nunca devolve token_hash, refs do gateway (cus_/sub_/pi_/in_), conta do gateway nem hash do computador.
import { consumirCodigo, solicitarCodigo } from './ativacao.ts'
import type { DepsCadastro } from './cadastro.ts'
import { prepararLink } from './links.ts'
import { type DepsPagamento, PRAZO_ARREPENDIMENTO_MS, VALOR_MENSALIDADE } from './pagamento/config.ts'
import { type Cliente, ErroRegra, type Licenca, type StatusLicenca, type StatusPagamento, type TipoPagamento } from './tipos.ts'
import { INTERVALO_TROCA_MS } from './troca.ts'

/** Quem o Supabase Auth diz que está logado. `email` já vem CONFIRMADO (o login é por código enviado a ele). */
export interface IdentidadePortal { auth_user_id: string; email: string }

export interface DepsPortal extends DepsPagamento, DepsCadastro {
  /** Valida o JWT do Supabase Auth (produção: GET /auth/v1/user com o token; exige e-mail confirmado). null = inválido/vencido. */
  autenticarPortal: (jwt: string) => Promise<IdentidadePortal | null>
}

const norm = (e: string) => e.trim().toLowerCase()
const semAcesso = () => new ErroRegra('nao_autenticado', 'Entre de novo na sua conta para continuar.', 401)

/** Contexto de uma requisição autenticada: o cliente e a licença DELE, e mais nada. */
export interface SessaoPortal { cliente: Cliente; licenca: Licenca }

/**
 * Descobre o cliente dono do login. Primeiro acesso: liga o usuário do Auth ao cliente cujo e-mail de compra
 * é igual ao e-mail confirmado (uma vez só; se o cliente já está ligado a OUTRO usuário, recusa).
 */
export async function clienteLogado(d: DepsPortal, jwt: string): Promise<SessaoPortal> {
  const token = jwt.trim()
  if (!token) throw semAcesso()
  const id = await d.autenticarPortal(token)
  if (!id || !id.auth_user_id || !id.email) throw semAcesso()
  if (!(await d.store.tentarEvento(`portal:usuario:${id.auth_user_id}`, 120, 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas ações seguidas. Espere um minuto.', 429)
  }
  let cliente = await d.store.clientePorAuthUser(id.auth_user_id)
  if (!cliente) {
    const porEmail = await d.store.clientePorEmail(norm(id.email))
    // Mensagem única para "e-mail sem compra" e "compra ligada a outro login": não revela quem é cliente.
    const recusa = () => new ErroRegra('sem_compra', 'Não achamos uma compra do Atlas para esse e-mail. Use o e-mail que você usou no pagamento.', 403)
    if (!porEmail || porEmail.auth_user_id) throw recusa()
    if (!(await d.store.vincularAuthUser(porEmail.id, id.auth_user_id))) throw recusa()
    cliente = await d.store.clientePorAuthUser(id.auth_user_id)
    if (!cliente) throw recusa()
  }
  const licenca = await d.store.licencaDoCliente(cliente.id)
  if (!licenca) throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  return { cliente, licenca }
}

/** Quem sou eu (item 1): só o que a tela precisa para o cabeçalho. */
export async function eu(d: DepsPortal, jwt: string) {
  const { cliente } = await clienteLogado(d, jwt)
  return { nome: cliente.nome_tratamento, empresa: cliente.empresa ?? '', email: cliente.email_compra }
}

export interface ContaPortal {
  perfil: { nome: string; empresa: string; email: string }
  licenca: {
    status: StatusLicenca
    /** Quando a implantação foi paga. */
    comprada_em: Date | null
    mensalidade_valor: number
    mensalidade_ativa: boolean
    /** Mensalidade cancelada: a licença vale até aqui. */
    mensalidade_encerra_em: Date | null
    proxima_cobranca_em: Date | null
    /** Arrependimento (CDC art. 49): até quando dá para desistir e receber tudo de volta. */
    arrependimento_ate: Date | null
    pode_cancelar_compra: boolean
    pode_cancelar_mensalidade: boolean
    pode_mudar_pagamento: boolean
  }
  /** Só data de ativação: o identificador do computador nunca sai do servidor. */
  computador: { ativado_em: Date } | null
  troca: { pode_agora: boolean; proxima_troca_em: Date | null }
  pagamentos: Array<{ data: Date | null; descricao: string; valor: number; status: StatusPagamento; tipo: TipoPagamento }>
}

const DESCRICAO: Record<TipoPagamento, string> = {
  implantacao: 'Implantação do Atlas (curso, treinamento e licença)',
  mensalidade: 'Manutenção mensal',
}

const maisUmMes = (d: Date) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + 1); return r }

/** Quando dá para trocar de computador de novo (null = já pode). Respeita o override manual do admin. */
export async function proximaTroca(d: DepsPortal, lic: Licenca): Promise<Date | null> {
  if (lic.troca_liberada_em) return null
  const ultima = (await d.store.trocasDa(lic.id)).reduce<Date | null>((m, t) => (!m || t.feita_em > m ? t.feita_em : m), null)
  const proxima = ultima && new Date(ultima.getTime() + INTERVALO_TROCA_MS)
  return proxima && proxima > d.agora() ? proxima : null
}

/** Tela inteira do portal (item 2). Tudo escopado pela licença do cliente logado; só campos seguros. */
export async function conta(d: DepsPortal, jwt: string): Promise<ContaPortal> {
  const { cliente, licenca: l } = await clienteLogado(d, jwt)
  const agora = d.agora()
  const [ativ, bloqueadaAte, pags] = await Promise.all([d.store.ativacaoAtiva(l.id), proximaTroca(d, l), d.store.pagamentosDa(l.id)])
  const ordenados = [...pags].sort((a, b) => (b.pago_em?.getTime() ?? Infinity) - (a.pago_em?.getTime() ?? Infinity))
  const ativa = l.status !== 'cancelada'
  const mensalidade_ativa = ativa && !!l.gateway_assinatura_ref && !l.mensalidade_encerra_em
  const ultimaCobranca = pags.filter((p) => p.status === 'pago' && p.pago_em).reduce<Date | null>((m, p) => (!m || (p.pago_em as Date) > m ? (p.pago_em as Date) : m), null)
  const base = ultimaCobranca ?? l.comprada_em ?? null
  const arrependimento_ate = l.comprada_em ? new Date(l.comprada_em.getTime() + PRAZO_ARREPENDIMENTO_MS) : null
  return {
    perfil: { nome: cliente.nome_tratamento, empresa: cliente.empresa ?? '', email: cliente.email_compra },
    licenca: {
      status: l.status,
      comprada_em: l.comprada_em ?? null,
      mensalidade_valor: VALOR_MENSALIDADE,
      mensalidade_ativa,
      mensalidade_encerra_em: l.mensalidade_encerra_em ?? null,
      proxima_cobranca_em: mensalidade_ativa && l.status === 'ativa' && base ? maisUmMes(base) : null,
      arrependimento_ate,
      pode_cancelar_compra: ativa && !!arrependimento_ate && agora <= arrependimento_ate,
      pode_cancelar_mensalidade: mensalidade_ativa,
      pode_mudar_pagamento: ativa && !!l.gateway_cliente_ref && !!l.conta_gateway_id,
    },
    computador: ativ ? { ativado_em: ativ.ativado_em } : null,
    troca: { pode_agora: ativa && !bloqueadaAte, proxima_troca_em: bloqueadaAte },
    pagamentos: ordenados.map((p) => ({ data: p.pago_em, descricao: DESCRICAO[p.tipo], valor: p.valor, status: p.status, tipo: p.tipo })),
  }
}

/** "Trocar forma de pagamento": abre o portal de cobrança da Stripe na conta DO CLIENTE; o retorno vem do servidor. */
export async function formaDePagamento(d: DepsPortal, jwt: string): Promise<{ url: string }> {
  const { licenca: l } = await clienteLogado(d, jwt)
  const contaGw = l.status !== 'cancelada' && l.conta_gateway_id ? await d.store.contaGateway(l.conta_gateway_id) : null
  if (!contaGw || !l.gateway_cliente_ref) throw new ErroRegra('sem_pagamento', 'Não há forma de pagamento para trocar agora.', 409)
  if (!contaGw.base_retorno) throw new ErroRegra('retorno_nao_configurado', 'O endereço de retorno do pagamento ainda não está configurado.', 503)
  const sk = await d.segredos.chaveSecreta(contaGw.segredo_ref)
  if (!sk) throw new ErroRegra('gateway_nao_configurado', 'O pagamento ainda não está configurado.', 503)
  return { url: await d.stripe(sk).criarPortalCobranca(l.gateway_cliente_ref, `${new URL(contaGw.base_retorno).origin}/conta`) }
}

const mascarar = (e: string) => {
  const [u, dom] = e.split('@')
  return `${u.slice(0, 1)}***@${dom}`
}

/** Pede o código de 6 dígitos para trocar de computador. Vai SEMPRE para o e-mail da compra (o do login confirmado). */
export async function pedirCodigoTroca(d: DepsPortal, jwt: string, ip: string) {
  const { cliente, licenca: l } = await clienteLogado(d, jwt)
  if (l.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Essa licença está cancelada.', 409)
  const bloqueada = await proximaTroca(d, l)
  if (bloqueada) throw erroLimite(bloqueada)
  await solicitarCodigo(d, cliente.email_compra, 'troca', ip)
  return { ok: true, enviado_para: mascarar(cliente.email_compra) }
}

function erroLimite(proxima: Date) {
  const e = new ErroRegra('troca_limite', 'Você já trocou de computador há pouco. Só dá para trocar 1 vez a cada 7 dias.', 429)
  return Object.assign(e, { proxima_troca_em: proxima })
}

/** Gera o link novo e manda para o e-mail da compra. O link antigo só deixa de valer depois que o e-mail saiu. */
async function enviarNovoAcesso(d: DepsPortal, cliente: Cliente) {
  const { token, expira_em, registro } = await prepararLink(d, cliente.email_compra)
  try {
    await d.enviarBoasVindas(cliente.email_compra, { nome: cliente.nome_tratamento, empresa: cliente.empresa ?? '', ramo: cliente.ramo ?? '', token, expira_em })
  } catch {
    throw new ErroRegra('email_nao_enviado', 'Não deu para enviar o e-mail agora. Use "Enviar o acesso de novo" daqui a pouco.', 502)
  }
  await d.store.trocarLinks(registro, d.agora())
}

/**
 * Desativa o computador atual SEM precisar dele (roubo, perda, quebra): vale o e-mail + código.
 * Depois manda o link de instalação para o computador novo. Limite: 1 troca a cada 7 dias (override do admin respeitado).
 */
export async function desativarComputador(d: DepsPortal, jwt: string, codigo: string) {
  const { cliente, licenca: l } = await clienteLogado(d, jwt)
  if (l.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Essa licença está cancelada.', 409)
  const atual = await d.store.ativacaoAtiva(l.id)
  if (!atual) throw new ErroRegra('sem_ativacao', 'Nenhum computador está com a licença agora.', 409)
  const bloqueada = await proximaTroca(d, l)
  if (bloqueada) throw erroLimite(bloqueada)
  await consumirCodigo(d, cliente.id, 'troca', typeof codigo === 'string' ? codigo : '')
  const override = l.troca_liberada_em !== null
  const feita = await d.store.liberarAtivacao({
    licenca_id: l.id,
    ativacao_atual_id: atual.id,
    de_hash: atual.computador_hash,
    quando: d.agora(),
    por_admin: override,
    intervalo_ms: override ? 0 : INTERVALO_TROCA_MS,
  })
  if (!feita) throw new ErroRegra('troca_conflito', 'A troca não pôde ser concluída agora. Peça um novo código e tente de novo.', 409)
  await enviarNovoAcesso(d, cliente)
  return { ok: true, enviado_para: mascarar(cliente.email_compra), proxima_troca_em: new Date(d.agora().getTime() + INTERVALO_TROCA_MS) }
}

/** Computador já liberado e o e-mail não chegou: manda o acesso de novo (só sem computador ativo; 3 por hora). */
export async function reenviarAcesso(d: DepsPortal, jwt: string) {
  const { cliente, licenca: l } = await clienteLogado(d, jwt)
  if (l.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Essa licença está cancelada.', 409)
  if (await d.store.ativacaoAtiva(l.id)) throw new ErroRegra('ja_ativo', 'Já existe um computador com a licença. Para trocar, desative-o primeiro.', 409)
  if (!(await d.store.tentarEvento(`reenvio:cliente:${cliente.id}`, 3, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Você já pediu o acesso algumas vezes. Espere uns minutos e olhe o seu e-mail.', 429)
  }
  await enviarNovoAcesso(d, cliente)
  return { ok: true, enviado_para: mascarar(cliente.email_compra) }
}
