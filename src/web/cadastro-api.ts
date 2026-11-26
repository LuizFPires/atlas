// Cadastro: POST /cadastro no servidor (item 4 do M4). Só texto das 5 respostas + o session_id da compra
// (prova que o Stripe devolve na URL /compra/sucesso?session_id=…). Sem segredo, sem pagamento.
import { configCompra, type ConfigCompra } from './compra'
import { semMensagem } from './sem-mensagem'
import type { DadosCadastro, ResultadoCadastro } from './Cadastro'

/** Lê o session_id da URL de retorno do pagamento (ou '' se não veio). */
export function sessionIdDaUrl(busca: string = typeof window === 'undefined' ? '' : window.location.search): string {
  const v = new URLSearchParams(busca).get('session_id') ?? ''
  return /^cs_[A-Za-z0-9_]{8,200}$/.test(v) ? v : ''
}

export async function enviarCadastro(d: DadosCadastro, cfg: Pick<ConfigCompra, 'api'> | null = configCompra(), f: typeof fetch = fetch, sessionId: string = sessionIdDaUrl()): Promise<ResultadoCadastro> {
  if (!cfg) return { ok: false, mensagem: 'O cadastro ainda não está aberto por aqui. Volte daqui a pouco.' }
  if (!sessionId) return { ok: false, mensagem: 'Para abrir o cadastro, volte pelo botão da página de pagamento. Esse endereço precisa vir do pagamento.' }
  try {
    const r = await f(`${cfg.api}/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, nome: d.nome, empresa: d.empresa, ramo: d.faz, cidade: d.cidade, uf: d.uf, email: d.email }),
    })
    const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; mensagem?: string; enviado_para?: string; email_diferente?: boolean; segmento?: string | null }
    if (r.ok && corpo.ok === true) return { ok: true, enviado_para: corpo.enviado_para, email_diferente: corpo.email_diferente, segmento: corpo.segmento ?? null }
    return { ok: false, mensagem: corpo.mensagem ?? `As respostas não foram guardadas. ${semMensagem(r.status)}` }
  } catch {
    return { ok: false, mensagem: 'Sem conexão com o servidor. Veja a sua internet e tente de novo.' }
  }
}
