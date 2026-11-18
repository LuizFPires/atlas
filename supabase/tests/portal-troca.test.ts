// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { confirmarAtivacao, solicitarCodigo } from '../functions/_shared/ativacao.ts'
import { liberarTroca } from '../functions/_shared/troca.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { H2 } from './helpers.ts'
import { chamar, comDoisClientes, JWT_ANA } from './helpers-portal.ts'

const DIA = 24 * 3600_000
type M = Awaited<ReturnType<typeof comDoisClientes>>

const pedir = async (m: M, jwt = JWT_ANA) => {
  await m.store.limparEventos('emissao:ip:desconhecido')
  await m.store.limparEventos('emissao:cliente:c1:troca')
  return chamar(m.ctx(), '/portal/trocar/solicitar-codigo', jwt)
}

describe('portal — trocar de computador por e-mail + código (item 3)', () => {
  it('código vai SÓ para o e-mail da compra; desativa SEM o computador antigo e manda o link do novo', async () => {
    const m = await comDoisClientes()
    const p = await pedir(m)
    expect(await p.json()).toEqual({ ok: true, enviado_para: 'a***@loja.com' })
    expect(m.emails).toHaveLength(1)
    const r = await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails[0] })
    expect(r.status).toBe(200)
    expect((await r.json()).proxima_troca_em).toBe('2026-11-25T12:00:00.000Z')
    expect(m.store.ativacoes.find((a) => a.licenca_id === 'l1')?.ativo).toBe(false)
    expect(m.boasVindas).toEqual([{ email: 'ana@loja.com', token: expect.any(String) }])
    // computador antigo perde a permissão na hora
    const v = await verificar(m.deps, { email: 'ana@loja.com', computador_hash: 'a'.repeat(64), token_dispositivo: 'qualquer' })
    expect(v.pode_construir).toBe(false)
    // o novo ativa pelo link (fluxo do M2) e fica só um ativo
    await solicitarCodigo(m.deps, 'ana@loja.com', 'ativacao', 'ip-novo')
    const cod = m.emails.at(-1)!
    const at = await confirmarAtivacao(m.deps, { email: 'ana@loja.com', codigo: cod, token: m.boasVindas[0].token, computador_hash: H2 })
    expect(at.licenca_id).toBe('l1')
    expect(m.store.ativacoes.filter((a) => a.licenca_id === 'l1' && a.ativo)).toHaveLength(1)
  })

  it('código errado ou ausente não desativa nada', async () => {
    const m = await comDoisClientes()
    await pedir(m)
    for (const codigo of ['000000', '', undefined]) {
      const r = await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo })
      expect(r.status).toBe(400)
    }
    expect(m.store.ativacoes.find((a) => a.licenca_id === 'l1')?.ativo).toBe(true)
    expect(m.boasVindas).toHaveLength(0)
  })

  it('limite 1 troca a cada 7 dias; override do admin ignora o limite', async () => {
    const m = await comDoisClientes()
    await pedir(m)
    await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails.at(-1) })
    await m.store.inserirAtivacao('l1', H2, m.deps.agora(), 'x') // novo computador ativado
    m.avancar(2 * DIA)
    const bloq = await pedir(m)
    expect(bloq.status).toBe(429)
    expect((await bloq.json()).proxima_troca_em).toBe('2026-11-25T12:00:00.000Z')
    const c = await (await chamar(m.ctx(), '/portal/conta', JWT_ANA)).json()
    expect(c.troca).toEqual({ pode_agora: false, proxima_troca_em: '2026-11-25T12:00:00.000Z' })
    // mesmo com um código válido emitido por fora, a regra do limite vale
    await solicitarCodigo(m.deps, 'ana@loja.com', 'troca', 'outro-ip')
    expect((await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails.at(-1) })).status).toBe(429)
    expect(m.store.ativacoes.find((a) => a.computador_hash === H2)?.ativo).toBe(true)
    // override manual do admin (M2) libera uma troca fora do limite
    await liberarTroca(m.deps, 'l1', 'roubo comprovado')
    await solicitarCodigo(m.deps, 'ana@loja.com', 'troca', 'ip3')
    expect((await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails.at(-1) })).status).toBe(200)
  })

  it('passados 7 dias da última troca, o portal libera outra', async () => {
    const m = await comDoisClientes()
    await pedir(m)
    await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails.at(-1) })
    m.avancar(7 * DIA + 1000)
    expect((await (await chamar(m.ctx(), '/portal/conta', JWT_ANA)).json()).troca.pode_agora).toBe(true)
  })

  it('não mexe no computador de outro cliente (cada login age só na própria licença)', async () => {
    const m = await comDoisClientes()
    await solicitarCodigo(m.deps, 'beto@outra.com', 'troca', 'ip-b')
    const codBeto = m.emails.at(-1)!
    // Ana tenta usar o código do Beto e apontar a licença dele no corpo: nada acontece com o Beto
    const r = await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: codBeto, licenca_id: 'l2', email: 'beto@outra.com' })
    expect(r.status).toBe(400)
    expect(m.store.ativacoes.find((a) => a.licenca_id === 'l2')?.ativo).toBe(true)
    expect(m.store.ativacoes.find((a) => a.licenca_id === 'l1')?.ativo).toBe(true)
  })

  it('licença cancelada ou sem computador ativo: recusa com mensagem clara', async () => {
    const m = await comDoisClientes()
    m.store.ativacoes.find((a) => a.licenca_id === 'l1')!.ativo = false
    await solicitarCodigo(m.deps, 'ana@loja.com', 'troca', 'ip-1')
    const r = await chamar(m.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails.at(-1) })
    expect(r.status).toBe(409)
    expect((await r.json()).erro).toBe('sem_ativacao')
    await m.store.atualizarLicencaSe('l1', { status: 'cancelada' }, {})
    expect((await pedir(m)).status).toBe(409)
  })

  it('e-mail que falhou: o computador já foi liberado, mas o acesso pode ser reenviado (3 por hora)', async () => {
    const m = await comDoisClientes()
    await pedir(m)
    const ctx = m.ctx()
    ctx.portal = { ...ctx.portal!, enviarBoasVindas: async () => { throw new Error('smtp fora') } }
    const r = await chamar(ctx, '/portal/trocar/desativar', JWT_ANA, { codigo: m.emails.at(-1) })
    expect(r.status).toBe(502)
    expect(m.store.ativacoes.find((a) => a.licenca_id === 'l1')?.ativo).toBe(false)
    expect(m.store.links.filter((l) => !l.usado_em)).toHaveLength(0) // nenhum link ficou valendo sem o cliente ter recebido
    expect((await chamar(m.ctx(), '/portal/reenviar-acesso', JWT_ANA)).status).toBe(200)
    expect(m.boasVindas).toHaveLength(1)
    await chamar(m.ctx(), '/portal/reenviar-acesso', JWT_ANA)
    await chamar(m.ctx(), '/portal/reenviar-acesso', JWT_ANA)
    expect((await chamar(m.ctx(), '/portal/reenviar-acesso', JWT_ANA)).status).toBe(429)
    expect(m.store.links.filter((l) => !l.usado_em)).toHaveLength(1) // sempre um só link válido
  })

  it('reenviar o acesso com computador ativo é recusado', async () => {
    const m = await comDoisClientes()
    expect((await chamar(m.ctx(), '/portal/reenviar-acesso', JWT_ANA)).status).toBe(409)
  })
})
