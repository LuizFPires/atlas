// App-modelo RESTAURANTE — PORTA de dados (single-tenant: os dados são de UM restaurante só, o dono do app).
// Hoje só existe o adaptador FIXTURE (memória). O adaptador real aponta para o banco da obra do cliente
// (pendência: app/PENDENTE-ENTREGAR.md). Nenhum segredo e nenhum backend do Atlas aqui.

export const CATEGORIAS = ['Entrada', 'Prato', 'Bebida', 'Sobremesa'] as const

export interface ItemCardapio { id: string; nome: string; /** em centavos */ precoCentavos: number; categoria: string; disponivel: boolean }
export interface NovoItem { nome: string; precoCentavos: number; categoria: string }

export type Resp<T> = { ok: true; valor: T } | { ok: false; mensagem: string }

export interface PortaDados {
  listarCardapio(): Promise<ItemCardapio[]>
  criarItem(n: NovoItem): Promise<Resp<ItemCardapio>>
  editarItem(id: string, n: NovoItem): Promise<Resp<ItemCardapio>>
  removerItem(id: string): Promise<Resp<ItemCardapio>>
  definirDisponivel(id: string, disponivel: boolean): Promise<Resp<ItemCardapio>>
}

export function validarItem(n: NovoItem): string | null {
  const nome = n.nome.trim()
  if (nome.length < 2) return 'Escreva o nome do prato.'
  if (nome.length > 60) return 'O nome ficou comprido demais.'
  if (!Number.isInteger(n.precoCentavos) || n.precoCentavos <= 0) return 'Escreva o preço, por exemplo 25,90.'
  if (n.precoCentavos > 1_000_000) return 'Esse preço está alto demais. Confira o valor.'
  if (!(CATEGORIAS as readonly string[]).includes(n.categoria)) return 'Escolha a categoria.'
  return null
}

/** "25,90", "25.9" ou "1.234,50" vira centavos. Texto inválido vira 0 (a validação recusa). */
export function precoParaCentavos(t: string): number {
  let s = t.trim().replace(/^R\$\s*/, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return 0
  return Math.round(parseFloat(s) * 100)
}

export const formatarPreco = (c: number): string => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`

/** Adaptador FIXTURE: dados de exemplo em memória. Não persiste nada. */
export function criarDadosFixture(): PortaDados {
  let seq = 100
  const itens: ItemCardapio[] = [
    { id: 'i1', nome: 'Bolinho de bacalhau', precoCentavos: 2800, categoria: 'Entrada', disponivel: true },
    { id: 'i2', nome: 'Feijoada completa', precoCentavos: 4500, categoria: 'Prato', disponivel: true },
    { id: 'i3', nome: 'Filé à parmegiana', precoCentavos: 4200, categoria: 'Prato', disponivel: true },
    { id: 'i4', nome: 'Suco de laranja', precoCentavos: 900, categoria: 'Bebida', disponivel: true },
    { id: 'i5', nome: 'Pudim de leite', precoCentavos: 1400, categoria: 'Sobremesa', disponivel: false },
  ]
  const repetido = (nome: string, ignorar?: string) =>
    itens.some((i) => i.id !== ignorar && i.nome.toLowerCase() === nome.trim().toLowerCase())
  const nao = { ok: false, mensagem: 'Não achei esse item do cardápio.' } as const
  return {
    async listarCardapio() { return itens.map((i) => ({ ...i })) },
    async criarItem(n) {
      const e = validarItem(n)
      if (e) return { ok: false, mensagem: e }
      if (repetido(n.nome)) return { ok: false, mensagem: 'Já existe um item com esse nome.' }
      const i: ItemCardapio = { id: `i${++seq}`, nome: n.nome.trim(), precoCentavos: n.precoCentavos, categoria: n.categoria, disponivel: true }
      itens.push(i)
      return { ok: true, valor: { ...i } }
    },
    async editarItem(id, n) {
      const i = itens.find((x) => x.id === id)
      if (!i) return nao
      const e = validarItem(n)
      if (e) return { ok: false, mensagem: e }
      if (repetido(n.nome, id)) return { ok: false, mensagem: 'Já existe um item com esse nome.' }
      Object.assign(i, { nome: n.nome.trim(), precoCentavos: n.precoCentavos, categoria: n.categoria })
      return { ok: true, valor: { ...i } }
    },
    async removerItem(id) {
      const k = itens.findIndex((x) => x.id === id)
      if (k < 0) return nao
      const [i] = itens.splice(k, 1)
      return { ok: true, valor: { ...i } }
    },
    async definirDisponivel(id, disponivel) {
      const i = itens.find((x) => x.id === id)
      if (!i) return nao
      i.disponivel = disponivel
      return { ok: true, valor: { ...i } }
    },
  }
}
