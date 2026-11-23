// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compararVersoes, manifestoValido, verAtualizacao, type FonteAtualizacao } from '../functions/_shared/atualizacao.ts'
import { H1, H2, montar, TOKEN } from './helpers.ts'

const email = 'ana@loja.com'
const SHA = 'A'.repeat(86) + '=='
const fonte = (m: unknown, url: string | null = 'https://x.supabase.co/storage/v1/object/sign/instalador/Atlas-Instalador.exe?token=t'): FonteAtualizacao & { nomes: string[] } => {
  const nomes: string[] = []
  return { nomes, manifesto: async () => m, link: async (n) => { nomes.push(n); return url } }
}
const NOVA = { versao: '0.1.42', sha512: SHA, tamanho: 120_000_000 }

describe('versões', () => {
  it('compara número a número (0.1.10 é mais nova que 0.1.9)', () => {
    expect(compararVersoes('0.1.10', '0.1.9')).toBeGreaterThan(0)
    expect(compararVersoes('0.1.0', '0.1.0')).toBe(0)
    expect(compararVersoes('0.2.0', '1.0.0')).toBeLessThan(0)
  })
  it('manifesto estranho é descartado', () => {
    expect(manifestoValido(NOVA)).toEqual(NOVA)
    for (const ruim of [null, {}, { ...NOVA, versao: '1.0' }, { ...NOVA, sha512: 'x' }, { ...NOVA, tamanho: -1 }, { ...NOVA, tamanho: 2e9 }]) expect(manifestoValido(ruim)).toBeNull()
  })
})

describe('/atualizacao', () => {
  it('computador ativado com versão antiga recebe a nova, com o endereço temporário e a impressão digital', async () => {
    const m = montar()
    await m.ativar()
    const f = fonte(NOVA)
    const r = await verAtualizacao(m.deps, f, { email, computador_hash: H1, token_dispositivo: TOKEN, versao: '0.1.0' })
    expect(r).toEqual({ atualizar: true, versao: '0.1.42', sha512: SHA, tamanho: 120_000_000, url: expect.stringMatching(/^https:\/\//) })
    expect(f.nomes).toEqual(['Atlas-Atualizacao-0.1.42.exe'])
  })
  it('já na versão mais nova: nada a fazer e nenhum link é gerado', async () => {
    const m = montar()
    await m.ativar()
    const f = fonte(NOVA)
    expect(await verAtualizacao(m.deps, f, { email, computador_hash: H1, token_dispositivo: TOKEN, versao: '0.1.42' })).toMatchObject({ atualizar: false })
    expect(f.nomes).toEqual([])
  })
  it('sem licença ativada neste computador (token errado ou outro computador): negado, sem link', async () => {
    const m = montar()
    await m.ativar()
    const f = fonte(NOVA)
    await expect(verAtualizacao(m.deps, f, { email, computador_hash: H1, token_dispositivo: 'outro', versao: '0.1.0' })).rejects.toMatchObject({ codigo: 'negado', status: 403 })
    await expect(verAtualizacao(m.deps, f, { email, computador_hash: H2, token_dispositivo: TOKEN, versao: '0.1.0' })).rejects.toMatchObject({ codigo: 'negado' })
    expect(f.nomes).toEqual([])
  })
  it('versão que não é número.número.número é recusada', async () => {
    const m = montar()
    await m.ativar()
    await expect(verAtualizacao(m.deps, fonte(NOVA), { email, computador_hash: H1, token_dispositivo: TOKEN, versao: '../x' })).rejects.toMatchObject({ codigo: 'versao_invalida' })
  })
  it('sem arquivo publicado, manifesto estranho ou link que não é https: segue sem atualizar (nunca inventa)', async () => {
    const m = montar()
    await m.ativar()
    const a = { email, computador_hash: H1, token_dispositivo: TOKEN, versao: '0.1.0' }
    expect(await verAtualizacao(m.deps, undefined, a)).toMatchObject({ atualizar: false })
    expect(await verAtualizacao(m.deps, fonte({ versao: 'x' }), a)).toMatchObject({ atualizar: false })
    expect(await verAtualizacao(m.deps, fonte(NOVA, 'http://inseguro'), a)).toMatchObject({ atualizar: false })
    expect(await verAtualizacao(m.deps, fonte(NOVA, null), a)).toMatchObject({ atualizar: false })
  })
})

describe('/atualizacao diz o motivo quando não manda versão (caso do Guilherme, 23/11/2026)', () => {
  it('atual, sem configuração, sem manifesto e sem link são motivos diferentes', async () => {
    const m = montar()
    await m.ativar()
    const pedir = (f: FonteAtualizacao | undefined, versao = '0.1.0') => verAtualizacao(m.deps, f, { email, computador_hash: H1, token_dispositivo: TOKEN, versao })
    expect(await pedir(fonte(NOVA), '0.1.42')).toMatchObject({ atualizar: false, motivo: 'atual' })
    expect(await pedir(undefined)).toMatchObject({ atualizar: false, motivo: 'sem-configuracao' })
    expect(await pedir(fonte(null))).toMatchObject({ atualizar: false, motivo: 'sem-manifesto' })
    expect(await pedir(fonte(NOVA, null))).toMatchObject({ atualizar: false, motivo: 'sem-link' })
  })
})
