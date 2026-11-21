// Instalador para baixar: o .exe fica numa release do repositório PRIVADO do Atlas no GitHub. Quem tem link válido do e-mail
// recebe só um endereço temporário, que o próprio GitHub gera e assina (vale poucos minutos). O token fica no servidor.
// Por que não o Storage do Supabase: o instalador passa de 100 MB e o plano grátis aceita no máximo 50 MB por arquivo.

export interface ConfigInstalador { repo: string; tag: string; token: string }

const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

/** Lê a configuração do ambiente. Sem repositório ou sem token = desligado (null): a página avisa que ainda não há arquivo.
 *  ATLAS_INSTALADOR_REPO (dono/repositório), ATLAS_INSTALADOR_GITHUB_TOKEN (só leitura de "Contents" desse repositório),
 *  ATLAS_INSTALADOR_TAG (padrão: instalador-teste). */
export function lerConfigInstalador(env: (nome: string) => string | undefined): ConfigInstalador | null {
  const repo = (env('ATLAS_INSTALADOR_REPO') ?? '').trim()
  const token = (env('ATLAS_INSTALADOR_GITHUB_TOKEN') ?? '').trim()
  const tag = (env('ATLAS_INSTALADOR_TAG') ?? '').trim() || 'instalador-teste'
  if (!REPO_RE.test(repo) || repo.includes('..') || !token || !TAG_RE.test(tag)) return null
  return { repo, tag, token }
}

/** Devolve a função que pede o endereço temporário do .exe. Qualquer dúvida devolve null (nunca um endereço inventado). */
export function criarLinkInstaladorGitHub(cfg: ConfigInstalador, buscar: typeof fetch = fetch): () => Promise<string | null> {
  const cabecalhos = { Authorization: `Bearer ${cfg.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'atlas-servidor' }
  const base = `https://api.github.com/repos/${cfg.repo}/releases`
  return async () => {
    try {
      const r = await buscar(`${base}/tags/${cfg.tag}`, { headers: { ...cabecalhos, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) })
      if (!r.ok) return null
      const release = (await r.json()) as { assets?: Array<{ id?: unknown; name?: unknown }> }
      const exe = (release.assets ?? []).find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe') && Number.isInteger(a.id))
      if (!exe) return null
      // Sem seguir o redirecionamento: o que interessa é o endereço temporário (Location), que vai para o navegador do cliente.
      const a = await buscar(`${base}/assets/${exe.id}`, { headers: { ...cabecalhos, Accept: 'application/octet-stream' }, redirect: 'manual', signal: AbortSignal.timeout(8000) })
      const destino = a.status >= 300 && a.status < 400 ? a.headers.get('Location') : null
      return destino && /^https:\/\//.test(destino) ? destino : null
    } catch {
      return null
    }
  }
}
