// Ponto de entrada da edge function (Deno). Fora do tsc/vitest; o deploy é da etapa /entregar.
// Segredos vêm do ambiente do Supabase (nunca de arquivo). O adaptador Store do Supabase e o
// carregador do kit (bucket privado) entram aqui no deploy.
// @ts-nocheck
import { importarChavePrivada } from '../_shared/cripto.ts'
import { tratar } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const segredo = Deno.env.get('ATLAS_SEGREDO')
  const servico = Deno.env.get('ATLAS_SERVICO_TOKEN')
  // Ed25519: ATLAS_SIGN_SK = chave privada PKCS8 em base64 (só no ambiente do servidor).
  // A chave PÚBLICA correspondente será embutida no app num milestone futuro (verificar-publico.ts).
  const sk = Deno.env.get('ATLAS_SIGN_SK')
  if (!segredo || !servico || !sk) return new Response('configuração ausente', { status: 503 })
  const { criarStoreSupabase, criarCarregarKit, enviarCodigo } = await import('../_shared/adaptadores_supabase.ts')
  return tratar(
    {
      deps: { store: criarStoreSupabase(), agora: () => new Date(), enviarCodigoPorEmail: enviarCodigo, segredo, chaveAssinatura: await importarChavePrivada(sk) },
      carregarKit: criarCarregarKit(),
      autorizarServico: (r) => r.headers.get('Authorization') === `Bearer ${servico}`,
    },
    req,
  )
})
