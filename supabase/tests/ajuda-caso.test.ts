// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { H1, H2, montar, TOKEN } from './helpers.ts'

async function preparar() {
  const m = montar()
  await m.ativar()
  const c = { deps: m.deps, carregarKit: async () => [], autorizarServico: () => false }
  const post = (corpo: object, h: Record<string, string> = { 'X-Atlas-Dispositivo': TOKEN }) =>
    tratar(c, new Request('https://x.test/functions/v1/ajuda-caso', { method: 'POST', headers: h, body: JSON.stringify(corpo) }))
  const caso = (extra: object = {}) => ({ email: 'ana@loja.com', computador_hash: H1, tipo: 'ajuda_nao_resolvida', descricao: 'Não consegui publicar', ...extra })
  return { m, post, caso }
}

describe('/ajuda-caso', () => {
  it('grava a ocorrência com o cliente da LICENÇA e sem segredo', async () => {
    const { m, post, caso } = await preparar()
    const r = await post(caso({ cliente_id: 'outro', descricao: 'erro com sk_live_abcdefgh12345678 e senha: 123' }))
    expect(r.status).toBe(200)
    const o = m.store.ocorrencias.find((x) => x.tipo === 'ajuda_nao_resolvida')!
    expect(o).toMatchObject({ cliente_id: m.store.clientes[0].id, resolvida: false })
    expect(o.descricao).not.toMatch(/sk_live|123/)
  })
  it('sem credencial, computador errado ou tipo inválido: nada é gravado', async () => {
    const { m, post, caso } = await preparar()
    expect((await post(caso(), {})).status).toBe(403)
    expect((await post(caso(), { 'X-Atlas-Dispositivo': 'errado' })).status).toBe(403)
    expect((await post(caso({ computador_hash: H2 }))).status).toBe(403)
    expect((await post(caso({ email: 'x@y.com' }))).status).toBe(403)
    expect((await post(caso({ tipo: 'outro' }))).status).toBe(400)
    expect((await post(caso({ descricao: '   ' }))).status).toBe(400)
    expect(m.store.ocorrencias.filter((x) => x.tipo === 'ajuda_nao_resolvida')).toHaveLength(0)
  })
  it('corta descrição enorme e limita a frequência', async () => {
    const { m, post, caso } = await preparar()
    await post(caso({ descricao: 'a'.repeat(5000) }))
    expect(m.store.ocorrencias[0].descricao.length).toBeLessThanOrEqual(1200)
    let ultimo = 200
    for (let i = 0; i < 12; i++) ultimo = (await post(caso())).status
    expect(ultimo).toBe(429)
  })
})
