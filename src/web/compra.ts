// Compra: o botão chama POST /pagamento/checkout (M3) e leva o cliente ao Stripe Checkout da conta do Luiz.
// Nenhum dado de cartão passa por aqui; o pagamento é todo no gateway.

import { falaParaEmail } from '../ui'
import { documentoBR } from './documento'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Junta a fala ao e-mail que já está no campo. Se o cliente fala um e-mail inteiro ("arroba"), ele substitui o antigo. */
export function juntarFalaEmail(atual: string, falado: string): string {
  if (atual.includes('@') && (/\b(arroba|at)\b/i.test(falado) || falado.includes('@'))) return falaParaEmail(falado)
  return falaParaEmail(`${atual} ${falado}`)
}

export interface ConfigCompra { api: string; contaId: string }

/** Endereço do servidor e conta de pagamento vêm do ambiente do build (nunca segredos). */
export function configCompra(): ConfigCompra | null {
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
  const contaId = import.meta.env.VITE_CONTA_ID as string | undefined
  return api && contaId ? { api, contaId } : null
}

export type ResultadoCompra = { ok: true; url: string } | { ok: false; mensagem: string }

/**
 * `versaoAceita` é a versão dos Termos/Política que o cliente marcou que leu e aceita (LGPD).
 * Sem ela a compra nem sai daqui; o servidor também recusa e é ele quem registra o aceite.
 * `origem: 'app'` = compra feita de dentro do Atlas instalado (muda só para onde a Stripe devolve o cliente).
 */
const MSG = {
  pt: { aceite: 'Para continuar, marque que você leu e aceita a Política de Privacidade e os Termos de Uso.', email: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.', fechada: 'A compra ainda não está aberta por aqui. Volte daqui a pouco.', documento: 'Confira o CPF ou o CNPJ: para pagar em real, ele precisa ser um documento brasileiro válido (vai na nota da compra). Quem não tem documento brasileiro compra pela página em inglês, em dólar.', falhou: 'O servidor do Atlas não conseguiu abrir o pagamento agora. Nada foi cobrado. Tente de novo em alguns minutos; se continuar, use a Ajuda do Atlas.', rede: 'Sem conexão com o pagamento. Veja a sua internet e tente de novo.' },
  en: { aceite: 'To continue, check that you have read and accept the Privacy Policy and the Terms of Use.', email: 'Check the email: it needs an @ and an ending, like .com.', fechada: 'Checkout isn’t open here yet. Please come back in a bit.', documento: '', falhou: 'The Atlas server couldn’t open the payment page right now. You were not charged. Please try again in a few minutes; if it keeps happening, use Atlas Help.', rede: 'No connection to the payment page. Check your internet and try again.' },
}

/** M31: `mercado: 'us'` = compra em dólar, pela página em inglês (mensagens em inglês). */
/** M31 ("real só com CPF"): em real, `documento` (CPF ou CNPJ) é obrigatório e vai ao servidor; em dólar, não se pede. */
export async function iniciarCompra(email: string, cfg: ConfigCompra | null = configCompra(), f: typeof fetch = fetch, versaoAceita: string | null = null, parcelas = 1, segmento?: string, origem?: 'app', mercado?: 'us', documento?: string): Promise<ResultadoCompra> {
  const e = email.trim().toLowerCase()
  const M = mercado === 'us' ? MSG.en : MSG.pt
  if (!versaoAceita) return { ok: false, mensagem: M.aceite }
  if (!EMAIL_RE.test(e)) return { ok: false, mensagem: M.email }
  const doc = mercado === 'us' ? null : documentoBR(documento)
  if (mercado !== 'us' && !doc) return { ok: false, mensagem: M.documento }
  if (!cfg) return { ok: false, mensagem: M.fechada }
  try {
    const r = await f(`${cfg.api}/pagamento/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id: cfg.contaId, tipo: segmento ? 'prateleira' : 'implantacao', ...(segmento ? { segmento } : {}), email: e, parcelas, aceite_termos: true, versao_termos: versaoAceita, ...(origem ? { origem } : {}), ...(mercado ? { mercado } : {}), ...(doc ? { documento: doc.digitos } : {}) }),
    })
    const corpo = (await r.json().catch(() => ({}))) as { url?: string; mensagem?: string }
    if (r.ok && corpo.url && corpo.url.startsWith('https://')) return { ok: true, url: corpo.url }
    return { ok: false, mensagem: (mercado === 'us' ? undefined : corpo.mensagem) ?? M.falhou }
  } catch {
    return { ok: false, mensagem: M.rede }
  }
}
