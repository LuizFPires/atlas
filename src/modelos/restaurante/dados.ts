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
  listarPedidos(): Promise<Pedido[]>
  /** Abre um pedido para uma mesa ou um cliente (texto livre curto). */
  abrirPedido(rotulo: string): Promise<Resp<Pedido>>
  adicionarAoPedido(pedidoId: string, itemId: string, qtd: number): Promise<Resp<Pedido>>
  removerDoPedido(pedidoId: string, itemId: string): Promise<Resp<Pedido>>
  /** Só anda para a frente: aberto, na cozinha, pronto, entregue. */
  mudarStatus(pedidoId: string, para: StatusPedido): Promise<Resp<Pedido>>
}

export const STATUS = ['aberto', 'na_cozinha', 'pronto', 'entregue'] as const
export type StatusPedido = (typeof STATUS)[number]
export const ROTULO_STATUS: Record<StatusPedido, string> = { aberto: 'Aberto', na_cozinha: 'Na cozinha', pronto: 'Pronto', entregue: 'Entregue' }

/** O preço fica guardado na linha: mudar o cardápio depois não muda pedido já feito. */
export interface LinhaPedido { itemId: string; nome: string; precoCentavos: number; qtd: number }
export interface Pedido { id: string; rotulo: string; linhas: LinhaPedido[]; status: StatusPedido }

export const totalDoPedido = (p: Pedido): number => p.linhas.reduce((t, l) => t + l.precoCentavos * l.qtd, 0)

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
  const pedidos: Pedido[] = [
    { id: 'p1', rotulo: 'Mesa 4', linhas: [{ itemId: 'i2', nome: 'Feijoada completa', precoCentavos: 4500, qtd: 2 }, { itemId: 'i4', nome: 'Suco de laranja', precoCentavos: 900, qtd: 2 }], status: 'na_cozinha' },
    { id: 'p2', rotulo: 'Mesa 7', linhas: [{ itemId: 'i1', nome: 'Bolinho de bacalhau', precoCentavos: 2800, qtd: 1 }], status: 'aberto' },
  ]
  const copia = (p: Pedido): Pedido => ({ ...p, linhas: p.linhas.map((l) => ({ ...l })) })
  const semPedido = { ok: false, mensagem: 'Não achei esse pedido.' } as const
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
    async listarPedidos() { return pedidos.map(copia) },
    async abrirPedido(rotulo) {
      const r = rotulo.trim()
      if (r.length < 1) return { ok: false, mensagem: 'Diga a mesa ou o nome do cliente.' }
      if (r.length > 40) return { ok: false, mensagem: 'O nome da mesa ficou comprido demais.' }
      const p: Pedido = { id: `p${++seq}`, rotulo: r, linhas: [], status: 'aberto' }
      pedidos.push(p)
      return { ok: true, valor: copia(p) }
    },
    async adicionarAoPedido(pedidoId, itemId, qtd) {
      const p = pedidos.find((x) => x.id === pedidoId)
      if (!p) return semPedido
      if (p.status !== 'aberto') return { ok: false, mensagem: 'Esse pedido já foi para a cozinha. Abra outro pedido para acrescentar.' }
      const i = itens.find((x) => x.id === itemId)
      if (!i) return nao
      if (!i.disponivel) return { ok: false, mensagem: `${i.nome} está esgotado.` }
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > 50) return { ok: false, mensagem: 'Escolha uma quantidade de 1 a 50.' }
      const l = p.linhas.find((x) => x.itemId === itemId)
      if (l) l.qtd = Math.min(50, l.qtd + qtd)
      else p.linhas.push({ itemId, nome: i.nome, precoCentavos: i.precoCentavos, qtd })
      return { ok: true, valor: copia(p) }
    },
    async removerDoPedido(pedidoId, itemId) {
      const p = pedidos.find((x) => x.id === pedidoId)
      if (!p) return semPedido
      if (p.status !== 'aberto') return { ok: false, mensagem: 'Esse pedido já foi para a cozinha.' }
      p.linhas = p.linhas.filter((l) => l.itemId !== itemId)
      return { ok: true, valor: copia(p) }
    },
    async mudarStatus(pedidoId, para) {
      const p = pedidos.find((x) => x.id === pedidoId)
      if (!p) return semPedido
      if (STATUS.indexOf(para) !== STATUS.indexOf(p.status) + 1) return { ok: false, mensagem: 'Esse pedido não pode pular etapas nem voltar.' }
      if (para === 'na_cozinha' && p.linhas.length === 0) return { ok: false, mensagem: 'Coloque pelo menos um item antes de mandar para a cozinha.' }
      p.status = para
      return { ok: true, valor: copia(p) }
    },
  }
}
