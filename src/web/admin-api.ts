// Painel do administrador (F16) — cliente da API. Só o Luiz usa. O login é o mesmo do Atlas (Supabase Auth, código por e-mail),
// mas QUEM é admin é decidido no servidor (JWT validado + lista ATLAS_ADMIN_EMAILS): esconder o link aqui não protege nada.
// A sessão fica só nesta aba e em chave própria (a do portal do cliente nunca abre o painel).
import { configPortal, type ConfigPortal, type Resp } from './portal-api'

export type Situacao = 'em_dia' | 'atrasada' | 'pausada' | 'cancelada' | 'ativando'

export interface IndicadoresAdmin {
  clientes_ativos: number
  receita: { recorrente_mensal: number; recebida_no_mes: number; implantacoes_recebidas_no_mes: number }
  ativacoes: { no_mes: number; meta: number; computadores_ativos: number }
  inadimplencia: { atrasadas: number; pausadas: number; valor_em_aberto: number }
  travados: number
}
export interface LinhaCliente {
  licenca_id: string; nome: string; empresa: string; ramo: string; situacao: Situacao; obras: number
  ultimo_sinal_em: string | null; travado_em: 'cadastro' | 'instalacao' | null
  /** Cortesia do gestor (com vencimento) ou licença paga. Ausente = paga. */
  tipo?: 'paga' | 'cortesia'; validade_em?: string | null
}
export interface ItemAtencao { id: string; tipo: string; quem: string; oque: string; quando: string; licenca_id: string | null }
export interface PainelAdmin { gerado_em: string; indicadores: IndicadoresAdmin; atencao: ItemAtencao[]; clientes: LinhaCliente[] }
export interface LinhaEntrega { licenca_id: string; cliente: string; obra_id: string; marca_dagua: string; baixado_em: string }
export interface LinhaCadastro { licenca_id: string; nome: string; empresa: string; ramo: string; email: string; cadastro_em: string | null; comprada_em: string | null; situacao: 'feito' | 'pendente' }

export interface AdminApi {
  logado(): boolean
  pedirCodigoLogin(email: string): Promise<Resp>
  entrar(email: string, codigo: string): Promise<Resp>
  /** O servidor confirma que este login é de administrador (senão: 403 e a sessão é descartada). */
  eu(): Promise<Resp<{ email: string }>>
  painel(): Promise<Resp<{ painel: PainelAdmin }>>
  liberarTroca(licencaId: string, motivo: string): Promise<Resp<{ ja_liberada: boolean }>>
  resolverOcorrencia(id: string): Promise<Resp>
  /** Libera (ou renova) uma cortesia. `validadeEm` é um instante ISO; o servidor valida tudo de novo. */
  liberarCortesia(email: string, validadeEm: string, nome?: string): Promise<Resp<{ nova: boolean; validade_em: string }>>
  entregas(filtro?: { marca?: string; licenca_id?: string }): Promise<Resp<{ entregas: LinhaEntrega[] }>>
  cadastros(): Promise<Resp<{ cadastros: LinhaCadastro[] }>>
  sair(): void
}

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
    async pedirCodigoLogin(email) {
      const e = email.trim().toLowerCase()
      if (!EMAIL_RE.test(e)) return { ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' }
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        // create_user:false — o painel nunca cria usuário novo no Auth.
        const { r } = await auth('/otp', { email: e, create_user: false })
        if (r.status === 429) return { ok: false, mensagem: 'Códigos demais. Espere uns minutos e tente de novo.' }
        return r.ok ? { ok: true } : { ok: false, mensagem: 'Não deu para mandar o código agora. Tente de novo em instantes.' }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    async entrar(email, codigo) {
      const c = codigo.replace(/\s+/g, '')
      if (!/^\d{6,8}$/.test(c)) return { ok: false, mensagem: 'O código tem 6 números. Confira o e-mail.' }
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        const { r, d } = await auth('/verify', { type: 'email', email: email.trim().toLowerCase(), token: c })
        const t = d.access_token
        if (!r.ok || typeof t !== 'string') return { ok: false, mensagem: 'Código incorreto ou vencido. Peça um novo.' }
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
    resolverOcorrencia: (id) => servidor('/admin/ocorrencias/resolver', { id }),
    entregas: (filtro = {}) => servidor<{ entregas: LinhaEntrega[] }>('/admin/entregas', filtro),
    cadastros: () => servidor<{ cadastros: LinhaCadastro[] }>('/admin/cadastros'),
    sair() { token = ''; guardar('') },
  }
}
