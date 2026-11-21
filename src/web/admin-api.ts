// Painel do administrador (F16) — cliente da API. Só o Luiz usa. O login é o mesmo do Atlas (Supabase Auth, e-mail + senha),
// mas QUEM é admin é decidido no servidor (JWT validado + lista ATLAS_ADMIN_EMAILS): esconder o link aqui não protege nada.
// A sessão fica só nesta aba e em chave própria (a do portal do cliente nunca abre o painel).
import type { Regiao } from './mapa-brasil'
import { configPortal, type ConfigPortal, type Resp } from './portal-api'

export type Situacao = 'em_dia' | 'atrasada' | 'pausada' | 'cancelada' | 'ativando'

export interface IndicadoresAdmin {
  clientes_ativos: number
  receita: { recorrente_mensal: number; recebida_no_mes: number; implantacoes_recebidas_no_mes: number }
  ativacoes: { no_mes: number; meta: number; computadores_ativos: number }
  inadimplencia: { atrasadas: number; pausadas: number; valor_em_aberto: number }
  travados: number
  /** Cancelamentos do mês. Ausente = o servidor ainda não informa (pendência); a tela mostra "—", nunca inventa. */
  cancelamentos_no_mes?: number
}
export interface LinhaCliente {
  licenca_id: string; nome: string; empresa: string; ramo: string; situacao: Situacao; obras: number
  ultimo_sinal_em: string | null; travado_em: 'cadastro' | 'instalacao' | null
  /** Cortesia do gestor (com vencimento) ou licença paga. Ausente = paga. */
  tipo?: 'paga' | 'cortesia'; validade_em?: string | null
}
export interface ItemAtencao { id: string; tipo: string; quem: string; oque: string; quando: string; licenca_id: string | null; dominio_sugerido?: string }
export interface DominioBloqueado { dominio: string; motivo: string; criado_em: string }
export interface PainelAdmin { gerado_em: string; indicadores: IndicadoresAdmin; atencao: ItemAtencao[]; clientes: LinhaCliente[] }
export interface LinhaEntrega { licenca_id: string; cliente: string; obra_id: string; marca_dagua: string; baixado_em: string }
export interface LinhaCadastro { licenca_id: string; nome: string; empresa: string; ramo: string; email: string; cadastro_em: string | null; comprada_em: string | null; situacao: 'feito' | 'pendente' }

export interface MesCaixa { mes: string; implantacoes: number; prateleira: number; mensalidades: number }
/** Entradas por mês (AAAA-MM). Saídas/despesas ainda não existem: ficam para depois. */
export interface FluxoCaixa { meses: MesCaixa[] }

export type TipoSinal = 'instancia_recusada' | 'troca_frequente' | 'regioes_distantes' | 'degustacao_repetida'
export type GravidadeSinal = 'alta' | 'media' | 'baixa'
/** Detalhes por tipo. Só informação já resumida: hash CURTO do dispositivo, nunca token, computador_hash inteiro ou IP. */
export interface DetalhesSinal {
  regioes?: [string, string]
  trocas?: number; dias?: number
  dispositivo_hash?: string
  tentativas?: number
}
export interface SinalRadar { id: string; tipo: TipoSinal; gravidade: GravidadeSinal; licenca_id: string | null; cliente: string; descricao: string; quando: string; detalhes: DetalhesSinal }
export interface ResumoRadar { licencas_sob_suspeita: number; sinais_abertos: number; por_tipo: Record<TipoSinal, number> }
/** `ligado:false` = o servidor ainda não tem a rota: a tela explica e NÃO inventa número. */
export interface RadarPirataria { ligado: boolean; mensagem?: string; resumo: ResumoRadar; sinais: SinalRadar[] }

export interface LinhaUf { uf: string; regiao: Regiao; clientes: number; compras: number }
/** Só agregado por estado (nunca IP, nome ou e-mail). `ligado:false` = o servidor ainda não guarda a região: a tela explica e NÃO inventa ponto. */
export interface CidadeCliente { uf: string; cidade: string; clientes: number }
/**
 * `por_cidade` é OPCIONAL: só existe quando o servidor guardar a cidade do comprador (cidade + UF derivadas do IP/checkout na hora,
 * nunca o IP cru). Hoje o servidor só captura a UF; então, no caminho real, fica `undefined` e a tela explica. A posição (lon/lat) vem da base
 * CIDADES pelo nome + UF; cidade fora da base não ganha bolha.
 */
export interface MapaClientes { ligado: boolean; mensagem?: string; total: number; por_uf: LinhaUf[]; por_cidade?: CidadeCliente[]; atualizado_em: string }

