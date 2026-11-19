// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import { auditarDegustacao, type DepsDegustacao, normalizarDominio } from '../functions/_shared/degustacao.ts'
import { tratar } from '../functions/_shared/http.ts'
import { chamar } from './helpers-portal.ts'
import { montar } from './helpers.ts'

const DIA = 24 * 3600_000
const HORA = 3600_000
const JWT_LUIZ = 'jwt-luiz'
const HMAC_PC = 'd'.repeat(64)

function montarAuditoria() {
  const m = montar()
  m.store.clientes.length = 0
  m.store.licencas.length = 0
  const degustacao: DepsDegustacao = { ...m.deps, enviarConfirmacaoDegustacao: async () => {} }
  const admin = { ...m.deps, autenticarPortal: async (jwt: string) => (jwt === JWT_LUIZ ? { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' } : null), emailsAdmin: lerEmailsAdmin('luiz@atlas.com') }
  let servico = false
  const ctx = { deps: m.deps, degustacao, admin, carregarKit: async () => { throw new Error('x') }, autorizarServico: () => servico }
  const pedir = (email: string, ip: string) =>
    tratar(ctx, new Request('https://x.test/degustacao/pedir', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email }) }))
  const rotaAuditar = () => tratar(ctx, new Request('https://x.test/degustacao/auditar', { method: 'POST', body: '{}' }))
  const adm = (rota: string, corpo: object = {}) => chamar(ctx, rota, JWT_LUIZ, corpo)
  const abertas = () => m.store.ocorrencias.filter((o) => o.tipo === 'auditoria_degustacao' && !o.resolvida)
  return { ...m, ctx, pedir, adm, rotaAuditar, abertas, liberarServico: () => { servico = true } }
}
const ligada = async () => { const a = montarAuditoria(); await a.adm('/admin/degustacao', { ativa: true }); return a }
/** Marca os pedidos como testes CONFIRMADOS (a varredura de domínio só conta esses). */
const confirmarTodos = (a: Awaited<ReturnType<typeof ligada>>) => { for (const d of a.store.degustacoes) d.status = 'confirmada' }
const auditar = (a: Awaited<ReturnType<typeof ligada>>) => auditarDegustacao(a.deps)

describe('auditoria — sinais', () => {
  it('domínio não bloqueado com 5 pessoas diferentes: alerta com o domínio, sem e-mail; abaixo disso, nada', async () => {
    const a = await ligada()
    for (let i = 0; i < 4; i++) await a.pedir(`fulano${i}@suspeito.xyz`, `30.0.0.${i}`)
    confirmarTodos(a)
    expect(await auditar(a)).toMatchObject({ ok: true, novos: 0 })
    await a.pedir('fulano4@suspeito.xyz', '30.0.0.9')
    confirmarTodos(a)
    expect(await auditar(a)).toMatchObject({ novos: 1 })
    const [o] = a.abertas()
    expect(o).toMatchObject({ autor: 'auto-auditoria', resolvida: false, chave: 'aud:dominio:suspeito.xyz', cliente_id: null })
    expect(o.descricao).toContain('@suspeito.xyz')
    expect(o.descricao).not.toMatch(/fulano/)
  })

  it('provedor grande (gmail) e domínio já bloqueado não geram alerta de domínio', async () => {
    const a = await ligada()
    for (let i = 0; i < 6; i++) await a.pedir(`pessoa${i}x@gmail.com`, `31.0.0.${i}`)
    for (let i = 0; i < 6; i++) await a.pedir(`p${i}@ja-bloqueado.xyz`, `31.0.1.${i}`)
    confirmarTodos(a)
    await a.store.adicionarDominioBloqueado('ja-bloqueado.xyz', 'descartavel', a.deps.agora())
    expect((await auditar(a)).novos).toBe(0)
  })

  it('burst de IP: 8 e-mails diferentes do mesmo IP; o IP aparece mascarado', async () => {
    const a = await ligada()
    for (let i = 0; i < 8; i++) {
      await a.pedir(`gente${i}@dominio${i}.com.br`, '77.88.99.10')
      if (i === 4) a.avancar(61 * 60_000) // o freio por IP é 5/h
    }
    expect((await auditar(a)).novos).toBe(1)
    const [o] = a.abertas()
    expect(o.chave).toMatch(/^aud:ip:/)
    expect(o.descricao).toContain('77.88.*.*')
    expect(o.descricao).not.toContain('99.10')
  })

  it('mesmo tronco com 3 grafias diferentes: alerta sem e-mail; 2 grafias não alertam', async () => {
    const a = await ligada()
    for (const e of ['zeca+1@exemplo.com', 'zeca+2@exemplo.com']) await a.pedir(e, '32.0.0.1')
    expect((await auditar(a)).novos).toBe(0)
    await a.pedir('zeca+3@exemplo.com', '32.0.0.2')
    a.avancar(61 * 60_000) // 3 pedidos/h por e-mail
    await a.pedir('zeca+4@exemplo.com', '32.0.0.3')
    expect((await auditar(a)).novos).toBe(1)
    const [o] = a.abertas()
    expect(o.chave).toMatch(/^aud:tronco:/)
    expect(o.descricao).not.toMatch(/zeca|@exemplo/)
    expect(o.descricao).toContain('4 jeitos')
  })

  it('computador barrado 3 vezes: alerta com só o final do código; 2 vezes não', async () => {
    const a = await ligada()
    a.store.dispositivosTeste.set(HMAC_PC, 'lic-dono')
    await a.store.registrarBarradaDispositivo(HMAC_PC, a.deps.agora())
    await a.store.registrarBarradaDispositivo(HMAC_PC, a.deps.agora())
    expect((await auditar(a)).novos).toBe(0)
    await a.store.registrarBarradaDispositivo(HMAC_PC, a.deps.agora())
    expect((await auditar(a)).novos).toBe(1)
    const [o] = a.abertas()
    expect(o.chave).toBe(`aud:disp:${HMAC_PC.slice(0, 12)}`)
    expect(o.descricao).toContain('final dddddd')
    expect(o.descricao).not.toContain(HMAC_PC)
  })

  it('atividade fora da janela de 7 dias não conta', async () => {
    const a = await ligada()
    for (let i = 0; i < 5; i++) await a.pedir(`velho${i}@antigo.xyz`, `33.0.0.${i}`)
    a.avancar(8 * DIA)
    expect((await auditar(a)).novos).toBe(0)
  })
})

