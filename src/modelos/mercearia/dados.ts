// App-modelo MERCEARIA — PORTA de dados (single-tenant: os dados são de UMA mercearia só, a dona do app).
// Hoje só existe o adaptador FIXTURE (memória). O adaptador real aponta para o banco da obra do cliente
// (pendência: app/PENDENTE-ENTREGAR.md). Nenhum segredo e nenhum backend do Atlas aqui.

export interface Produto {
  id: string
  nome: string
  /** em centavos */
  precoCentavos: number
  quantidade: number
  /** AAAA-MM-DD; vazio = produto sem validade */
  validade: string
}
export interface NovoProduto { nome: string; precoCentavos: number; quantidade: number; validade: string }

export type Resp<T> = { ok: true; valor: T } | { ok: false; mensagem: string }

export interface PortaDados {
  listarProdutos(): Promise<Produto[]>
  criarProduto(n: NovoProduto): Promise<Resp<Produto>>
  editarProduto(id: string, n: NovoProduto): Promise<Resp<Produto>>
  removerProduto(id: string): Promise<Resp<Produto>>
  /** Entrada (chegou mercadoria) soma; saída (perda, uso próprio) subtrai. Nunca deixa negativo. */
  registrarEntrada(id: string, qtd: number): Promise<Resp<Produto>>
  registrarSaida(id: string, qtd: number): Promise<Resp<Produto>>
  /** Fecha a venda de uma vez: ou baixa o estoque de tudo, ou não baixa nada. Preço fica guardado na linha. */
  fecharVenda(itens: ItemVenda[]): Promise<Resp<Venda>>
}

export interface ItemVenda { produtoId: string; qtd: number }
export interface LinhaVenda { produtoId: string; nome: string; precoCentavos: number; qtd: number }
export interface Venda { id: string; linhas: LinhaVenda[]; totalCentavos: number }

export const totalDasLinhas = (l: { precoCentavos: number; qtd: number }[]): number => l.reduce((t, x) => t + x.precoCentavos * x.qtd, 0)

export function validarProduto(n: NovoProduto): string | null {
  const nome = n.nome.trim()
  if (nome.length < 2) return 'Escreva o nome do produto.'
  if (nome.length > 60) return 'O nome ficou comprido demais.'
  if (!Number.isInteger(n.precoCentavos) || n.precoCentavos <= 0) return 'Escreva o preço, por exemplo 4,50.'
  if (n.precoCentavos > 1_000_000) return 'Esse preço está alto demais. Confira o valor.'
  if (!Number.isInteger(n.quantidade) || n.quantidade < 0) return 'A quantidade precisa ser 0 ou mais.'
  if (n.quantidade > 100_000) return 'Essa quantidade está alta demais. Confira o valor.'
  if (n.validade !== '' && !dataValida(n.validade)) return 'Escolha uma data de validade válida.'
  return null
}

