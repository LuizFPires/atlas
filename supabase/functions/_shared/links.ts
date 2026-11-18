// Item 2 — link de instalação de uso único (~48 h). Só o hash do token vai ao banco.
import { sha256, tokenAleatorio } from './cripto.ts'
import { type Deps, ErroRegra } from './tipos.ts'

export const VALIDADE_LINK_MS = 48 * 3600_000

export async function gerarLink(d: Deps, emailCompra: string) {
  const cliente = await d.store.clientePorEmail(emailCompra.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!cliente || !lic || lic.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Não encontramos uma compra ativa para esse e-mail.', 404)
  const token = tokenAleatorio()
  const expira_em = new Date(d.agora().getTime() + VALIDADE_LINK_MS)
  await d.store.inserirLink({ cliente_id: cliente.id, token_hash: await sha256(token), expira_em })
  return { token, expira_em }
}

/** Valida sem consumir. O consumo acontece na ativação confirmada. */
export async function validarLink(d: Deps, token: string) {
  const l = await d.store.linkPorHash(await sha256(token))
  if (!l) throw new ErroRegra('link_invalido', 'Esse link não existe.', 404)
  if (l.usado_em) throw new ErroRegra('link_usado', 'Esse link já foi usado. Peça outro.', 410)
  if (l.expira_em <= d.agora()) throw new ErroRegra('link_expirado', 'Esse link venceu. Peça outro.', 410)
  return l
}

/** Consumo atômico do link (UPDATE ... WHERE usado_em IS NULL): dois pedidos em paralelo não passam os dois. */
export async function consumirLinkOuFalha(d: Deps, id: string) {
  if (!(await d.store.consumirLink(id, d.agora()))) throw new ErroRegra('link_usado', 'Esse link já foi usado. Peça outro.', 410)
}
