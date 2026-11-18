// Store em memória: fixture dos testes (sem conexão com Supabase).
import type { Ativacao, Cliente, Codigo, Entrega, Licenca, Link, Ocorrencia, Store, Troca } from './tipos.ts'

export class StoreMemoria implements Store {
  clientes: Cliente[] = []
  licencas: Licenca[] = []
  ativacoes: Ativacao[] = []
  trocas: Troca[] = []
  links: Link[] = []
  codigos: Codigo[] = []
  entregas: Entrega[] = []
  ocorrencias: Ocorrencia[] = []
  private seq = 0
  private id = () => `id-${++this.seq}`

  async clientePorEmail(e: string) { return this.clientes.find((c) => c.email_compra === e) ?? null }
  async licencaDoCliente(id: string) { return this.licencas.find((l) => l.cliente_id === id) ?? null }
  async licencaPorId(id: string) { return this.licencas.find((l) => l.id === id) ?? null }
  async salvarLicenca(l: Licenca) { const i = this.licencas.findIndex((x) => x.id === l.id); this.licencas[i] = l }
  async inserirLink(l: Omit<Link, 'id' | 'usado_em'>) { this.links.push({ ...l, id: this.id(), usado_em: null }) }
  async linkPorHash(h: string) { return this.links.find((l) => l.token_hash === h) ?? null }
  async marcarLinkUsado(id: string, q: Date) { const l = this.links.find((x) => x.id === id); if (l) l.usado_em = q }
  async inserirCodigo(c: Omit<Codigo, 'id' | 'tentativas' | 'usado_em'>) {
    this.codigos.push({ ...c, id: this.id(), tentativas: 0, usado_em: null })
  }
  async codigoAberto(cid: string, f: Codigo['finalidade']) {
    return [...this.codigos].reverse().find((c) => c.cliente_id === cid && c.finalidade === f && !c.usado_em) ?? null
  }
  async salvarCodigo(c: Codigo) { const i = this.codigos.findIndex((x) => x.id === c.id); this.codigos[i] = c }
  async ativacaoAtiva(lid: string) { return this.ativacoes.find((a) => a.licenca_id === lid && a.ativo) ?? null }
  async inserirAtivacao(lid: string, hash: string, q: Date) {
    if (this.ativacoes.some((a) => a.licenca_id === lid && a.ativo)) throw new Error('índice único: já há computador ativo')
    this.ativacoes.push({ id: this.id(), licenca_id: lid, computador_hash: hash, ativo: true, ativado_em: q, desativado_em: null })
  }
  async desativarAtivacao(id: string, q: Date) {
    const a = this.ativacoes.find((x) => x.id === id)
    if (a) { a.ativo = false; a.desativado_em = q }
  }
  async trocasDa(lid: string) { return this.trocas.filter((t) => t.licenca_id === lid) }
  async inserirTroca(t: Troca) { this.trocas.push(t) }
  async inserirEntrega(e: Entrega) { this.entregas.push(e) }
  async inserirOcorrencia(o: Ocorrencia) { this.ocorrencias.push(o) }
}
