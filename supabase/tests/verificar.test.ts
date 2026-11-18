// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { respostaAindaVale, TOLERANCIA_OFFLINE_MS, verificar } from '../functions/_shared/verificar.ts'
import { H1, H2, montar } from './helpers.ts'

const email = 'ana@loja.com'

describe('/verificar', () => {
  it('libera com licença ativa e computador ativado', async () => {
    const m = montar()
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    const r = await verificar(m.deps, { email, computador_hash: H1 })
    expect(r).toMatchObject({ pode_construir: true, motivo: 'ok', licenca_id: 'l1' })
  })
  it('nega computador diferente, sem ativação, e-mail desconhecido', async () => {
    const m = montar()
    expect((await verificar(m.deps, { email, computador_hash: H1 })).motivo).toBe('computador_nao_ativado')
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    expect((await verificar(m.deps, { email, computador_hash: H2 })).pode_construir).toBe(false)
    expect((await verificar(m.deps, { email: 'x@y.com', computador_hash: H1 })).motivo).toBe('sem_licenca')
  })
  it('status: pausada/cancelada negam; atrasada vale até a pausa prevista', async () => {
    for (const [s, motivo] of [['pausada', 'licenca_pausada'], ['cancelada', 'licenca_cancelada']] as const) {
      const m = montar(s)
      await m.store.inserirAtivacao('l1', H1, m.deps.agora())
      expect((await verificar(m.deps, { email, computador_hash: H1 })).motivo).toBe(motivo)
    }
    const m = montar('atrasada')
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    m.store.licencas[0].pausa_prevista_em = new Date(m.deps.agora().getTime() + 3600_000)
    expect((await verificar(m.deps, { email, computador_hash: H1 })).pode_construir).toBe(true)
    m.avancar(3600_001)
    expect((await verificar(m.deps, { email, computador_hash: H1 })).motivo).toBe('licenca_atrasada_pausa')
  })
  it('tolerância offline é curta, assinada e presa ao computador', async () => {
    const m = montar()
    await m.store.inserirAtivacao('l1', H1, m.deps.agora())
    const r = await verificar(m.deps, { email, computador_hash: H1 })
    expect(await respostaAindaVale(m.deps, r, H1)).toBe(true)
    expect(await respostaAindaVale(m.deps, r, H2)).toBe(false)
    expect(await respostaAindaVale(m.deps, { ...r, valido_ate: '2099-01-01T00:00:00.000Z' }, H1)).toBe(false)
    m.avancar(TOLERANCIA_OFFLINE_MS + 1)
    expect(await respostaAindaVale(m.deps, r, H1)).toBe(false)
  })
})
