// M7 — Painel do administrador (F16), lado do servidor.
// Regra de ouro: TODA função daqui começa em `adminLogado`. O JWT do Supabase Auth é validado NO SERVIDOR
// (não basta existir) e o e-mail confirmado precisa estar na allowlist ATLAS_ADMIN_EMAILS (ambiente do servidor).
// Cliente comum, mesmo logado no portal, recebe 403. Lista vazia = ninguém é admin (fail-closed).
// O painel mostra agregados e dados operacionais: nunca token_hash, hash de computador, refs/contas do gateway ou chaves.
import { gerarLink } from './links.ts'
import { REGIAO_DA_UF, type Regiao, UFS } from './geo.ts'
import type { IdentidadePortal } from './portal.ts'
import { VALOR_MENSALIDADE } from './pagamento/config.ts'
import { type Cliente, type Deps, ErroRegra, type OcorrenciaAdmin } from './tipos.ts'

export interface DepsAdmin extends Deps {
  /** Mesma validação do portal: GET /auth/v1/user com o token; exige e-mail confirmado. null = inválido/vencido. */
  autenticarPortal: (jwt: string) => Promise<IdentidadePortal | null>
  /** Allowlist de admins (ATLAS_ADMIN_EMAILS, separada por vírgula). */
  emailsAdmin: readonly string[]
  /** Envia o e-mail da cortesia (link de instalação de uso único). Produção: adaptador de e-mail (Resend). Ausente = não envia (email_enviado: false). */
  enviarCortesia?: (email: string, dados: { token: string; expira_em: Date; validade_em: Date }) => Promise<void>
}

export interface IdentidadeAdmin { auth_user_id: string; email: string }

/** Cliente sem computador ativo por mais de 48 h depois do último passo (o link de instalação vale ~48 h) está "travado". */
export const LIMITE_TRAVADO_MS = 48 * 3600_000
export const META_ATIVACOES_MES = 100

const norm = (e: string) => e.trim().toLowerCase()
const semLogin = () => new ErroRegra('nao_autenticado', 'Entre de novo para continuar.', 401)
const semAcesso = () => new ErroRegra('sem_acesso', 'Esta área é só do administrador do Atlas.', 403)

/** Lê ATLAS_ADMIN_EMAILS ("a@x.com, b@y.com") em lista normalizada. */
export const lerEmailsAdmin = (bruto: string | undefined | null): string[] =>
  (bruto ?? '').split(',').map(norm).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

export async function adminLogado(d: DepsAdmin, jwt: string): Promise<IdentidadeAdmin> {
  const token = (jwt ?? '').trim()
  if (!token) throw semLogin()
  const id = await d.autenticarPortal(token)
  if (!id || !id.auth_user_id || !id.email) throw semLogin()
  const email = norm(id.email)
  if (!d.emailsAdmin.some((a) => a === email)) {
    // Quem tenta e não é admin (inclusive cliente logado no portal) gasta um balde pequeno: barra sondagem.
    if (!(await d.store.tentarEvento(`admin:negado:${id.auth_user_id}`, 5, 15 * 60_000, d.agora()))) {
      throw new ErroRegra('muitas_solicitacoes', 'Muitas tentativas. Espere um pouco.', 429)
    }
    throw semAcesso()
  }
  if (!(await d.store.tentarEvento(`admin:uso:${id.auth_user_id}`, 300, 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas ações seguidas. Espere um minuto.', 429)
  }
  return { auth_user_id: id.auth_user_id, email }
}

export async function euAdmin(d: DepsAdmin, jwt: string) {
  const a = await adminLogado(d, jwt)
  return { email: a.email }
}

// ── indicadores ────────────────────────────────────────────────────────────────
const BRT_MS = 3 * 3600_000
/** Primeiro instante do mês corrente no horário de Brasília (UTC-3, sem horário de verão). */
export function inicioDoMes(agora: Date): Date {
  const l = new Date(agora.getTime() - BRT_MS)
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) + BRT_MS)
}

export type SituacaoCliente = 'em_dia' | 'atrasada' | 'pausada' | 'cancelada' | 'ativando'

