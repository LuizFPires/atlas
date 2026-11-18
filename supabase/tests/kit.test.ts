// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { entregarKit, marcaDagua, type CarregarKit } from '../functions/_shared/kit.ts'
import { H1, H2, montar } from './helpers.ts'

const fixture: CarregarKit = async () => [
  { caminho: '.claude/agents/arquiteto.md', conteudo: '# Arquiteto' },
  { caminho: '.claude/hooks/x.cjs', conteudo: 'module.exports = 1' },
  { caminho: '.claude/settings.json', conteudo: '{"a":1}' },
]
const email = 'ana@loja.com'

describe('/entregar-kit', () => {
  it('marca todos os arquivos, registra a entrega e proíbe cache', async () => {
    const m = montar()
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    const r = await entregarKit(m.deps, fixture, { email, computador_hash: H1, obra_id: 'obra-1' })
    expect(r.marca_dagua).toBe(await marcaDagua(m.deps, 'l1'))
    for (const f of r.arquivos) expect(f.conteudo).toContain(r.marca_dagua)
    expect(r.arquivos[0].conteudo).toContain('licenciado a Ana')
    expect(r.arquivos[0].conteudo).toContain('Lei 9.609/98')
    expect(r.arquivos[1].conteudo.startsWith('// Software proprietário')).toBe(true)
    expect(JSON.parse(r.arquivos[2].conteudo)._marca).toBe(r.marca_dagua)
    expect(r.cabecalhos['Cache-Control']).toBe('no-store')
    expect(m.store.entregas).toEqual([expect.objectContaining({ licenca_id: 'l1', obra_id: 'obra-1', marca_dagua: r.marca_dagua })])
  })
  it('marca é por cliente e a entrega não guarda o conteúdo', async () => {
    const m = montar()
    const outra = await marcaDagua({ ...m.deps, segredo: 'outro' }, 'l1')
    expect(outra).not.toBe(await marcaDagua(m.deps, 'l1'))
    expect(await marcaDagua(m.deps, 'l2')).not.toBe(await marcaDagua(m.deps, 'l1'))
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    await entregarKit(m.deps, fixture, { email, computador_hash: H1, obra_id: 'o' })
    expect(JSON.stringify(m.store.entregas)).not.toContain('Arquiteto')
  })
  it('nega sem licença liberada ou em outro computador, e obra inválida', async () => {
    const m = montar()
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    await expect(entregarKit(m.deps, fixture, { email, computador_hash: H2, obra_id: 'o' })).rejects.toMatchObject({ status: 403 })
    await expect(entregarKit(m.deps, fixture, { email, computador_hash: H1, obra_id: '../x' })).rejects.toMatchObject({ codigo: 'obra_invalida' })
    const p = montar('pausada')
    await p.store.inserirAtivacao('l1', H1, p.deps.agora())
    await expect(entregarKit(p.deps, fixture, { email, computador_hash: H1, obra_id: 'o' })).rejects.toMatchObject({ codigo: 'licenca_pausada' })
    expect(p.store.entregas).toHaveLength(0)
  })
})
