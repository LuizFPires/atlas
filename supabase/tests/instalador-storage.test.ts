// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarLinkInstaladorStorage, lerConfigInstalador, VALIDADE_LINK_INSTALADOR_S } from '../functions/_shared/instalador-storage.ts'

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
  it('pede um endereço que vale 10 minutos e baixa com o nome Atlas-Instalador.exe', async () => {
    const s = storage({ data: { signedUrl: TEMPORARIO }, error: null })
    expect(await criarLinkInstaladorStorage(cfg, s.de)()).toBe(TEMPORARIO)
    expect(VALIDADE_LINK_INSTALADOR_S).toBe(600)
    expect(s.pedidos).toEqual([{ bucket: 'instalador', arquivo: 'Atlas-Instalador.exe', validade: 600, opcoes: { download: 'Atlas-Instalador.exe' } }])
  })
  it('arquivo que ainda não subiu, erro do Storage ou queda: null, nunca um endereço inventado', async () => {
    expect(await criarLinkInstaladorStorage(cfg, storage({ data: null, error: { message: 'Object not found' } }).de)()).toBeNull()
    expect(await criarLinkInstaladorStorage(cfg, storage({ data: { signedUrl: '' }, error: null }).de)()).toBeNull()
    const cai = () => ({ createSignedUrl: async () => { throw new Error('fora') } })
    expect(await criarLinkInstaladorStorage(cfg, cai)()).toBeNull()
  })
})
