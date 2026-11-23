// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarFonteAtualizacaoStorage, criarLinkInstaladorStorage, lerConfigInstalador, VALIDADE_LINK_INSTALADOR_S } from '../functions/_shared/instalador-storage.ts'

const env = (v: Record<string, string>) => (k: string) => v[k]
const TEMPORARIO = 'https://projeto.supabase.co/storage/v1/object/sign/instalador/Atlas-Instalador.exe?token=abc'

/** Storage de mentira: guarda o que foi pedido e responde como o cliente do Supabase. */
function storage(resposta: { data: { signedUrl: string } | null; error: unknown }) {
  const pedidos: Array<{ bucket: string; arquivo: string; validade: number; opcoes: unknown }> = []
  return {
    pedidos,
    de: (bucket: string) => ({
      createSignedUrl: async (arquivo: string, validade: number, opcoes?: unknown) => { pedidos.push({ bucket, arquivo, validade, opcoes }); return resposta },
    }),
  }
}

describe('configuração', () => {
  it('desligado sem ATLAS_INSTALADOR_ARQUIVO; o bucket tem padrão', () => {
    expect(lerConfigInstalador(env({}))).toBeNull()
    expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_ARQUIVO: 'Atlas-Instalador.exe' }))).toEqual({ bucket: 'instalador', arquivo: 'Atlas-Instalador.exe' })
    expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_ARQUIVO: 'v1/Atlas.exe', ATLAS_INSTALADOR_BUCKET: 'downloads' }))).toEqual({ bucket: 'downloads', arquivo: 'v1/Atlas.exe' })
  })
  it('recusa caminho ou bucket que escapariam da pasta', () => {
    for (const arquivo of ['../segredo.exe', 'a/../../b.exe', '/Atlas.exe', 'Atlas.exe?x=1', 'com espaco.exe', '']) {
      expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_ARQUIVO: arquivo })), arquivo).toBeNull()
    }
    expect(lerConfigInstalador(env({ ATLAS_INSTALADOR_ARQUIVO: 'Atlas.exe', ATLAS_INSTALADOR_BUCKET: 'a/b' }))).toBeNull()
  })
})

describe('endereço temporário do instalador (pasta privada do Storage)', () => {
  const cfg = { bucket: 'instalador', arquivo: 'Atlas-Instalador.exe' }
  it('pede um endereço que vale 10 minutos e baixa com o nome pedido (que leva o código do link)', async () => {
    const s = storage({ data: { signedUrl: TEMPORARIO }, error: null })
    expect(await criarLinkInstaladorStorage(cfg, s.de)('Atlas-Instalador-abc.exe')).toBe(TEMPORARIO)
    expect(VALIDADE_LINK_INSTALADOR_S).toBe(600)
    expect(s.pedidos).toEqual([{ bucket: 'instalador', arquivo: 'Atlas-Instalador.exe', validade: 600, opcoes: { download: 'Atlas-Instalador-abc.exe' } }])
  })
  it('arquivo que ainda não subiu, erro do Storage ou queda: null, nunca um endereço inventado', async () => {
    expect(await criarLinkInstaladorStorage(cfg, storage({ data: null, error: { message: 'Object not found' } }).de)('a.exe')).toBeNull()
    expect(await criarLinkInstaladorStorage(cfg, storage({ data: { signedUrl: '' }, error: null }).de)('a.exe')).toBeNull()
    const cai = () => ({ createSignedUrl: async () => { throw new Error('fora') } })
    expect(await criarLinkInstaladorStorage(cfg, cai)('a.exe')).toBeNull()
  })
})

describe('fonte da atualização no Storage', () => {
  it('lê o atualizacao.json da mesma pasta privada e assina o mesmo .exe', async () => {
    const pedidos: string[] = []
    const doBucket = (b: string) => ({
      createSignedUrl: async (arq: string, _s: number, o?: { download?: string }) => { pedidos.push(`${b}/${arq}/${o?.download}`); return { data: { signedUrl: 'https://s/assinado' }, error: null } },
      download: async (arq: string) => { pedidos.push(`baixar ${b}/${arq}`); return { data: new Blob(['{"versao":"0.1.2"}']), error: null } },
    })
    const f = criarFonteAtualizacaoStorage({ bucket: 'instalador', arquivo: 'Atlas-Instalador.exe' }, doBucket)
    expect(await f.manifesto()).toEqual({ versao: '0.1.2' })
    expect(await f.link('Atlas-Atualizacao-0.1.2.exe')).toBe('https://s/assinado')
    expect(pedidos).toEqual(['baixar instalador/atualizacao.json', 'instalador/Atlas-Instalador.exe/Atlas-Atualizacao-0.1.2.exe'])
  })
  it('sem manifesto ou com JSON quebrado: null (o app segue sem atualizar)', async () => {
    const semArquivo = () => ({ createSignedUrl: async () => ({ data: null, error: 'x' }), download: async () => ({ data: null, error: 'nao existe' }) })
    expect(await criarFonteAtualizacaoStorage({ bucket: 'instalador', arquivo: 'a.exe' }, semArquivo).manifesto()).toBeNull()
    const quebrado = () => ({ createSignedUrl: async () => ({ data: null, error: 'x' }), download: async () => ({ data: new Blob(['{quebr']), error: null }) })
    expect(await criarFonteAtualizacaoStorage({ bucket: 'instalador', arquivo: 'a.exe' }, quebrado).manifesto()).toBeNull()
  })
})

describe('manifesto com o cliente de verdade do Supabase (método que usa this)', () => {
  it('lê o atualizacao.json chamando download COMO MÉTODO (antes perdia o this e devolvia null: "servidor sem versão")', async () => {
    class BucketDeVerdade {
      constructor(private nome: string) {}
      async download(arquivo: string) {
        if (this.nome !== 'instalador') throw new Error('this perdido')
        return { data: new Blob([JSON.stringify({ arquivo })]), error: null }
      }
      async createSignedUrl() { return { data: { signedUrl: 'https://x/assinado' }, error: null } }
    }
    const fonte = criarFonteAtualizacaoStorage({ bucket: 'instalador', arquivo: 'Atlas-Instalador.exe' }, (b) => new BucketDeVerdade(b))
    expect(await fonte.manifesto()).toEqual({ arquivo: 'atualizacao.json' })
  })
})
