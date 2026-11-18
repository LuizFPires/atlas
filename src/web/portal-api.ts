// Portal do cliente (F15) — cliente da API. O login é PRÓPRIO do Atlas (Supabase Auth, código de 6 dígitos por e-mail),
// independente do login do Claude. O navegador só guarda o token de sessão desta aba (nunca segredo de pagamento).
// Todas as chamadas ao servidor vão com esse token: o servidor descobre o dono por ele, nunca por id enviado daqui.
import { configCompra } from './compra'

export type Resp<T = object> = ({ ok: true } & T) | { ok: false; mensagem: string }

export interface PerfilPortal { nome: string; empresa: string; email: string }

/** O que a tela de /conta mostra (datas em ISO). Só campos seguros: o servidor nunca manda hash, ref do gateway nem dados de outro cliente. */
export interface ContaPortal {
  perfil: PerfilPortal
  licenca: {
    status: 'ativa' | 'atrasada' | 'pausada' | 'cancelada'
    comprada_em: string | null
    mensalidade_valor: number
    mensalidade_ativa: boolean
    mensalidade_encerra_em: string | null
    proxima_cobranca_em: string | null
    arrependimento_ate: string | null
    pode_cancelar_compra: boolean
    pode_cancelar_mensalidade: boolean
    pode_mudar_pagamento: boolean
  }
  computador: { ativado_em: string } | null
  troca: { pode_agora: boolean; proxima_troca_em: string | null }
  pagamentos: Array<{ data: string | null; descricao: string; valor: number; status: 'pendente' | 'pago' | 'falhou' | 'estornado'; tipo: 'implantacao' | 'mensalidade' }>
}

export interface PortalApi {
  /** Já existe uma sessão aberta nesta aba? */
  logado(): boolean
  pedirCodigoLogin(email: string): Promise<Resp>
  entrar(email: string, codigo: string): Promise<Resp>
  eu(): Promise<Resp<{ perfil: PerfilPortal }>>
  conta(): Promise<Resp<{ conta: ContaPortal }>>
  /** Endereço (https) do portal de cobrança do cliente para trocar a forma de pagamento. */
  formaPagamento(): Promise<Resp<{ url: string }>>
  /** Manda o código de 6 dígitos para o e-mail da compra (começo da troca de computador). */
  pedirCodigoTroca(): Promise<Resp<{ enviado_para: string }>>
  /** Desativa o computador atual (não precisa dele) e manda o link de instalação do novo. */
  desativarComputador(codigo: string): Promise<Resp<{ enviado_para: string; proxima_troca_em: string }>>
  /** Arrependimento (7 dias, CDC art. 49): devolve tudo e encerra a licença. */
  cancelarCompra(): Promise<Resp<{ estornados: number }>>
  /** Sem fidelidade: para de cobrar; a licença vale até o fim do período pago. */
  cancelarMensalidade(): Promise<Resp<{ encerra_em: string }>>
  /** Computador já liberado e o e-mail não chegou: manda o acesso de novo. */
  reenviarAcesso(): Promise<Resp<{ enviado_para: string }>>
  /** LGPD: exclui a conta de forma definitiva (anonimiza os dados, para a cobrança e apaga o login). Só vale com o servidor confirmando. */
  excluirConta(): Promise<Resp>
  sair(): void
}

export interface ConfigPortal { api: string; authUrl: string; anonKey: string }

/** Endereços públicos do build (a chave "anon" do Supabase é pública por desenho; quem protege os dados é o RLS e o servidor). */
export function configPortal(): ConfigPortal | null {
  const base = configCompra()
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  return base && url && anonKey ? { api: base.api, authUrl: `${url}/auth/v1`, anonKey } : null
}

export const CHAVE_SESSAO = 'atlas.portal.sessao'
const MSG_OFF = 'O portal ainda não está aberto por aqui. Volte daqui a pouco.'
const MSG_REDE = 'Sem conexão com o servidor. Veja a sua internet e tente de novo.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function lerSessao(): string {
  try { return sessionStorage.getItem(CHAVE_SESSAO) ?? '' } catch { return '' }
}
function guardarSessao(t: string) {
  try { if (t) sessionStorage.setItem(CHAVE_SESSAO, t); else sessionStorage.removeItem(CHAVE_SESSAO) } catch { /* sem armazenamento: vale só nesta carga */ }
}

