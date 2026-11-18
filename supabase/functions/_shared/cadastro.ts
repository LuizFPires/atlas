// M4 item 4 — POST /cadastro: completa o cliente criado pelo webhook de pagamento (M3) com as 4 respostas
// e dispara o e-mail de boas-vindas (S10) com o link de instalação de uso único.
import { gerarLink } from './links.ts'
import { type Deps, ErroRegra } from './tipos.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const limpar = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export interface BoasVindas { nome: string; empresa: string; ramo: string; token: string; expira_em: Date }

export interface DepsCadastro extends Deps {
  /** Envia o e-mail de boas-vindas. Fixture/testes: grava. Produção: adaptador de e-mail (etapa /entregar). */
  enviarBoasVindas: (email: string, dados: BoasVindas) => Promise<void>
}

export interface PedidoCadastro { nome?: unknown; empresa?: unknown; ramo?: unknown; email?: unknown }

export async function cadastrar(d: DepsCadastro, p: PedidoCadastro): Promise<{ ok: true }> {
  const nome = limpar(p.nome, 60)
  const empresa = limpar(p.empresa, 120)
  const ramo = limpar(p.ramo, 300)
  const email = limpar(p.email, 254).toLowerCase()
  if (!nome) throw new ErroRegra('nome_obrigatorio', 'Diga como o Atlas vai te chamar.')
  if (!ramo) throw new ErroRegra('ramo_obrigatorio', 'Conte, com as suas palavras, o que a sua empresa faz.')
  if (!EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail.')

  // Só quem tem implantação paga (confirmada pelo webhook do gateway) pode se cadastrar.
  const cliente = await d.store.clientePorEmail(email)
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  const pago = lic && (await d.store.pagamentosDa(lic.id)).some((x) => x.tipo === 'implantacao' && x.status === 'pago')
  if (!cliente || !lic || lic.status === 'cancelada' || !pago) {
    throw new ErroRegra('sem_compra', 'Ainda não vimos o pagamento desse e-mail. Se pagou com Pix, espere um instante e tente de novo.', 404)
  }

  // Uma vez só, de forma atômica: dois envios ao mesmo tempo não mandam dois acessos.
  if (!(await d.store.salvarCadastro(cliente.id, { nome, empresa, ramo }, d.agora()))) {
    throw new ErroRegra('cadastro_feito', 'O seu cadastro já foi feito. O acesso foi enviado: olhe o seu e-mail.', 409)
  }
  try {
    const { token, expira_em } = await gerarLink(d, email)
    await d.enviarBoasVindas(email, { nome, empresa, ramo, token, expira_em })
  } catch (e) {
    await d.store.reabrirCadastro(cliente.id) // o e-mail não saiu: deixa tentar de novo
    if (e instanceof ErroRegra) throw e
    throw new ErroRegra('email_nao_enviado', 'Não deu para enviar o e-mail agora. Tente de novo em instantes.', 502)
  }
  return { ok: true }
}