export function dataValida(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

export const ymd = (d: Date): string => d.toISOString().slice(0, 10)
export function somarDias(d: string, dias: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + dias)
  return ymd(t)
}
/** Dias de hoje até a validade (negativo = já venceu). */
export const diasAteValidade = (validade: string, hoje: string): number =>
  Math.round((Date.parse(`${validade}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000)

export function formatarData(d: string): string {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

/** "4,50", "4.5" ou "1.234,50" vira centavos. Texto inválido vira 0 (a validação recusa). */
export function precoParaCentavos(t: string): number {
  let s = t.trim().replace(/^R\$\s*/, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return 0
  return Math.round(parseFloat(s) * 100)
}

export const formatarPreco = (c: number): string => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`

/** Adaptador FIXTURE: dados de exemplo em memória. Não persiste nada. `hoje` só serve para datas de exemplo. */
export function criarDadosFixture(hoje: string = ymd(new Date())): PortaDados {
  let seq = 100
  const produtos: Produto[] = [
    { id: 'p1', nome: 'Arroz 5 kg', precoCentavos: 2890, quantidade: 24, validade: somarDias(hoje, 300) },
    { id: 'p2', nome: 'Leite integral 1 L', precoCentavos: 549, quantidade: 3, validade: somarDias(hoje, 4) },
    { id: 'p3', nome: 'Pão de forma', precoCentavos: 790, quantidade: 12, validade: somarDias(hoje, -1) },
    { id: 'p4', nome: 'Café 500 g', precoCentavos: 1890, quantidade: 18, validade: somarDias(hoje, 120) },
    { id: 'p5', nome: 'Sabão em pó', precoCentavos: 1250, quantidade: 2, validade: '' },
  ]
  const repetido = (nome: string, ignorar?: string) =>
    produtos.some((p) => p.id !== ignorar && p.nome.toLowerCase() === nome.trim().toLowerCase())
  const nao = { ok: false, mensagem: 'Não achei esse produto.' } as const
  const qtdOk = (q: number) => Number.isInteger(q) && q >= 1 && q <= 100_000
  return {
    async listarProdutos() { return produtos.map((p) => ({ ...p })) },
    async criarProduto(n) {
      const e = validarProduto(n)
      if (e) return { ok: false, mensagem: e }
      if (repetido(n.nome)) return { ok: false, mensagem: 'Já existe um produto com esse nome.' }
      const p: Produto = { id: `p${++seq}`, nome: n.nome.trim(), precoCentavos: n.precoCentavos, quantidade: n.quantidade, validade: n.validade }
      produtos.push(p)
      return { ok: true, valor: { ...p } }
    },
    async editarProduto(id, n) {
      const p = produtos.find((x) => x.id === id)
      if (!p) return nao
      const e = validarProduto(n)
      if (e) return { ok: false, mensagem: e }
      if (repetido(n.nome, id)) return { ok: false, mensagem: 'Já existe um produto com esse nome.' }
      Object.assign(p, { nome: n.nome.trim(), precoCentavos: n.precoCentavos, quantidade: n.quantidade, validade: n.validade })
      return { ok: true, valor: { ...p } }
    },
    async removerProduto(id) {
      const k = produtos.findIndex((x) => x.id === id)
      if (k < 0) return nao
      const [p] = produtos.splice(k, 1)
      return { ok: true, valor: { ...p } }
    },
    async registrarEntrada(id, qtd) {
      const p = produtos.find((x) => x.id === id)
      if (!p) return nao
      if (!qtdOk(qtd)) return { ok: false, mensagem: 'Escreva uma quantidade de 1 em diante.' }
      p.quantidade += qtd
      return { ok: true, valor: { ...p } }
    },
    async registrarSaida(id, qtd) {
      const p = produtos.find((x) => x.id === id)
      if (!p) return nao
      if (!qtdOk(qtd)) return { ok: false, mensagem: 'Escreva uma quantidade de 1 em diante.' }
      if (qtd > p.quantidade) return { ok: false, mensagem: `Só tem ${p.quantidade} de ${p.nome} no estoque.` }
      p.quantidade -= qtd
      return { ok: true, valor: { ...p } }
    },
    async fecharVenda(itens) {
      if (itens.length === 0) return { ok: false, mensagem: 'Coloque pelo menos um produto na venda.' }
      // Soma por produto (o mesmo produto pode vir em duas linhas) e confere TUDO antes de baixar qualquer coisa.
      const pedido = new Map<string, number>()
      for (const it of itens) {
        if (!qtdOk(it.qtd)) return { ok: false, mensagem: 'Escreva uma quantidade de 1 em diante.' }
        pedido.set(it.produtoId, (pedido.get(it.produtoId) ?? 0) + it.qtd)
      }
      const linhas: LinhaVenda[] = []
      for (const [produtoId, qtd] of pedido) {
        const p = produtos.find((x) => x.id === produtoId)
        if (!p) return nao
        if (qtd > p.quantidade) return { ok: false, mensagem: `Só tem ${p.quantidade} de ${p.nome} no estoque.` }
        linhas.push({ produtoId, nome: p.nome, precoCentavos: p.precoCentavos, qtd })
      }
      for (const l of linhas) (produtos.find((x) => x.id === l.produtoId) as Produto).quantidade -= l.qtd
      return { ok: true, valor: { id: `v${++seq}`, linhas, totalCentavos: totalDasLinhas(linhas) } }
    },
  }
}