export interface IndicadoresAdmin {
  /** Clientes com licença em dia (ativa). */
  clientes_ativos: number
  receita: { recorrente_mensal: number; recebida_no_mes: number; implantacoes_recebidas_no_mes: number }
  ativacoes: { no_mes: number; meta: number; computadores_ativos: number }
  inadimplencia: { atrasadas: number; pausadas: number; valor_em_aberto: number }
  travados: number
  /** Cancelamentos pedidos/ocorridos no mês corrente (licenças com cancelada_em no mês). */
  cancelamentos_no_mes: number
}

export interface LinhaCliente {
  licenca_id: string
  nome: string
  empresa: string
  ramo: string
  situacao: SituacaoCliente
  tipo: 'paga' | 'cortesia'
  /** Cortesia: até quando vale. Nulo nas pagas. */
  validade_em: Date | null
  /** Obras diferentes que o kit entregou a este cliente. */
  obras: number
  ultimo_sinal_em: Date | null
  /** Onde o cliente parou, se está travado. */
  travado_em: 'cadastro' | 'instalacao' | null
}

export interface ItemAtencao {
  id: string
  tipo: string
  quem: string
  oque: string
  quando: Date
  /** Presente quando a ação "liberar troca urgente" faz sentido para este item. */
  licenca_id: string | null
  /** Auditoria da degustação: domínio sugerido para bloquear (botão "Bloquear este domínio"). */
  dominio_sugerido?: string
}

const rotuloCliente = (c: Cliente | undefined) => (c ? c.empresa?.trim() || c.nome_tratamento : 'Atlas')
const maior = (...ds: Array<Date | null | undefined>) => ds.reduce<Date | null>((m, x) => (x && (!m || x > m) ? x : m), null)

