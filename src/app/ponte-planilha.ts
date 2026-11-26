// Começar por uma planilha (prototipo/caminho-novo/X1–X3). Adaptador real: app/adaptadores/planilha-obra.cjs (raio-X no computador,
// "o que entendi" pelo Claude). A tela recebe só o resumo: nunca os dados da planilha.

export type AbaLida = { nome: string; linhas: number; colunas: number; achados: string[] }
export type VisaoPlanilha = {
  arquivo: string
  formato: 'xlsx' | 'xlsm' | 'csv'
  abas: AbaLida[]
  macros: boolean
  contas: { conferidas: number; batem: number; divergem: number; semConferir: number }
}
export type Entendimento = {
  resumo: string
  entidades: { nome: string; quantos: number | null; campos: string }[]
  relacoes: string[]
  regras: string[]
  relatorios: string[]
  perguntas: { pergunta: string; porque: string }[]
  mudancas: string[]
  aparelho: { celular: string; computador: string }
  /** M65: o porteiro barrou (sistema que constrói sistemas). situacao = o que o servidor decidiu. */
  politica?: { bloqueia: boolean; sinais: string[]; situacao?: 'livre' | 'embargada' | 'recusada' }
}

export interface PontePlanilha {
  ler(pasta: string, nome: string): Promise<VisaoPlanilha>
  /** Sem fala: primeira leitura. Com fala: respostas, acréscimos e mudanças do cliente. */
  entender(pasta: string, fala?: string): Promise<Entendimento>
  levarDados(pasta: string, sim: boolean): Promise<void>
  relato(pasta: string): Promise<string>
}

export function criarPlanilhaFixture(): PontePlanilha {
  let falou = ''
  const base: Entendimento = {
    resumo: 'Você controla as compras das obras: cada pedido com os itens, o fornecedor e o status.',
    entidades: [
      { nome: 'Pedidos de compra', quantos: 412, campos: 'nº, data, obra, fornecedor, status, total' },
      { nome: 'Itens do pedido', quantos: 790, campos: 'descrição, quantidade, preço, total' },
      { nome: 'Fornecedores', quantos: 38, campos: 'nome, CNPJ, contato' },
    ],
    relacoes: ['Cada pedido tem vários itens e um fornecedor'],
    regras: ['Total do item = quantidade × preço unitário', 'Pedido acima de R$ 5.000 fica vermelho: precisa de aprovação'],
    relatorios: ['Resumo do mês: gasto por obra e por categoria'],
    perguntas: [{ pergunta: 'Quem aprova pedido acima de R$ 5.000?', porque: 'A macro manda e-mail, mas não diz para quem.' }],
    mudancas: [],
    aparelho: { celular: 'fazer o pedido na obra', computador: 'conferir o resumo do mês' },
  }
  return {
    async ler(_p, nome) {
      return {
        arquivo: nome, formato: 'xlsx', macros: true,
        abas: [
          { nome: 'Pedidos', linhas: 412, colunas: 9, achados: ['Status: texto · lista (Rascunho, Enviado, Aprovado…)', 'Total: valor em R$ · fórmula · cor quando maior que 5000'] },
          { nome: 'Itens', linhas: 790, colunas: 6, achados: ['Total item: valor em R$ · fórmula'] },
          { nome: 'Fornecedores', linhas: 38, colunas: 7, achados: [] },
        ],
        contas: { conferidas: 214, batem: 214, divergem: 0, semConferir: 12 },
      }
    },
    async entender(_p, fala) {
      if (!fala) return base
      falou = fala
      return { ...base, perguntas: [], mudancas: ['Entendi: quem aprova é o financeiro', 'Novo: foto da nota fiscal no pedido'] }
    },
    async levarDados() {},
    async relato() { return `${base.resumo}\n${falou}` },
  }
}
