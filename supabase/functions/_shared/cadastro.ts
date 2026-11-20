// M4 item 4 — POST /cadastro: completa o cliente criado pelo webhook de pagamento (M3) com as 4 respostas
// e dispara o e-mail de boas-vindas (S10) com o link de instalação de uso único.
// A chave do cadastro é o session_id do Stripe Checkout (prova da compra), nunca o e-mail do corpo:
// o acesso vai SEMPRE para o e-mail da compra. Sem prova válida, uma única resposta genérica.
import { gerarLink } from './links.ts'
import { type Deps, ErroRegra } from './tipos.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SESSAO_RE = /^cs_[A-Za-z0-9_]{8,200}$/
const limpar = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Texto livre vira e-mail: sem endereço, link ou número comprido (anti-phishing). */
export function suspeito(v: string): boolean {
  return /@|https?:|www\.|\/\/|[a-z0-9-]+\.(com|net|org|app|io|ly|me|co|br|info|xyz|site|link|top)\b/i.test(v) || (v.match(/\d/g)?.length ?? 0) >= 6
}

export interface BoasVindas { nome: string; empresa: string; ramo: string; token: string; expira_em: Date }

export interface DepsCadastro extends Deps {
  /** Envia o e-mail de boas-vindas. Fixture/testes: grava. Produção: adaptador de e-mail (etapa /entregar). */
  enviarBoasVindas: (email: string, dados: BoasVindas) => Promise<void>
}

export interface PedidoCadastro { session_id?: unknown; nome?: unknown; empresa?: unknown; ramo?: unknown; email?: unknown }

export type RespostaCadastro =
  | { ok: true; enviado_para: string; email_diferente: boolean; segmento: string | null }
  | { ok: false; pendente: true; mensagem: string }

/** Resposta única para qualquer pedido sem prova válida: não revela se o e-mail comprou, pagou ou já se cadastrou. */
const semProva = () => new ErroRegra('cadastro_indisponivel', 'Não conseguimos abrir o cadastro por este endereço. Volte pelo botão da página de pagamento. Se acabou de pagar, espere um instante e tente de novo.', 404)

const mascarar = (e: string) => {
  const [u, d] = e.split('@')
  return `${u.slice(0, 1)}***@${d}`
}

export async function cadastrar(d: DepsCadastro, p: PedidoCadastro): Promise<RespostaCadastro> {
  const sid = typeof p.session_id === 'string' ? p.session_id.trim() : ''
  if (!SESSAO_RE.test(sid)) throw semProva()
  const sessao = await d.store.sessaoPorId(sid)
  if (!sessao) throw semProva()
  // Prova válida, mas o Pix ainda não compensou: só quem tem a prova vê este estado.
  if (!sessao.paga) return { ok: false, pendente: true, mensagem: 'O pagamento ainda não caiu. Se você pagou com Pix, espere um instante e tente de novo.' }

  const cliente = await d.store.clientePorEmail(sessao.email)
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  const pagamentos = lic ? await d.store.pagamentosDa(lic.id) : []
  const pago = lic && lic.conta_gateway_id === sessao.conta_gateway_id && pagamentos.some((x) => x.tipo === 'implantacao' && x.status === 'pago')
  if (!cliente || !lic || lic.status === 'cancelada' || !pago) throw semProva()

  const nome = limpar(p.nome, 60)
  const empresa = limpar(p.empresa, 120)
  const ramo = limpar(p.ramo, 300)
  const digitado = limpar(p.email, 254).toLowerCase()
  if (!nome) throw new ErroRegra('nome_obrigatorio', 'Diga como o Atlas vai te chamar.')
  if (!ramo) throw new ErroRegra('ramo_obrigatorio', 'Conte, com as suas palavras, o que a sua empresa faz.')
  if (digitado && !EMAIL_RE.test(digitado)) throw new ErroRegra('email_invalido', 'Confira o e-mail.')
  if ([nome, empresa, ramo].some(suspeito)) {
    throw new ErroRegra('texto_invalido', 'Escreva só com palavras, sem e-mail, endereço de site ou muitos números.')
  }

  // Limite por cliente (além do por IP): quem tem a prova também não fica reemitindo acesso sem fim.
  if (!(await d.store.tentarEvento(`cadastro:cliente:${cliente.id}`, 5, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas tentativas. Espere uns minutos.', 429)
  }

  // Uma vez só, de forma atômica: dois envios ao mesmo tempo não mandam dois acessos.
  if (!(await d.store.salvarCadastro(cliente.id, { nome, empresa, ramo }, d.agora()))) {
    throw new ErroRegra('cadastro_feito', 'O seu cadastro já foi feito. O acesso foi enviado: olhe o seu e-mail.', 409)
  }
  const destino = cliente.email_compra
  try {
    await d.store.invalidarLinks(cliente.id, d.agora()) // um reenvio nunca deixa links antigos valendo
    const { token, expira_em } = await gerarLink(d, destino)
    await d.enviarBoasVindas(destino, { nome, empresa, ramo, token, expira_em })
  } catch (e) {
    await d.store.invalidarLinks(cliente.id, d.agora())
    await d.store.reabrirCadastro(cliente.id) // o e-mail não saiu: deixa tentar de novo
    if (e instanceof ErroRegra) throw e
    throw new ErroRegra('email_nao_enviado', 'Não deu para enviar o e-mail agora. Tente de novo em instantes.', 502)
  }
  return { ok: true, enviado_para: mascarar(destino), email_diferente: !!digitado && digitado !== destino.toLowerCase(), segmento: pagamentos.find((x) => x.status === 'pago' && x.segmento)?.segmento ?? null }
}
