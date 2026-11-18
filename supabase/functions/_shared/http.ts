// Roteador das APIs S4 (sem dependência de Deno: testável com Request/Response padrão).
import { abrirLink, reenviarParaComputador } from './abertura.ts'
import { confirmarAtivacao, solicitarCodigo } from './ativacao.ts'
import { entregarKit, type CarregarKit } from './kit.ts'
import { gerarLink } from './links.ts'
import { type Deps, ErroRegra } from './tipos.ts'
import { trocarComputador } from './troca.ts'
import { verificar } from './verificar.ts'
import { criarCheckout } from './pagamento/checkout.ts'
import type { DepsPagamento } from './pagamento/config.ts'
import { cancelarCompra, cancelarMensalidade } from './pagamento/cancelamento.ts'
import { processarAtrasos } from './pagamento/atraso.ts'
import { processarWebhook } from './pagamento/webhook.ts'
import { cadastrar, type DepsCadastro } from './cadastro.ts'
import { adminLogado, type DepsAdmin, euAdmin, liberarTrocaUrgente, painel, resolverOcorrencia, verCadastros, verEntregas } from './admin.ts'
import { cancelarPeloPortal, conta, type DepsPortal, desativarComputador, eu, formaDePagamento, pedirCodigoTroca, reenviarAcesso } from './portal.ts'

