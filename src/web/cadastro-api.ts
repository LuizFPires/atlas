// Cadastro: POST /cadastro no servidor (item 4 do M4). Só texto das 4 respostas; sem segredo, sem pagamento.
import { configCompra, type ConfigCompra } from './compra'
import type { DadosCadastro, ResultadoCadastro } from './Cadastro'

export async function enviarCadastro(d: DadosCadastro, cfg: Pick<ConfigCompra, 'api'> | null = configCompra(), f: typeof fetch = fetch): Promise<ResultadoCadastro> {
  if (!cfg) return { ok: false, mensagem: 'O cadastro ainda não está aberto por aqui. Volte daqui a pouco.' }
  try {
    const r = await f(`${cfg.api}/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: d.nome, empresa: d.empresa, ramo: d.faz, email: d.email }),
    })
    if (r.ok) return { ok: true }
    const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string }
    return { ok: false, mensagem: corpo.mensagem ?? 'Não deu para guardar as respostas agora. Tente de novo em instantes.' }
  } catch {
    return { ok: false, mensagem: 'Sem conexão com o servidor. Veja a sua internet e tente de novo.' }
  }
}
