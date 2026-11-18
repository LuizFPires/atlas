// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { TOLERANCIA_OFFLINE_MS, verificar } from '../functions/_shared/verificar.ts'
import { respostaAindaVale } from '../functions/_shared/verificar-publico.ts'
import { chavePublica, H1, H2, montar, TOKEN } from './helpers.ts'

const email = 'ana@loja.com'
const arg = (h = H1, t = TOKEN) => ({ email, computador_hash: h, token_dispositivo: t })

describe('/verificar', () => {
  it('libera com licença ativa, computador ativado e credencial', async () => {
    const m = montar()
    await m.ativar()
    expect(await verificar(m.deps, arg())).toMatchObject({ pode_construir: true, motivo: 'ok', licenca_id: 'l1' })
  })
  it('sem credencial válida: negação genérica, sem licenca_id nem motivo detalhado', async () => {
    const m = montar()
    await m.ativar()
    const casos = [arg(H1, 'errado'), arg(H1, ''), arg(H2), { email: 'x@y.com', computador_hash: H1, token_dispositivo: TOKEN }]
    for (const c of casos) expect(await verificar(m.deps, c)).toMatchObject({ pode_construir: false, motivo: 'negado', licenca_id: null })
    const sem = montar()
    expect(await verificar(sem.deps, arg())).toMatchObject({ motivo: 'negado', licenca_id: null })
  })
  it('status: allowlist fail-closed', async () => {
    for (const [s, motivo] of [['pausada', 'licenca_pausada'], ['cancelada', 'licenca_cancelada']] as const) {
      const m = montar(s)
      await m.ativar()
      expect((await verificar(m.deps, arg())).motivo).toBe(motivo)
    }
    const m = montar('atrasada')
    await m.ativar()
    // atrasada com pausa nula: nega, motivo genérico
    expect(await verificar(m.deps, arg())).toMatchObject({ pode_construir: false, motivo: 'negado' })
    m.store.licencas[0].pausa_prevista_em = new Date(m.deps.agora().getTime() + 3600_000)
    expect((await verificar(m.deps, arg())).pode_construir).toBe(true)
    m.avancar(3600_001)
    expect(await verificar(m.deps, arg())).toMatchObject({ pode_construir: false, motivo: 'licenca_atrasada_pausa' })
    // status desconhecido: nega
    const x = montar()
    await x.ativar()
    ;(x.store.licencas[0] as { status: string }).status = 'inventado'
    expect(await verificar(x.deps, arg())).toMatchObject({ pode_construir: false, motivo: 'negado' })
  })
  it('assinatura Ed25519: verificada só com a chave pública, curta e presa ao computador', async () => {
    const m = montar()
    await m.ativar()
    const r = await verificar(m.deps, arg())
    const agora = m.deps.agora()
    expect(await respostaAindaVale(chavePublica, r, H1, agora)).toBe(true)
    expect(await respostaAindaVale(chavePublica, r, H2, agora)).toBe(false)
    expect(await respostaAindaVale(chavePublica, { ...r, valido_ate: '2099-01-01T00:00:00.000Z' }, H1, agora)).toBe(false)
    expect(await respostaAindaVale(chavePublica, { ...r, assinatura: 'AAAA' }, H1, agora)).toBe(false)
    expect(await respostaAindaVale(chavePublica, r, H1, new Date(agora.getTime() + TOLERANCIA_OFFLINE_MS + 1))).toBe(false)
  })
})
