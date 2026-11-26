// Ponte do Lançamento (M60; prototipo/caminho-novo/LC1Lancamento). O adaptador real é app/adaptadores/lancamento.cjs.
export type Gateway = 'stripe' | 'asaas'
export type FaseLancamento = 'comecar' | 'recebimento' | 'pagina'
export interface Plano { nome: string; limite: string; preco: string }
export interface EstadoLancamento { paraVender: boolean; adaptacao: 'pedida' | null; comecado: boolean; gateway: Gateway | null; contaPronta: boolean; planos: Plano[]; fase: FaseLancamento; endereco: string | null }
export interface ItemLancamento { pasta: string; endereco: string | null; fase: FaseLancamento; gateway: Gateway | null }

export interface PonteLancamento {
  indisponivel?: boolean
  estado(pasta: string): Promise<EstadoLancamento>
  /** adaptar: o cliente viu o aviso de que um sistema de uso interno precisa antes de uma obra de adaptação (M64). */
  comecar(pasta: string, adaptar?: boolean): Promise<EstadoLancamento>
  escolherGateway(pasta: string, g: Gateway): Promise<EstadoLancamento>
  contaPronta(pasta: string): Promise<EstadoLancamento>
  listar(): Promise<ItemLancamento[]>
}

export const PLANOS: Plano[] = [{ nome: 'Grátis', limite: 'até 3 funcionários', preco: 'R$ 0' }, { nome: 'Mensal', limite: 'sem limite', preco: 'R$ 49/mês' }, { nome: 'Anual', limite: 'sem limite', preco: 'R$ 470/ano' }]

/** Stripe x Asaas, lado a lado (decisão do Luiz, 25/11/2026: o cliente escolhe, com prós e contras claros). */
export const GATEWAYS: { id: Gateway; nome: string; pros: string[]; contras: string[] }[] = [
  { id: 'stripe', nome: 'Stripe', pros: ['Assinatura no cartão muito estável, usada no mundo todo', 'Aceita cartão de fora do Brasil', 'Boleto', 'Painel e recibos muito completos'], contras: ['Pix só para pagamento avulso: não dá para cobrar a mensalidade no Pix', 'Não parcela no cartão: o plano anual fica à vista'] },
  { id: 'asaas', nome: 'Asaas', pros: ['Mensalidade no Pix, que cai sozinha todo mês (Pix Automático)', 'Parcela no cartão: o anual pode ser em até 10×', 'Boleto e cartão todo mês', 'Empresa brasileira, tudo em português'], contras: ['Feito para vender dentro do Brasil: se um dia vender para fora, o Stripe é melhor'] },
]

const vazio = (paraVender = true): EstadoLancamento => ({ paraVender, adaptacao: null, comecado: false, gateway: null, contaPronta: false, planos: PLANOS, fase: 'comecar', endereco: 'pontoampla.vercel.app' })

export function criarLancamentoFixture({ usoInterno = [] as string[] } = {}): PonteLancamento {
  const m = new Map<string, EstadoLancamento>()
  const de = (p: string) => { if (!m.has(p)) m.set(p, vazio(!usoInterno.includes(p))); return m.get(p) as EstadoLancamento }
  const fase = (e: EstadoLancamento): FaseLancamento => (!e.comecado ? 'comecar' : !e.gateway || !e.contaPronta ? 'recebimento' : 'pagina')
  const devolve = (e: EstadoLancamento) => { e.fase = fase(e); return structuredClone(e) }
  return {
    async estado(p) { return devolve(de(p)) },
    async comecar(p, adaptar) { const e = de(p); if (!e.comecado && !e.paraVender) { if (!adaptar) throw new Error('precisa-adaptar'); e.adaptacao = 'pedida' } e.comecado = true; return devolve(e) },
    async escolherGateway(p, g) { const e = de(p); if (e.gateway !== g) e.contaPronta = false; e.gateway = g; return devolve(e) },
    async contaPronta(p) { de(p).contaPronta = true; return devolve(de(p)) },
    async listar() { return [...m.entries()].filter(([, e]) => e.comecado).map(([pasta, e]) => ({ pasta, endereco: e.endereco, fase: fase(e), gateway: e.gateway })) },
  }
}

export const lancamentoIndisponivel: PonteLancamento = {
  indisponivel: true,
  async estado() { return { ...vazio(), endereco: null } },
  async comecar() { throw new Error('indisponivel') },
  async escolherGateway() { throw new Error('indisponivel') },
  async contaPronta() { throw new Error('indisponivel') },
  async listar() { return [] },
}
