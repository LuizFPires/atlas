// Conta da página de vendas: quanto o Claude LÊ para construir um app, sozinho numa conversa longa ou pelo Atlas.
// Ideia: numa conversa, a cada mensagem o Claude relê tudo o que já foi dito (o contexto). Conversa longa = bola de neve.
// No Atlas, cada especialista começa com a mesa limpa: recebe só a etapa da vez e sai ao entregar.
// É uma conta SIMPLIFICADA e ilustrativa, com as premissas à vista na página. O gasto real varia com o projeto, com o plano
// do Claude e com recursos dele que resumem conversas longas; por isso a página mostra a ordem de grandeza, não uma promessa.

export interface Conversa {
  /** Tokens que a conversa já começa lendo (regras, arquivos do projeto). */
  base: number
  /** Quantas trocas (mensagem + resposta) a conversa tem. */
  trocas: number
  /** Quanto cada troca acrescenta ao que precisa ser relido (pedido, código, resposta). */
  porTroca: number
}

/** Tokens lidos numa conversa: na troca i o Claude relê a base mais tudo o que as i trocas acrescentaram. */
export function lidosNaConversa(c: Conversa): number {
  let total = 0
  for (let i = 1; i <= c.trocas; i++) total += c.base + c.porTroca * i
  return total
}

export interface PremissasTokens {
  etapas: number
  /** Claude sozinho: uma conversa só para o app inteiro. */
  sozinho: { base: number; trocasPorEtapa: number; porTroca: number }
  /** Atlas, por etapa: equipe de execução, revisores e mestre de obras, cada um com a mesa limpa. */
  execucao: Conversa
  revisores: number
  revisao: Conversa
  mestre: Conversa
}

/** App de agendamento em 8 etapas. Mesmas trocas de trabalho nos dois lados; o Atlas ainda soma três revisões por etapa. */
export const ESTIMATIVA_AGENDAMENTO: PremissasTokens = {
  etapas: 8,
  sozinho: { base: 5_000, trocasPorEtapa: 15, porTroca: 3_000 },
  execucao: { base: 15_000, trocas: 12, porTroca: 3_000 },
  revisores: 3,
  revisao: { base: 15_000, trocas: 6, porTroca: 3_000 },
  mestre: { base: 8_000, trocas: 10, porTroca: 1_000 },
}

export function estimarTokens(p: PremissasTokens): { sozinho: number; atlas: number; economiaPct: number } {
  const sozinho = lidosNaConversa({ base: p.sozinho.base, trocas: p.etapas * p.sozinho.trocasPorEtapa, porTroca: p.sozinho.porTroca })
  const porEtapa = lidosNaConversa(p.execucao) + p.revisores * lidosNaConversa(p.revisao) + lidosNaConversa(p.mestre)
  const atlas = p.etapas * porEtapa
  return { sozinho, atlas, economiaPct: Math.round((1 - atlas / sozinho) * 100) }
}

/** "22 milhões" — arredonda para milhões inteiros, como a página mostra. */
export const emMilhoes = (n: number) => `${Math.round(n / 1_000_000)} milhões`
