// M65 — O Atlas não constrói outro Atlas (prototipo/caminho-novo/AC1Politica … AC5Embargada). Adaptador real: app/adaptadores/politica.cjs.
export type SituacaoPolitica = 'livre' | 'embargada' | 'recusada'

/** O que o porteiro disse (ideia ou pós-obra). situacao vem do servidor (fonte da verdade do embargo). */
export interface ResultadoPolitica { bloqueia: boolean; sinais: string[]; situacao?: SituacaoPolitica }

export interface PontePolitica {
  readonly indisponivel?: boolean
  /** "Acha que é engano? Explique": vai para a análise da equipe. */
  analise(obra: string, texto: string): Promise<{ ok: true }>
  situacao(obra: string): Promise<SituacaoPolitica>
}

export const PODE = ['Chatbot de atendimento com IA', 'Site ou loja com textos feitos por IA', 'Orçamento, resumo ou relatório com IA', 'Qualquer sistema para o seu negócio']
export const NAO_PODE = ['Sistema que transforma ideia e protótipo em software', 'Agentes de IA que constroem sistemas para outras pessoas', 'Copiar a experiência do Atlas (canteiro, obras, linha)']

export function criarPoliticaFixture(): PontePolitica & { analises: { obra: string; texto: string }[] } {
  const analises: { obra: string; texto: string }[] = []
  return { analises, async analise(obra, texto) { analises.push({ obra, texto }); return { ok: true } }, async situacao() { return 'livre' } }
}

export const politicaIndisponivel: PontePolitica = {
  indisponivel: true,
  async analise() { throw new Error('indisponivel') },
  async situacao() { return 'livre' },
}

/** Erros da linha que vêm da política (garantirObra no app). */
export const ERROS_POLITICA = ['obra-embargada', 'uso-recusado', 'politica-bloqueado'] as const
export function mensagemPolitica(codigo: string): string | null {
  if (codigo === 'obra-embargada') return 'Esta obra está embargada enquanto a equipe do Atlas analisa se ela pode seguir. As suas outras obras continuam normalmente.'
  if (codigo === 'uso-recusado') return 'O uso do Atlas foi encerrado pelos termos de uso.'
  if (codigo === 'politica-bloqueado') return 'O código desta obra passou a construir outros sistemas com agentes de IA, como o Atlas. Isso vai contra as políticas de desenvolvimento do Atlas.'
  return null
}
