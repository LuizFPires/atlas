// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarConviteTeste, entrarNoTeste, situacaoTestadores, verConviteTeste } from '../functions/_shared/lojas.ts'
import { H1, montar, TOKEN } from './helpers.ts'

const auth = { email: 'ana@loja.com', computador_hash: H1, token_dispositivo: TOKEN }
const GRUPO = 'https://groups.google.com/g/ponto-testadores'
const OPTIN = 'https://play.google.com/apps/testing/br.com.pontoampla.app'
const DIA = 24 * 3600_000

describe('lojas: os 12 testadores do Google (página de convite do Atlas)', () => {
  it('cria o convite da obra (um só por obra) e a página pública mostra só o necessário', async () => {
    const m = montar(); await m.ativar()
    const c = await criarConviteTeste(m.deps, { ...auth, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: GRUPO, optin_url: OPTIN })
    expect(c.codigo).toMatch(/^[a-z0-9]{10,}$/)
    const de_novo = await criarConviteTeste(m.deps, { ...auth, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: GRUPO, optin_url: OPTIN })
    expect(de_novo.codigo).toBe(c.codigo)
    const v = await verConviteTeste(m.deps, { codigo: c.codigo })
    expect(v).toEqual({ app_nome: 'Ponto', grupo_url: GRUPO, optin_url: OPTIN })
  })

  it('só aceita endereços do Google (grupo e opt-in)', async () => {
    const m = montar(); await m.ativar()
    await expect(criarConviteTeste(m.deps, { ...auth, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: 'https://evil.com/g', optin_url: OPTIN })).rejects.toMatchObject({ codigo: 'convite_invalido' })
    await expect(criarConviteTeste(m.deps, { ...auth, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: GRUPO, optin_url: 'https://play.google.com.evil.com/apps/testing/x' })).rejects.toMatchObject({ codigo: 'convite_invalido' })
  })

  it('conta pessoas e os 14 dias a partir do 12º; nome repetido não conta duas vezes', async () => {
    const m = montar(); await m.ativar()
    const { codigo } = await criarConviteTeste(m.deps, { ...auth, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: GRUPO, optin_url: OPTIN })
    for (let i = 1; i <= 9; i++) await entrarNoTeste(m.deps, { codigo, nome: `Pessoa ${i}`, ip: `10.0.0.${i}` })
    await entrarNoTeste(m.deps, { codigo, nome: 'pessoa 1 ', ip: '10.0.1.1' })
    let s = await situacaoTestadores(m.deps, { ...auth, obra_id: 'ponto' })
    expect(s).toMatchObject({ pessoas: 9, faltam: 3, dia: 0, completo: false })
    for (let i = 10; i <= 12; i++) await entrarNoTeste(m.deps, { codigo, nome: `Pessoa ${i}`, ip: `10.0.0.${i}` })
    s = await situacaoTestadores(m.deps, { ...auth, obra_id: 'ponto' })
    expect(s).toMatchObject({ pessoas: 12, faltam: 0, dia: 1, completo: false })
    m.avancar(13 * DIA)
    s = await situacaoTestadores(m.deps, { ...auth, obra_id: 'ponto' })
    expect(s).toMatchObject({ dia: 14, completo: true })
  })

  it('código inexistente = 404; muitas entradas do mesmo lugar = 429', async () => {
    const m = montar(); await m.ativar()
    await expect(verConviteTeste(m.deps, { codigo: 'naoexiste00' })).rejects.toMatchObject({ status: 404 })
    const { codigo } = await criarConviteTeste(m.deps, { ...auth, obra_id: 'ponto', app_nome: 'Ponto', grupo_url: GRUPO, optin_url: OPTIN })
    let barrado = false
    for (let i = 0; i < 40 && !barrado; i++) await entrarNoTeste(m.deps, { codigo, nome: `P${i}`, ip: '10.9.9.9' }).catch((e) => { barrado = e.status === 429 })
    expect(barrado).toBe(true)
  })
})
