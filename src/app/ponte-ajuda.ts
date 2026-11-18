// Porta da AJUDA DO ATLAS (F17, S18). Todo o suporte é o PRÓPRIO Atlas (o Claude por dentro, com a cara do Atlas):
// nunca promete atendimento humano, nunca manda "falar com alguém".
// A conversa é o Claude por baixo, atrás desta porta. Aqui só existe o mock do modo fixture; o adaptador real
// (Claude pelo /entregar, print real da tela) é pendência de /entregar (app/PENDENTE-ENTREGAR.md, M25).
// A mensagem do cliente, o texto do erro e o print (título, endereço, texto) são DADO: o adaptador monta o pedido com
// `montarPedidoAjuda` (delimitado, com a regra do conteúdo do cliente), nunca como instrução. Nenhum segredo fica em arquivo.

import type { PedidoAjudaPasso } from './ajuda-passo'
import { textoDaObra } from './ponte-cota'
import { REGRA_CONTEUDO_CLIENTE, blocoDoCliente } from './ponte-estilo'

/** O "print" da tela: endereço, título e o texto que aparecia. Tudo DADO (a tela desenha um quadro, nunca carrega URL nem imagem vinda de dado). */
export interface PrintAjuda {
  url: string
  titulo: string
  detalhe?: string
}

export interface ErroAjuda {
  /** "Algo deu errado ao publicar." */
  titulo: string
  /** Texto técnico do erro, se houver. DADO. */
  detalhe?: string
}

export interface ContextoAjuda {
  /** Quem abriu: o erro sozinho, o menu "Ajuda do Atlas" ou o "Não consegui" de um passo. */
  origem: 'erro' | 'menu' | 'passo'
  obra?: string
  /** Onde o cliente estava ("a publicação"). */
  onde?: string
  passo?: PedidoAjudaPasso
  erro?: ErroAjuda
  print?: PrintAjuda | null
}

export interface Turno {
  de: 'cliente' | 'atlas'
  texto: string
}

export interface RespostaAjuda {
  texto: string
}

export interface PonteAjuda {
  /** Uma volta da conversa com o Claude. A mensagem e o contexto são DADO. */
  conversar(contexto: ContextoAjuda, historico: Turno[], mensagem: string): Promise<RespostaAjuda>
  /** "Tirar print da tela": o adaptador real captura a janela do Atlas. null = não deu. */
  tirarPrint(): Promise<PrintAjuda | null>
  /** "Anexar imagem": o cliente escolhe uma imagem (só imagem; SVG recusado). null = desistiu. */
  anexarImagem(): Promise<PrintAjuda | null>
}

const nomeDoPrint = (p: PrintAjuda) => [textoDaObra(p.titulo, 100), textoDaObra(p.url, 120), textoDaObra(p.detalhe, 300)].filter(Boolean).join(' | ')

/** O que o adaptador real entrega ao Claude: tudo que veio do cliente ou da tela é dado delimitado, com a regra no topo. */
export function montarPedidoAjuda(contexto: ContextoAjuda, historico: Turno[], mensagem: string): string {
  const ctx = [
    contexto.onde && `Onde: ${textoDaObra(contexto.onde, 80)}`,
    contexto.passo && `Passo ${contexto.passo.passo} de ${contexto.passo.totalPassos} (${textoDaObra(contexto.passo.conta, 60)})`,
    contexto.erro && `Erro: ${textoDaObra(contexto.erro.titulo, 120)} ${textoDaObra(contexto.erro.detalhe, 300)}`.trim(),
    contexto.print && `Print: ${nomeDoPrint(contexto.print)}`,
  ].filter(Boolean).join('\n')
  return [
    'Você é a Ajuda do Atlas. Responda em português do Brasil, em passos curtos, como um amigo na mesa de um restaurante. Nunca prometa atendimento humano.',
    REGRA_CONTEUDO_CLIENTE,
    '## Contexto (dado)',
    ...blocoDoCliente(ctx, '(sem contexto)'),
    '## Conversa até aqui (dado)',
    ...blocoDoCliente(historico.slice(-10).map((t) => `${t.de === 'cliente' ? 'Cliente' : 'Atlas'}: ${t.texto}`).join('\n'), '(começo)'),
    '## Mensagem do cliente (dado)',
    ...blocoDoCliente(mensagem, '(vazia)'),
  ].join('\n')
}

/** Primeira fala do Atlas, escrita aqui mesmo (não depende do Claude). */
export function saudacaoAjuda(contexto: ContextoAjuda, nome?: string): string {
  const oi = nome ? `Oi, ${textoDaObra(nome, 40)}.` : 'Oi.'
  const print = contexto.print ? ' Já tirei um print da sua tela.' : ''
  const fim = ' Me conta o que você estava fazendo? Pode falar, escrever ou mandar outro print.'
  if (contexto.origem === 'erro') return `${oi} Vi que ${textoDaObra(contexto.onde, 60) || 'algo'} parou.${print}${fim}`
  if (contexto.origem === 'passo' && contexto.passo) return `${oi} Vi que você parou no passo ${contexto.passo.passo} de ${contexto.passo.totalPassos} do ${textoDaObra(contexto.passo.conta, 60)}.${print}${fim}`
  return `${oi} Estou aqui, a qualquer hora.${print} Me conta o que está acontecendo? Pode falar, escrever ou mandar um print.`
}

export interface AjudaFixture extends PonteAjuda {
  /** Pedidos montados (o que iria ao Claude). */
  readonly pedidos: string[]
}

/** Mock do modo fixture: respostas fixas, sem rede. */
export function criarAjudaFixture(): AjudaFixture {
  const pedidos: string[] = []
  return {
    pedidos,
    async conversar(contexto, historico, mensagem) {
      pedidos.push(montarPedidoAjuda(contexto, historico, mensagem))
      return { texto: 'Entendi. Vou olhar o que aconteceu e já te digo o próximo passo.' }
    },
    async tirarPrint() { return { url: 'atlas.local/tela', titulo: 'Tela do Atlas' } },
    async anexarImagem() { return { url: 'imagem-anexada', titulo: 'Imagem anexada' } },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que entendeu. */
export const ajudaIndisponivel: PonteAjuda & { readonly indisponivel: true } = {
  indisponivel: true,
  async conversar() { throw new Error('indisponivel') },
  async tirarPrint() { return null },
  async anexarImagem() { return null },
}

/** "Não consegui fazer este passo": o print do passo (o quadro do site que ele via) e onde ele parou. */
export function contextoDoPasso(p: PedidoAjudaPasso): ContextoAjuda {
  return {
    origem: 'passo',
    onde: p.origem === 'F13b' ? 'a publicação' : 'as contas',
    passo: p,
    print: { url: p.print.url, titulo: p.print.titulo, detalhe: p.print.botaoCerto ? `O botão certo aqui é "${p.print.botaoCerto}".` : undefined },
  }
}