describe('auditoria — sufixo público e pedidos não confirmados', () => {
  it('pedidos NÃO confirmados não bastam para sugerir domínio', async () => {
    const a = await ligada()
    for (let i = 0; i < 6; i++) await a.pedir(`n${i}@inflado.xyz`, `37.0.0.${i}`)
    expect((await auditar(a)).novos).toBe(0)
    confirmarTodos(a)
    expect((await auditar(a)).novos).toBe(1)
  })

  it('a varredura nunca sugere sufixo público (com.br) mesmo com 5+ confirmados; sugere um registrável de verdade', async () => {
    const a = await ligada()
    const agora = a.deps.agora()
    for (let i = 0; i < 6; i++) a.store.degustacoes.push({ email: `p${i}@com.br`, email_hash: `h-sufixo-${i}`, token_hash: `t-s-${i}`, status: 'confirmada', ip: null, expira_em: agora, criado_em: agora, confirmado_em: agora, pedidos: 1, variantes: 0, ultimo_pedido_em: agora })
    for (let i = 0; i < 6; i++) await a.pedir(`q${i}@descartavel123.com`, `38.0.0.${i}`)
    confirmarTodos(a)
    expect((await auditar(a)).novos).toBe(1)
    expect(a.abertas()[0].chave).toBe('aud:dominio:descartavel123.com')
  })

  it('bloquear sufixo público, TLD nu ou pai de provedor é recusado; domínio registrável passa', async () => {
    const a = await ligada()
    for (const ruim of ['com.br', 'net.br', 'co.uk', 'com', 'io', 'github.io']) {
      const r = await a.adm('/admin/dominios/adicionar', { dominio: ruim })
      expect([400, 409], ruim).toContain(r.status)
    }
    expect((await a.adm('/admin/dominios/adicionar', { dominio: 'com.br' })).status).toBe(409)
    expect((await (await a.adm('/admin/dominios/adicionar', { dominio: 'com.br' })).json()).erro).toBe('dominio_protegido')
    expect((await a.adm('/admin/dominios/adicionar', { dominio: 'google.com' })).status).toBe(200) // não é pai de nenhum provedor da lista
    expect((await a.adm('/admin/dominios/adicionar', { dominio: 'descartavel123.com' })).status).toBe(200)
    expect((await a.pedir('alguem@empresa.com.br', '39.0.0.1')).status).toBe(200) // com.br continua livre
    expect((await a.adm('/admin/dominios')).status).toBe(200)
  })
})

