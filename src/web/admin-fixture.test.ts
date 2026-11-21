import { describe, expect, it } from 'vitest'
import { criarAdminFixture } from './admin-fixture'

describe('painel do administrador em modo demonstração', () => {
  it('entra sem login e se apresenta como admin de mentira', async () => {
    const api = criarAdminFixture()
    expect(api.logado()).toBe(true)
    const eu = await api.eu()
    expect(eu.ok && eu.email).toBe('admin@demonstracao.local')
  })
  it('traz clientes em todas as situações, inclusive cortesia', async () => {
    const r = await criarAdminFixture().painel()
    if (!r.ok) throw new Error('painel')
    const s = new Set(r.painel.clientes.map((c) => c.situacao))
    for (const x of ['em_dia', 'atrasada', 'pausada', 'cancelada', 'ativando']) expect(s.has(x as never)).toBe(true)
    expect(r.painel.clientes.some((c) => c.tipo === 'cortesia')).toBe(true)
    expect(r.painel.indicadores.clientes_ativos).toBe(r.painel.clientes.filter((c) => c.situacao === 'em_dia' && c.tipo !== 'cortesia').length)
  })
  it('as ações de escrita mexem no estado em memória', async () => {
    const api = criarAdminFixture()
    expect((await api.bloquearDominio('Lixo.com')).ok).toBe(true)
    const d = await api.dominios()
    expect(d.ok && d.dominios.some((x) => x.dominio === 'lixo.com')).toBe(true)
    const t = await api.degustacao({ ativa: false, dias: 10 })
    expect(t.ok && !t.ativa && t.dias === 10).toBe(true)
    expect((await api.liberarTroca('lic-01', 'x')).ok && (await api.liberarTroca('lic-01', 'x'))).toMatchObject({ ja_liberada: true })
    await api.liberarCortesia('novo@x.com', '2030-01-01T00:00:00Z')
    const p = await api.painel()
    expect(p.ok && p.painel.clientes.some((c) => c.nome === 'novo@x.com')).toBe(true)
  })
})
