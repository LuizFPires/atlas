// Store em memória: fixture dos testes (sem conexão com Supabase).
// Os métodos "atômicos" não têm await no meio: em JS cada um roda inteiro, equivalendo ao UPDATE/RPC do Postgres.
import type { Ativacao, CondicaoLicenca, Cliente, Codigo, ContaGateway, Entrega, Licenca, Link, NovaCompra, Ocorrencia, Pagamento, SessaoCheckout, StatusPagamento, Store, Troca, TrocaAtomica } from './tipos.ts'

export class StoreMemoria implements Store {
  clientes: Cliente[] = []
  licencas: Licenca[] = []
  ativacoes: Ativacao[] = []
  trocas: Troca[] = []
  links: Link[] = []
  codigos: Codigo[] = []
  entregas: Entrega[] = []
  ocorrencias: Ocorrencia[] = []
  contas: ContaGateway[] = []
  pagamentos: Pagamento[] = []
  sessoes: SessaoCheckout[] = []
  private eventosGateway = new Set<string>()
  private eventos = new Map<string, number[]>()
  private seq = 0
  private id = () => `id-${++this.seq}`

  async clientePorEmail(e: string) { return this.clientes.find((c) => c.email_compra === e) ?? null }
  async licencaDoCliente(id: string) { return this.licencas.find((l) => l.cliente_id === id) ?? null }
  async licencaPorId(id: string) { return this.licencas.find((l) => l.id === id) ?? null }
  async salvarLicenca(l: Licenca) { const i = this.licencas.findIndex((x) => x.id === l.id); this.licencas[i] = l }
  /** Equivale ao UPDATE condicional: sem await, então é atômico. Troca o objeto (quem segurava o antigo continua com a cópia velha). */
  async atualizarLicencaSe(id: string, set: Partial<Omit<Licenca, 'id' | 'cliente_id'>>, c: CondicaoLicenca) {
    const i = this.licencas.findIndex((x) => x.id === id)
    if (i < 0) return false
    const l = this.licencas[i]
    if (c.status && l.status !== c.status) return false
    if (c.status_diferente && l.status === c.status_diferente) return false
    if (c.avisos_atraso !== undefined && (l.avisos_atraso ?? 0) !== c.avisos_atraso) return false
    if (c.pausa_prevista_ate && !(l.pausa_prevista_em && l.pausa_prevista_em <= c.pausa_prevista_ate)) return false
    if (c.encerra_ate && !(l.mensalidade_encerra_em && l.mensalidade_encerra_em <= c.encerra_ate)) return false
    this.licencas[i] = { ...l, ...set }
    return true
  }
  async inserirLink(l: Omit<Link, 'id' | 'usado_em'>) { this.links.push({ ...l, id: this.id(), usado_em: null }) }
  async linkPorHash(h: string) { return this.links.find((l) => l.token_hash === h) ?? null }
  async consumirLink(id: string, q: Date) {
    const l = this.links.find((x) => x.id === id)
    if (!l || l.usado_em) return false
    l.usado_em = q
    return true
  }
  async inserirCodigo(c: Omit<Codigo, 'id' | 'tentativas' | 'usado_em'>, agora: Date) {
    for (const x of this.codigos) if (x.cliente_id === c.cliente_id && x.finalidade === c.finalidade && !x.usado_em) x.usado_em = agora
    this.codigos.push({ ...c, id: this.id(), tentativas: 0, usado_em: null })
  }
  async codigoAberto(cid: string, f: Codigo['finalidade']) {
    return [...this.codigos].reverse().find((c) => c.cliente_id === cid && c.finalidade === f && !c.usado_em) ?? null
  }
  async incrementarTentativa(id: string, max: number, agora: Date) {
    const c = this.codigos.find((x) => x.id === id)
    if (!c || c.usado_em || c.tentativas >= max || c.expira_em <= agora) return null
    c.tentativas += 1
    return { ...c }
  }
  async consumirCodigo(id: string, max: number, agora: Date) {
    const c = this.codigos.find((x) => x.id === id)
    if (!c || c.usado_em || c.tentativas > max || c.expira_em <= agora) return false
    c.usado_em = agora
    return true
  }
  async tentarEvento(chave: string, max: number, janelaMs: number, agora: Date) {
    const t = agora.getTime()
    const recentes = (this.eventos.get(chave) ?? []).filter((e) => e > t - janelaMs)
    if (recentes.length >= max) { this.eventos.set(chave, recentes); return false }
    recentes.push(t)
    this.eventos.set(chave, recentes)
    return true
  }
  async limparEventos(chave: string) { this.eventos.delete(chave) }
  async ativacaoAtiva(lid: string) { return this.ativacoes.find((a) => a.licenca_id === lid && a.ativo) ?? null }
  async inserirAtivacao(lid: string, hash: string, q: Date, tokenHash: string) {
    if (this.ativacoes.some((a) => a.licenca_id === lid && a.ativo)) throw new Error('índice único: já há computador ativo')
    this.ativacoes.push({ id: this.id(), licenca_id: lid, computador_hash: hash, token_hash: tokenHash, ativo: true, ativado_em: q, desativado_em: null })
  }
  async rotacionarToken(id: string, tokenHash: string) {
    const a = this.ativacoes.find((x) => x.id === id)
    if (a) a.token_hash = tokenHash
  }
  /** Equivale à função SQL trocar_computador (uma transação). */
  async trocarAtivacao(p: TrocaAtomica) {
    const atual = this.ativacoes.find((x) => x.id === p.ativacao_atual_id)
    if (!atual || !atual.ativo) return false
    if (p.intervalo_ms > 0) {
      const lim = p.quando.getTime() - p.intervalo_ms
      if (this.trocas.some((t) => t.licenca_id === p.licenca_id && t.feita_em.getTime() > lim)) return false
    }
    atual.ativo = false
    atual.desativado_em = p.quando
    this.ativacoes.push({ id: this.id(), licenca_id: p.licenca_id, computador_hash: p.para_hash, token_hash: p.token_hash, ativo: true, ativado_em: p.quando, desativado_em: null })
    this.trocas.push({ licenca_id: p.licenca_id, de_hash: p.de_hash, para_hash: p.para_hash, feita_em: p.quando, por_admin: p.por_admin })
    if (p.por_admin) { const l = this.licencas.find((x) => x.id === p.licenca_id); if (l) l.troca_liberada_em = null }
    return true
  }
  async trocasDa(lid: string) { return this.trocas.filter((t) => t.licenca_id === lid) }
  async inserirEntrega(e: Entrega) { this.entregas.push(e) }
  async inserirOcorrencia(o: Ocorrencia) { this.ocorrencias.push(o) }

