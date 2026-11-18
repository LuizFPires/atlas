// M5 item 2 — o que acontece quando o link de instalação (uso único, ~48 h, só hash no banco) é aberto.
// Abriu no celular? Mostra "abra no computador onde você vai construir" e oferece reenviar o acesso por e-mail.
// Abrir NÃO consome o link: quem consome é a ativação confirmada (M2), então olhar no celular não queima o link.
import { type DepsCadastro } from './cadastro.ts'
import { prepararLink, validarLink } from './links.ts'
import { ErroRegra } from './tipos.ts'

const CELULAR_RE = /android|iphone|ipad|ipod|mobile|windows phone|opera mini|silk|kindle/i
/** Telas estreitas (CSS px) contam como celular/tablet mesmo com user-agent de "desktop" (iPadOS, modo desktop). */
export const LARGURA_MAX_CELULAR = 820

export function ehCelular(userAgent: string | null | undefined, largura?: number | null): boolean {
  if ((userAgent ?? '').length > 0 && CELULAR_RE.test(userAgent as string)) return true
  return typeof largura === 'number' && Number.isFinite(largura) && largura > 0 && largura <= LARGURA_MAX_CELULAR
}

export const AVISO_ABRA_NO_COMPUTADOR = 'Abra no computador onde você vai construir. O Atlas se instala no computador, não no celular. Toque em "Enviar para o meu computador" e a gente manda o acesso de novo para o seu e-mail.'

export interface AberturaLink { valido: true; celular: boolean; aviso: string | null; expira_em: Date; pode_reenviar: boolean }

export async function abrirLink(d: DepsCadastro, a: { token: string; user_agent?: string | null; largura?: number | null }): Promise<AberturaLink> {
  const l = await validarLink(d, a.token) // inválido/usado/vencido: ErroRegra com mensagem clara
  const celular = ehCelular(a.user_agent, a.largura)
  return { valido: true, celular, aviso: celular ? AVISO_ABRA_NO_COMPUTADOR : null, expira_em: l.expira_em, pode_reenviar: celular }
}

/** "Enviar para o meu computador": gera um link novo (o aberto no celular deixa de valer) e manda SEMPRE para o e-mail da compra. */
export async function reenviarParaComputador(d: DepsCadastro, a: { token: string }): Promise<{ ok: true }> {
  const antigo = await validarLink(d, a.token)
  const cliente = await d.store.clientePorId(antigo.cliente_id)
  if (!cliente) throw new ErroRegra('link_invalido', 'Esse link não existe.', 404)
  if (!(await d.store.tentarEvento(`reenvio:cliente:${cliente.id}`, 3, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Você já pediu o acesso algumas vezes. Espere uns minutos e olhe o seu e-mail.', 429)
  }
  // Gera o link novo SEM gravar; o antigo só deixa de valer depois que o e-mail saiu. Se o envio falhar, nada muda.
  const { token, expira_em, registro } = await prepararLink(d, cliente.email_compra)
  try {
    await d.enviarBoasVindas(cliente.email_compra, { nome: cliente.nome_tratamento, empresa: cliente.empresa ?? '', ramo: cliente.ramo ?? '', token, expira_em })
  } catch {
    throw new ErroRegra('email_nao_enviado', 'Não deu para enviar o e-mail agora. O seu link continua valendo: tente de novo em instantes.', 502)
  }
  await d.store.trocarLinks(registro, d.agora()) // atômico: fecha os abertos e grava o novo; só um link vale por vez
  return { ok: true }
}