export interface AdminApi {
  logado(): boolean
  /** Login por e-mail + senha (Supabase Auth, password grant). A allowlist continua valendo no servidor. */
  entrar(email: string, senha: string): Promise<Resp>
  /** O servidor confirma que este login é de administrador (senão: 403 e a sessão é descartada). */
  eu(): Promise<Resp<{ email: string }>>
  painel(): Promise<Resp<{ painel: PainelAdmin }>>
  liberarTroca(licencaId: string, motivo: string): Promise<Resp<{ ja_liberada: boolean }>>
  resolverOcorrencia(id: string): Promise<Resp>
  /** Libera (ou renova) uma cortesia. `validadeEm` é um instante ISO; o servidor valida tudo de novo. */
  liberarCortesia(email: string, validadeEm: string, nome?: string): Promise<Resp<{ nova: boolean; validade_em: string }>>
  /** Teste grátis: sem argumentos só lê; com `ativa`/`dias` liga, desliga ou ajusta (1 a 30 dias). O servidor valida de novo. */
  degustacao(mudanca?: { ativa?: boolean; dias?: number }): Promise<Resp<{ ativa: boolean; dias: number }>>
  /** Domínios de e-mail descartável bloqueados no teste grátis (a lista que o gestor edita). */
  dominios(): Promise<Resp<{ dominios: DominioBloqueado[] }>>
  bloquearDominio(dominio: string): Promise<Resp<{ dominio: string; ja_existia: boolean }>>
  liberarDominio(dominio: string): Promise<Resp<{ dominio: string }>>
  entregas(filtro?: { marca?: string; licenca_id?: string }): Promise<Resp<{ entregas: LinhaEntrega[] }>>
  cadastros(): Promise<Resp<{ cadastros: LinhaCadastro[] }>>
  /** Fluxo de caixa (só entradas). Se o servidor ainda não tem a rota, devolve ok:false com mensagem honesta. */
  fluxoCaixa(): Promise<Resp<{ fluxo: FluxoCaixa }>>
  /** Radar de pirataria: sinais suspeitos agregados. Sem a rota no servidor, devolve ok:true com `ligado:false`. */
  radarPirataria(): Promise<Resp<{ radar: RadarPirataria }>>
  /** "Já verifiquei" um sinal. No servidor real ainda não existe (pendência): devolve ok:false com mensagem honesta. */
  resolverSinalRadar(id: string): Promise<Resp>
  /** Mapa do Brasil: clientes e compras por estado. Sem a rota no servidor, devolve ok:true com `ligado:false`. */
  mapaClientes(): Promise<Resp<{ mapa: MapaClientes }>>
  sair(): void
}

export const RESUMO_VAZIO: ResumoRadar = { licencas_sob_suspeita: 0, sinais_abertos: 0, por_tipo: { instancia_recusada: 0, troca_frequente: 0, regioes_distantes: 0, degustacao_repetida: 0 } }

export const CHAVE_SESSAO_ADMIN = 'atlas.admin.sessao'
const MSG_OFF = 'O painel ainda não está aberto por aqui.'
const MSG_REDE = 'Sem conexão com o servidor. Veja a sua internet e tente de novo.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ler = () => { try { return sessionStorage.getItem(CHAVE_SESSAO_ADMIN) ?? '' } catch { return '' } }
const guardar = (t: string) => { try { if (t) sessionStorage.setItem(CHAVE_SESSAO_ADMIN, t); else sessionStorage.removeItem(CHAVE_SESSAO_ADMIN) } catch { /* vale só nesta carga */ } }

