// Testar a ideia (TI1TestarIdeia, aprovado pelo Luiz em 28/11/2026): agentes de IA olham o protótipo. Um termômetro, não
// uma pesquisa de mercado. Os números do relatório vêm do programa; o Claude só agrupa os motivos em temas.
export type Quantidade = 100 | 250 | 500 | 1000
export interface ContagemTeste { total: number; usaria: number; nao: number; duvida: number; pctUsaria: number; pctNao: number; pctDuvida: number }
export interface ResumoTeste {
  n: number
  criadoEm: string
  quantidade: number
  mesmosDe: number | null
  versao: string | null
  etapa: 'entender' | 'agentes' | 'olhar' | 'conversa' | 'relatorio' | 'pronto'
  estado: 'rodando' | 'pausado-cota' | 'erro' | 'pronto'
  motivo: string | null
  feitos: number
  olhados: number
  termometro: ContagemTeste | null
  maisContra: string | null
}
export interface TemaRelatorio { tema: string; n: number; ids: string[]; exemplo: { id: string; fala: string; quem: string } | null }
export interface RelatorioTeste {
  aviso: string
  produto: { nome: string; oQueE: string; paraQuem: string; preco: number | null; telas: string[] }
  geral: ContagemTeste
  semResposta: number
  porTipo: Record<string, (ContagemTeste & { valor: string })[]>
  preco: { rotulo: string; n: number }[]
  mediana: number | null
  fortes: TemaRelatorio[]
  fracos: TemaRelatorio[]
  ideias: { titulo: string; como: string; tema: string | null; n: number }[]
  criadoEm: string
}
export interface PonteTestar {
  listar(pasta: string): Promise<ResumoTeste[]>
  iniciar(pasta: string, o: { quantidade: Quantidade; mesmosDe?: number | null; versao?: string | null }): Promise<{ n: number }>
  estado(pasta: string, n: number): Promise<ResumoTeste | null>
  relatorio(pasta: string, n: number): Promise<RelatorioTeste | null>
  retomar(pasta: string, n: number): Promise<{ ok: true }>
  aoMudar?(f: (n: number) => void): () => void
}