/** Painel completo (itens 1 e 2 do M7): indicadores, "precisam de atenção" e a tabela de clientes. */
export async function painel(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const agora = d.agora()
  const mes = inicioDoMes(agora)
  const s = d.store
  const [clientes, licencas, ativacoes, trocas, pagamentos, entregas, ocorrencias] = await Promise.all([
    s.listarClientes(), s.listarLicencas(), s.listarAtivacoes(), s.listarTrocas(), s.listarPagamentos(), s.entregasRecentes(5000), s.ocorrenciasAbertas(20),
  ])
  const porCliente = new Map(clientes.map((c) => [c.id, c]))

  const linhas: LinhaCliente[] = []
  for (const l of licencas) {
    const c = porCliente.get(l.cliente_id)
    if (!c) continue
    const ativs = ativacoes.filter((a) => a.licenca_id === l.id)
    const temComputador = ativs.some((a) => a.ativo)
    const entregasL = entregas.filter((e) => e.licenca_id === l.id)
    const ultimaTroca = maior(...trocas.filter((t) => t.licenca_id === l.id).map((t) => t.feita_em))
    const sinal = maior(...entregasL.map((e) => e.baixado_em), ...ativs.map((a) => a.ativado_em), ...ativs.map((a) => a.desativado_em))
    const marco = maior(c.cadastro_em ?? l.comprada_em ?? null, ultimaTroca)
    const aberta = l.status === 'ativa' || l.status === 'atrasada'
    const travado = aberta && !temComputador && !!marco && agora.getTime() - marco.getTime() > LIMITE_TRAVADO_MS
    linhas.push({
      licenca_id: l.id,
      nome: c.nome_tratamento,
      empresa: c.empresa ?? '',
      ramo: c.ramo ?? '',
      tipo: l.tipo === 'cortesia' ? 'cortesia' : 'paga',
      validade_em: l.tipo === 'cortesia' ? (l.validade_em ?? null) : null,
      situacao: cortesiaVencida(l, agora) ? 'cancelada' : l.status === 'ativa' ? (ativs.length === 0 ? 'ativando' : 'em_dia') : l.status === 'atrasada' ? 'atrasada' : l.status === 'pausada' ? 'pausada' : 'cancelada',
      obras: new Set(entregasL.map((e) => e.obra_id)).size,
      ultimo_sinal_em: sinal,
      travado_em: travado ? (c.cadastro_em ? 'instalacao' : 'cadastro') : null,
    })
  }
  // Travados primeiro, depois atrasados, depois o sinal mais recente.
  const peso = (x: LinhaCliente) => (x.travado_em ? 0 : x.situacao === 'atrasada' || x.situacao === 'pausada' ? 1 : 2)
  linhas.sort((a, b) => peso(a) - peso(b) || (b.ultimo_sinal_em?.getTime() ?? 0) - (a.ultimo_sinal_em?.getTime() ?? 0))

  const noMes = pagamentos.filter((p) => p.status === 'pago' && p.pago_em && p.pago_em >= mes)
  const comMensalidade = licencas.filter((l) => (l.status === 'ativa' || l.status === 'atrasada') && !!l.gateway_assinatura_ref && !l.mensalidade_encerra_em)
  const primeiraAtivacao = new Map<string, Date>()
  for (const a of ativacoes) {
    const x = primeiraAtivacao.get(a.licenca_id)
    if (!x || a.ativado_em < x) primeiraAtivacao.set(a.licenca_id, a.ativado_em)
  }
  const atrasadas = licencas.filter((l) => l.status === 'atrasada').length
  const pausadas = licencas.filter((l) => l.status === 'pausada').length

  const indicadores: IndicadoresAdmin = {
    clientes_ativos: licencas.filter((l) => l.status === 'ativa' && !cortesiaVencida(l, agora)).length,
    receita: {
      recorrente_mensal: comMensalidade.length * VALOR_MENSALIDADE,
      recebida_no_mes: noMes.reduce((t, p) => t + p.valor, 0),
      implantacoes_recebidas_no_mes: noMes.filter((p) => p.tipo === 'implantacao').length,
    },
    ativacoes: {
      no_mes: [...primeiraAtivacao.values()].filter((q) => q >= mes).length,
      meta: META_ATIVACOES_MES,
      computadores_ativos: ativacoes.filter((a) => a.ativo).length,
    },
    inadimplencia: { atrasadas, pausadas, valor_em_aberto: (atrasadas + pausadas) * VALOR_MENSALIDADE },
    travados: linhas.filter((x) => x.travado_em).length,
    cancelamentos_no_mes: licencas.filter((l) => !!l.cancelada_em && l.cancelada_em >= mes).length,
  }

  const licDoCliente = new Map(licencas.map((l) => [l.cliente_id, l.id]))
  const atencao: ItemAtencao[] = ocorrencias.map((o: OcorrenciaAdmin) => ({
    id: o.id,
    tipo: o.tipo,
    quem: rotuloCliente(o.cliente_id ? porCliente.get(o.cliente_id) : undefined),
    oque: o.descricao,
    quando: o.criada_em,
    licenca_id: o.tipo === 'troca_antecipada' && o.cliente_id ? (licDoCliente.get(o.cliente_id) ?? null) : null,
    ...(o.chave?.startsWith('aud:dominio:') ? { dominio_sugerido: o.chave.slice('aud:dominio:'.length) } : {}),
  }))
  return { gerado_em: agora, indicadores, atencao, clientes: linhas.slice(0, 500) }
}

/** Dá baixa numa ocorrência (auditado: quem e quando). */
export async function resolverOcorrencia(d: DepsAdmin, jwt: string, id: unknown) {
  const adm = await adminLogado(d, jwt)
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new ErroRegra('ocorrencia_invalida', 'Ocorrência inválida.', 400)
  if (!(await d.store.resolverOcorrencia(id, adm.email, d.agora()))) throw new ErroRegra('ocorrencia_nao_encontrada', 'Essa ocorrência não existe ou já foi resolvida.', 404)
  return { ok: true }
}

// ── cortesia manual ────────────────────────────────────────────────────────────
export const CORTESIA_MAX_DIAS = 180
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Libera (ou renova) uma cortesia para um e-mail, com a data de vencimento escolhida pelo gestor.
 * Tudo é validado AQUI: e-mail válido, vencimento no futuro e até CORTESIA_MAX_DIAS dias. Idempotente (mesmo e-mail renova a cortesia).
 * E-mail que já tem licença paga não é alterado. Fica registrado em ocorrencias_admin (quem, quando, até quando).
 */
