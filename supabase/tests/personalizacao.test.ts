// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validarPersonalizacao } from '../functions/_shared/personalizacao.ts'
import { ErroRegra } from '../functions/_shared/tipos.ts'
import { StoreMemoria } from '../functions/_shared/memoria.ts'

const ok = (extra: Record<string, unknown> = {}) => ({ nome_negocio: 'Barbearia do Zé', cor_principal: '#c6f135', cor_apoio: '#2A3A12', ...extra })

describe('validarPersonalizacao', () => {
  it('aceita hex #RRGGBB e normaliza para maiúsculas', () => {
    expect(validarPersonalizacao(ok())).toEqual({ nome_negocio: 'Barbearia do Zé', logo_url: null, cor_principal: '#C6F135', cor_apoio: '#2A3A12' })
  })
  it.each(['C6F135', '#C6F13', '#C6F1355', '#GGGGGG', 'red', '#12345', '', '#C6F135;', 42, null])('recusa cor inválida %j', (c) => {
    expect(() => validarPersonalizacao(ok({ cor_principal: c }))).toThrow(ErroRegra)
    expect(() => validarPersonalizacao(ok({ cor_apoio: c }))).toThrow(/cor/)
  })
  it('nome é obrigatório e limitado', () => {
    expect(() => validarPersonalizacao(ok({ nome_negocio: '   ' }))).toThrow(/nome/i)
    expect(() => validarPersonalizacao(ok({ nome_negocio: 'x'.repeat(500) }))).toThrow(/nome/i)
    expect(() => validarPersonalizacao(ok({ nome_negocio: 7 }))).toThrow(ErroRegra)
    expect([...validarPersonalizacao(ok({ nome_negocio: 'a'.repeat(100) })).nome_negocio].length).toBeLessThanOrEqual(60)
  })
  it('logo: só https', () => {
    expect(validarPersonalizacao(ok({ logo_url: 'https://x.test/l.png' })).logo_url).toBe('https://x.test/l.png')
    expect(() => validarPersonalizacao(ok({ logo_url: 'javascript:alert(1)' }))).toThrow(ErroRegra)
    expect(() => validarPersonalizacao(ok({ logo_url: 'http://x.test/l.png' }))).toThrow(ErroRegra)
  })
})

describe('store: personalização por licença', () => {
  it('grava e lê só da própria licença', async () => {
    const s = new StoreMemoria()
    await s.salvarPersonalizacao('l1', validarPersonalizacao(ok()), new Date())
    expect((await s.personalizacaoDaLicenca('l1'))?.nome_negocio).toBe('Barbearia do Zé')
    expect(await s.personalizacaoDaLicenca('l2')).toBeNull()
  })
})
