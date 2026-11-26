// Item 2 — link de instalação de uso único (~48 h). Só o hash do token vai ao banco.
import { sha256, tokenAleatorio } from './cripto.ts'
import { type Deps, ErroRegra } from './tipos.ts'

export const VALIDADE_LINK_MS = 48 * 3600_000

/** Monta o link (token + hash + validade) sem gravar nada. */
export async function prepararLink(d: Deps, emailCompra: string) {
  const cliente = await d.store.clientePorEmail(emailCompra.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!cliente || !lic || lic.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Não encontramos uma compra ativa para esse e-mail.', 404)
  const token = tokenAleatorio()
  const expira_em = new Date(d.agora().getTime() + VALIDADE_LINK_MS)
  return { token, expira_em, registro: { cliente_id: cliente.id, token_hash: await sha256(token), expira_em } }
}

export async function gerarLink(d: Deps, emailCompra: string) {
  const { token, expira_em, registro } = await prepararLink(d, emailCompra)
  await d.store.inserirLink(registro)
  return { token, expira_em }
}

/** Valida sem consumir. O consumo acontece na ativação confirmada. */
export async function validarLink(d: Deps, token: string) {
  const l = await d.store.linkPorHash(await sha256(token))
  if (!l) throw new ErroRegra('link_invalido', 'Esse link não existe (pode ter sido copiado pela metade). Abra de novo pelo botão do e-mail ou peça um link novo.', 404)
  if (l.usado_em) throw new ErroRegra('link_usado', 'Esse link já foi usado. Peça outro.', 410)
  if (l.expira_em <= d.agora()) throw new ErroRegra('link_expirado', 'Esse link venceu. Peça outro.', 410)
  return l
}

/** Consumo atômico do link (UPDATE ... WHERE usado_em IS NULL): dois pedidos em paralelo não passam os dois. */
export async function consumirLinkOuFalha(d: Deps, id: string) {
  if (!(await d.store.consumirLink(id, d.agora()))) throw new ErroRegra('link_usado', 'Esse link já foi usado. Peça outro.', 410)
}

/** M31: o idioma da licença do cliente, pronto para ir junto do e-mail de acesso ({} = português). */
export async function idiomaDoCliente(d: Deps, clienteId: string): Promise<{ idioma?: 'en' }> {
  const lic = await d.store.licencaDoCliente(clienteId)
  return lic && (await d.store.idiomaDaLicenca(lic.id)) === 'en' ? { idioma: 'en' } : {}
}