export async function liberarCortesia(d: DepsAdmin, jwt: string, a: { email: unknown; validade_em: unknown; nome?: unknown; silencioso?: unknown }) {
  const adm = await adminLogado(d, jwt)
  const email = typeof a.email === 'string' ? norm(a.email) : ''
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.', 400)
  const bruto = typeof a.validade_em === 'string' ? a.validade_em.trim() : ''
  const validade = new Date(bruto)
  if (!bruto || Number.isNaN(validade.getTime())) throw new ErroRegra('validade_invalida', 'Escolha a data de vencimento da cortesia.', 400)
  const agora = d.agora()
  if (validade.getTime() <= agora.getTime()) throw new ErroRegra('validade_no_passado', 'A data de vencimento precisa ser no futuro.', 400)
  if (validade.getTime() > agora.getTime() + CORTESIA_MAX_DIAS * 24 * 3600_000) throw new ErroRegra('validade_longe_demais', `A cortesia pode durar no máximo ${CORTESIA_MAX_DIAS} dias.`, 400)
  const nome = limparMotivo(a.nome).slice(0, 80) || 'Convidado'
  const r = await d.store.criarCortesia({ email, nome, validade_em: validade, agora })
  if (r.resultado === 'ja_tem_paga') throw new ErroRegra('ja_tem_licenca_paga', 'Essa pessoa já tem uma licença paga. Não precisa de cortesia.', 409)
  await d.store.inserirOcorrencia({ cliente_id: r.licenca.cliente_id, tipo: 'cortesia', descricao: `Cortesia ${r.resultado === 'criada' ? 'liberada' : 'renovada'} até ${validade.toISOString()}`, autor: adm.email, resolvida: true, criada_em: agora })
  // silencioso (estender prazo): só suprime o aviso; as validações acima valem igual. Só o booleano true conta.
  const email_enviado = a.silencioso === true ? false : await enviarEmailCortesia(d, email, validade)
  return { ok: true, nova: r.resultado === 'criada', licenca_id: r.licenca.id, validade_em: validade, email_enviado }
}

/**
 * Gera um link de instalação de uso único e manda o e-mail da cortesia. NUNCA lança: se o link ou o envio falhar, a cortesia
 * continua valendo e devolve false (o gestor pode reenviar). Token e erro do provedor não vão para log.
 */
async function enviarEmailCortesia(d: DepsAdmin, email: string, validade: Date): Promise<boolean> {
  if (!d.enviarCortesia) return false
  let etapa = 'gerar_link'
  try {
    const link = await gerarLink(d, email)
    etapa = 'enviar'
    await d.enviarCortesia(email, { token: link.token, expira_em: link.expira_em, validade_em: validade })
    return true
  } catch (e) {
    // Só a etapa e o nome do erro (curto, sem mensagem): a mensagem poderia carregar token, chave ou e-mail.
    const nome = e instanceof Error && /^\w{1,40}$/.test(e.name) ? e.name : 'desconhecido'
    console.error(`cortesia_email_falhou etapa=${etapa} erro=${nome}`)
    return false
  }
}

