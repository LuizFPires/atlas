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
  it('/atualizacao: só com a credencial do dispositivo no cabeçalho; resposta sem cache', async () => {
    const { m, c } = ctx()
    await m.ativar()
    const sha512 = 'A'.repeat(86) + '=='
    const cc = { ...c, atualizacao: { manifesto: async () => ({ versao: '0.1.9', sha512, tamanho: 10 }), link: async () => 'https://x.test/assinado' } }
    const corpo = { email: 'ana@loja.com', computador_hash: H1, versao: '0.1.0' }
    expect((await post(cc, '/atualizacao', { ...corpo, token_dispositivo: TOKEN })).status).toBe(403)
    const r = await post(cc, '/atualizacao', corpo, { 'X-Atlas-Dispositivo': TOKEN })
    expect(r.status).toBe(200)
    expect(r.headers.get('Cache-Control')).toBe('no-store')
    expect(await r.json()).toMatchObject({ atualizar: true, versao: '0.1.9', url: 'https://x.test/assinado' })
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

describe('/prototipo/link e /prototipo/ver', () => {
  it('o app publica com a credencial no cabeçalho; o site lê pelo token; resposta sem cache', async () => {
    const { m, c } = ctx()
    await m.ativar()
    const guardados = new Map<string, unknown>()
    const cc = { ...c, origemWeb: 'https://atlas-ia.app.br', prototipos: { guardar: async (t: string, v: unknown) => { guardados.set(t, v) }, ler: async (t: string) => (guardados.get(t) as never) ?? null } }
    const doc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><section id="tela-a">oi</section>'
    const corpo = { email: 'ana@loja.com', computador_hash: H1, nome: 'Colore', documento: doc }
    expect((await post(cc, '/prototipo/link', { ...corpo, token_dispositivo: TOKEN })).status).toBe(403)
    const r = await post(cc, '/prototipo/link', corpo, { 'X-Atlas-Dispositivo': TOKEN })
    expect(r.status).toBe(200)
    const { url } = await r.json()
    const token = url.split('/p/')[1]
    const v = await post(cc, '/prototipo/ver', { token })
    expect(v.status).toBe(200)
    expect(v.headers.get('Cache-Control')).toBe('no-store')
    expect(await v.json()).toMatchObject({ nome: 'Colore', documento: doc })
  })
})
