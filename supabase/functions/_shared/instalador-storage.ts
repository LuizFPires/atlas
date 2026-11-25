// Instalador para baixar: o .exe fica numa pasta PRIVADA do Storage do Supabase (bucket "instalador"). Quem tem link válido do
// e-mail recebe só um endereço temporário, assinado pelo Supabase. Ninguém baixa sem passar pelo servidor.
// Quem sobe o arquivo é o workflow "Instalador de teste (Windows)". Lógica sem Deno, para o teste rodar no vitest.

export interface ConfigInstalador { bucket: string; arquivo: string }

/** Validade do endereço temporário: dá para começar o download, e é curto para não virar link repassável. */
export const VALIDADE_LINK_INSTALADOR_S = 10 * 60

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
  download?: (arquivo: string) => Promise<{ data: Blob | null; error: unknown }>
}

/** Manifesto da atualização automática, escrito pelo workflow ao lado do .exe (mesma pasta privada). */
export const ARQUIVO_MANIFESTO = 'atualizacao.json'

/** Devolve a função que pede o endereço temporário, baixando com o nome pedido (abertura.ts põe nele o código do link). Qualquer dúvida devolve null (nunca um endereço inventado). */
export function criarLinkInstaladorStorage(cfg: ConfigInstalador, doBucket: DoBucket): (nomeDoDownload: string) => Promise<string | null> {
  return async (nomeDoDownload) => {
    try {
      const { data, error } = await doBucket(cfg.bucket).createSignedUrl(cfg.arquivo, VALIDADE_LINK_INSTALADOR_S, { download: nomeDoDownload })
      return error || !data?.signedUrl ? null : data.signedUrl
    } catch {
      return null
    }
  }
}

/** Atualização automática: o manifesto (atualizacao.json) e o endereço temporário do MESMO .exe da página de instalação.
 *  Qualquer dúvida devolve null; quem valida o conteúdo do manifesto é atualizacao.ts. */
export function criarFonteAtualizacaoStorage(cfg: ConfigInstalador, doBucket: DoBucket, manifestoNome = ARQUIVO_MANIFESTO) {
  return {
    async manifesto(): Promise<unknown> {
      try {
        // Chamar COMO MÉTODO: o cliente do Supabase usa this (separar a função perdia o this e o manifesto vinha null; 23/11/2026).
        const pasta = doBucket(cfg.bucket)
        if (!pasta.download) return null
        const { data, error } = await pasta.download(manifestoNome)
        if (error || !data || data.size > 4096) return null
        return JSON.parse(await data.text())
      } catch {
        return null
      }
    },
    link: criarLinkInstaladorStorage(cfg, doBucket),
  }
}

/** M48: a atualização do Mac fica na mesma pasta privada: Atlas-mac.zip (o Atlas.app) e atualizacao-mac.json (escritos pelo
 *  workflow do Mac). Liga junto com o instalador do Windows (mesma pasta). */
export const ARQUIVO_ATUALIZACAO_MAC = 'Atlas-mac.zip'
export const ARQUIVO_MANIFESTO_MAC = 'atualizacao-mac.json'
