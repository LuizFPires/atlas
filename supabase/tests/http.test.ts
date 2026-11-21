// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { H1, montar, TOKEN } from './helpers.ts'

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
    const { token_dispositivo } = await ok.json()
    const sem = await (await post(c, '/verificar', { email: 'ana@loja.com', computador_hash: H1 })).json()
    expect(sem).toMatchObject({ pode_construir: false, motivo: 'negado', licenca_id: null })
    expect((await post(c, '/entregar-kit', { email: 'ana@loja.com', computador_hash: H1, obra_id: 'o1' })).status).toBe(403)
    const v = await (await post(c, '/verificar', { email: 'ana@loja.com', computador_hash: H1 }, { 'X-Atlas-Dispositivo': token_dispositivo })).json()
    expect(v.pode_construir).toBe(true)
    const k = await post(c, '/entregar-kit', { email: 'ana@loja.com', computador_hash: H1, obra_id: 'o1' }, { 'X-Atlas-Dispositivo': token_dispositivo })
    expect(k.headers.get('Cache-Control')).toBe('no-store')
    expect((await k.json()).arquivos[0].conteudo).toContain('Lei 9.609/98')
  })
  it('/licenca/resumo: só com a credencial do dispositivo no cabeçalho', async () => {
    const { m, c } = ctx()
    await m.ativar()
    const corpo = { email: 'ana@loja.com', computador_hash: H1 }
    const sem = await post(c, '/licenca/resumo', { ...corpo, token_dispositivo: TOKEN })
    expect(sem.status).toBe(401)
    expect(await sem.json()).toMatchObject({ erro: 'negado' })
    const com = await post(c, '/licenca/resumo', corpo, { 'X-Atlas-Dispositivo': TOKEN })
    expect(com.status).toBe(200)
    expect(await com.json()).toMatchObject({ tipo: 'paga', validade_em: null, vencida: false })
  })
  it('credencial no corpo é ignorada; só o cabeçalho vale', async () => {
    const { m, c } = ctx()
    await m.ativar()
    const noCorpo = await (await post(c, '/verificar', { email: 'ana@loja.com', computador_hash: H1, token_dispositivo: TOKEN })).json()
    expect(noCorpo).toMatchObject({ pode_construir: false, motivo: 'negado' })
    const noHeader = await (await post(c, '/verificar', { email: 'ana@loja.com', computador_hash: H1 }, { 'X-Atlas-Dispositivo': TOKEN })).json()
    expect(noHeader.pode_construir).toBe(true)
  })
  it('IP vem do último hop do x-forwarded-for (o primeiro é forjável)', async () => {
    const { c } = ctx()
    for (let i = 0; i < 3; i++) await post(c, '/ativar/solicitar-codigo', { email: `u${i}@x.com` }, { 'x-forwarded-for': `9.9.9.${i}, 1.2.3.4` })
    expect((await post(c, '/ativar/solicitar-codigo', { email: 'o@x.com' }, { 'x-forwarded-for': '8.8.8.8, 1.2.3.4' })).status).toBe(429)
  })
  it('limite de códigos por IP vira 429', async () => {
    const { c } = ctx()
    const h = { 'x-forwarded-for': '1.2.3.4' }
    for (let i = 0; i < 3; i++) expect((await post(c, '/ativar/solicitar-codigo', { email: `u${i}@x.com` }, h)).status).toBe(200)
    expect((await post(c, '/ativar/solicitar-codigo', { email: 'outro@x.com' }, h)).status).toBe(429)
    expect((await post(c, '/ativar/solicitar-codigo', { email: 'outro@x.com' }, { 'x-forwarded-for': '5.6.7.8' })).status).toBe(200)
  })
  it('erros viram JSON em pt-BR com status certo', async () => {
    const { c } = ctx()
    const r = await post(c, '/verificar', { email: 'a', computador_hash: 'x' })
    expect(r.status).toBe(400)
    expect((await post(c, '/nada', {})).status).toBe(404)
    expect((await tratar(c, new Request('https://x.test/verificar'))).status).toBe(405)
  })
})
