// Roteador das APIs S4 (sem dependência de Deno: testável com Request/Response padrão).
import { abrirLink, baixarInstalador, reenviarParaComputador } from './abertura.ts'
import { resumoDaLicenca } from './licenca-resumo.ts'
import { registrarCasoAjuda } from './ajuda-caso.ts'
import { confirmarAtivacao, solicitarCodigo, solicitarCodigoPeloLink } from './ativacao.ts'
import { validarInstancia } from './instancia.ts'
import { limparRadar, radar, resolverSinal } from './radar.ts'
import { obrasDoPortal, publicarStatusObras } from './status-obras.ts'
import { assinarPush, avisarCelular, type CanalPush, chavePublica, type EnvioPush } from './push.ts'
import { baixarReferencia, type CanalCelular, enviarReferencia, estadoDoCelular, pedirPeloCelular, publicarProjeto, publicarTeste, responderPedido, sinalDoComputador } from './celular.ts'
import { entregarKit, type CarregarKit } from './kit.ts'
import { gerarLink } from './links.ts'
import { type Deps, ErroRegra } from './tipos.ts'
import { type DepsEntrada, pedirCodigoEntrada } from './entrada.ts'
import { trocarComputador } from './troca.ts'
import { verificar } from './verificar.ts'
import { criarCheckout } from './pagamento/checkout.ts'
import { type FontesAtualizacao, verAtualizacao } from './atualizacao.ts'
import { type ArmazemPrototipos, publicarPrototipo, verPrototipo } from './prototipo-link.ts'
import type { DepsPagamento } from './pagamento/config.ts'
import { cancelarCompra, cancelarMensalidade } from './pagamento/cancelamento.ts'
import { processarAtrasos } from './pagamento/atraso.ts'
import { processarWebhook } from './pagamento/webhook.ts'
import { lerPersonalizacao, salvarPersonalizacaoDoPortal } from './personalizacao.ts'
import { cadastrar, type DepsCadastro } from './cadastro.ts'
import { criarConviteTeste, entrarNoTeste, situacaoTestadores, verConviteTeste } from './lojas.ts'
import { decidirPolitica, painelPolitica, pedirAnalise, registrarPolitica, situacaoPolitica } from './politica.ts'
import { adicionarDominio, auditarDegustacao, configDegustacaoAdmin, confirmarDegustacao, listarDominios, removerDominio, type DepsDegustacao, estadoDegustacao, pedirDegustacao } from './degustacao.ts'
import { adminLogado, fluxoCaixa, liberarCortesia, listarCortesias, type DepsAdmin, euAdmin, liberarTrocaUrgente, mapa, painel, reenviarCortesia, resolverOcorrencia, verCadastros, verEntregas } from './admin.ts'
import { cancelarPeloPortal, conta, type DepsPortal, desativarComputador, eu, excluirConta, formaDePagamento, pedirCodigoTroca, reenviarAcesso } from './portal.ts'

