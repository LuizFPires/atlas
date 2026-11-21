// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarLinkInstaladorGitHub, lerConfigInstalador } from '../functions/_shared/instalador-github.ts'

const CFG = { repo: 'dono/atlas', tag: 'instalador-teste', token: 'ghp_segredo' }
const TEMPORARIO = 'https://release-assets.githubusercontent.com/arquivo?assinatura=1'

/** GitHub de mentira: a release tem um .exe; pedir o arquivo devolve um redirecionamento para o endereço temporário. */
function github(over: { release?: unknown; statusRelease?: number; location?: string | null; statusArquivo?: number } = {}) {
  const pedidos: Array<{ url: string; init: RequestInit }> = []
  const f = (async (url: string, init: RequestInit = {}) => {
    pedidos.push({ url, init })
    if (url.endsWith('/releases/tags/instalador-teste')) {
      const corpo = over.release ?? { assets: [{ id: 7, name: 'notas.txt' }, { id: 42, name: 'Atlas-Instalador-TESTE-0.1.0.exe' }] }
      return new Response(JSON.stringify(corpo), { status: over.statusRelease ?? 200 })
    }
    const location = over.location === undefined ? TEMPORARIO : over.location
    return new Response(null, { status: over.statusArquivo ?? 302, headers: location ? { Location: location } : {} })
  }) as unknown as typeof fetch
  return { f, pedidos }
}

describe('endereço temporário do instalador (release privada do GitHub)', () => {
  it('acha o .exe da release e devolve o endereço temporário, sem seguir o redirecionamento', async () => {
    const { f, pedidos } = github()
    expect(await criarLinkInstaladorGitHub(CFG, f)()).toBe(TEMPORARIO)
    expect(pedidos.map((p) => p.url)).toEqual([
      'https://api.github.com/repos/dono/atlas/releases/tags/instalador-teste',
      'https://api.github.com/repos/dono/atlas/releases/assets/42',
    ])
    expect(pedidos[1].init.redirect).toBe('manual')
    expect((pedidos[1].init.headers as Record<string, string>).Accept).toBe('application/octet-stream')
    expect((pedidos[1].init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_segredo')
  })

  it('o segredo nunca aparece no endereço devolvido', async () => {
    const { f } = github()
    expect(await criarLinkInstaladorGitHub(CFG, f)()).not.toContain('ghp_segredo')
  })

  it('qualquer dúvida devolve null: release sem .exe, GitHub negando, sem redirecionamento ou endereço que não é https', async () => {
    expect(await criarLinkInstaladorGitHub(CFG, github({ release: { assets: [{ id: 7, name: 'notas.txt' }] } }).f)()).toBeNull()
    expect(await criarLinkInstaladorGitHub(CFG, github({ release: {} }).f)()).toBeNull()
    expect(await criarLinkInstaladorGitHub(CFG, github({ statusRelease: 404 }).f)()).toBeNull()
    expect(await criarLinkInstaladorGitHub(CFG, github({ statusArquivo: 200, location: null }).f)()).toBeNull()
    expect(await criarLinkInstaladorGitHub(CFG, github({ location: 'http://sem-https.test/x' }).f)()).toBeNull()
    const cai = (async () => { throw new Error('rede fora') }) as unknown as typeof fetch
    expect(await criarLinkInstaladorGitHub(CFG, cai)()).toBeNull()
  })
})

describe('configuração', () => {
  const env = (v: Record<string, string>) => (k: string) => v[k]
  it('só liga com repositório e token válidos; a tag tem padrão', () => {
    expect(lerConfigInstalador(env({}))).toBeNull()
    expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_REPO: 'dono/atlas' }))).toBeNull()
    expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_REPO: 'dono/atlas', ATLAS_INSTALADOR_GITHUB_TOKEN: 'ghp_x' }))).toEqual({ repo: 'dono/atlas', tag: 'instalador-teste', token: 'ghp_x' })
    expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_REPO: 'dono/atlas', ATLAS_INSTALADOR_GITHUB_TOKEN: 'ghp_x', ATLAS_INSTALADOR_TAG: 'v1.0.0' }))?.tag).toBe('v1.0.0')
  })
  it('recusa repositório ou tag que mudariam o endereço chamado', () => {
    const base = { ATLAS_INSTALADOR_GITHUB_TOKEN: 'ghp_x' }
    expect(lerConfigInstalador(env({ ...base, ATLAS_INSTALADOR_REPO: 'dono/atlas/../outro' }))).toBeNull()
    expect(lerConfigInstalador(env({ ...base, ATLAS_INSTALADOR_REPO: 'dono' }))).toBeNull()
    expect(lerConfigInstalador(env({ ...base, ATLAS_INSTALADOR_REPO: 'dono/atlas', ATLAS_INSTALADOR_TAG: 'a/b?x' }))).toBeNull()
  })
})
