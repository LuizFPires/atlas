import { afterEach, describe, expect, it, vi } from 'vitest'
import { provisionar } from './provisionar'
import { criarSimulacao } from './simulacao'
import { criarEntregaProvisionada } from './entrega'
import type { Compra, Credenciais } from './portas'

const compra: Compra = {
  id: 'c1',
  segmento: 'barbearia',
  personalizacao: { nome_negocio: 'Barbearia do Zé', logo_url: null, cor_principal: '#1E7A46', cor_apoio: '#FFFFFF' },
  licenca: { id: 'lic-1', email: 'ze@exemplo.com' },
}
const SEGREDO = 'SEGREDO-github-xyz'
const cred: Credenciais = { github: SEGREDO, supabase: 'SEGREDO-supabase-abc', vercel: 'SEGREDO-vercel-123' }

afterEach(() => vi.restoreAllMocks())

describe('provisionar', () => {
  it('caminho feliz: todos os passos feitos e endereço no fim', async () => {
    const s = criarSimulacao()
    const r = await provisionar(compra, cred, s.portas)
    expect(Object.values(r.passos)).toEqual(['feito', 'feito', 'feito', 'feito', 'feito'])
    expect(r.endereco).toMatch(/^https:\/\//)
    expect(r.erro).toBeNull()
    const e = await criarEntregaProvisionada('c1', 'Barbearia do Zé', s.portas.registro).estado()
    expect(e).toEqual({ estado: 'pronto', nome: 'Barbearia do Zé', link: r.endereco })
  })

  it('idempotência: rodar 2x não duplica nada', async () => {
    const s = criarSimulacao()
    const a = await provisionar(compra, cred, s.portas)
    const b = await provisionar(compra, cred, s.portas)
    expect(b).toEqual(a)
    expect(s.chamadas).toMatchObject({ repo: 1, banco: 1, deploy: 1, guardiao: 1 })
  })

  it('retomada: falha no deploy, reexecuta só dali pra frente', async () => {
    const s = criarSimulacao()
    s.falharEm('deploy', true)
    const r1 = await provisionar(compra, cred, s.portas)
    expect(r1.passos).toMatchObject({ repo: 'feito', banco: 'feito', deploy: 'erro', guardiao: 'pendente', publicar: 'pendente' })
    expect(r1.erro).toBeTruthy()
    const durante = await criarEntregaProvisionada('c1', 'X', s.portas.registro).estado()
    expect(durante.estado).toBe('falhou')
    expect(JSON.stringify(durante)).not.toMatch(/https:\/\//)
    const r2 = await provisionar(compra, cred, s.portas)
    expect(r2.endereco).toBeTruthy()
    expect(Object.values(r2.passos).every((p) => p === 'feito')).toBe(true)
    expect(s.chamadas).toMatchObject({ repo: 1, banco: 1, deploy: 1, guardiao: 1 })
  })

  it('sem registro, a entrega continua "preparando" e sem link', async () => {
    const s = criarSimulacao()
    const e = await criarEntregaProvisionada('nada', 'X', s.portas.registro).estado()
    expect(e.estado).toBe('montando')
    expect(JSON.stringify(e)).not.toContain('http')
  })

  it('nenhuma credencial é persistida, logada nem vai para a mensagem de erro', async () => {
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info')]
    const s = criarSimulacao()
    s.falharEm('banco', true)
    await provisionar(compra, cred, s.portas)
    await provisionar(compra, cred, s.portas)
    const guardado = JSON.stringify(await s.portas.registro.ler('c1'))
    expect(guardado).not.toContain('SEGREDO')
    for (const l of logs) expect(JSON.stringify(l.mock.calls)).not.toContain('SEGREDO')
  })
})
