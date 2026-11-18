// Compra: o botão chama POST /pagamento/checkout (M3) e leva o cliente ao Stripe Checkout da conta do Luiz.
// Nenhum dado de cartão passa por aqui; o pagamento é todo no gateway.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ConfigCompra { api: string; contaId: string }

/** Endereço do servidor e conta de pagamento vêm do ambiente do build (nunca segredos). */
export function configCompra(): ConfigCompra | null {
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
  const contaId = import.meta.env.VITE_CONTA_ID as string | undefined
  return api && contaId ? { api, contaId } : null
}

export type ResultadoCompra = { ok: true; url: string } | { ok: false; mensagem: string }

export async function iniciarCompra(email: string, cfg: ConfigCompra | null = configCompra(), f: typeof fetch = fetch): Promise<ResultadoCompra> {
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return { ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' }
  if (!cfg) return { ok: false, mensagem: 'A compra ainda não está aberta por aqui. Volte daqui a pouco.' }
  try {
    const r = await f(`${cfg.api}/pagamento/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: cfg.contaId, tipo: 'implantacao', email: e }),
    })
    const corpo = (await r.json().catch(() => ({}))) as { url?: string; mensagem?: string }
    if (r.ok && corpo.url && corpo.url.startsWith('https://')) return { ok: true, url: corpo.url }
    return { ok: false, mensagem: corpo.mensagem ?? 'Não deu para abrir o pagamento agora. Tente de novo em instantes.' }
  } catch {
    return { ok: false, mensagem: 'Sem conexão com o pagamento. Veja a sua internet e tente de novo.' }
  }
}
