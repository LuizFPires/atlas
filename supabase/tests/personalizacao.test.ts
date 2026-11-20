// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validarPersonalizacao } from '../functions/_shared/personalizacao.ts'
import { ErroRegra } from '../functions/_shared/tipos.ts'
import { StoreMemoria } from '../functions/_shared/memoria.ts'
import { CONTA } from './helpers-pagamento.ts'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO, JWT_INTRUSO } from './helpers-portal.ts'

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
    await s.salvarPersonalizacao('l1', validarPersonalizacao(ok()))
    expect((await s.personalizacaoDaLicenca('l1'))?.nome_negocio).toBe('Barbearia do Zé')
    expect(await s.personalizacaoDaLicenca('l2')).toBeNull()
  })
})

describe('/portal/personalizacao — escopo pela licença do login (anti-IDOR)', () => {
  const corpo = (extra: object = {}) => ({ nome_negocio: 'Barbearia do Zé', cor_principal: '#C6F135', cor_apoio: '#2A3A12', ...extra })
  async function preparar() {
    const m = await comDoisClientes()
    // Só Ana comprou um app pronto (segmento); Beto comprou do zero.
    await m.store.gravarPagamento({ licenca_id: 'l1', conta_gateway_id: CONTA, tipo: 'implantacao', valor: 7300, status: 'pago', gateway_ref: 'pi_ana2', gateway_pi: 'pi_ana2', pago_em: m.deps.agora(), segmento: 'barbearia' })
    return { m, c: m.ctx() }
  }
  it('sem login ou com login inválido: 401/403 e nada gravado', async () => {
    const { m, c } = await preparar()
    expect((await chamar(c, '/portal/personalizacao/salvar', null, corpo())).status).toBeGreaterThanOrEqual(401)
    expect((await chamar(c, '/portal/personalizacao/salvar', 'jwt-falso', corpo())).status).toBeGreaterThanOrEqual(401)
    expect((await chamar(c, '/portal/personalizacao/salvar', JWT_INTRUSO, corpo())).status).toBe(403)
    expect(m.store.personalizacoes.size).toBe(0)
  })
  it('grava na licença do dono mesmo que o corpo mande outra; Beto não lê a da Ana', async () => {
    const { m, c } = await preparar()
    const r = await chamar(c, '/portal/personalizacao/salvar', JWT_ANA, corpo({ licenca_id: 'l2', cor_principal: '#c6f135' }))
    expect(r.status).toBe(200)
    expect([...m.store.personalizacoes.keys()]).toEqual(['l1'])
    const ana = await (await chamar(c, '/portal/personalizacao', JWT_ANA)).json()
    expect(ana.segmento).toBe('barbearia')
    expect(ana.personalizacao.cor_principal).toBe('#C6F135')
    const beto = await (await chamar(c, '/portal/personalizacao', JWT_BETO, { licenca_id: 'l1' })).json()
    expect(beto.personalizacao).toBeNull()
    expect(beto.segmento).toBeNull()
  })
  it('quem não comprou app pronto não grava (403) e hex inválido dá 400 com mensagem clara', async () => {
    const { m, c } = await preparar()
    expect((await chamar(c, '/portal/personalizacao/salvar', JWT_BETO, corpo())).status).toBe(403)
    const r = await chamar(c, '/portal/personalizacao/salvar', JWT_ANA, corpo({ cor_apoio: 'verde' }))
    expect(r.status).toBe(400)
    expect((await r.json()).mensagem).toMatch(/#RRGGBB/)
    expect(m.store.personalizacoes.size).toBe(0)
  })
  it('limita a frequência por licença', async () => {
    const { c } = await preparar()
    let ultimo = 200
    for (let i = 0; i < 32; i++) ultimo = (await chamar(c, '/portal/personalizacao/salvar', JWT_ANA, corpo())).status
    expect(ultimo).toBe(429)
  })
})
