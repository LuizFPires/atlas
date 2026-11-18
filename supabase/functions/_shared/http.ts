// Roteador das APIs S4 (sem dependência de Deno: testável com Request/Response padrão).
import { confirmarAtivacao, solicitarCodigo } from './ativacao.ts'
import { entregarKit, type CarregarKit } from './kit.ts'
import { gerarLink } from './links.ts'
import { type Deps, ErroRegra } from './tipos.ts'
import { liberarTroca, trocarComputador } from './troca.ts'
import { verificar } from './verificar.ts'

export interface Contexto {
  deps: Deps
  carregarKit: CarregarKit
  /** Chamadas de serviço/admin (gerar link pós-compra, override). Conferido contra segredo do ambiente. */
  autorizarServico: (req: Request) => boolean
}

/**
 * IP do cliente. Usa o ÚLTIMO valor de x-forwarded-for: é o que o proxy da plataforma anexa
 * (o IP que ele viu de verdade); os valores anteriores vêm do cliente e podem ser forjados.
 * Sem cabeçalho, todos caem no mesmo balde (mais restrito, nunca mais frouxo).
 */
const ipDe = (req: Request) => {
  const hops = (req.headers.get('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  return hops[hops.length - 1] ?? 'desconhecido'
}

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } })

export async function tratar(ctx: Contexto, req: Request): Promise<Response> {
  const rota = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?/, '/').replace(/\/+$/, '')
  if (req.method !== 'POST') return json({ erro: 'metodo', mensagem: 'Use POST.' }, 405)
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, string>
    const s = (k: string) => (typeof b[k] === 'string' ? b[k] : '')
    // Credencial da ativação: SOMENTE o cabeçalho X-Atlas-Dispositivo (nunca o corpo, que pode ir para log).
    const dispositivo = req.headers.get('X-Atlas-Dispositivo') ?? ''
    switch (rota) {
      case '/link-instalacao':
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        return json(await gerarLink(ctx.deps, s('email')))
      case '/ativar/solicitar-codigo':
        return json(await solicitarCodigo(ctx.deps, s('email'), 'ativacao', ipDe(req)))
      case '/ativar/confirmar':
        return json(await confirmarAtivacao(ctx.deps, { email: s('email'), codigo: s('codigo'), token: s('token'), computador_hash: s('computador_hash') }))
      case '/trocar-computador/solicitar-codigo':
        return json(await solicitarCodigo(ctx.deps, s('email'), 'troca', ipDe(req)))
      case '/trocar-computador':
        return json(await trocarComputador(ctx.deps, { email: s('email'), codigo: s('codigo'), novo_hash: s('novo_hash') }))
      case '/admin/liberar-troca':
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        await liberarTroca(ctx.deps, s('licenca_id'), s('motivo') || 'Override manual')
        return json({ ok: true })
      case '/verificar':
        return json(await verificar(ctx.deps, { email: s('email'), computador_hash: s('computador_hash'), token_dispositivo: dispositivo }))
      case '/entregar-kit': {
        const r = await entregarKit(ctx.deps, ctx.carregarKit, { email: s('email'), computador_hash: s('computador_hash'), token_dispositivo: dispositivo, obra_id: s('obra_id') })
        const { cabecalhos, ...corpo } = r
        return json(corpo, 200, cabecalhos)
      }
      default:
        return json({ erro: 'nao_encontrado' }, 404)
    }
  } catch (e) {
    if (e instanceof ErroRegra) return json({ erro: e.codigo, mensagem: e.message, ...e.extra() }, e.status)
    return json({ erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }, 500)
  }
}