export function criarAdminApi(cfg: ConfigPortal | null = configPortal(), f: typeof fetch = fetch): AdminApi {
  let token = ler()
  const auth = async (caminho: string, corpo: object) => {
    const r = await f(`${cfg!.authUrl}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg!.anonKey }, body: JSON.stringify(corpo) })
    return { r, d: (await r.json().catch(() => ({}))) as Record<string, unknown> }
  }
  /** POST autenticado. 401/403 derrubam a sessão local: quem não é admin não fica com token guardado. */
  const servidor = async <T extends object>(rota: string, corpo: object = {}): Promise<Resp<T>> => {
    if (!cfg || !token) return { ok: false, mensagem: MSG_OFF }
    try {
      const r = await f(`${cfg.api}${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) })
      const c = (await r.json().catch(() => ({}))) as Record<string, unknown> & { mensagem?: string }
      if (r.status === 401 || r.status === 403) { token = ''; guardar(''); return { ok: false, mensagem: c.mensagem ?? 'Entre de novo.' } }
      if (!r.ok) return { ok: false, mensagem: c.mensagem ?? 'Não deu certo agora. Tente de novo em instantes.' }
      return { ok: true, ...(c as T) }
    } catch { return { ok: false, mensagem: MSG_REDE } }
  }
  return {
    logado: () => token !== '',
    async entrar(email, senha) {
      const e = email.trim().toLowerCase()
      if (!EMAIL_RE.test(e)) return { ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' }
      if (!senha) return { ok: false, mensagem: 'Digite a sua senha.' }
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        // Senha só vai no corpo desta chamada; nunca é guardada nem registrada. Quem é admin o servidor decide (allowlist) em /admin/eu.
        const { r, d } = await auth('/token?grant_type=password', { email: e, password: senha })
        if (r.status === 429) return { ok: false, mensagem: 'Tentativas demais. Espere uns minutos e tente de novo.' }
        const t = d.access_token
        if (!r.ok || typeof t !== 'string') return { ok: false, mensagem: 'E-mail ou senha incorretos.' }
        token = t
        guardar(t)
        return { ok: true }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    eu: () => servidor<{ email: string }>('/admin/eu'),
    async painel() {
      const r = await servidor<PainelAdmin>('/admin/painel')
      if (!r.ok) return r
      const painel: Record<string, unknown> = { ...r }; delete painel.ok
      return { ok: true, painel: painel as unknown as PainelAdmin }
    },
    liberarTroca: (licencaId, motivo) => servidor<{ ja_liberada: boolean }>('/admin/liberar-troca', { licenca_id: licencaId, motivo }),
    liberarCortesia(email, validadeEm, nome) {
      const e = email.trim().toLowerCase()
      if (!EMAIL_RE.test(e)) return Promise.resolve({ ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' })
      return servidor<{ nova: boolean; validade_em: string }>('/admin/cortesia', { email: e, validade_em: validadeEm, ...(nome?.trim() ? { nome: nome.trim() } : {}) })
    },
    degustacao: (mudanca = {}) => servidor<{ ativa: boolean; dias: number }>('/admin/degustacao', mudanca),
    dominios: () => servidor<{ dominios: DominioBloqueado[] }>('/admin/dominios'),
    bloquearDominio: (dominio) => servidor<{ dominio: string; ja_existia: boolean }>('/admin/dominios/adicionar', { dominio }),
    liberarDominio: (dominio) => servidor<{ dominio: string }>('/admin/dominios/remover', { dominio }),
    resolverOcorrencia: (id) => servidor('/admin/ocorrencias/resolver', { id }),
    entregas: (filtro = {}) => servidor<{ entregas: LinhaEntrega[] }>('/admin/entregas', filtro),
    cadastros: () => servidor<{ cadastros: LinhaCadastro[] }>('/admin/cadastros'),
    async fluxoCaixa() {
      const r = await servidor<FluxoCaixa>('/admin/fluxo-caixa')
      if (r.ok) return { ok: true, fluxo: { meses: Array.isArray(r.meses) ? r.meses : [] } }
      // Rota ainda não existe no servidor (pendência): mensagem honesta em vez de erro técnico.
      return { ok: false, mensagem: 'O fluxo de caixa ainda não está ligado no servidor. Por enquanto só aparece no modo demonstração.' }
    },
    async radarPirataria() {
      const r = await servidor<{ resumo?: ResumoRadar; sinais?: SinalRadar[] }>('/admin/radar')
      if (r.ok && Array.isArray(r.sinais) && r.resumo) return { ok: true, radar: { ligado: true, resumo: r.resumo, sinais: r.sinais } }
      // Rota ainda não existe (pendência): estado honesto, sem número inventado.
      return { ok: true, radar: { ligado: false, mensagem: 'O Radar ainda está sendo ligado no servidor. Quando estiver pronto, os sinais aparecem aqui sozinhos.', resumo: RESUMO_VAZIO, sinais: [] } }
    },
    resolverSinalRadar: () => Promise.resolve({ ok: false, mensagem: 'Dar baixa nos sinais ainda não está ligado no servidor. Nada foi marcado.' }),
    async mapaClientes() {
      const r = await servidor<{ total?: number; por_uf?: LinhaUf[]; por_cidade?: CidadeCliente[]; atualizado_em?: string }>('/admin/mapa')
      if (r.ok && Array.isArray(r.por_uf) && typeof r.total === 'number') {
        // Honestidade: só repassa cidade que o servidor mandou (e bem formada). Não mandou → undefined; nada é inventado.
        const por_cidade = Array.isArray(r.por_cidade) ? r.por_cidade.filter((c) => c && typeof c.uf === 'string' && typeof c.cidade === 'string' && typeof c.clientes === 'number' && c.clientes > 0) : undefined
        return { ok: true, mapa: { ligado: true, total: r.total, por_uf: r.por_uf, ...(por_cidade ? { por_cidade } : {}), atualizado_em: r.atualizado_em ?? '' } }
      }
      // Rota ainda não existe e o servidor ainda não guarda a região do comprador (pendência): estado honesto, sem ponto inventado.
      return { ok: true, mapa: { ligado: false, mensagem: 'O Mapa ainda está sendo ligado: o Atlas precisa passar a guardar o estado de quem compra (só o estado, nunca o endereço). Quando estiver pronto, os estados se pintam aqui sozinhos.', total: 0, por_uf: [], atualizado_em: '' } }
    },
    sair() { token = ''; guardar('') },
  }
}