/** Reenvia o e-mail da cortesia (novo link de uso único; o anterior continua valendo até vencer ou ser usado). Exige cortesia ativa e dentro do prazo. */
export async function reenviarCortesia(d: DepsAdmin, jwt: string, a: { email: unknown }) {
  await adminLogado(d, jwt)
  const email = typeof a.email === 'string' ? norm(a.email) : ''
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ErroRegra('email_invalido', 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.', 400)
  const cli = await d.store.clientePorEmail(email)
  const lic = cli && (await d.store.licencaDoCliente(cli.id))
  if (!lic || lic.tipo !== 'cortesia' || lic.status !== 'ativa' || cortesiaVencida(lic, d.agora()) || !lic.validade_em) {
    throw new ErroRegra('sem_cortesia', 'Não há uma cortesia ativa para esse e-mail. Libere a cortesia primeiro.', 404)
  }
  return { ok: true, email_enviado: await enviarEmailCortesia(d, email, lic.validade_em) }
}

/** Cortesias em vigor (tipo cortesia, ativa, dentro do prazo): só e-mail, nome e validade — o que o gestor precisa para estender. */
export async function listarCortesias(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const agora = d.agora()
  const [clientes, licencas] = await Promise.all([d.store.listarClientes(), d.store.listarLicencas()])
  const porCliente = new Map(clientes.map((c) => [c.id, c]))
  const cortesias: Array<{ email: string; nome: string; validade_em: string }> = []
  for (const l of licencas) {
    if (l.tipo !== 'cortesia' || l.status !== 'ativa' || cortesiaVencida(l, agora) || !l.validade_em) continue
    const c = porCliente.get(l.cliente_id)
    if (!c || c.excluido_em) continue
    cortesias.push({ email: c.email_compra, nome: c.nome_tratamento, validade_em: l.validade_em.toISOString() })
  }
  cortesias.sort((a, b) => a.validade_em.localeCompare(b.validade_em) || a.email.localeCompare(b.email))
  return { cortesias }
}

/** Cortesia cujo prazo passou (status ainda 'ativa' no banco até alguém verificar). Cortesia sem prazo conta como vencida (fail-closed). */
export const cortesiaVencida = (l: { tipo?: string; validade_em?: Date | null }, agora: Date) =>
  l.tipo === 'cortesia' && (!l.validade_em || l.validade_em.getTime() <= agora.getTime())

// ── ações ──────────────────────────────────────────────────────────────────────
const ID_RE = /^[\w-]{1,64}$/
const limparMotivo = (m: unknown) => (typeof m === 'string' ? [...m].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim() : '')

/**
 * Liberar troca urgente: ignora UMA vez o limite de 1 troca a cada 7 dias (o M2/M6 consomem o override na troca).
 * Exige motivo (vai para o registro) e grava quem/quando em ocorrencias_admin. Idempotente: liberar de novo não duplica.
 */
export async function liberarTrocaUrgente(d: DepsAdmin, jwt: string, a: { licenca_id: unknown; motivo: unknown }) {
  const adm = await adminLogado(d, jwt)
  if (typeof a.licenca_id !== 'string' || !ID_RE.test(a.licenca_id)) throw new ErroRegra('licenca_invalida', 'Licença inválida.', 400)
  const motivo = limparMotivo(a.motivo)
  if (motivo.length < 5 || motivo.length > 300) throw new ErroRegra('motivo_invalido', 'Conte o motivo em poucas palavras (de 5 a 300 letras).', 400)
  const lic = await d.store.licencaPorId(a.licenca_id)
  if (!lic) throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  if (lic.status === 'cancelada') throw new ErroRegra('licenca_cancelada', 'Essa licença está cancelada.', 409)
  if (lic.troca_liberada_em) return { ok: true, ja_liberada: true }
  if (!(await d.store.atualizarLicencaSe(lic.id, { troca_liberada_em: d.agora() }, { status_diferente: 'cancelada' }))) {
    throw new ErroRegra('troca_conflito', 'A licença mudou agora há pouco. Abra o painel de novo.', 409)
  }
  await d.store.inserirOcorrencia({ cliente_id: lic.cliente_id, tipo: 'override_troca', descricao: `Troca urgente liberada: ${motivo}`, autor: adm.email, resolvida: true, criada_em: d.agora() })
  // O pedido do cliente ("tentou trocar antes do prazo") está atendido.
  for (const o of await d.store.ocorrenciasAbertas(200)) {
    if (o.cliente_id === lic.cliente_id && o.tipo === 'troca_antecipada') await d.store.resolverOcorrencia(o.id, adm.email, d.agora())
  }
  return { ok: true, ja_liberada: false }
}

export interface LinhaEntrega { licenca_id: string; cliente: string; obra_id: string; marca_dagua: string; baixado_em: Date }

/** Ver entregas e marca d'água: as últimas, as de uma licença ou quem recebeu uma marca (rastrear vazamento). */
export async function verEntregas(d: DepsAdmin, jwt: string, a: { licenca_id?: unknown; marca?: unknown }) {
  await adminLogado(d, jwt)
  const marca = typeof a.marca === 'string' ? a.marca.trim() : ''
  const licId = typeof a.licenca_id === 'string' ? a.licenca_id.trim() : ''
  if (marca && !/^[\w.:-]{8,128}$/.test(marca)) throw new ErroRegra('marca_invalida', 'Essa marca não parece uma marca d\'água do Atlas.', 400)
  if (licId && !ID_RE.test(licId)) throw new ErroRegra('licenca_invalida', 'Licença inválida.', 400)
  const lista = marca ? await d.store.entregasPorMarca(marca) : licId ? await d.store.entregasDaLicenca(licId, 200) : await d.store.entregasRecentes(100)
  const [clientes, licencas] = await Promise.all([d.store.listarClientes(), d.store.listarLicencas()])
  const cli = new Map(clientes.map((c) => [c.id, c]))
  const lic = new Map(licencas.map((l) => [l.id, l]))
  const entregas: LinhaEntrega[] = lista.map((e) => ({
    licenca_id: e.licenca_id,
    cliente: rotuloCliente(cli.get(lic.get(e.licenca_id)?.cliente_id ?? '')),
    obra_id: e.obra_id,
    marca_dagua: e.marca_dagua,
    baixado_em: e.baixado_em,
  }))
  return { entregas }
}

export interface LinhaCadastro { licenca_id: string; nome: string; empresa: string; ramo: string; email: string; cadastro_em: Date | null; comprada_em: Date | null; situacao: 'feito' | 'pendente' }

/** Ver cadastros: as respostas de cada cliente (nome, empresa, ramo, e-mail) e quem ainda não respondeu. */
export async function verCadastros(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const [clientes, licencas] = await Promise.all([d.store.listarClientes(), d.store.listarLicencas()])
  const lic = new Map(licencas.map((l) => [l.cliente_id, l]))
  const cadastros: LinhaCadastro[] = []
  for (const c of clientes) {
    const l = lic.get(c.id)
    if (!l) continue
    cadastros.push({ licenca_id: l.id, nome: c.nome_tratamento, empresa: c.empresa ?? '', ramo: c.ramo ?? '', email: c.email_compra, cadastro_em: c.cadastro_em ?? null, comprada_em: l.comprada_em ?? null, situacao: c.cadastro_em ? 'feito' : 'pendente' })
  }
  cadastros.sort((x, y) => (y.comprada_em?.getTime() ?? 0) - (x.comprada_em?.getTime() ?? 0))
  return { cadastros: cadastros.slice(0, 500) }
}

// ── mapa de clientes (por estado e por cidade) ───────────────────────────────────
export interface LinhaUf { uf: string; regiao: Regiao; clientes: number; compras: number }
export interface CidadeCliente { uf: string; cidade: string; clientes: number }

/**
 * Mapa do Brasil: clientes PAGANTES por estado e por cidade, a partir do que o próprio cliente informou no cadastro (clientes.cidade/uf).
 * Pagante = licença paga (não cortesia/teste), já comprada, não cancelada e conta não excluída. Cliente sem UF (cadastro antigo ou ainda
 * não feito) fica fora do mapa (não se chuta estado); sem cidade conta só no estado. `total` = soma dos estados, e a soma das cidades
 * nunca passa do total do estado. `compras` = pagamentos de compra (implantação ou app pronto) recebidos desses clientes; mensalidade não conta.
 * Só agregado: nada de nome, e-mail ou IP sai daqui.
 */
export async function mapa(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const [clientes, licencas, pagamentos] = await Promise.all([d.store.listarClientes(), d.store.listarLicencas(), d.store.listarPagamentos()])
  const licDoCliente = new Map(licencas.map((l) => [l.cliente_id, l]))
  const comprasDaLicenca = new Map<string, number>()
  for (const p of pagamentos) if (p.status === 'pago' && p.tipo !== 'mensalidade') comprasDaLicenca.set(p.licenca_id, (comprasDaLicenca.get(p.licenca_id) ?? 0) + 1)
  const porUf = new Map<string, LinhaUf>(UFS.map((uf) => [uf, { uf, regiao: REGIAO_DA_UF[uf], clientes: 0, compras: 0 }]))
  const porCidade = new Map<string, CidadeCliente>()
  let total = 0
  for (const c of clientes) {
    const l = licDoCliente.get(c.id)
    if (!l || c.excluido_em || l.tipo === 'cortesia' || l.status === 'cancelada' || !l.comprada_em) continue
    const linha = c.uf ? porUf.get(c.uf) : undefined
    if (!linha) continue
    linha.clientes += 1
    linha.compras += comprasDaLicenca.get(l.id) ?? 0
    total += 1
    const cidade = (c.cidade ?? '').trim()
    if (cidade) {
      const k = `${c.uf}|${cidade.toLocaleLowerCase('pt-BR')}`
      const x = porCidade.get(k)
      if (x) x.clientes += 1
      else porCidade.set(k, { uf: c.uf as string, cidade, clientes: 1 })
    }
  }
  return {
    ligado: true,
    total,
    por_uf: [...porUf.values()],
    por_cidade: [...porCidade.values()].sort((a, b) => b.clientes - a.clientes || a.uf.localeCompare(b.uf) || a.cidade.localeCompare(b.cidade, 'pt-BR')),
    atualizado_em: d.agora(),
  }
}

// ── fluxo de caixa (só entradas) ────────────────────────────────────────────────
export const MESES_DO_FLUXO = 12
export interface MesCaixa { mes: string; implantacoes: number; prateleira: number; mensalidades: number; total: number }

/** AAAA-MM no horário de Brasília (o mesmo corte do "mês corrente" do painel). */
const chaveMes = (d: Date) => {
  const l = new Date(d.getTime() - BRT_MS)
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Entradas por mês (em reais) da receita do Atlas, dos últimos MESES_DO_FLUXO meses (o corrente incluso, meses sem venda = 0).
 * Fonte: tabela `pagamentos`, só os de status 'pago', agrupados pelo mês de `pago_em` (Brasília):
 *   implantacoes = tipo 'implantacao' sem segmento · prateleira = tipo 'implantacao' com segmento (app pronto) · mensalidades = tipo 'mensalidade'.
 * Estornado/falhou/pendente não entra (um arrependimento tira a venda do mês). Cortesia e teste grátis não geram pagamento, então não aparecem.
 * Saídas (despesas) NÃO existem ainda: o fluxo é só de entradas e a resposta diz isso.
 */
export async function fluxoCaixa(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const agora = d.agora()
  const meses = new Map<string, MesCaixa>()
  const l = new Date(agora.getTime() - BRT_MS)
  for (let i = MESES_DO_FLUXO - 1; i >= 0; i--) {
    const chave = chaveMes(new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() - i, 15) + BRT_MS))
    meses.set(chave, { mes: chave, implantacoes: 0, prateleira: 0, mensalidades: 0, total: 0 })
  }
  for (const p of await d.store.listarPagamentos()) {
    if (p.status !== 'pago' || !p.pago_em) continue
    const m = meses.get(chaveMes(p.pago_em))
    if (!m) continue // fora da janela
    if (p.tipo === 'mensalidade') m.mensalidades += p.valor
    else if (p.segmento) m.prateleira += p.valor
    else m.implantacoes += p.valor
    m.total += p.valor
  }
  const arred = (n: number) => Math.round(n * 100) / 100
  return {
    ligado: true,
    meses: [...meses.values()].map((m) => ({ mes: m.mes, implantacoes: arred(m.implantacoes), prateleira: arred(m.prateleira), mensalidades: arred(m.mensalidades), total: arred(m.total) })),
    saidas_ligado: false,
    mensagem: 'Só entradas por enquanto: as despesas ainda não são registradas.',
  }
}
