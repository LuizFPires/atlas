// Store em memória: fixture dos testes (sem conexão com Supabase).
// Os métodos "atômicos" não têm await no meio: em JS cada um roda inteiro, equivalendo ao UPDATE/RPC do Postgres.
import type { AssinaturaPush, CanalPush } from './push.ts'
import { dominioRegistravel, LIMIARES_AUDITORIA, PROVEDORES_COMUNS, protegeProvedor } from './auditoria.ts'
import type { CanalCelular, Pedido, ProjetoCelular, Referencia } from './celular.ts'
import type { Ativacao, BarradaTeste, EventoRadar, CondicaoLicenca, ConfigDegustacao, Cliente, Codigo, ContaGateway, Entrega, Licenca, LiberacaoAtomica, Link, NovaCompra, Ocorrencia, OcorrenciaAdmin, Pagamento, SessaoCheckout, Personalizacao, StatusObraLinha, StatusPagamento, Store, Troca, TrocaAtomica, EventoPolitica, SituacaoPolitica, ConviteTeste, Testador } from './tipos.ts'

export class StoreMemoria implements Store {
  clientes: Cliente[] = []
  licencas: Licenca[] = []
  ativacoes: Ativacao[] = []
  trocas: Troca[] = []
  links: Link[] = []
  codigos: Codigo[] = []
  entregas: Entrega[] = []
  ocorrencias: OcorrenciaAdmin[] = []
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
  /** Espelha o ledger degustacoes_dispositivos (0019): HMAC do computador -> licença dona. excluirConta NÃO mexe nele. */
  dispositivosTeste = new Map<string, string>()
  barradasDispositivo = new Map<string, { n: number; ultima: Date }>()
  async registrarBarradaDispositivo(hmac: string, quando: Date) {
    if (!this.dispositivosTeste.has(hmac)) return // UPDATE sem linha = nada
    this.barradasDispositivo.set(hmac, { n: (this.barradasDispositivo.get(hmac)?.n ?? 0) + 1, ultima: quando })
  }
  async computadorJaTestou(hmac: string, licencaIdAtual: string) {
    const dono = this.dispositivosTeste.get(hmac)
    return dono !== undefined && dono !== licencaIdAtual
  }
  async registrarDispositivoTeste(hmac: string, licencaId: string) {
    if (!this.dispositivosTeste.has(hmac)) this.dispositivosTeste.set(hmac, licencaId)
    return this.dispositivosTeste.get(hmac) === licencaId
  }
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
    const lic = this.licencas.find((x) => x.id === p.licenca_id)
    if (p.dispositivo_hmac && lic?.tipo === 'cortesia' && lic.origem === 'degustacao') { // espelha o ledger dentro de trocar_computador (0019)
      if (await this.computadorJaTestou(p.dispositivo_hmac, p.licenca_id)) { await this.registrarBarradaDispositivo(p.dispositivo_hmac, p.quando); return false }
      await this.registrarDispositivoTeste(p.dispositivo_hmac, p.licenca_id)
    }
    atual.ativo = false
    atual.desativado_em = p.quando
    this.ativacoes.push({ id: this.id(), licenca_id: p.licenca_id, computador_hash: p.para_hash, token_hash: p.token_hash, ativo: true, ativado_em: p.quando, desativado_em: null })
    this.trocas.push({ licenca_id: p.licenca_id, de_hash: p.de_hash, para_hash: p.para_hash, feita_em: p.quando, por_admin: p.por_admin })
    if (p.por_admin) { const l = this.licencas.find((x) => x.id === p.licenca_id); if (l) l.troca_liberada_em = null }
    return true
  }
  /** Equivale à função SQL liberar_computador. */
  async liberarAtivacao(p: LiberacaoAtomica) {
    const atual = this.ativacoes.find((x) => x.id === p.ativacao_atual_id && x.licenca_id === p.licenca_id)
    if (!atual || !atual.ativo) return false
    if (p.intervalo_ms > 0) {
      const lim = p.quando.getTime() - p.intervalo_ms
      if (this.trocas.some((t) => t.licenca_id === p.licenca_id && t.feita_em.getTime() > lim)) return false
    }
    atual.ativo = false
    atual.desativado_em = p.quando
    this.trocas.push({ licenca_id: p.licenca_id, de_hash: p.de_hash, para_hash: null, feita_em: p.quando, por_admin: p.por_admin })
    if (p.por_admin) { const l = this.licencas.find((x) => x.id === p.licenca_id); if (l) l.troca_liberada_em = null }
    return true
  }
  async trocasDa(lid: string) { return this.trocas.filter((t) => t.licenca_id === lid) }
  async inserirEntrega(e: Entrega) { this.entregas.push(e) }
  async inserirOcorrencia(o: Ocorrencia) {
    // Espelha o índice único parcial (0020): no máximo 1 ocorrência ABERTA por chave; a repetida é ignorada (ON CONFLICT DO NOTHING).
    if (o.chave && this.ocorrencias.some((x) => x.chave === o.chave && !x.resolvida)) return
    this.ocorrencias.push({
      chave: o.chave ?? null,
      id: this.id(), cliente_id: o.cliente_id, tipo: o.tipo, descricao: o.descricao, autor: o.autor ?? null,
      resolvida: o.resolvida ?? false, criada_em: o.criada_em ?? new Date(), resolvida_por: null, resolvida_em: null,
    })
  }

  statusObras: Array<StatusObraLinha & { licenca_id: string }> = []
  async substituirStatusObras(licencaId: string, obras: StatusObraLinha[]) {
    this.statusObras = this.statusObras.filter((s) => s.licenca_id !== licencaId).concat(obras.map((o) => ({ ...o, licenca_id: licencaId })))
  }
  async statusObrasDaLicenca(licencaId: string) {
    return this.statusObras.filter((s) => s.licenca_id === licencaId).map((s) => { const o: Record<string, unknown> = { ...s }; delete o.licenca_id; return o as unknown as StatusObraLinha })
  }

  personalizacoes = new Map<string, Personalizacao>()
  async salvarPersonalizacao(licencaId: string, p: Personalizacao) { this.personalizacoes.set(licencaId, { ...p }) }
  async personalizacaoDaLicenca(licencaId: string) { const p = this.personalizacoes.get(licencaId); return p ? { ...p } : null }

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
    if (ja?.tipo === 'cortesia') {
      // Espelha 0015/0019: a compra converte a cortesia em paga e zera a origem.
      Object.assign(ja, { tipo: 'paga', origem: null, validade_em: null, status: 'ativa', comprada_em: c.agora, avisos_atraso: 0, pausa_prevista_em: null, conta_gateway_id: c.conta_gateway_id, gateway_cliente_ref: c.gateway_cliente_ref, gateway_assinatura_ref: null, mensalidade_encerra_em: null })
      return { licenca: ja, nova: false }
    }
    if (ja) return { licenca: ja, nova: false }
    const licenca: Licenca = {
      id: this.id(), cliente_id: cli.id, status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null,
      comprada_em: c.agora, avisos_atraso: 0, conta_gateway_id: c.conta_gateway_id, gateway_cliente_ref: c.gateway_cliente_ref,
      gateway_assinatura_ref: null, mensalidade_encerra_em: null,
    }
    this.licencas.push(licenca)
    return { licenca, nova: true }
  }
  async idiomaDaLicenca(id: string) { return this.licencas.find((x) => x.id === id)?.idioma === 'en' ? 'en' as const : 'pt' as const }
  async definirIdiomaLicenca(id: string, idioma: 'pt' | 'en') {
    const l = this.licencas.find((x) => x.id === id)
    if (l) l.idioma = idioma
  }
  async criarCortesia(c: { email: string; nome: string; validade_em: Date; agora: Date }) {
    let cli = this.clientes.find((x) => x.email_compra === c.email)
    if (!cli) { cli = { id: this.id(), email_compra: c.email, nome_tratamento: c.nome }; this.clientes.push(cli) }
    const i = this.licencas.findIndex((l) => l.cliente_id === cli.id)
    if (i < 0) {
      const licenca: Licenca = { id: this.id(), cliente_id: cli.id, status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, comprada_em: null, avisos_atraso: 0, tipo: 'cortesia', validade_em: c.validade_em }
      this.licencas.push(licenca)
      return { resultado: 'criada' as const, licenca }
    }
    if (this.licencas[i].tipo === 'cortesia') {
      this.licencas[i] = { ...this.licencas[i], status: 'ativa', validade_em: c.validade_em }
      return { resultado: 'atualizada' as const, licenca: this.licencas[i] }
    }
    return { resultado: 'ja_tem_paga' as const, licenca: this.licencas[i] }
  }
  // ── Bloco B: degustação (espelha a migration 0016) ──
  config: ConfigDegustacao = { ativa: false, dias: 5 }
  dominiosExtras = new Set<string>()
  degustacoes: Array<{ email: string | null; email_hash: string; token_hash: string; status: 'pendente' | 'confirmada' | 'expirada'; ip: string | null; expira_em: Date; criado_em: Date; confirmado_em: Date | null; pedidos: number; variantes: number; ultimo_pedido_em: Date }> = []
  async configDegustacao() { return { ...this.config } }
  async definirConfigDegustacao(c: { ativa: boolean; dias?: number }) { this.config = { ativa: c.ativa, dias: c.dias ?? this.config.dias }; return { ...this.config } }
  async dominioBloqueado(d: string) { return this.dominiosExtras.has(d) }
  async pedirDegustacao(p: { email: string; email_hash: string; token_hash: string; ip: string; expira_em: Date; agora: Date }) {
    const ex = this.degustacoes.find((x) => x.email_hash === p.email_hash)
    if (!ex) { this.degustacoes.push({ email: p.email, email_hash: p.email_hash, token_hash: p.token_hash, status: 'pendente', ip: p.ip, expira_em: p.expira_em, criado_em: p.agora, confirmado_em: null, pedidos: 1, variantes: 0, ultimo_pedido_em: p.agora }); return 'criado' as const }
    if (ex.status === 'confirmada') { ex.pedidos++; ex.ultimo_pedido_em = p.agora; return 'ja_usada' as const }
    ex.pedidos++; ex.ultimo_pedido_em = p.agora
    if (ex.email !== p.email) ex.variantes++
    Object.assign(ex, { email: p.email, token_hash: p.token_hash, ip: p.ip, expira_em: p.expira_em, criado_em: p.agora, status: 'pendente' })
    return 'reenviado' as const
  }
  async listarDominiosBloqueados() { return [...this.dominiosExtras].sort().map((dominio) => ({ dominio, motivo: this.motivosDominio.get(dominio) ?? 'descartavel', criado_em: this.quandoDominio.get(dominio) ?? new Date(0) })) }
  private motivosDominio = new Map<string, string>()
  private quandoDominio = new Map<string, Date>()
  async adicionarDominioBloqueado(dominio: string, motivo: string, agora: Date) {
    if (this.dominiosExtras.has(dominio)) return false
    this.dominiosExtras.add(dominio); this.motivosDominio.set(dominio, motivo); this.quandoDominio.set(dominio, agora)
    return true
  }
  async removerDominioBloqueado(dominio: string) { return this.dominiosExtras.delete(dominio) }
  /** Espelha auditar_degustacao (0020): mesmos sinais, limiares e chaves. Sem e-mail cru nas descrições. */
  async auditarDegustacao(agora: Date, desde: Date) {
    const L = LIMIARES_AUDITORIA
    const antes = this.ocorrencias.length
    const abrir = async (chave: string, descricao: string) => this.inserirOcorrencia({ cliente_id: null, tipo: 'auditoria_degustacao', descricao, autor: 'auto-auditoria', resolvida: false, criada_em: agora, chave })
    const janela = this.degustacoes.filter((d) => d.ultimo_pedido_em >= desde)
    const porDominio = new Map<string, Set<string>>()
    for (const d of janela.filter((x) => x.status === 'confirmada')) { // só testes CONFIRMADOS contam para sugerir domínio
      const dom = d.email && d.email.includes('@') ? d.email.slice(d.email.indexOf('@') + 1) : ''
      if (dom) porDominio.set(dom, (porDominio.get(dom) ?? new Set()).add(d.email_hash))
    }
    for (const [dom, hashes] of porDominio) {
      if (hashes.size < L.dominio || PROVEDORES_COMUNS.has(dom) || !dominioRegistravel(dom) || protegeProvedor(dom)) continue
      if ([...this.dominiosExtras].some((b) => dom === b || dom.endsWith(`.${b}`))) continue
      await abrir(`aud:dominio:${dom}`, `Domínio suspeito no teste grátis: ${hashes.size} pessoas diferentes pediram o teste com e-mail @${dom} nos últimos dias. Se for e-mail temporário (daqueles que somem em minutos), clique em "Bloquear este domínio". Se for uma empresa de verdade, é só dar baixa.`)
    }
    const porIp = new Map<string, Set<string>>()
    for (const d of janela) if (d.ip) porIp.set(d.ip, (porIp.get(d.ip) ?? new Set()).add(d.email_hash))
    for (const [ip, hashes] of porIp) {
      if (hashes.size < L.ip) continue
      const mascara = /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? `${ip.split('.').slice(0, 2).join('.')}.*.*` : `${ip.slice(0, 9)}…`
      await abrir(`aud:ip:${ip}`, `Muitos pedidos do mesmo lugar: ${hashes.size} e-mails diferentes pediram o teste grátis a partir do IP ${mascara} nos últimos dias. Pode ser uma empresa ou escola dividindo a internet (normal), ou uma pessoa tentando muitos testes. Olhe os domínios dos e-mails; se parecer abuso, bloqueie o domínio ou desligue o teste por um tempo.`)
    }
    for (const d of janela) {
      if (d.variantes < L.tronco_variantes && d.pedidos < L.tronco_pedidos) continue
      await abrir(`aud:tronco:${d.email_hash.slice(0, 12)}`, `Uma mesma pessoa tentou o teste grátis ${d.pedidos} vezes, escrevendo o e-mail de ${d.variantes + 1} jeitos diferentes (com pontos ou "+algo" no meio). O Atlas já trata tudo isso como o mesmo e-mail e libera só 1 teste, então não precisa fazer nada; é só um aviso de que tem gente tentando burlar. Dê baixa quando quiser.`)
    }
    for (const [hmac, b] of this.barradasDispositivo) {
      if (b.ultima < desde || b.n < L.dispositivo_barradas) continue
      await abrir(`aud:disp:${hmac.slice(0, 12)}`, `Um computador (final ${hmac.slice(-6)}) foi barrado ${b.n} vezes tentando usar outro teste grátis. O Atlas já recusou todas; é só um aviso de reincidência. Se essa pessoa quiser mesmo continuar, o caminho é assinar. Dê baixa quando quiser.`)
    }
    return this.ocorrencias.length - antes
  }
  /** Espelha limpar_ips_degustacao (0017). */
  async limparIpsDegustacao(agora: Date, dias: number) {
    let n = 0
    for (const d of this.degustacoes) if (d.ip !== null && d.criado_em.getTime() < agora.getTime() - dias * 24 * 3600_000) { d.ip = null; n++ }
    return n
  }
  async criarDegustacao(p: { token_hash: string; dias: number; agora: Date }) {
    const d = this.degustacoes.find((x) => x.token_hash === p.token_hash)
    if (!d || d.email === null) return { resultado: 'token_invalido' as const }
    if (d.status === 'confirmada') return { resultado: 'ja_usada' as const }
    if (d.status === 'expirada' || d.expira_em <= p.agora) { d.status = 'expirada'; return { resultado: 'expirada' as const } }
    let cli = this.clientes.find((x) => x.email_compra === d.email)
    if (!cli) { cli = { id: this.id(), email_compra: d.email, nome_tratamento: 'Convidado' }; this.clientes.push(cli) }
    if (this.licencas.some((l) => l.cliente_id === cli.id)) return { resultado: 'ja_tem_licenca' as const, email: d.email }
    const licenca: Licenca = { id: this.id(), cliente_id: cli.id, status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, comprada_em: null, avisos_atraso: 0, tipo: 'cortesia', origem: 'degustacao', validade_em: new Date(p.agora.getTime() + p.dias * 24 * 3600_000) }
    this.licencas.push(licenca)
    Object.assign(d, { status: 'confirmada', confirmado_em: p.agora })
    return { resultado: 'criada' as const, email: d.email, licenca }
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
  // ── M33: Radar (espelha 0028) ──
  eventosDoRadar: EventoRadar[] = []
  baixasDoRadar = new Map<string, { por: string; em: Date }>()
  async registrarEventoRadar(e: EventoRadar) { this.eventosDoRadar.push({ ...e }) }
  async eventosRadar(desde: Date) { return this.eventosDoRadar.filter((e) => e.criado_em >= desde).map((e) => ({ ...e })) }
  async barradasDeTeste(desde: Date, minimo: number): Promise<BarradaTeste[]> {
    const saida: BarradaTeste[] = []
    for (const [hmac, b] of this.barradasDispositivo) {
      const lic = this.dispositivosTeste.get(hmac)
      if (lic && b.n >= minimo && b.ultima >= desde) saida.push({ dispositivo: hmac.slice(0, 8), licenca_id: lic, barradas: b.n, ultima_em: b.ultima })
    }
    return saida
  }
  async baixasRadar() { return [...this.baixasDoRadar].map(([sinal_id, b]) => ({ sinal_id, resolvida_em: b.em })) }
  async baixarSinalRadar(id: string, por: string, quando: Date) { this.baixasDoRadar.set(id, { por, em: quando }) }
  convitesTeste: ConviteTeste[] = []
  testadores: Testador[] = []
  async salvarConviteTeste(c: ConviteTeste) { this.convitesTeste = this.convitesTeste.filter((x) => x.codigo !== c.codigo); this.convitesTeste.push({ ...c }) }
  async conviteTestePorCodigo(codigo: string) { const c = this.convitesTeste.find((x) => x.codigo === codigo); return c ? { ...c } : null }
  async conviteTesteDaObra(licencaId: string, obraId: string) { const c = this.convitesTeste.find((x) => x.licenca_id === licencaId && x.obra_id === obraId); return c ? { ...c } : null }
  async registrarTestador(t: Testador) { this.testadores.push({ ...t }) }
  async testadoresDoConvite(codigo: string) { return this.testadores.filter((t) => t.codigo === codigo).map((t) => ({ ...t })) }
  eventosDaPolitica: EventoPolitica[] = []
  situacoesDaPolitica: SituacaoPolitica[] = []
  async registrarEventoPolitica(e: EventoPolitica) { this.eventosDaPolitica.push({ ...e }) }
  async eventosPoliticaDaObra(licencaId: string, obraId: string, desde: Date) { return this.eventosDaPolitica.filter((e) => e.licenca_id === licencaId && e.obra_id === obraId && e.criado_em >= desde).map((e) => ({ ...e })) }
  async eventosPoliticaRecentes(desde: Date, limite: number) { return this.eventosDaPolitica.filter((e) => e.criado_em >= desde).sort((a, b) => b.criado_em.getTime() - a.criado_em.getTime()).slice(0, limite).map((e) => ({ ...e })) }
  async situacoesPolitica(licencaId: string) { return this.situacoesDaPolitica.filter((s) => s.licenca_id === licencaId).map((s) => ({ ...s })) }
  async situacoesPoliticaAbertas() { return this.situacoesDaPolitica.filter((s) => s.situacao === 'embargada' || s.situacao === 'recusada').map((s) => ({ ...s })) }
  async definirSituacaoPolitica(s: SituacaoPolitica) {
    this.situacoesDaPolitica = this.situacoesDaPolitica.filter((x) => !(x.licenca_id === s.licenca_id && x.obra_id === s.obra_id))
    this.situacoesDaPolitica.push({ ...s })
  }
  async limparEventosRadar(antes: Date) { const n = this.eventosDoRadar.length; this.eventosDoRadar = this.eventosDoRadar.filter((e) => e.criado_em >= antes); return n - this.eventosDoRadar.length }

  async clientePorId(id: string) { return this.clientes.find((c) => c.id === id) ?? null }

  async clientePorAuthUser(id: string) { return this.clientes.find((c) => c.auth_user_id === id) ?? null }
  async vincularAuthUser(clienteId: string, authUserId: string) {
    const c = this.clientes.find((x) => x.id === clienteId)
    if (!c || c.auth_user_id) return false
    c.auth_user_id = authUserId
    return true
  }

  async salvarCadastro(clienteId: string, c: { nome: string; empresa: string; ramo: string; cidade?: string | null; uf?: string | null }, quando: Date) {
    const cli = this.clientes.find((x) => x.id === clienteId)
    if (!cli || cli.cadastro_em) return false
    Object.assign(cli, { nome_tratamento: c.nome, empresa: c.empresa, ramo: c.ramo, cadastro_em: quando, cidade: c.cidade ?? null, uf: c.uf ?? null })
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
  consentimentos: Array<{ email: string; cliente_id: string | null; versao_termos: string; origem: string; aceito_em: Date }> = []
  async registrarConsentimento(email: string, versao: string, origem: 'checkout', quando: Date) {
    this.consentimentos.push({ email, cliente_id: null, versao_termos: versao, origem, aceito_em: quando })
  }
  /** Espelha a RPC excluir_conta (0012): anonimiza o cliente e apaga o que é só dele; mantém pagamentos (obrigação fiscal). */
  async excluirConta(clienteId: string, quando: Date) {
    const cli = this.clientes.find((x) => x.id === clienteId)
    if (!cli) return false
    if (cli.excluido_em) return true // idempotente, como a RPC
    const email = cli.email_compra
    const lics = this.licencas.filter((l) => l.cliente_id === clienteId).map((l) => l.id)
    Object.assign(cli, { email_compra: `excluido+${clienteId}@anonimo.invalid`, nome_tratamento: 'Conta excluída', empresa: null, ramo: null, cidade: null, uf: null, excluido_em: quando })
    for (const l of this.licencas) if (lics.includes(l.id)) Object.assign(l, { status: 'cancelada', pausa_prevista_em: null, troca_liberada_em: null, gateway_cliente_ref: null, gateway_assinatura_ref: null })
    this.ativacoes = this.ativacoes.filter((a) => !lics.includes(a.licenca_id))
    this.trocas = this.trocas.filter((t) => !lics.includes(t.licenca_id))
    this.ocorrencias = this.ocorrencias.filter((o) => o.cliente_id !== clienteId)
    this.links = this.links.filter((x) => x.cliente_id !== clienteId)
    this.codigos = this.codigos.filter((x) => x.cliente_id !== clienteId)
    this.sessoes = this.sessoes.filter((s) => s.email !== email)
    for (const d of this.degustacoes) if (d.email === email) Object.assign(d, { email: null, ip: null, token_hash: `anon-${d.email_hash}`, status: d.status === 'pendente' ? 'expirada' : d.status }) // espelha 0017
    for (const c of this.consentimentos) if (c.email === email) Object.assign(c, { email: `excluido+${clienteId}@anonimo.invalid`, cliente_id: clienteId })
    return true
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

  async listarClientes() { return this.clientes.map((c) => ({ ...c })) }
  async listarLicencas() { return this.licencas.map((l) => ({ ...l })) }
  async listarPagamentos() { return this.pagamentos.map((p) => ({ ...p })) }
  async listarAtivacoes() { return this.ativacoes.map((a) => ({ ...a })) }
  async listarTrocas() { return this.trocas.map((t) => ({ ...t })) }
  async ocorrenciasAbertas(limite: number) {
    return this.ocorrencias.filter((o) => !o.resolvida).sort((a, b) => b.criada_em.getTime() - a.criada_em.getTime()).slice(0, limite).map((o) => ({ ...o }))
  }
  async resolverOcorrencia(id: string, por: string, quando: Date) {
    const o = this.ocorrencias.find((x) => x.id === id)
    if (!o || o.resolvida) return false
    Object.assign(o, { resolvida: true, resolvida_por: por, resolvida_em: quando })
    return true
  }
  async entregasRecentes(limite: number) { return [...this.entregas].sort((a, b) => b.baixado_em.getTime() - a.baixado_em.getTime()).slice(0, limite) }
  async entregasDaLicenca(licencaId: string, limite: number) { return (await this.entregasRecentes(Infinity)).filter((e) => e.licenca_id === licencaId).slice(0, limite) }
  async entregasPorMarca(marca: string) { return this.entregas.filter((e) => e.marca_dagua === marca) }
}

/** M33: canal celular ↔ computador em memória (testes e modo fixture). Espelha as regras das tabelas celular_* (0029). */
/** M41: assinaturas de aviso no celular, em memória (testes). */
export function criarCanalPushMemoria(): CanalPush {
  const porLicenca = new Map<string, AssinaturaPush[]>()
  return {
    async guardar(l, a) { const xs = (porLicenca.get(l) ?? []).filter((x) => x.endpoint !== a.endpoint); xs.push(a); porLicenca.set(l, xs) },
    async listar(l) { return (porLicenca.get(l) ?? []).slice() },
    async apagar(l, endpoint) { porLicenca.set(l, (porLicenca.get(l) ?? []).filter((x) => x.endpoint !== endpoint)) },
  }
}

export function criarCanalCelularMemoria() {
  const sinais = new Map<string, { visto_em: Date; ocupado: string | null }>()
  const pedidos: Pedido[] = []
  const projetos = new Map<string, ProjetoCelular>()
  const referencias = new Map<string, Referencia>()
  const copia = <T>(x: T): T => structuredClone(x)
  const canal: CanalCelular & { pedidos: Pedido[]; referencias: Map<string, Referencia> } = {
    pedidos, referencias,
    async sinal(l, agora, ocupado) { sinais.set(l, { visto_em: agora, ocupado }) },
    async ultimoSinal(l) { const s = sinais.get(l); return s ? copia(s) : null },
    async criarPedido(p) { pedidos.push(copia(p)) },
    async contarAbertos(l) { return pedidos.filter((p) => p.licenca_id === l && (p.estado === 'pendente' || p.estado === 'entregue')).length },
    async levarPedidos(l, agora, reentregaMs, limite) {
      const prontos = pedidos.filter((p) => p.licenca_id === l && (p.estado === 'pendente' || (p.estado === 'entregue' && p.entregue_em && agora.getTime() - p.entregue_em.getTime() > reentregaMs)))
        .sort((a, b) => a.criado_em.getTime() - b.criado_em.getTime()).slice(0, limite)
      for (const p of prontos) { p.estado = 'entregue'; p.entregue_em = agora }
      return prontos.map(copia)
    },
    async responder(l, id, estado, mensagem) {
      const p = pedidos.find((x) => x.id === id && x.licenca_id === l)
      if (!p) return false
      p.estado = estado; p.mensagem = mensagem
      return true
    },
    async pedidosRecentes(l, limite) { return pedidos.filter((p) => p.licenca_id === l).sort((a, b) => b.criado_em.getTime() - a.criado_em.getTime()).slice(0, limite).map(copia) },
    async salvarProjeto(l, p) { projetos.set(`${l}|${p.obra_id}`, copia(p)) },
    async projetos(l) { return [...projetos.entries()].filter(([k]) => k.startsWith(`${l}|`)).map(([, v]) => copia(v)).sort((a, b) => b.atualizado_em.getTime() - a.atualizado_em.getTime()) },
    async guardarReferencia(id, r) { referencias.set(id, copia(r)) },
    async contarReferencias(l) { return [...referencias.values()].filter((r) => r.licenca_id === l).length },
    async tirarReferencia(l, id) { const r = referencias.get(id); if (!r || r.licenca_id !== l) return null; referencias.delete(id); return r },
    async referenciaExiste(l, id) { return referencias.get(id)?.licenca_id === l },
  }
  return canal
}