describe('auditoria — sem alerta repetido', () => {
  it('rodar de novo com o alerta aberto não duplica; resolvido e ainda suspeito, reabre', async () => {
    const a = await ligada()
    for (let i = 0; i < 5; i++) await a.pedir(`x${i}@repete.xyz`, `34.0.0.${i}`)
    confirmarTodos(a)
    expect((await auditar(a)).novos).toBe(1)
    a.avancar(7 * DIA - HORA)
    expect((await auditar(a)).novos).toBe(0)
    expect(a.abertas()).toHaveLength(1)
    const painel = await (await a.adm('/admin/painel')).json()
    expect(painel.atencao.find((x: { dominio_sugerido?: string }) => x.dominio_sugerido)).toMatchObject({ dominio_sugerido: 'repete.xyz' })
    await a.store.resolverOcorrencia(a.abertas()[0].id, 'luiz@atlas.com', a.deps.agora())
    expect((await auditar(a)).novos).toBe(1)
    expect(a.store.ocorrencias.filter((o) => o.tipo === 'auditoria_degustacao')).toHaveLength(2)
  })
})

describe('auditoria — lista de domínios no painel', () => {
  it('só admin; normaliza, valida, não duplica e protege provedores', async () => {
    const a = await ligada()
    expect((await chamar(a.ctx, '/admin/dominios', 'jwt-qualquer')).status).toBe(401)
    expect((await chamar(a.ctx, '/admin/dominios/adicionar', null, { dominio: 'x.xyz' })).status).toBe(401)
    expect(await (await a.adm('/admin/dominios')).json()).toEqual({ dominios: [] })
    const r = await a.adm('/admin/dominios/adicionar', { dominio: '  Lixo@LixoNovo.XYZ. ' })
    expect(await r.json()).toMatchObject({ ok: true, dominio: 'lixonovo.xyz', ja_existia: false })
    expect(await (await a.adm('/admin/dominios/adicionar', { dominio: 'lixonovo.xyz' })).json()).toMatchObject({ ja_existia: true })
    for (const ruim of ['', 'sem ponto', 'a b.com', 'x', '-ruim.com', 123]) expect((await a.adm('/admin/dominios/adicionar', { dominio: ruim })).status).toBe(400)
    expect((await a.adm('/admin/dominios/adicionar', { dominio: 'gmail.com' })).status).toBe(409)
    const lista = (await (await a.adm('/admin/dominios')).json()).dominios
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ dominio: 'lixonovo.xyz', motivo: 'descartavel' })
    expect(normalizarDominio('  Foo.COM.BR ')).toBe('foo.com.br')
  })

  it('bloquear recusa novos pedidos do domínio (e subdomínios); remover volta a liberar', async () => {
    const a = await ligada()
    await a.adm('/admin/dominios/adicionar', { dominio: 'temporario.xyz' })
    const bloqueado = await a.pedir('alguem@temporario.xyz', '35.0.0.1')
    expect(bloqueado.status).toBe(400)
    expect((await bloqueado.json()).erro).toBe('dominio_descartavel')
    expect((await a.pedir('alguem@sub.temporario.xyz', '35.0.0.2')).status).toBe(400)
    expect((await a.adm('/admin/dominios/remover', { dominio: 'temporario.xyz' })).status).toBe(200)
    expect((await a.pedir('alguem@temporario.xyz', '35.0.0.3')).status).toBe(200)
    expect((await a.adm('/admin/dominios/remover', { dominio: 'temporario.xyz' })).status).toBe(404)
    expect((await chamar(a.ctx, '/admin/dominios/remover', 'jwt-qualquer', { dominio: 'temporario.xyz' })).status).toBe(401)
  })
})

describe('auditoria — rota de serviço', () => {
  it('exige o segredo de serviço; com ele varre e devolve quantos alertas novos', async () => {
    const a = await ligada()
    for (let i = 0; i < 5; i++) await a.pedir(`y${i}@rota.xyz`, `36.0.0.${i}`)
    confirmarTodos(a)
    expect((await a.rotaAuditar()).status).toBe(401)
    expect(a.abertas()).toHaveLength(0)
    a.liberarServico()
    const r = await a.rotaAuditar()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, novos: 1 })
    expect(await (await a.rotaAuditar()).json()).toEqual({ ok: true, novos: 0 })
  })
})
