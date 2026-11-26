// M5 item 2 — o que acontece quando o link de instalação (uso único, ~48 h, só hash no banco) é aberto.
// Abriu no celular? Mostra "abra no computador onde você vai construir" e oferece reenviar o acesso por e-mail.
// Abrir NÃO consome o link: quem consome é a ativação confirmada (M2), então olhar no celular não queima o link.
import { type DepsCadastro } from './cadastro.ts'
import { prepararLink, validarLink, idiomaDoCliente } from './links.ts'
import { ErroRegra } from './tipos.ts'

const CELULAR_RE = /android|iphone|ipad|ipod|mobile|windows phone|opera mini|silk|kindle/i
/** Telas estreitas (CSS px) contam como celular/tablet mesmo com user-agent de "desktop" (iPadOS, modo desktop). */
export const LARGURA_MAX_CELULAR = 820

export function ehCelular(userAgent: string | null | undefined, largura?: number | null, toque?: boolean | null): boolean {
  if ((userAgent ?? '').length > 0 && CELULAR_RE.test(userAgent as string)) return true
  // iPad (iPadOS) se apresenta como "Macintosh": um Mac de verdade não tem tela de toque (M47).
  if (toque === true && /Macintosh/i.test(userAgent ?? '')) return true
  return typeof largura === 'number' && Number.isFinite(largura) && largura > 0 && largura <= LARGURA_MAX_CELULAR
}

export const AVISO_ABRA_NO_COMPUTADOR = 'Abra no computador onde você vai construir. O Atlas se instala no computador, não no celular. Toque em "Enviar para o meu computador" e a gente manda o acesso de novo para o seu e-mail.'

/** `instalador`: o arquivo já está publicado e pode ser pedido em /instalar/baixar (a página só mostra o botão se for true). */
export interface AberturaLink { valido: true; celular: boolean; aviso: string | null; expira_em: Date; pode_reenviar: boolean; instalador: boolean; /** M47: o arquivo do Mac já está publicado. */ instalador_mac: boolean }

export async function abrirLink(d: DepsCadastro, a: { token: string; user_agent?: string | null; largura?: number | null; toque?: boolean | null }): Promise<AberturaLink> {
  const l = await validarLink(d, a.token) // inválido/usado/vencido: ErroRegra com mensagem clara
  const celular = ehCelular(a.user_agent, a.largura, a.toque)
  return { valido: true, celular, aviso: celular ? AVISO_ABRA_NO_COMPUTADOR : null, expira_em: l.expira_em, pode_reenviar: celular, instalador: !!d.instalador, instalador_mac: !!d.instaladorMac }
}

/** Nome com que o instalador chega ao computador. Leva o código do link: o instalador lê o próprio nome e entrega o código ao
 *  Atlas (app/link-instalacao.cjs), então o cliente não precisa voltar à página para liberar o computador.
 *  Código fora do formato esperado: nome sem código (o Atlas pede para liberar pela página). */
export function nomeDoInstalador(token: string): string {
  return /^[\w-]{20,128}$/.test(token) ? `Atlas-Instalador-${token}.exe` : 'Atlas-Instalador.exe'
}

const semInstalador = () => new ErroRegra('instalador_indisponivel', 'O instalador ainda não está disponível para baixar. O seu acesso continua valendo: tente de novo daqui a pouco.', 503)

/** Botão "Baixar o instalador": só quem tem link válido recebe o endereço temporário do arquivo. Baixar NÃO consome o link
 *  (quem consome é a ativação). Qualquer dúvida sobre o arquivo vira recado honesto, nunca um endereço inventado. */
export async function baixarInstalador(d: DepsCadastro, a: { token: string; sistema?: string | null }): Promise<{ url: string }> {
  await validarLink(d, a.token) // inválido/usado/vencido: ErroRegra com mensagem clara, antes de tocar no arquivo
  // M47: o Mac recebe o .dmg (o código do link volta ao Atlas pelo botão "Já arrastei: abrir o Atlas", não pelo nome do arquivo).
  const mac = a.sistema === 'mac'
  const fonte = mac ? d.instaladorMac : d.instalador
  if (!fonte) throw semInstalador()
  const url = await fonte.link(mac ? 'Atlas.dmg' : nomeDoInstalador(a.token)).catch(() => null)
  if (!url || !/^https:\/\//.test(url)) throw semInstalador()
  return { url }
}

/** "Enviar para o meu computador": gera um link novo (o aberto no celular deixa de valer) e manda SEMPRE para o e-mail da compra. */
export async function reenviarParaComputador(d: DepsCadastro, a: { token: string }): Promise<{ ok: true }> {
  const antigo = await validarLink(d, a.token)
  const cliente = await d.store.clientePorId(antigo.cliente_id)
  if (!cliente) throw new ErroRegra('link_invalido', 'Esse link não existe (pode ter sido copiado pela metade). Abra de novo pelo botão do e-mail ou peça um link novo.', 404)
  if (!(await d.store.tentarEvento(`reenvio:cliente:${cliente.id}`, 3, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Você já pediu o acesso algumas vezes. Espere uns minutos e olhe o seu e-mail.', 429)
  }
  // Gera o link novo SEM gravar; o antigo só deixa de valer depois que o e-mail saiu. Se o envio falhar, nada muda.
  const { token, expira_em, registro } = await prepararLink(d, cliente.email_compra)
  try {
    await d.enviarBoasVindas(cliente.email_compra, { nome: cliente.nome_tratamento, empresa: cliente.empresa ?? '', ramo: cliente.ramo ?? '', token, expira_em, ...(await idiomaDoCliente(d, cliente.id)) })
  } catch {
    throw new ErroRegra('email_nao_enviado', 'O serviço de e-mail não respondeu agora. O seu link continua valendo: tente de novo em alguns minutos.', 502)
  }
  await d.store.trocarLinks(registro, d.agora()) // atômico: fecha os abertos e grava o novo; só um link vale por vez
  return { ok: true }
}
