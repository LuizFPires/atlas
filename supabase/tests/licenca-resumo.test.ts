// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { resumoDaLicenca } from '../functions/_shared/licenca-resumo.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { H1, H2, montar, TOKEN } from './helpers.ts'

const email = 'ana@loja.com'
const arg = (h = H1, t = TOKEN, e = email) => ({ email: e, computador_hash: h, token_dispositivo: t })
const DIA = 24 * 60 * 60_000

/** Licença de teste (cortesia com origem degustação) que vence em `dias` a partir do relógio do teste. */
function comCortesia(dias: number, origem: 'degustacao' | null = 'degustacao') {
  const m = montar()
  Object.assign(m.store.licencas[0], { tipo: 'cortesia', origem, validade_em: new Date(m.deps.agora().getTime() + dias * DIA) })
  return m
}

describe('resumo da licença para o app (contador do teste)', () => {
  it('licença paga: sem prazo', async () => {
    const m = montar()
    await m.ativar()
    expect(await resumoDaLicenca(m.deps, arg())).toEqual({ tipo: 'paga', origem: null, validade_em: null, vencida: false, entrega_libera_em: null, agora: '2026-11-18T12:00:00.000Z' })
  })

  it('licença paga nos 7 dias de arrependimento: diz quando a entrega em produção libera', async () => {
    const m = montar()
    Object.assign(m.store.licencas[0], { tipo: 'paga', comprada_em: new Date('2026-11-16T12:00:00Z') })
    await m.ativar()
    expect(await resumoDaLicenca(m.deps, arg())).toMatchObject({ tipo: 'paga', entrega_libera_em: '2026-11-23T12:00:00.000Z' })
    m.avancar(5 * DIA)
    expect(await resumoDaLicenca(m.deps, arg())).toMatchObject({ tipo: 'paga', entrega_libera_em: null })
  })

  it('teste grátis em andamento: tipo, origem e até quando vale', async () => {
    const m = comCortesia(3)
    await m.ativar()
    expect(await resumoDaLicenca(m.deps, arg())).toEqual({ tipo: 'cortesia', origem: 'degustacao', validade_em: '2026-11-21T12:00:00.000Z', vencida: false, agora: '2026-11-18T12:00:00.000Z' })
  })

  it('cortesia do gestor (presente): origem nula', async () => {
    const m = comCortesia(5, null)
    await m.ativar()
    expect(await resumoDaLicenca(m.deps, arg())).toMatchObject({ tipo: 'cortesia', origem: null, vencida: false })
  })

  it('prazo passou: vencida, mesmo depois de o /verificar ter encerrado a licença', async () => {
    const m = comCortesia(1)
    await m.ativar()
    m.avancar(2 * DIA)
    expect(await resumoDaLicenca(m.deps, arg())).toMatchObject({ tipo: 'cortesia', vencida: true })
    expect((await verificar(m.deps, arg())).motivo).toBe('cortesia_expirada') // encerra a licença
    expect(await resumoDaLicenca(m.deps, arg())).toMatchObject({ tipo: 'cortesia', vencida: true, validade_em: '2026-11-19T12:00:00.000Z' })
  })

  it('cortesia sem prazo gravado conta como vencida (igual ao /verificar)', async () => {
    const m = montar()
    Object.assign(m.store.licencas[0], { tipo: 'cortesia', validade_em: null })
    await m.ativar()
    expect(await resumoDaLicenca(m.deps, arg())).toMatchObject({ tipo: 'cortesia', validade_em: null, vencida: true })
  })

  it('sem a credencial deste computador ninguém lê o resumo, e a recusa não dá detalhes', async () => {
    const m = comCortesia(3)
    await m.ativar()
    for (const a of [arg(H1, 'errado'), arg(H1, ''), arg(H2), arg(H1, TOKEN, 'outra@pessoa.com'), arg('nao-e-hash')]) {
      await expect(resumoDaLicenca(m.deps, a)).rejects.toMatchObject({ codigo: 'negado', status: 401 })
    }
    const semAtivacao = comCortesia(3)
    await expect(resumoDaLicenca(semAtivacao.deps, arg())).rejects.toMatchObject({ codigo: 'negado' })
  })
})
