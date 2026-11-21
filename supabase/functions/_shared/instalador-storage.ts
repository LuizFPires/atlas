// Instalador para baixar: o .exe fica numa pasta PRIVADA do Storage do Supabase (bucket "instalador"). Quem tem link válido do
// e-mail recebe só um endereço temporário, assinado pelo Supabase. Ninguém baixa sem passar pelo servidor.
// Quem sobe o arquivo é o workflow "Instalador de teste (Windows)". Lógica sem Deno, para o teste rodar no vitest.

export interface ConfigInstalador { bucket: string; arquivo: string }

/** Validade do endereço temporário: dá para começar o download, e é curto para não virar link repassável. */
export const VALIDADE_LINK_INSTALADOR_S = 10 * 60
/** Nome com que o arquivo chega ao computador do cliente (a página fala esse nome). */
export const NOME_DO_DOWNLOAD = 'Atlas-Instalador.exe'

const ARQUIVO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/
const BUCKET_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/

/** ATLAS_INSTALADOR_ARQUIVO (caminho do .exe no bucket) liga o download; sem ele fica desligado (null) e a página avisa que
 *  ainda não há arquivo. ATLAS_INSTALADOR_BUCKET é opcional (padrão: instalador). */
export function lerConfigInstalador(env: (nome: string) => string | undefined): ConfigInstalador | null {
  const arquivo = (env('ATLAS_INSTALADOR_ARQUIVO') ?? '').trim()
  const bucket = (env('ATLAS_INSTALADOR_BUCKET') ?? '').trim() || 'instalador'
  if (arquivo.length > 200 || !ARQUIVO_RE.test(arquivo) || arquivo.includes('..') || !BUCKET_RE.test(bucket)) return null
  return { bucket, arquivo }
}

/** A parte do cliente do Supabase que usamos: `storage.from(bucket)`. */
export type DoBucket = (bucket: string) => {
  createSignedUrl: (arquivo: string, validadeS: number, opcoes?: { download?: string }) => Promise<{ data: { signedUrl: string } | null; error: unknown }>
}

/** Devolve a função que pede o endereço temporário. Qualquer dúvida devolve null (nunca um endereço inventado). */
export function criarLinkInstaladorStorage(cfg: ConfigInstalador, doBucket: DoBucket): () => Promise<string | null> {
  return async () => {
    try {
      const { data, error } = await doBucket(cfg.bucket).createSignedUrl(cfg.arquivo, VALIDADE_LINK_INSTALADOR_S, { download: NOME_DO_DOWNLOAD })
      return error || !data?.signedUrl ? null : data.signedUrl
    } catch {
      return null
    }
  }
}
