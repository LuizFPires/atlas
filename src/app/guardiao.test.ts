import { describe, expect, it, vi } from 'vitest'
import { CHAVE_COFRE } from './ativacao-api'
import { criarGuardiaoFixture, criarGuardiaoReal, MSG_OUTRA_INSTANCIA } from './guardiao'

const ponte = () => ({
  cofre: {
    ler: async (k: string) => (k === CHAVE_COFRE ? JSON.stringify({ token: 'seg', email: 'ana@loja.com', nome: 'Ana' }) : null),
    guardar: async () => {}, apagar: async () => {},
  },
  hashComputador: async () => 'a'.repeat(64),
}) as never
const resp = (status: number, corpo: object) => vi.fn(async () => new Response(JSON.stringify(corpo), { status }))

describe('guardião', () => {
  it('libera quando o servidor aceita, mandando só e-mail+computador e o token no cabeçalho', async () => {
    const f = resp(200, { ok: true })
    expect(await criarGuardiaoReal(ponte(), { api: 'https://api.x' }, f as never).conferir()).toEqual({ estado: 'liberado' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.x/instancia/validar')
    expect((init.headers as Record<string, string>)['X-Atlas-Dispositivo']).toBe('seg')
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(['computador_hash', 'email'])
  })
  it('bloqueia com mensagem honesta quando o servidor recusa', async () => {
    const v = await criarGuardiaoReal(ponte(), { api: 'https://api.x' }, resp(200, { ok: false, motivo: 'outra_instancia' }) as never).conferir()
    expect(v).toEqual({ estado: 'bloqueado', mensagem: MSG_OUTRA_INSTANCIA })
  })
  it('bloqueia em 403 e sem ativação; não bloqueia o dono sem internet', async () => {
    expect((await criarGuardiaoReal(ponte(), { api: 'https://api.x' }, resp(403, {}) as never).conferir()).estado).toBe('bloqueado')
    const vazio = { cofre: { ler: async () => null }, hashComputador: async () => 'a'.repeat(64) } as never
    expect((await criarGuardiaoReal(vazio, { api: 'https://api.x' }, resp(200, { ok: true }) as never).conferir()).estado).toBe('bloqueado')
    const off = vi.fn(async () => { throw new Error('rede') })
    expect((await criarGuardiaoReal(ponte(), { api: 'https://api.x' }, off as never).conferir()).estado).toBe('liberado')
  })
  it('fixture', async () => {
    expect((await criarGuardiaoFixture().conferir()).estado).toBe('liberado')
    expect((await criarGuardiaoFixture('outra_instancia').conferir()).estado).toBe('bloqueado')
  })
})
