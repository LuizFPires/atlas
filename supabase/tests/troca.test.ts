// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { solicitarCodigo } from '../functions/_shared/ativacao.ts'
import { INTERVALO_TROCA_MS, liberarTroca, trocarComputador } from '../functions/_shared/troca.ts'
import { H1, H2, montar } from './helpers.ts'

const H3 = 'c'.repeat(64)

async function comAtivacao() {
  const m = montar()
  await m.ativar()
  return m
}
async function codigoTroca(m: Awaited<ReturnType<typeof comAtivacao>>) {
  // zera só os limites de emissão: aqui o foco é a regra de 7 dias (o limite de emissão tem teste próprio)
  await m.store.limparEventos('emissao:ip:desconhecido')
  await m.store.limparEventos('emissao:cliente:c1:troca')
  await solicitarCodigo(m.deps, 'ana@loja.com', 'troca')
  return m.emails[m.emails.length - 1]
}
const email = 'ana@loja.com'

describe('troca de computador', () => {
  it('troca com código e mantém só 1 ativo', async () => {
    const m = await comAtivacao()
    await trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H2 })
    const ativos = m.store.ativacoes.filter((a) => a.ativo)
    expect(ativos).toHaveLength(1)
    expect(ativos[0].computador_hash).toBe(H2)
    expect(ativos[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(m.store.trocas[0]).toMatchObject({ de_hash: H1, para_hash: H2, por_admin: false })
  })
  it('bloqueia segunda troca em menos de 7 dias e libera depois', async () => {
    const m = await comAtivacao()
    await trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H2 })
    m.avancar(INTERVALO_TROCA_MS - 1000)
    await expect(trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H3 })).rejects.toMatchObject({ codigo: 'troca_limite', status: 429 })
    m.avancar(2000)
    await trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H3 })
    expect(m.store.trocas).toHaveLength(2)
  })
  it('override do admin libera uma troca e depois volta o limite', async () => {
    const m = await comAtivacao()
    await trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H2 })
    await liberarTroca(m.deps, 'l1', 'PC quebrou')
    await trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H3 })
    expect(m.store.trocas[1].por_admin).toBe(true)
    expect(m.store.ocorrencias[0].tipo).toBe('override_troca')
    await expect(trocarComputador(m.deps, { email, codigo: await codigoTroca(m), novo_hash: H1 })).rejects.toMatchObject({ codigo: 'troca_limite' })
  })
  it('código errado não troca; sem ativação e mesmo PC são recusados', async () => {
    const m = await comAtivacao()
    await codigoTroca(m)
    await expect(trocarComputador(m.deps, { email, codigo: '12345x', novo_hash: H2 })).rejects.toMatchObject({ codigo: 'codigo_invalido' })
    expect(m.store.ativacoes.find((a) => a.ativo)?.computador_hash).toBe(H1)
    await expect(trocarComputador(m.deps, { email, codigo: '000000', novo_hash: H1 })).rejects.toMatchObject({ codigo: 'mesmo_computador' })
    const v = montar()
    await expect(trocarComputador(v.deps, { email, codigo: '000000', novo_hash: H2 })).rejects.toMatchObject({ codigo: 'sem_ativacao' })
  })
})