export function criarPortalApi(cfg: ConfigPortal | null = configPortal(), f: typeof fetch = fetch): PortalApi {
  let token = lerSessao()
  const auth = async (caminho: string, corpo: object) => {
    const r = await f(`${cfg!.authUrl}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg!.anonKey }, body: JSON.stringify(corpo) })
    return { r, d: (await r.json().catch(() => ({}))) as Record<string, unknown> }
  }
  /** POST autenticado. 401 = sessão vencida: derruba a sessão local para a tela voltar ao login. */
  const servidor = async <T extends object>(rota: string, corpo: object = {}): Promise<Resp<T>> => {
    if (!cfg || !token) return { ok: false, mensagem: MSG_OFF }
    try {
      const r = await f(`${cfg.api}${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) })
      const c = (await r.json().catch(() => ({}))) as Record<string, unknown> & { mensagem?: string }
      if (r.status === 401) { token = ''; guardarSessao(''); return { ok: false, mensagem: c.mensagem ?? 'Entre de novo na sua conta.' } }
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
        const { r } = await auth('/otp', { email: e, create_user: true })
        if (r.status === 429) return { ok: false, mensagem: 'Você pediu códigos demais. Espere uns minutos e tente de novo.' }
        // Resposta neutra: não revelamos se esse e-mail é de um cliente.
        return r.ok ? { ok: true } : { ok: false, mensagem: 'Não deu para mandar o código agora. Tente de novo em instantes.' }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    async entrar(email, codigo) {
      const c = codigo.replace(/\s+/g, '')
      if (!/^\d{6,8}$/.test(c)) return { ok: false, mensagem: 'O código tem 6 números. Confira o e-mail que mandamos.' }
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        const { r, d } = await auth('/verify', { type: 'email', email: email.trim().toLowerCase(), token: c })
        const t = d.access_token
        if (!r.ok || typeof t !== 'string') return { ok: false, mensagem: 'Código incorreto ou vencido. Peça um novo.' }
        token = t
        guardarSessao(t)
        return { ok: true }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    async eu() {
      const r = await servidor<PerfilPortal>('/portal/eu')
      return r.ok ? { ok: true, perfil: { nome: r.nome ?? '', empresa: r.empresa ?? '', email: r.email ?? '' } } : r
    },
    async conta() {
      const r = await servidor<ContaPortal>('/portal/conta')
      if (!r.ok) return r
      const conta: Record<string, unknown> = { ...r }; delete conta.ok
      return { ok: true, conta: conta as unknown as ContaPortal }
    },
    async formaPagamento() {
      const r = await servidor<{ url: string }>('/portal/forma-pagamento')
      return r.ok && !String(r.url).startsWith('https://') ? { ok: false, mensagem: 'O endereço do pagamento veio estranho. Tente de novo.' } : r
    },
    pedirCodigoTroca: () => servidor<{ enviado_para: string }>('/portal/trocar/solicitar-codigo'),
    desativarComputador: (codigo) => servidor<{ enviado_para: string; proxima_troca_em: string }>('/portal/trocar/desativar', { codigo: codigo.replace(/\s+/g, '') }),
    reenviarAcesso: () => servidor<{ enviado_para: string }>('/portal/reenviar-acesso'),
    cancelarCompra: () => servidor<{ estornados: number }>('/portal/compra/cancelar', { confirmar: true }),
    cancelarMensalidade: () => servidor<{ encerra_em: string }>('/portal/mensalidade/cancelar', { confirmar: true }),
    async excluirConta() {
      const r = await servidor('/portal/conta/excluir', { confirmar: true })
      if (r.ok) { token = ''; guardarSessao('') } // a sessão morreu junto com a conta
      return r
    },
    sair() { token = ''; guardarSessao('') },
  }
}
