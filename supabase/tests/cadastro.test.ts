// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cadastrar, type BoasVindas, type DepsCadastro } from '../functions/_shared/cadastro.ts'
import { montarBoasVindas } from '../functions/_shared/emails.ts'
import { type Contexto, tratar } from '../functions/_shared/http.ts'
import { ErroRegra } from '../functions/_shared/tipos.ts'
import { sha256 } from '../functions/_shared/cripto.ts'
import { montarPag } from './helpers-pagamento.ts'

function pronto(pago = true) {
  const m = montarPag()
  const enviados: Array<{ email: string; dados: BoasVindas }> = []
  const falha = { envio: false }
  const deps: DepsCadastro = {
    ...m.deps,
    enviarBoasVindas: async (email, dados) => {
      if (falha.envio) throw new Error('e-mail fora do ar')
      enviados.push({ email, dados })
    },
  }
  if (pago) m.store.pagamentos.push({ licenca_id: 'l1', conta_gateway_id: 'conta-1', tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_1', gateway_pi: 'pi_1', pago_em: m.deps.agora() })
  return { m, deps, enviados, falha }
}
const pedido = { nome: ' Zé ', empresa: 'Barbearia do Zé', ramo: 'Barbearia: corte e barba', email: 'Ana@Loja.com' }

describe('cadastro pós-pagamento', () => {
  it('grava as 4 respostas, gera link de uso único e dispara o e-mail de boas-vindas', async () => {
    const { m, deps, enviados } = pronto()
    expect(await cadastrar(deps, pedido)).toEqual({ ok: true })
    expect(m.store.clientes[0]).toMatchObject({ nome_tratamento: 'Zé', empresa: 'Barbearia do Zé', ramo: 'Barbearia: corte e barba' })
    expect(m.store.clientes[0].cadastro_em).toBeInstanceOf(Date)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].email).toBe('ana@loja.com')
    expect(m.store.links[0].token_hash).toBe(await sha256(enviados[0].dados.token))
    const { assunto, texto } = montarBoasVindas({ ...enviados[0].dados, link_instalacao: `https://atlas-ia.app.br/instalar?t=${enviados[0].dados.token}` })
    expect(assunto).toContain('Zé')
    expect(texto).toContain('Barbearia do Zé')
    expect(texto).toContain('Ajuda do Atlas')
    expect(texto).not.toMatch(/atendente|equipe de suporte|ligue/i)
  })
  it('só vale uma vez: o segundo envio não manda outro acesso', async () => {
    const { deps, enviados } = pronto()
    await cadastrar(deps, pedido)
    await expect(cadastrar(deps, { ...pedido, nome: 'Outro' })).rejects.toMatchObject({ codigo: 'cadastro_feito', status: 409 })
    expect(enviados).toHaveLength(1)
  })
  it('dois envios ao mesmo tempo mandam um acesso só', async () => {
    const { deps, enviados } = pronto()
    const r = await Promise.allSettled([cadastrar(deps, pedido), cadastrar(deps, pedido)])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(enviados).toHaveLength(1)
  })
  it('sem pagamento confirmado, e-mail desconhecido ou licença cancelada: nada é gravado nem enviado', async () => {
    const sem = pronto(false)
    await expect(cadastrar(sem.deps, pedido)).rejects.toMatchObject({ codigo: 'sem_compra', status: 404 })
    const ok = pronto()
    await expect(cadastrar(ok.deps, { ...pedido, email: 'outro@x.com' })).rejects.toMatchObject({ codigo: 'sem_compra' })
    ok.m.store.licencas[0].status = 'cancelada'
    await expect(cadastrar(ok.deps, pedido)).rejects.toMatchObject({ codigo: 'sem_compra' })
    ok.m.store.licencas[0].status = 'ativa'
    ok.m.store.pagamentos[0].status = 'estornado'
    await expect(cadastrar(ok.deps, pedido)).rejects.toMatchObject({ codigo: 'sem_compra' })
    expect(sem.enviados.length + ok.enviados.length).toBe(0)
    expect(ok.m.store.clientes[0].cadastro_em).toBeFalsy()
  })
  it('valida as respostas', async () => {
    const { deps } = pronto()
    await expect(cadastrar(deps, { ...pedido, nome: '  ' })).rejects.toMatchObject({ codigo: 'nome_obrigatorio' })
    await expect(cadastrar(deps, { ...pedido, ramo: '' })).rejects.toMatchObject({ codigo: 'ramo_obrigatorio' })
    await expect(cadastrar(deps, { ...pedido, email: 'sem-arroba' })).rejects.toMatchObject({ codigo: 'email_invalido' })
    await expect(cadastrar(deps, { ...pedido, nome: 42 })).rejects.toBeInstanceOf(ErroRegra)
  })
  it('se o e-mail não sai, o cadastro é reaberto para tentar de novo', async () => {
    const { m, deps, enviados, falha } = pronto()
    falha.envio = true
    await expect(cadastrar(deps, pedido)).rejects.toMatchObject({ codigo: 'email_nao_enviado', status: 502 })
    expect(m.store.clientes[0].cadastro_em).toBeFalsy()
    falha.envio = false
    await cadastrar(deps, pedido)
    expect(enviados).toHaveLength(1)
  })
})

describe('POST /cadastro (http)', () => {
  const montarCtx = () => {
    const p = pronto()
    return { p, c: <Contexto>{ deps: p.m.deps, carregarKit: async () => [], autorizarServico: () => false, cadastro: p.deps, origemWeb: 'https://atlas-ia.app.br' } }
  }
  const post = (c: ReturnType<typeof montarCtx>['c'], corpo: object, h: Record<string, string> = {}) =>
    tratar(c, new Request('https://x.test/functions/v1/cadastro', { method: 'POST', headers: h, body: JSON.stringify(corpo) }))

  it('é pública, responde 200 e libera CORS só para o site do Luiz', async () => {
    const { c, p } = montarCtx()
    const r = await post(c, { nome: 'Zé', empresa: '', ramo: 'barbearia', email: 'ana@loja.com' }, { Origin: 'https://atlas-ia.app.br' })
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://atlas-ia.app.br')
    expect(p.enviados).toHaveLength(1)
    const estranho = await post(c, { email: 'x@y.com' }, { Origin: 'https://outro.site' })
    expect(estranho.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
  it('preflight: 204 para o site, 403 para os outros', async () => {
    const { c } = montarCtx()
    const pre = (origin: string) => tratar(c, new Request('https://x.test/functions/v1/cadastro', { method: 'OPTIONS', headers: { Origin: origin } }))
    expect((await pre('https://atlas-ia.app.br')).status).toBe(204)
    expect((await pre('https://outro.site')).status).toBe(403)
  })
  it('limita por IP e responde 503 sem configuração', async () => {
    const { c } = montarCtx()
    const h = { 'x-forwarded-for': '1.2.3.4' }
    for (let i = 0; i < 10; i++) await post(c, { email: 'nao@existe.com', nome: 'a', ramo: 'b' }, h)
    expect((await post(c, { email: 'nao@existe.com', nome: 'a', ramo: 'b' }, h)).status).toBe(429)
    expect((await post({ ...c, cadastro: undefined }, {})).status).toBe(503)
  })
})
