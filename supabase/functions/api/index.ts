// Ponto de entrada da edge function (Deno). Fora do tsc/vitest; o deploy é da etapa /entregar.
// Segredos vêm do ambiente do Supabase (nunca de arquivo). O adaptador Store do Supabase e o
// carregador do kit (bucket privado) entram aqui no deploy.
// @ts-nocheck
import { tratar } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const segredo = Deno.env.get('ATLAS_SEGREDO')
  const servico = Deno.env.get('ATLAS_SERVICO_TOKEN')
  if (!segredo || !servico) return new Response('configuração ausente', { status: 503 })
  const { criarStoreSupabase, criarCarregarKit, enviarCodigo } = await import('../_shared/adaptadores_supabase.ts')
  return tratar(
    {
      deps: { store: criarStoreSupabase(), agora: () => new Date(), enviarCodigoPorEmail: enviarCodigo, segredo },
      carregarKit: criarCarregarKit(),
      autorizarServico: (r) => r.headers.get('Authorization') === `Bearer ${servico}`,
    },
    req,
  )
})
