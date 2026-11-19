// Degustação (teste grátis): cliente da API pública. Sem segredo, sem pagamento. O servidor valida tudo de novo.
import { configCompra, type ConfigCompra, EMAIL_RE } from './compra'

export interface EstadoDegustacao { ativa: boolean; dias: number }
export type ResultadoPedido = { ok: true } | { ok: false; mensagem: string }
export type ResultadoConfirmacao = { ok: true; dias: number; linkToken: string } | { ok: false; mensagem: string }

export interface DegustacaoApi {
  estado(): Promise<EstadoDegustacao>
  pedir(email: string): Promise<ResultadoPedido>
  confirmar(token: string): Promise<ResultadoConfirmacao>
}

const MSG_REDE = 'Sem conexão com o servidor. Veja a sua internet e tente de novo.'

/** Lê o token do link do e-mail (?t=…). */
export function tokenDaUrl(busca: string = typeof window === 'undefined' ? '' : window.location.search): string {
  const v = new URLSearchParams(busca).get('t') ?? ''
  return /^[\w-]{20,128}$/.test(v) ? v : ''
}

export function criarDegustacaoApi(cfg: Pick<ConfigCompra, 'api'> | null = configCompra(), f: typeof fetch = fetch): DegustacaoApi {
  const post = async (rota: string, corpo: object) => {
    const r = await f(`${cfg!.api}${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    return { r, c: (await r.json().catch(() => ({}))) as Record<string, unknown> & { mensagem?: string } }
  }
  return {
    async estado() {
      // Sem servidor ou com erro: o bloco NÃO aparece (nunca oferece o que não pode cumprir).
      if (!cfg) return { ativa: false, dias: 5 }
      try {
        const { r, c } = await post('/degustacao/estado', {})
        return r.ok && c.ativa === true ? { ativa: true, dias: typeof c.dias === 'number' ? c.dias : 5 } : { ativa: false, dias: 5 }
      } catch { return { ativa: false, dias: 5 } }
    },
    async pedir(email) {
      const e = email.trim().toLowerCase()
      if (!EMAIL_RE.test(e)) return { ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' }
      if (!cfg) return { ok: false, mensagem: 'O teste grátis ainda não está aberto por aqui. Volte daqui a pouco.' }
      try {
        const { r, c } = await post('/degustacao/pedir', { email: e })
        return r.ok ? { ok: true } : { ok: false, mensagem: c.mensagem ?? 'Não deu certo agora. Tente de novo em instantes.' }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    async confirmar(token) {
      if (!cfg) return { ok: false, mensagem: 'O teste grátis ainda não está aberto por aqui. Volte daqui a pouco.' }
      try {
        const { r, c } = await post('/degustacao/confirmar', { token })
        if (r.ok && typeof c.link_token === 'string') return { ok: true, dias: typeof c.dias === 'number' ? c.dias : 5, linkToken: c.link_token }
        return { ok: false, mensagem: c.mensagem ?? 'Não deu certo agora. Tente de novo em instantes.' }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
  }
}
