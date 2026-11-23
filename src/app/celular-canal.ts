// M33 — o lado do notebook nas rotas do celular. As chamadas passam pelo processo principal (fetchPelaPonte), com a credencial
// da ativação só no cabeçalho X-Atlas-Dispositivo. A licença é decidida no servidor. Pedido com formato estranho é descartado.
import { cabecalhoDispositivo, lerAtivacao } from './ativacao-api'
import type { CanalRemoto, PedidoRemoto, TipoPedido } from './celular-remoto'
import type { PonteDesktop } from './ponte'

const TIPOS: TipoPedido[] = ['obra_nova', 'ajuste', 'aprovar_telas', 'nome', 'construir', 'pausar', 'continuar']

function pedidoValido(x: unknown): x is PedidoRemoto {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  return typeof p.id === 'string' && /^[0-9a-f]{32}$/.test(p.id) && TIPOS.includes(p.tipo as TipoPedido) && typeof p.obra_id === 'string' && /^[\w.-]{1,64}$/.test(p.obra_id)
    && !!p.dados && typeof p.dados === 'object' && !Array.isArray(p.dados)
}

export function criarCanalRemotoApi(ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>, api: string, f: typeof fetch = fetch): CanalRemoto {
  const base = api.replace(/[/]+$/, '')
  async function postar(rota: string, corpo: Record<string, unknown>) {
    const ativ = await lerAtivacao(ponte.cofre)
    if (!ativ) throw new Error('sem-ativacao')
    const r = await f(`${base}${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await cabecalhoDispositivo(ponte.cofre)) },
      body: JSON.stringify({ email: ativ.email, computador_hash: await ponte.hashComputador(), ...corpo }),
    })
    if (!r.ok) throw new Error(`servidor-${r.status}`)
    return (await r.json().catch(() => null)) as Record<string, unknown> | null
  }
  return {
    async sinal(ocupado) {
      try {
        const d = await postar('/celular/sinal', { ocupado })
        return Array.isArray(d?.pedidos) ? d.pedidos.filter(pedidoValido) : []
      } catch { return [] }
    },
    async responder(id, estado, mensagem) { await postar('/celular/resposta', { pedido_id: id, estado, mensagem }) },
    async projeto(obraId, projeto, documento) { await postar('/celular/projeto', { obra_id: obraId, projeto, ...(documento ? { documento } : {}) }) },
    async referencia(id) {
      const d = await postar('/celular/referencia', { id })
      if (typeof d?.imagem !== 'string') throw new Error('referencia-invalida')
      return d.imagem
    },
    async status(obras) { await postar('/status-obras/publicar', { obras }) },
  }
}