  async contaGateway(id: string) { return this.contas.find((c) => c.id === id) ?? null }
  async registrarEventoGateway(conta: string, ev: string) {
    const k = `${conta}:${ev}`
    if (this.eventosGateway.has(k)) return false
    this.eventosGateway.add(k)
    return true
  }
  async liberarEventoGateway(conta: string, ev: string) { this.eventosGateway.delete(`${conta}:${ev}`) }
  async licencaPorGateway(conta: string, ref: { cliente?: string | null; assinatura?: string | null }) {
    return (
      this.licencas.find(
        (l) => l.conta_gateway_id === conta && ((ref.assinatura && l.gateway_assinatura_ref === ref.assinatura) || (ref.cliente && l.gateway_cliente_ref === ref.cliente)),
      ) ?? null
    )
  }
  async criarCompra(c: NovaCompra) {
    let cli = this.clientes.find((x) => x.email_compra === c.email)
    if (!cli) { cli = { id: this.id(), email_compra: c.email, nome_tratamento: c.nome }; this.clientes.push(cli) }
    const ja = this.licencas.find((l) => l.cliente_id === cli.id)
    if (ja) return { licenca: ja, nova: false }
    const licenca: Licenca = {
      id: this.id(), cliente_id: cli.id, status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null,
      comprada_em: c.agora, avisos_atraso: 0, conta_gateway_id: c.conta_gateway_id, gateway_cliente_ref: c.gateway_cliente_ref,
      gateway_assinatura_ref: null, mensalidade_encerra_em: null,
    }
    this.licencas.push(licenca)
    return { licenca, nova: true }
  }
  async gravarPagamento(p: Pagamento) {
    const i = this.pagamentos.findIndex((x) => x.conta_gateway_id === p.conta_gateway_id && x.gateway_ref === p.gateway_ref)
    if (i < 0) { this.pagamentos.push({ ...p }); return null }
    const antes = this.pagamentos[i].status
    if (antes === 'estornado' && p.status !== 'estornado') return antes // upsert condicional: WHERE status <> 'estornado'
    this.pagamentos[i] = { ...p }
    return antes
  }
  async pagamentoPorRef(conta: string, ref: string) { return this.pagamentos.find((p) => p.conta_gateway_id === conta && p.gateway_ref === ref) ?? null }
  async pagamentosPorPi(conta: string, pi: string) { return this.pagamentos.filter((p) => p.conta_gateway_id === conta && p.gateway_pi === pi) }
  async pagamentosDa(lid: string) { return this.pagamentos.filter((p) => p.licenca_id === lid) }
  async atualizarStatusPagamento(conta: string, ref: string, status: StatusPagamento) {
    const p = this.pagamentos.find((x) => x.conta_gateway_id === conta && x.gateway_ref === ref)
    if (p) p.status = status
  }
  async licencasAtrasadas() { return this.licencas.filter((l) => l.status === 'atrasada') }
  async licencasEncerramentoVencido(agora: Date) { return this.licencas.filter((l) => l.status !== 'cancelada' && l.mensalidade_encerra_em && l.mensalidade_encerra_em <= agora) }
  async clientePorId(id: string) { return this.clientes.find((c) => c.id === id) ?? null }

  async salvarCadastro(clienteId: string, c: { nome: string; empresa: string; ramo: string }, quando: Date) {
    const cli = this.clientes.find((x) => x.id === clienteId)
    if (!cli || cli.cadastro_em) return false
    Object.assign(cli, { nome_tratamento: c.nome, empresa: c.empresa, ramo: c.ramo, cadastro_em: quando })
    return true
  }
  async registrarSessao(conta: string, id: string, email: string) {
    if (!this.sessoes.some((s) => s.sessao_id === id)) this.sessoes.push({ conta_gateway_id: conta, sessao_id: id, email, paga: false })
  }
  async marcarSessaoPaga(conta: string, id: string, email: string) {
    const s = this.sessoes.find((x) => x.sessao_id === id)
    if (s) s.paga = true
    else this.sessoes.push({ conta_gateway_id: conta, sessao_id: id, email, paga: true })
  }
  async sessaoPorId(id: string) { return this.sessoes.find((s) => s.sessao_id === id) ?? null }
  async invalidarLinks(clienteId: string, quando: Date) {
    for (const l of this.links) if (l.cliente_id === clienteId && !l.usado_em) l.usado_em = quando
  }
  async trocarLinks(l: Omit<Link, 'id' | 'usado_em'>, quando: Date) {
    for (const x of this.links) if (x.cliente_id === l.cliente_id && !x.usado_em) x.usado_em = quando
    this.links.push({ ...l, id: this.id(), usado_em: null })
  }
  async reabrirCadastro(clienteId: string) {
    const cli = this.clientes.find((x) => x.id === clienteId)
    if (cli) cli.cadastro_em = null
  }
}