export interface Contexto {
  deps: Deps
  carregarKit: CarregarKit
  /** Pagamento (Stripe do cliente). Ausente = rotas de pagamento respondem 503. */
  pagamento?: DepsPagamento
  /** Cadastro pós-pagamento (M4) e e-mail de boas-vindas. Ausente = /cadastro responde 503. */
  cadastro?: DepsCadastro
  /** Portal do cliente (M6, login próprio). Ausente = rotas /portal/* respondem 503. */
  portal?: DepsPortal
  /** Painel do administrador (M7, F16). Ausente = rotas /admin/* de pessoa respondem 503 (nunca ficam abertas). */
  admin?: DepsAdmin
  /** Origem do site (ex.: https://atlas-ia.app.br). Só ela recebe CORS; ausente = nenhuma origem de navegador. */
  origemWeb?: string
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

/** CORS só para a origem do site do Luiz (a página de vendas chama /pagamento/checkout e /cadastro do navegador). */
export async function tratar(ctx: Contexto, req: Request): Promise<Response> {
  const origem = req.headers.get('Origin')
  const liberada = !!ctx.origemWeb && origem === ctx.origemWeb
  const cors: Record<string, string> = liberada
    ? { 'Access-Control-Allow-Origin': origem, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' }
    : {}
  if (req.method === 'OPTIONS') return new Response(null, { status: liberada ? 204 : 403, headers: cors })
  const res = await tratarRota(ctx, req)
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  return res
}

async function tratarRota(ctx: Contexto, req: Request): Promise<Response> {
  const rota = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?/, '/').replace(/\/+$/, '')
  if (req.method !== 'POST') return json({ erro: 'metodo', mensagem: 'Use POST.' }, 405)
  try {
    // Webhook: precisa do corpo BRUTO (a assinatura cobre os bytes exatos), por isso antes do req.json().
    const wh = rota.match(/^\/webhook\/stripe\/([\w-]+)$/)
    if (wh) {
      if (!ctx.pagamento) return json({ erro: 'pagamento_indisponivel' }, 503)
      return json(await processarWebhook(ctx.pagamento, wh[1], await req.text(), req.headers.get('Stripe-Signature')))
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, string>
    const s = (k: string) => (typeof b[k] === 'string' ? b[k] : '')
    // Credencial da ativação: SOMENTE o cabeçalho X-Atlas-Dispositivo (nunca o corpo, que pode ir para log).
    const dispositivo = req.headers.get('X-Atlas-Dispositivo') ?? ''
    // Painel do admin (M7): SÓ pessoa admin. JWT validado no servidor + allowlist (admin.ts). O cron /admin/processar-atrasos
    // é a única exceção: é máquina (segredo de serviço), não pessoa, e não devolve dado nenhum de cliente.
    if (rota.startsWith('/admin/') && rota !== '/admin/processar-atrasos') {
      if (!ctx.admin) return json({ erro: 'admin_indisponivel' }, 503)
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const o = b as Record<string, unknown>
      switch (rota) {
        case '/admin/eu':
          return json(await euAdmin(ctx.admin, jwt))
        case '/admin/painel':
          return json(await painel(ctx.admin, jwt))
        case '/admin/ocorrencias/resolver':
          return json(await resolverOcorrencia(ctx.admin, jwt, o.id))
        case '/admin/liberar-troca':
          return json(await liberarTrocaUrgente(ctx.admin, jwt, { licenca_id: o.licenca_id, motivo: o.motivo }))
        case '/admin/entregas':
          return json(await verEntregas(ctx.admin, jwt, { licenca_id: o.licenca_id, marca: o.marca }))
        case '/admin/cadastros':
          return json(await verCadastros(ctx.admin, jwt))
        default:
          // Rota /admin/* desconhecida: ainda exige admin antes de dizer qualquer coisa (não revela o que existe).
          await adminLogado(ctx.admin, jwt)
          return json({ erro: 'nao_encontrado' }, 404)
      }
    }
    // Portal: o dono é SEMPRE o usuário do JWT (cabeçalho Authorization). Nada de id/e-mail do corpo.
    if (rota.startsWith('/portal/')) {
      if (!ctx.portal) return json({ erro: 'portal_indisponivel' }, 503)
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      switch (rota) {
        case '/portal/eu':
          return json(await eu(ctx.portal, jwt))
        case '/portal/conta':
          return json(await conta(ctx.portal, jwt))
        case '/portal/trocar/solicitar-codigo':
          return json(await pedirCodigoTroca(ctx.portal, jwt, ipDe(req)))
        case '/portal/trocar/desativar':
          return json(await desativarComputador(ctx.portal, jwt, s('codigo')))
        case '/portal/reenviar-acesso':
          return json(await reenviarAcesso(ctx.portal, jwt))
        case '/portal/compra/cancelar':
          return json(await cancelarPeloPortal(ctx.portal, jwt, 'compra', (b as Record<string, unknown>).confirmar))
        case '/portal/mensalidade/cancelar':
          return json(await cancelarPeloPortal(ctx.portal, jwt, 'mensalidade', (b as Record<string, unknown>).confirmar))
        case '/portal/forma-pagamento':
          return json(await formaDePagamento(ctx.portal, jwt))
        default:
          return json({ erro: 'nao_encontrado' }, 404)
      }
    }
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
      case '/pagamento/checkout': {
        if (!ctx.pagamento) return json({ erro: 'pagamento_indisponivel' }, 503)
        const tipo = s('tipo') === 'mensalidade' ? 'mensalidade' : 'implantacao'
        // compra inicial é pública (com limite por IP); mensalidade é de serviço (portal já autenticado).
        if (tipo === 'mensalidade' && !ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        if (tipo === 'implantacao' && !(await ctx.pagamento.store.tentarEvento(`checkout:ip:${ipDe(req)}`, 10, 15 * 60_000, ctx.pagamento.agora()))) {
          return json({ erro: 'muitas_solicitacoes', mensagem: 'Muitas tentativas. Espere uns minutos.' }, 429)
        }
        return json(await criarCheckout(ctx.pagamento, { conta_id: s('conta_id'), tipo, email: s('email'), licenca_id: s('licenca_id') }))
      }
      case '/cadastro': {
        if (!ctx.cadastro) return json({ erro: 'cadastro_indisponivel' }, 503)
        // pública (o cliente acabou de pagar e ainda não tem login): limite por IP
        if (!(await ctx.cadastro.store.tentarEvento(`cadastro:ip:${ipDe(req)}`, 10, 15 * 60_000, ctx.cadastro.agora()))) {
          return json({ erro: 'muitas_solicitacoes', mensagem: 'Muitas tentativas. Espere uns minutos.' }, 429)
        }
        const rc = await cadastrar(ctx.cadastro, { session_id: b.session_id, nome: b.nome, empresa: b.empresa, ramo: b.ramo, email: b.email })
        return json(rc, rc.ok ? 200 : 202)
      }
      // Link de instalação aberto (M5): público, o token é a prova. Só consulta; não consome o link.
      case '/instalar/abrir':
      case '/instalar/enviar-para-computador': {
        if (!ctx.cadastro) return json({ erro: 'cadastro_indisponivel' }, 503)
        if (!(await ctx.cadastro.store.tentarEvento(`instalar:ip:${ipDe(req)}`, 30, 15 * 60_000, ctx.cadastro.agora()))) {
          return json({ erro: 'muitas_solicitacoes', mensagem: 'Muitas tentativas. Espere uns minutos.' }, 429)
        }
        if (rota === '/instalar/enviar-para-computador') return json(await reenviarParaComputador(ctx.cadastro, { token: s('token') }))
        const largura = typeof (b as Record<string, unknown>).largura === 'number' ? ((b as Record<string, unknown>).largura as number) : null
        return json(await abrirLink(ctx.cadastro, { token: s('token'), user_agent: req.headers.get('User-Agent'), largura }))
      }
      // Portal (F15): o cliente já está autenticado lá; aqui só entra chamada de serviço.
      case '/compra/cancelar':
      case '/mensalidade/cancelar':
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        if (!ctx.pagamento) return json({ erro: 'pagamento_indisponivel' }, 503)
        return json(await (rota === '/compra/cancelar' ? cancelarCompra : cancelarMensalidade)(ctx.pagamento, s('email')))
      case '/admin/processar-atrasos': // agendador diário (cron do Supabase)
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        if (!ctx.pagamento) return json({ erro: 'pagamento_indisponivel' }, 503)
        return json(await processarAtrasos(ctx.pagamento))
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
