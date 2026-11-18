// Store em memória: fixture dos testes (sem conexão com Supabase).
// Os métodos "atômicos" não têm await no meio: em JS cada um roda inteiro, equivalendo ao UPDATE/RPC do Postgres.
import type { Ativacao, Cliente, Codigo, Entrega, Licenca, Link, Ocorrencia, Store, Troca, TrocaAtomica } from './tipos.ts'

export class StoreMemoria implements Store {
  clientes: Cliente[] = []
  licencas: Licenca[] = []
  ativacoes: Ativacao[] = []
  trocas: Troca[] = []
  links: Link[] = []
  codigos: Codigo[] = []
  entregas: Entrega[] = []
  ocorrencias: Ocorrencia[] = []
  private eventos = new Map<string, number[]>()
  private seq = 0
  private id = () => `id-${++this.seq}`

  async clientePorEmail(e: string) { return this.clientes.find((c) => c.email_compra === e) ?? null }
  async licencaDoCliente(id: string) { return this.licencas.find((l) => l.cliente_id === id) ?? null }
  async licencaPorId(id: string) { return this.licencas.find((l) => l.id === id) ?? null }
  async salvarLicenca(l: Licenca) { const i = this.licencas.findIndex((x) => x.id === l.id); this.licencas[i] = l }
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
}
