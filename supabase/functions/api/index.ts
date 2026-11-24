// Ponto de entrada da edge function (Deno). Fora do tsc/vitest; o deploy é da etapa /entregar.
// Segredos vêm do ambiente do Supabase (nunca de arquivo). O adaptador Store do Supabase e o
// carregador do kit (bucket privado) entram aqui no deploy (incluindo enviarAvisoAtraso, S10).
// @ts-nocheck
import { importarChavePrivada } from '../_shared/cripto.ts'
import { lerEmailsAdmin } from '../_shared/admin.ts'
import { ufDoCabecalhoConfiavel } from '../_shared/geo.ts'
import { tratar } from '../_shared/http.ts'
import { criarStripeApi } from '../_shared/pagamento/stripe-api.ts'

Deno.serve(async (req) => {
  const segredo = Deno.env.get('ATLAS_SEGREDO')
  const servico = Deno.env.get('ATLAS_SERVICO_TOKEN')
  // Ed25519: ATLAS_SIGN_SK = chave privada PKCS8 em base64 (só no ambiente do servidor).
  // A chave PÚBLICA correspondente será embutida no app num milestone futuro (verificar-publico.ts).
  const sk = Deno.env.get('ATLAS_SIGN_SK')
  if (!segredo || !servico || !sk) return new Response('configuração ausente', { status: 503 })
  const { criarStoreSupabase, criarCarregarKit, enviarCodigo } = await import('../_shared/adaptadores_supabase.ts')
  const { criarCanalPush, criarEnvioPush } = await import('../_shared/adaptadores_supabase.ts')
  const { criarArmazemPrototipos, criarCanalCelular, criarAtualizacao, criarInstalador, enviarAvisoAtraso, enviarBoasVindas, enviarConfirmacaoDegustacao, enviarCortesia, gerarCodigoEntrada, enviarCodigoEntrada } = await import('../_shared/adaptadores_supabase.ts')
  const deps = { store: criarStoreSupabase(), agora: () => new Date(), enviarCodigoPorEmail: enviarCodigo, segredo, chaveAssinatura: await importarChavePrivada(sk) }
  // Pagamento: a conta Stripe é SEMPRE do cliente. Chaves por conta (STRIPE_<ref>_SK / STRIPE_<ref>_WHSEC) vêm dos
  // segredos do Supabase, resolvidas por referência guardada em contas_gateway. Nunca uma conta central do Luiz.
  const segredos = {
    chaveSecreta: async (ref: string) => Deno.env.get(`STRIPE_${ref}_SK`) ?? null,
    segredoWebhook: async (ref: string) => Deno.env.get(`STRIPE_${ref}_WHSEC`) ?? null,
  }
  const pagamento = { ...deps, segredos, stripe: (chave: string) => criarStripeApi(chave, fetch), enviarAvisoAtraso }
  // Cadastro pós-pagamento (M4). enviarBoasVindas monta o texto com montarBoasVindas (_shared/emails.ts); o envio real é do /entregar.
  // Download do instalador (/instalar/baixar): só liga com ATLAS_INSTALADOR_ARQUIVO definido; sem ele a página avisa que ainda não há arquivo.
  const cadastro = { ...deps, enviarBoasVindas, instalador: criarInstalador() }
  // Portal (M6, /conta): o JWT do Supabase Auth é validado NO SERVIDOR (GET /auth/v1/user com o token do cliente + chave anon);
  // só vale com e-mail confirmado. O resto (dono, licença, ações) é decidido por portal.ts a partir dessa identidade.
  const autenticarPortal = async (jwt) => {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') } })
    if (!r.ok) return null
    const u = await r.json()
    return u?.id && u?.email && u?.email_confirmed_at ? { auth_user_id: u.id, email: u.email } : null
  }
  // LGPD: exclusão do login no Auth com a service_role (só no servidor). Falhou = lança, e a exclusão não finge que acabou.
  const removerUsuarioAuth = async (id) => {
    const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${chave}`, apikey: chave } })
    if (!r.ok && r.status !== 404) throw new Error(`auth admin delete: ${r.status}`)
  }
  const degustacao = { ...deps, enviarConfirmacaoDegustacao }
  const portal = { ...pagamento, ...cadastro, autenticarPortal, removerUsuarioAuth, gerarCodigoEntrada, enviarCodigoEntrada }
  // Painel do admin (M7): mesma validação de JWT do portal + allowlist ATLAS_ADMIN_EMAILS (vazia = ninguém entra).
  const admin = { ...deps, enviarCortesia, autenticarPortal, emailsAdmin: lerEmailsAdmin(Deno.env.get('ATLAS_ADMIN_EMAILS')) }
  return tratar(
    {
      deps,
      // Atualização automática (/atualizacao): mesma pasta privada do instalador + atualizacao.json do workflow.
      atualizacao: criarAtualizacao(),
      // Link provisório do protótipo para o celular (/prototipo/link e /prototipo/ver): pasta privada "prototipos".
      prototipos: criarArmazemPrototipos(),
      // M33: celular como controle remoto do notebook (tabelas celular_*, migration 0029).
      celular: criarCanalCelular(),
      // M41: avisos no celular (Web Push, tabela celular_push da migration 0030). As chaves VAPID são segredos do Supabase,
      // criados pelo Luiz; sem elas, só as rotas de aviso respondem 503.
      push: criarCanalPush(),
      enviarPush: criarEnvioPush(Deno.env.get('VAPID_PUBLIC_KEY'), Deno.env.get('VAPID_PRIVATE_KEY'), Deno.env.get('VAPID_SUBJECT')),
      chavePublicaPush: Deno.env.get('VAPID_PUBLIC_KEY') ?? undefined,
      admin,
      pagamento,
      cadastro,
      portal,
      degustacao,
      // UF só para o Radar. Cabeçalhos de geo (cf-*, x-vercel-*) o cliente consegue forjar, então por padrão a UF é DESCONHECIDA.
      // Só vale o cabeçalho que o operador confirmou que o edge do Supabase sobrescreve (ATLAS_GEO_HEADER_UF = nome dele). Nunca o IP.
      ufDoAcesso: (r) => ufDoCabecalhoConfiavel(r.headers, Deno.env.get('ATLAS_GEO_HEADER_UF')),
      origemWeb: Deno.env.get('ATLAS_WEB_ORIGEM') ?? undefined,
      carregarKit: criarCarregarKit(),
      autorizarServico: (r) => r.headers.get('Authorization') === `Bearer ${servico}`,
    },
    req,
  )
})
