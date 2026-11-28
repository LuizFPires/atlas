// Revisão do protótipo pedida a partir de um teste da ideia. Fica fora da tela (por obra) para o dono poder trocar de aba
// enquanto o Atlas revisa (pode levar alguns minutos) e encontrar o resultado quando voltar. A chave é obra#teste.
export type Revisao = { estado: 'revisando'; ideias: string[] } | { estado: 'pronta'; ideias: string[]; versao: number } | { estado: 'erro'; ideias: string[]; erro: unknown }

const revisoes = new Map<string, Revisao>()
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

export const revisaoDe = (pasta: string): Revisao | null => revisoes.get(pasta) ?? null
export function ouvirRevisoes(f: () => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f) } }

/** Monta o pedido para o Atlas revisar o protótipo: as ideias marcadas e a mudança do próprio dono. */
export function pedidoDeRevisao(n: number, ideias: { titulo: string; como: string; n: number }[], outra: string): string {
  return [
    `Mudanças escolhidas pelo dono depois do teste ${n} da ideia (as opiniões vieram de agentes de IA, não de pessoas reais):`,
    ...ideias.map((i) => `- ${i.titulo}: ${i.como}${i.n ? ` (citado por ${i.n} agentes)` : ''}`),
    ...(outra.trim() ? [`- Mudança do dono: ${outra.trim()}`] : []),
  ].join('\n')
}

export function revisar(pasta: string, ideias: string[], fazer: () => Promise<number>): void {
  if (revisoes.get(pasta)?.estado === 'revisando') return
  revisoes.set(pasta, { estado: 'revisando', ideias })
  avisar()
  fazer().then((versao) => { revisoes.set(pasta, { estado: 'pronta', ideias, versao }); avisar() }, (erro) => { revisoes.set(pasta, { estado: 'erro', ideias, erro }); avisar() })
}

export function esquecerRevisao(pasta: string): void { revisoes.delete(pasta); avisar() }
