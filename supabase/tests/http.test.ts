// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { H1, montar } from './helpers.ts'

function ctx() {
  const m = montar()
  return { m, c: { deps: m.deps, carregarKit: async () => [{ caminho: 'a.md', conteudo: 'x' }], autorizarServico: (r: Request) => r.headers.get('Authorization') === 'Bearer s' } }
}
const post = (c: ReturnType<typeof ctx>['c'], rota: string, corpo: object, h: Record<string, string> = {}) =>
  tratar(c, new Request(`https://x.test/functions/v1${rota}`, { method: 'POST', headers: h, body: JSON.stringify(corpo) }))

describe('http', () => {
  it('fluxo completo: link, código, ativar, verificar, entregar', async () => {
    const { m, c } = ctx()
    expect((await post(c, '/link-instalacao', { email: 'ana@loja.com' })).status).toBe(401)
    const { token } = await (await post(c, '/link-instalacao', { email: 'ana@loja.com' }, { Authorization: 'Bearer s' })).json()
    await post(c, '/ativar/solicitar-codigo', { email: 'ana@loja.com' })
    const ok = await post(c, '/ativar/confirmar', { email: 'ana@loja.com', codigo: m.emails[0], token, computador_hash: H1 })
    expect(ok.status).toBe(200)
    const v = await (await post(c, '/verificar', { email: 'ana@loja.com', computador_hash: H1 })).json()
    expect(v.pode_construir).toBe(true)
    const k = await post(c, '/entregar-kit', { email: 'ana@loja.com', computador_hash: H1, obra_id: 'o1' })
    expect(k.headers.get('Cache-Control')).toBe('no-store')
    expect((await k.json()).arquivos[0].conteudo).toContain('Lei 9.609/98')
  })
  it('erros viram JSON em pt-BR com status certo', async () => {
    const { c } = ctx()
    const r = await post(c, '/verificar', { email: 'a', computador_hash: 'x' })
    expect(r.status).toBe(400)
    expect((await post(c, '/nada', {})).status).toBe(404)
    expect((await tratar(c, new Request('https://x.test/verificar'))).status).toBe(405)
  })
})
