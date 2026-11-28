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
  rodada?: number
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
  conversa: { postam: number; comentam: number; discutem: number }
  mudaram: number
  passaramAGostar: number
  criadoEm: string
}
export type Opiniao = 'usaria' | 'nao' | 'duvida'
export interface AgenteNaCena { id: string; nome: string; idade: number; tracos: Record<string, string>; r: Opiniao | null; fala: string | null }
export interface EventoConversa { rodada: number; de: string; para: string | null; acao: 'postar' | 'comentar' | 'discutir'; texto: string; r: Opiniao }
export interface CenaTeste { agentes: AgenteNaCena[]; eventos: EventoConversa[] }
export interface PonteTestar {
  listar(pasta: string): Promise<ResumoTeste[]>
  iniciar(pasta: string, o: { quantidade: Quantidade; mesmosDe?: number | null; versao?: string | null }): Promise<{ n: number }>
  estado(pasta: string, n: number): Promise<ResumoTeste | null>
  relatorio(pasta: string, n: number): Promise<RelatorioTeste | null>
  retomar(pasta: string, n: number): Promise<{ ok: true }>
  cena(pasta: string, n: number): Promise<CenaTeste>
  aoMudar?(f: (n: number) => void): () => void
}

/** Tempo aproximado de cada tamanho (tela de quantidade): ~3 s por agente, contando a conversa. */
export const MINUTOS: Record<Quantidade, number> = { 100: 6, 250: 13, 500: 25, 1000: 50 }

/** Simulação para o modo fixture e os testes: um teste pronto e os novos andam a cada leitura do estado. */
export function criarTestarFixture(): PonteTestar {
  const contagem = (u: number, n: number, d: number): ContagemTeste => { const t = u + n + d; return { total: t, usaria: u, nao: n, duvida: d, pctUsaria: Math.round((u / t) * 100), pctNao: Math.round((n / t) * 100), pctDuvida: Math.round((d / t) * 100) } }
  const testes: ResumoTeste[] = [{ n: 1, criadoEm: '2026-11-27T21:02:00.000Z', quantidade: 500, mesmosDe: null, versao: 'v3', etapa: 'pronto', estado: 'pronto', motivo: null, feitos: 500, olhados: 488, termometro: contagem(305, 155, 28), maisContra: 'Sem internet na obra' }]
  const passos = new Map<number, number>()
  const profs = ['Mestre de obras', 'Dono de construtora', 'Pedreiro', 'RH', 'Contador']
  const agentes: AgenteNaCena[] = Array.from({ length: 60 }, (_, i) => ({ id: 'a' + i, nome: ['Marta', 'Renato', 'Jéssica', 'Diego', 'Raimundo'][i % 5], idade: 22 + ((i * 7) % 45), tracos: { Profissão: profs[i % 5] }, r: i % 9 === 0 ? 'duvida' : i % 3 === 0 ? 'nao' : 'usaria', fala: i % 3 === 0 ? 'No meu canteiro o sinal some.' : 'Acaba a briga de quem chegou atrasado.' }))
  const tema = (t: string, n: number, fala: string, quem: string): TemaRelatorio => ({ tema: t, n, ids: [], exemplo: { id: 'a1', fala, quem } })
  const relatorio = (r: ResumoTeste): RelatorioTeste => ({
    aviso: 'São agentes de IA, não pessoas reais.',
    produto: { nome: 'Ponto', oQueE: 'Ponto da equipe pelo celular', paraQuem: 'pequenas construtoras', preco: 49, telas: [] },
    geral: r.termometro ?? contagem(1, 1, 1),
    semResposta: 12,
    porTipo: { Profissão: [{ valor: 'Mestre de obras', ...contagem(80, 15, 5) }, { valor: 'RH', ...contagem(60, 25, 5) }, { valor: 'Pedreiro', ...contagem(30, 60, 10) }], Idade: [{ valor: '18 a 29', ...contagem(70, 20, 6) }, { valor: '60 ou mais', ...contagem(25, 55, 8) }] },
    preco: [{ rotulo: 'R$ 0', n: 60 }, { rotulo: 'até R$ 19', n: 104 }, { rotulo: 'até R$ 29', n: 200 }, { rotulo: 'até R$ 49', n: 128 }, { rotulo: 'mais de R$ 49', n: 44 }],
    mediana: 29,
    fortes: [tema('Bater ponto com foto e localização', 212, 'Acaba a briga de quem chegou atrasado.', 'Marta, 41'), tema('Horas da semana prontas para a folha', 174, 'Me economiza uma tarde toda sexta.', 'Jéssica, 27')],
    fracos: [tema(r.n === 1 ? 'Sem internet na obra' : 'Caro para equipe grande', r.n === 1 ? 141 : 37, 'No meu canteiro o sinal some.', 'Raimundo, 58'), tema('Caro para equipe pequena', r.n === 1 ? 117 : 41, 'R$ 49 pesa para quem tem 3 pessoas.', 'Diego, 24')],
    ideias: [{ titulo: 'Bater ponto sem internet', como: 'Guarda no celular e envia quando o sinal voltar.', tema: 'Sem internet na obra', n: 141 }],
    conversa: { postam: 120, comentam: 340, discutem: 85 },
    mudaram: 38,
    passaramAGostar: 27,
    criadoEm: r.criadoEm,
  })
  return {
    listar: async () => [...testes].sort((a, b) => b.n - a.n),
    iniciar: async (_p, o) => {
      if (testes.some((t) => t.estado === 'rodando')) throw new Error('teste-em-andamento')
      const n = testes.length + 1
      testes.push({ n, criadoEm: new Date().toISOString(), quantidade: o.quantidade, mesmosDe: o.mesmosDe ?? null, versao: o.versao ?? null, etapa: 'entender', estado: 'rodando', motivo: null, feitos: 0, olhados: 0, termometro: null, maisContra: null })
      return { n }
    },
    estado: async (_p, n) => {
      const t = testes.find((x) => x.n === n)
      if (!t) return null
      if (t.estado === 'rodando') {
        const k = (passos.get(n) ?? 0) + 1
        passos.set(n, k)
        const etapas = ['entender', 'agentes', 'olhar', 'conversa', 'relatorio', 'pronto'] as const
        t.etapa = etapas[Math.min(k, 5)]
        t.feitos = Math.min(t.quantidade, Math.round((t.quantidade * k) / 3))
        t.olhados = t.etapa === 'olhar' ? Math.round(t.quantidade / 2) : t.feitos
        t.termometro = k >= 2 ? contagem(Math.round(t.quantidade * 0.7), Math.round(t.quantidade * 0.22), Math.round(t.quantidade * 0.05)) : null
        if (t.etapa === 'pronto') { t.estado = 'pronto'; t.maisContra = 'Caro para equipe grande' }
      }
      return { ...t }
    },
    relatorio: async (_p, n) => { const t = testes.find((x) => x.n === n); return t && t.estado === 'pronto' ? relatorio(t) : null },
    retomar: async () => ({ ok: true }),
    cena: async () => ({ agentes, eventos: [] }),
  }
}