export interface Contexto {
  deps: Deps
  carregarKit: CarregarKit
  /** Atualização automática do app: manifesto + endereço temporário do .exe. Ausente = "nada a atualizar". */
  atualizacao?: FontesAtualizacao
  /** Links provisórios do protótipo (pasta privada). Ausente = "link indisponível". */
  prototipos?: ArmazemPrototipos
  /** M33: canal celular ↔ notebook (fila de pedidos, sinal, projetos, fotos). Ausente = rotas do celular respondem 503. */
  celular?: CanalCelular
  /** M41: avisos no celular (Web Push). Ausentes = rotas de aviso respondem 503 (o resto segue normal). */
  push?: CanalPush
  enviarPush?: EnvioPush
  /** Chave PÚBLICA VAPID (segredo VAPID_PUBLIC_KEY do Supabase). A privada nunca passa por aqui. */
  chavePublicaPush?: string
  /** Pagamento (Stripe do cliente). Ausente = rotas de pagamento respondem 503. */
  pagamento?: DepsPagamento
  /** Cadastro pós-pagamento (M4) e e-mail de boas-vindas. Ausente = /cadastro responde 503. */
  cadastro?: DepsCadastro
  /** Degustação self-service (bloco B). Ausente = /degustacao/* responde 503. */
  degustacao?: DepsDegustacao
  /** Portal do cliente (M6, login próprio). Ausente = rotas /portal/* respondem 503. */
  portal?: DepsPortal
  /** Painel do administrador (M7, F16). Ausente = rotas /admin/* de pessoa respondem 503 (nunca ficam abertas). */
  admin?: DepsAdmin
  /** UF do acesso (só para o Radar). Ausente = UF desconhecida (nada é gravado): nunca se confia em cabeçalho de geolocalização vindo do cliente. Nunca devolve nem guarda IP. */
  ufDoAcesso?: (req: Request) => string | null
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
  // ATLAS_WEB_ORIGEM pode ser uma LISTA separada por vírgula (domínio próprio, www e o endereço provisório da Vercel).
  const permitidas = (ctx.origemWeb ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const liberada = !!origem && permitidas.includes(origem)
  const cors: Record<string, string> = liberada
    ? { 'Access-Control-Allow-Origin': origem, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' }
    : {}
  if (req.method === 'OPTIONS') return new Response(null, { status: liberada ? 204 : 403, headers: cors })
  const res = await tratarRota(ctx, req)
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  return res
}

async function tratarRota(ctx: Contexto, req: Request): Promise<Response> {
  // Tira o prefixo do Supabase (/functions/v1/) E o nome da função (api/), que vêm no caminho ao servir a edge function.
  const rota = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?(api\/)?/, '/').replace(/\/+$/, '')
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
        case '/admin/cortesia':
          return json(await liberarCortesia(ctx.admin, jwt, { email: o.email, validade_em: o.validade_em, nome: o.nome, silencioso: o.silencioso }))
        case '/admin/cortesias':
          return json(await listarCortesias(ctx.admin, jwt))
        case '/admin/cortesia/reenviar':
          return json(await reenviarCortesia(ctx.admin, jwt, { email: o.email }))
        case '/admin/degustacao':
          return json(await configDegustacaoAdmin(ctx.admin, jwt, { ativa: o.ativa, dias: o.dias }))
        case '/admin/dominios':
          return json(await listarDominios(ctx.admin, jwt))
        case '/admin/dominios/adicionar':
          return json(await adicionarDominio(ctx.admin, jwt, { dominio: o.dominio }))
        case '/admin/dominios/remover':
          return json(await removerDominio(ctx.admin, jwt, { dominio: o.dominio }))
        case '/admin/cadastros':
          return json(await verCadastros(ctx.admin, jwt))
        case '/admin/fluxo-caixa':
          return json(await fluxoCaixa(ctx.admin, jwt))
        case '/admin/politica':
          return json(await painelPolitica(ctx.admin, jwt))
        case '/admin/politica/decidir':
          return json(await decidirPolitica(ctx.admin, jwt, { licenca_id: o.licenca_id, obra_id: o.obra_id, decisao: o.decisao }))
        case '/admin/radar':
          return json(await radar(ctx.admin, jwt))
        case '/admin/radar/resolver':
          return json(await resolverSinal(ctx.admin, jwt, o.id))
        case '/admin/mapa':
          return json(await mapa(ctx.admin, jwt))
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
        // Antes de entrar (sem JWT): pede o código de entrada. Resposta igual para qualquer e-mail.
        case '/portal/entrar/codigo': {
          const p = ctx.portal as Partial<DepsEntrada>
          if (!p.gerarCodigoEntrada || !p.enviarCodigoEntrada) return json({ erro: 'portal_indisponivel' }, 503)
          return json(await pedirCodigoEntrada(ctx.portal as unknown as DepsEntrada, s('email'), ipDe(req)))
        }
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
        case '/portal/conta/excluir':
          return json(await excluirConta(ctx.portal, jwt, (b as Record<string, unknown>).confirmar))
        case '/portal/forma-pagamento':
          return json(await formaDePagamento(ctx.portal, jwt))
        case '/portal/obras':
          return json(await obrasDoPortal(ctx.portal, jwt))
        case '/portal/personalizacao':
          return json(await lerPersonalizacao(ctx.portal, jwt))
        case '/portal/personalizacao/salvar':
          return json(await salvarPersonalizacaoDoPortal(ctx.portal, jwt, b))
        // M33: o celular como controle remoto do notebook do dono.
        case '/portal/celular':
          return json(await estadoDoCelular(ctx.portal, ctx.celular, jwt))
        case '/portal/celular/pedido':
          return json(await pedirPeloCelular(ctx.portal, ctx.celular, jwt, b as Record<string, unknown>))
        case '/portal/celular/push/chave':
          return json(chavePublica(ctx.chavePublicaPush))
        case '/portal/celular/push/assinar':
          return json(await assinarPush(ctx.portal, ctx.push, ctx.chavePublicaPush, jwt, (b as Record<string, unknown>).assinatura))
        case '/portal/celular/referencia':
          return json(await enviarReferencia(ctx.portal, ctx.celular, jwt, (b as Record<string, unknown>).imagem))
        default:
          return json({ erro: 'nao_encontrado' }, 404)
      }
    }
    switch (rota) {
      case '/link-instalacao':
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        return json(await gerarLink(ctx.deps, s('email')))
      // Degustação (bloco B): públicas. O freio principal é o clique no link do e-mail; IP, e-mail e domínio têm limites próprios.
      case '/degustacao/limpar-ips': // agendador diário (cron): zera o ip de pedidos antigos (LGPD)
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        return json({ ok: true, limpos: await ctx.deps.store.limparIpsDegustacao(ctx.deps.agora(), 30), radar_limpos: await limparRadar(ctx.deps) })
      case '/degustacao/auditar': // agendador semanal (cron): varredura anti-fraude; só abre ocorrências no painel
        if (!ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        return json(await auditarDegustacao(ctx.deps))
      case '/degustacao/estado':
        return json(await estadoDegustacao((ctx.degustacao ?? ctx.deps) as DepsDegustacao))
      case '/degustacao/pedir':
        if (!ctx.degustacao) return json({ erro: 'degustacao_indisponivel' }, 503)
        return json(await pedirDegustacao(ctx.degustacao, { email: (b as Record<string, unknown>).email, ip: ipDe(req) }))
      case '/degustacao/confirmar':
        if (!ctx.degustacao) return json({ erro: 'degustacao_indisponivel' }, 503)
        return json(await confirmarDegustacao(ctx.degustacao, { token: (b as Record<string, unknown>).token, ip: ipDe(req) }))
      case '/ativar/solicitar-codigo':
        return json(await solicitarCodigo(ctx.deps, s('email'), 'ativacao', ipDe(req)))
      case '/ativar/solicitar-codigo-link':
        return json(await solicitarCodigoPeloLink(ctx.deps, s('token'), ipDe(req)))
      case '/ativar/confirmar':
        return json(await confirmarAtivacao(ctx.deps, { email: s('email'), codigo: s('codigo'), token: s('token'), computador_hash: s('computador_hash') }))
      case '/trocar-computador/solicitar-codigo':
        return json(await solicitarCodigo(ctx.deps, s('email'), 'troca', ipDe(req)))
      case '/trocar-computador':
        return json(await trocarComputador(ctx.deps, { email: s('email'), codigo: s('codigo'), novo_hash: s('novo_hash') }))
      case '/pagamento/checkout': {
        if (!ctx.pagamento) return json({ erro: 'pagamento_indisponivel' }, 503)
        const tipo = s('tipo') === 'mensalidade' ? 'mensalidade' : s('tipo') === 'prateleira' ? 'prateleira' : 'implantacao'
        // compra inicial é pública (com limite por IP); mensalidade é de serviço (portal já autenticado).
        if (tipo === 'mensalidade' && !ctx.autorizarServico(req)) return json({ erro: 'nao_autorizado' }, 401)
        if (tipo !== 'mensalidade' && !(await ctx.pagamento.store.tentarEvento(`checkout:ip:${ipDe(req)}`, 10, 15 * 60_000, ctx.pagamento.agora()))) {
          return json({ erro: 'muitas_solicitacoes', mensagem: 'Muitas tentativas. Espere uns minutos.' }, 429)
        }
        return json(await criarCheckout(ctx.pagamento, { conta_id: s('conta_id'), tipo, segmento: s('segmento'), email: s('email'), documento: s('documento'), parcelas: Number((b as Record<string, unknown>).parcelas) || 1, licenca_id: s('licenca_id'), aceite_termos_versao: (b as Record<string, unknown>).aceite_termos === true ? s('versao_termos') : '', ...(s('origem') === 'app' ? { origem: 'app' as const } : {}), ...(s('mercado') === 'us' ? { mercado: 'us' as const } : {}) }))
      }
      case '/cadastro': {
        if (!ctx.cadastro) return json({ erro: 'cadastro_indisponivel' }, 503)
        // pública (o cliente acabou de pagar e ainda não tem login): limite por IP
        if (!(await ctx.cadastro.store.tentarEvento(`cadastro:ip:${ipDe(req)}`, 10, 15 * 60_000, ctx.cadastro.agora()))) {
          return json({ erro: 'muitas_solicitacoes', mensagem: 'Muitas tentativas. Espere uns minutos.' }, 429)
        }
        const rc = await cadastrar(ctx.cadastro, { session_id: b.session_id, nome: b.nome, empresa: b.empresa, ramo: b.ramo, email: b.email, cidade: b.cidade, uf: b.uf })
        return json(rc, rc.ok ? 200 : 202)
      }
      // Link de instalação aberto (M5): público, o token é a prova. Só consulta; não consome o link.
      case '/instalar/abrir':
      case '/instalar/baixar':
      case '/instalar/enviar-para-computador': {
        if (!ctx.cadastro) return json({ erro: 'cadastro_indisponivel' }, 503)
        if (!(await ctx.cadastro.store.tentarEvento(`instalar:ip:${ipDe(req)}`, 30, 15 * 60_000, ctx.cadastro.agora()))) {
          return json({ erro: 'muitas_solicitacoes', mensagem: 'Muitas tentativas. Espere uns minutos.' }, 429)
        }
        if (rota === '/instalar/enviar-para-computador') return json(await reenviarParaComputador(ctx.cadastro, { token: s('token') }))
        if (rota === '/instalar/baixar') return json(await baixarInstalador(ctx.cadastro, { token: s('token'), sistema: s('sistema') === 'mac' ? 'mac' : 'windows' }))
        const largura = typeof (b as Record<string, unknown>).largura === 'number' ? ((b as Record<string, unknown>).largura as number) : null
        return json(await abrirLink(ctx.cadastro, { token: s('token'), user_agent: req.headers.get('User-Agent'), largura, toque: (b as Record<string, unknown>).toque === true }))
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
      // Contador do teste no app: só leitura do tipo e da validade da licença, com a credencial do dispositivo.
      case '/licenca/resumo':
        return json(await resumoDaLicenca(ctx.deps, { email: s('email'), computador_hash: s('computador_hash'), token_dispositivo: dispositivo }))
      case '/ajuda-caso':
        return json(await registrarCasoAjuda(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, tipo: b.tipo, descricao: b.descricao }))
      case '/instancia/validar':
        return json(await validarInstancia(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, uf: ctx.ufDoAcesso ? ctx.ufDoAcesso(req) : null }))
      case '/status-obras/publicar':
        return json(await publicarStatusObras(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obras: (b as Record<string, unknown>).obras }))
      // M33: o notebook do dono busca os pedidos do celular e publica o resultado.
      case '/celular/sinal':
        return json(await sinalDoComputador(ctx.deps, ctx.celular, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, ocupado: (b as Record<string, unknown>).ocupado }))
      case '/celular/resposta':
        return json(await responderPedido(ctx.deps, ctx.celular, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, pedido_id: b.pedido_id, estado: b.estado, mensagem: b.mensagem }))
      case '/celular/projeto': {
        const o = b as Record<string, unknown>
        return json(await publicarProjeto(ctx.deps, ctx.celular, ctx.prototipos, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: o.obra_id, projeto: o.projeto, documento: o.documento }))
      }
      case '/celular/teste': {
        const o = b as Record<string, unknown>
        return json(await publicarTeste(ctx.deps, ctx.celular, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: o.obra_id, teste: o.teste }))
      }
      case '/celular/avisar':
        return json(await avisarCelular(ctx.deps, ctx.push, ctx.enviarPush, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, titulo: (b as Record<string, unknown>).titulo, texto: (b as Record<string, unknown>).texto }))
      case '/celular/referencia':
        return json(await baixarReferencia(ctx.deps, ctx.celular, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, id: b.id }), 200, { 'Cache-Control': 'no-store' })
      case '/prototipo/link': {
        const origem = (ctx.origemWeb ?? '').split(',').map((x) => x.trim()).find(Boolean)
        return json(await publicarPrototipo(ctx.deps, ctx.prototipos, origem, { email: s('email'), computador_hash: s('computador_hash'), token_dispositivo: dispositivo, nome: s('nome'), documento: s('documento') }), 200, { 'Cache-Control': 'no-store' })
      }
      case '/prototipo/ver':
        return json(await verPrototipo(ctx.deps, ctx.prototipos, s('token')), 200, { 'Cache-Control': 'no-store' })
      case '/atualizacao':
        return json(await verAtualizacao(ctx.deps, ctx.atualizacao, { email: s('email'), computador_hash: s('computador_hash'), token_dispositivo: dispositivo, versao: s('versao'), sistema: s('sistema') === 'mac' ? 'mac' : 'windows' }), 200, { 'Cache-Control': 'no-store' })
      // M65: o Atlas não constrói outro Atlas (pedido bloqueado, pedido de análise, situação da obra).
      case '/politica/registrar':
        return json(await registrarPolitica(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: (b as Record<string, unknown>).obra_id, onde: (b as Record<string, unknown>).onde, texto: (b as Record<string, unknown>).texto }))
      case '/politica/analise':
        return json(await pedirAnalise(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: (b as Record<string, unknown>).obra_id, texto: (b as Record<string, unknown>).texto }))
      case '/politica/situacao':
        return json(await situacaoPolitica(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: (b as Record<string, unknown>).obra_id }))
      // M59: os 12 testadores do Google (convite do cliente; página pública do testador; contagem).
      case '/lojas/convite': {
        const o = b as Record<string, unknown>
        const r = await criarConviteTeste(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: o.obra_id, app_nome: o.app_nome, grupo_url: o.grupo_url, optin_url: o.optin_url })
        const origem = (ctx.origemWeb ?? '').split(',').map((x) => x.trim()).find((x) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(x))
        return json({ ...r, link: origem ? `${origem}/teste/${r.codigo}` : null })
      }
      case '/lojas/convite/ver':
        return json(await verConviteTeste(ctx.deps, { codigo: s('codigo') }), 200, { 'Cache-Control': 'no-store' })
      case '/lojas/teste/entrar':
        return json(await entrarNoTeste(ctx.deps, { codigo: s('codigo'), nome: s('nome'), ip: ipDe(req) }))
      case '/lojas/testadores':
        return json(await situacaoTestadores(ctx.deps, { email: b.email, computador_hash: b.computador_hash, token_dispositivo: dispositivo, obra_id: (b as Record<string, unknown>).obra_id }), 200, { 'Cache-Control': 'no-store' })
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
    const id = crypto.randomUUID()
    // Nunca logar o objeto de erro bruto (pode, um dia, carregar algo sensível): só o rastro de Error ou uma string segura.
    console.error(id, e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e))
    return json({ erro: 'interno', mensagem: `O servidor do Atlas teve um problema (não foi nada que você fez). Tente de novo em alguns minutos; se continuar, use a Ajuda do Atlas e informe o código ${id.slice(0, 8)}.`, id }, 500)
  }
}
