// Portal do cliente (F15) — cliente da API. O login é PRÓPRIO do Atlas (Supabase Auth, código de 6 dígitos por e-mail),
// independente do login do Claude. O navegador só guarda o token de sessão desta aba (nunca segredo de pagamento).
// Todas as chamadas ao servidor vão com esse token: o servidor descobre o dono por ele, nunca por id enviado daqui.
import { configCompra } from './compra'

export type Resp<T = object> = ({ ok: true } & T) | { ok: false; mensagem: string }

export interface PerfilPortal { nome: string; empresa: string; email: string }

export interface PortalApi {
  /** Já existe uma sessão aberta nesta aba? */
  logado(): boolean
  pedirCodigoLogin(email: string): Promise<Resp>
  entrar(email: string, codigo: string): Promise<Resp>
  eu(): Promise<Resp<{ perfil: PerfilPortal }>>
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
      if (!cfg || !token) return { ok: false, mensagem: MSG_OFF }
      try {
        const r = await f(`${cfg.api}/portal/eu`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' })
        const c = (await r.json().catch(() => ({}))) as Partial<PerfilPortal> & { mensagem?: string; erro?: string }
        if (r.status === 401) { token = ''; guardarSessao(''); return { ok: false, mensagem: c.mensagem ?? 'Entre de novo na sua conta.' } }
        if (!r.ok) return { ok: false, mensagem: c.mensagem ?? 'Não deu para abrir a sua conta agora.' }
        return { ok: true, perfil: { nome: c.nome ?? '', empresa: c.empresa ?? '', email: c.email ?? '' } }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    sair() { token = ''; guardarSessao('') },
  }
}
