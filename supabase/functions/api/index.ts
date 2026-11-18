// Ponto de entrada da edge function (Deno). Fora do tsc/vitest; o deploy é da etapa /entregar.
// Segredos vêm do ambiente do Supabase (nunca de arquivo). O adaptador Store do Supabase e o
// carregador do kit (bucket privado) entram aqui no deploy (incluindo enviarAvisoAtraso, S10).
// @ts-nocheck
import { importarChavePrivada } from '../_shared/cripto.ts'
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
  const { enviarAvisoAtraso } = await import('../_shared/adaptadores_supabase.ts')
  const deps = { store: criarStoreSupabase(), agora: () => new Date(), enviarCodigoPorEmail: enviarCodigo, segredo, chaveAssinatura: await importarChavePrivada(sk) }
  // Pagamento: a conta Stripe é SEMPRE do cliente. Chaves por conta (STRIPE_<ref>_SK / STRIPE_<ref>_WHSEC) vêm dos
  // segredos do Supabase, resolvidas por referência guardada em contas_gateway. Nunca uma conta central do Luiz.
  const segredos = {
    chaveSecreta: async (ref: string) => Deno.env.get(`STRIPE_${ref}_SK`) ?? null,
    segredoWebhook: async (ref: string) => Deno.env.get(`STRIPE_${ref}_WHSEC`) ?? null,
  }
  const pagamento = { ...deps, segredos, stripe: (chave: string) => criarStripeApi(chave, fetch), enviarAvisoAtraso }
  return tratar(
    {
      deps,
      pagamento,
      carregarKit: criarCarregarKit(),
      autorizarServico: (r) => r.headers.get('Authorization') === `Bearer ${servico}`,
    },
    req,
  )
})
