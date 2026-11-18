// M6 — Portal do cliente (F15), lado do servidor.
// Regra de ouro: TUDO aqui parte do cliente AUTENTICADO. Nenhuma função recebe id de cliente, licença,
// pagamento ou e-mail do corpo da requisição: o dono é sempre descoberto pelo login (anti-IDOR).
// O portal também nunca devolve token_hash, refs do gateway (cus_/sub_/pi_/in_), conta do gateway nem hash do computador.
import type { Cliente, Deps, Licenca } from './tipos.ts'
import { ErroRegra } from './tipos.ts'

/** Quem o Supabase Auth diz que está logado. `email` já vem CONFIRMADO (o login é por código enviado a ele). */
export interface IdentidadePortal { auth_user_id: string; email: string }

export interface DepsPortal extends Deps {
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
