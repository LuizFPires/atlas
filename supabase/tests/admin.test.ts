// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { inicioDoMes, lerEmailsAdmin } from '../functions/_shared/admin.ts'
import { tratar } from '../functions/_shared/http.ts'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO } from './helpers-portal.ts'

const JWT_LUIZ = 'jwt-luiz'
const JWT_ADMIN_FALSO = 'jwt-admin-falso'
const HORA = 3600_000
const DIA = 24 * HORA

async function montarAdmin() {
  const m = await comDoisClientes()
  m.sessoes.set(JWT_LUIZ, { auth_user_id: 'auth-luiz', email: ' Luiz@Atlas.com ' })
  m.sessoes.set(JWT_ADMIN_FALSO, { auth_user_id: 'auth-falso', email: 'luiz@atlas.com.evil.com' })
  const admin = { ...m.deps, autenticarPortal: m.deps.autenticarPortal, emailsAdmin: lerEmailsAdmin('luiz@atlas.com, , lixo') }
  const ctx = () => m.ctx({ admin })
  return { ...m, admin, ctx }
}
type A = Awaited<ReturnType<typeof montarAdmin>>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const painel = async (a: A) => (await (await chamar(a.ctx(), '/admin/painel', JWT_LUIZ)).json()) as any

const ROTAS = ['/admin/eu', '/admin/painel', '/admin/ocorrencias/resolver', '/admin/liberar-troca', '/admin/entregas', '/admin/cadastros', '/admin/cortesia', '/admin/qualquer-coisa']

describe('admin — só o admin entra (segurança)', () => {
  it('sem token, token inválido, cliente comum logado e e-mail parecido: nenhuma rota /admin/* abre', async () => {
    const a = await montarAdmin()
    for (const rota of ROTAS) {
      for (const u of ['auth-ana', 'auth-falso']) await a.store.limparEventos(`admin:negado:${u}`) // o limite de sondagem tem teste próprio
      expect((await chamar(a.ctx(), rota, null)).status, `${rota} sem token`).toBe(401)
      expect((await chamar(a.ctx(), rota, 'jwt-inexistente')).status, `${rota} token inválido`).toBe(401)
      const cliente = await chamar(a.ctx(), rota, JWT_ANA, { licenca_id: 'l2', motivo: 'tentando invadir' })
      expect(cliente.status, `${rota} cliente`).toBe(403)
      expect((await cliente.json()).erro).toBe('sem_acesso')
      expect((await chamar(a.ctx(), rota, JWT_ADMIN_FALSO)).status, `${rota} e-mail parecido`).toBe(403)
    }
    expect(a.store.ocorrencias.filter((o) => o.tipo === 'override_troca')).toHaveLength(0)
    expect(a.store.licencas.every((l) => !l.troca_liberada_em)).toBe(true)
  })

  it('sem allowlist configurada ninguém é admin (fail-closed), e sem o contexto admin responde 503', async () => {
    const a = await montarAdmin()
    const vazio = a.ctx()
    vazio.admin = { ...a.admin, emailsAdmin: lerEmailsAdmin('') }
    expect((await chamar(vazio, '/admin/painel', JWT_LUIZ)).status).toBe(403)
    const sem = a.ctx()
    delete sem.admin
    expect((await chamar(sem, '/admin/painel', JWT_LUIZ)).status).toBe(503)
  })

  it('o admin entra (e-mail normalizado) e a rota desconhecida só diz 404 a ele', async () => {
    const a = await montarAdmin()
    expect(await (await chamar(a.ctx(), '/admin/eu', JWT_LUIZ)).json()).toEqual({ email: 'luiz@atlas.com' })
    expect((await chamar(a.ctx(), '/admin/nao-existe', JWT_LUIZ)).status).toBe(404)
  })

  it('sondagem de quem não é admin é limitada (429)', async () => {
    const a = await montarAdmin()
    const codigos: number[] = []
    for (let i = 0; i < 7; i++) codigos.push((await chamar(a.ctx(), '/admin/painel', JWT_BETO)).status)
    expect(codigos).toEqual([403, 403, 403, 403, 403, 429, 429])
  })

  it('só POST (GET não abre nada) e o cron de atrasos segue só por segredo de serviço', async () => {
    const a = await montarAdmin()
    const get = await tratar(a.ctx(), new Request('https://x.test/admin/painel', { method: 'GET', headers: { Authorization: `Bearer ${JWT_LUIZ}` } }))
    expect(get.status).toBe(405)
    expect((await chamar(a.ctx(), '/admin/processar-atrasos', JWT_LUIZ)).status).toBe(401) // JWT de admin não substitui o segredo do cron
  })
})

describe('admin — painel: indicadores e lista de atenção', () => {
  it('clientes_ativos não conta cortesia vencida (bate com a situação cancelada)', async () => {
    const a = await montarAdmin()
    const agora = a.deps.agora()
    const base = (await painel(a)).indicadores.clientes_ativos
    a.store.clientes.push({ id: 'cv', email_compra: 'v@x.com', nome_tratamento: 'V' })
    a.store.licencas.push({ id: 'lv', cliente_id: 'cv', status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, comprada_em: null, tipo: 'cortesia', validade_em: new Date(agora.getTime() - DIA) } as never)
    const corpo = await painel(a)
    expect(corpo.indicadores.clientes_ativos).toBe(base)
    expect(corpo.clientes.find((c: { nome: string }) => c.nome === 'V')).toMatchObject({ situacao: 'cancelada' })
  })
  it('agrega receita, inadimplência, ativações e travados do próprio Atlas, sem vazar segredo', async () => {
    const a = await montarAdmin()
    const agora = a.deps.agora()
    // Ana: em dia, com mensalidade. Beto: atrasado. Carla: pagou há 3 dias e nunca cadastrou (travada).
    a.store.licencas[1].status = 'atrasada'
    a.store.clientes.push({ id: 'c3', email_compra: 'carla@x.com', nome_tratamento: 'Carla' })
    a.store.licencas.push({ id: 'l3', cliente_id: 'c3', status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, comprada_em: new Date(agora.getTime() - 3 * DIA), conta_gateway_id: 'conta-1', gateway_cliente_ref: 'cus_carla', gateway_assinatura_ref: null })
    await a.store.gravarPagamento({ licenca_id: 'l3', conta_gateway_id: 'conta-1', tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_carla', gateway_pi: 'pi_carla', pago_em: new Date(agora.getTime() - 3 * DIA) })
    await a.store.gravarPagamento({ licenca_id: 'l1', conta_gateway_id: 'conta-1', tipo: 'mensalidade', valor: 200, status: 'pago', gateway_ref: 'in_ana', gateway_pi: 'pi_in_ana', pago_em: agora })
    await a.store.gravarPagamento({ licenca_id: 'l2', conta_gateway_id: 'conta-1', tipo: 'mensalidade', valor: 200, status: 'falhou', gateway_ref: 'in_beto', gateway_pi: null, pago_em: null })
    const corpo = await painel(a)
    expect(corpo.indicadores.clientes_ativos).toBe(2) // Ana e Carla (Beto está atrasado)
    expect(corpo.indicadores.receita).toEqual({ recorrente_mensal: 400, recebida_no_mes: 4800 * 3 + 200, implantacoes_recebidas_no_mes: 3 })
    expect(corpo.indicadores.inadimplencia).toEqual({ atrasadas: 1, pausadas: 0, valor_em_aberto: 200 })
    expect(corpo.indicadores.ativacoes).toEqual({ no_mes: 2, meta: 100, computadores_ativos: 2 })
    expect(corpo.indicadores.travados).toBe(1)
    expect(corpo.clientes[0]).toMatchObject({ nome: 'Carla', travado_em: 'cadastro', situacao: 'ativando' })
    expect(corpo.clientes.find((c: { nome: string }) => c.nome === 'Beto').situacao).toBe('atrasada')
    const texto = JSON.stringify(corpo)
    for (const proibido of ['token_hash', 'SEGREDO', 'computador_hash', 'gateway', 'cus_', 'sub_', 'pi_', 'conta-1', 'acct_', 'sk_']) expect(texto).not.toContain(proibido)
  })

  it('"precisam de atenção" vem de ocorrencias_admin (abertas), com quem e o quê', async () => {
    const a = await montarAdmin()
    await a.store.inserirOcorrencia({ cliente_id: 'c2', tipo: 'licenca_pausada', descricao: 'Pipeline pausado: mensalidade em atraso por mais de 7 dias.' })
    await a.store.inserirOcorrencia({ cliente_id: 'c1', tipo: 'compra_cancelada', descricao: 'resolvida antes', resolvida: true })
    const { atencao } = await painel(a)
    expect(atencao).toHaveLength(1)
    expect(atencao[0]).toMatchObject({ quem: 'Beto', tipo: 'licenca_pausada', oque: expect.stringContaining('atraso'), licenca_id: null })
  })

  it('cliente que tenta trocar antes de 7 dias vira item de atenção (uma vez por dia) com o botão de liberar', async () => {
    const a = await montarAdmin()
    a.store.trocas.push({ licenca_id: 'l1', de_hash: 'x'.repeat(64), para_hash: 'y'.repeat(64), feita_em: new Date(a.deps.agora().getTime() - 2 * DIA), por_admin: false })
    for (let i = 0; i < 3; i++) expect((await chamar(a.ctx(), '/portal/trocar/solicitar-codigo', JWT_ANA)).status).toBe(429)
    const { atencao } = await painel(a)
    expect(atencao).toHaveLength(1)
    expect(atencao[0]).toMatchObject({ quem: 'Ana', tipo: 'troca_antecipada', licenca_id: 'l1' })
  })

  it('travado depois do cadastro = etapa "instalacao"; mês usa horário de Brasília', async () => {
    const a = await montarAdmin()
    a.store.clientes.push({ id: 'c4', email_compra: 'd@x.com', nome_tratamento: 'Davi', cadastro_em: new Date(a.deps.agora().getTime() - 5 * DIA) })
    a.store.licencas.push({ id: 'l4', cliente_id: 'c4', status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, comprada_em: new Date(a.deps.agora().getTime() - 6 * DIA) })
    expect((await painel(a)).clientes[0]).toMatchObject({ nome: 'Davi', travado_em: 'instalacao' })
    expect(inicioDoMes(new Date('2026-12-01T02:00:00Z')).toISOString()).toBe('2026-11-01T03:00:00.000Z') // 30/11 23h em Brasília
  })
})

describe('admin — ações (auditadas, sem IDOR)', () => {
  it('liberar troca urgente: ignora o limite 1/7 dias uma vez, grava quem/quando e dá baixa no pedido', async () => {
    const a = await montarAdmin()
    a.store.trocas.push({ licenca_id: 'l1', de_hash: 'x'.repeat(64), para_hash: 'y'.repeat(64), feita_em: new Date(a.deps.agora().getTime() - 1 * DIA), por_admin: false })
    expect((await chamar(a.ctx(), '/portal/trocar/solicitar-codigo', JWT_ANA)).status).toBe(429)
    expect((await painel(a)).atencao).toHaveLength(1)
    const r = await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'l1', motivo: 'PC da Ana pegou fogo' })
    expect(await r.json()).toEqual({ ok: true, ja_liberada: false })
    expect(a.store.licencas[0].troca_liberada_em).toEqual(a.deps.agora())
    const audit = a.store.ocorrencias.find((o) => o.tipo === 'override_troca')!
    expect(audit).toMatchObject({ cliente_id: 'c1', autor: 'luiz@atlas.com', resolvida: true, descricao: expect.stringContaining('PC da Ana pegou fogo') })
    expect(audit.criada_em).toEqual(a.deps.agora())
    expect((await painel(a)).atencao).toHaveLength(0)
    // agora o cliente consegue e o override é consumido
    expect((await chamar(a.ctx(), '/portal/trocar/solicitar-codigo', JWT_ANA)).status).toBe(200)
    const d = await chamar(a.ctx(), '/portal/trocar/desativar', JWT_ANA, { codigo: a.emails.at(-1)! })
    expect(d.status).toBe(200)
    expect(a.store.licencas[0].troca_liberada_em).toBeNull()
  })

  it('liberar é idempotente, exige motivo e só mexe na licença pedida (Beto intacto)', async () => {
    const a = await montarAdmin()
    expect((await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'l1', motivo: 'x' })).status).toBe(400)
    expect((await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'l1' })).status).toBe(400)
    expect((await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: ['l1'], motivo: 'motivo válido' })).status).toBe(400)
    expect((await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'nao-existe', motivo: 'motivo válido' })).status).toBe(404)
    expect((await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'l1', motivo: 'motivo válido' })).status).toBe(200)
    const deNovo = await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'l1', motivo: 'motivo válido' })
    expect(await deNovo.json()).toEqual({ ok: true, ja_liberada: true })
    expect(a.store.ocorrencias.filter((o) => o.tipo === 'override_troca')).toHaveLength(1)
    expect(a.store.licencas[1].troca_liberada_em).toBeFalsy()
  })

  it('licença cancelada não recebe override', async () => {
    const a = await montarAdmin()
    a.store.licencas[0].status = 'cancelada'
    expect((await chamar(a.ctx(), '/admin/liberar-troca', JWT_LUIZ, { licenca_id: 'l1', motivo: 'motivo válido' })).status).toBe(409)
  })

  it('resolver ocorrência registra quem/quando; id inexistente ou já resolvido dá 404', async () => {
    const a = await montarAdmin()
    await a.store.inserirOcorrencia({ cliente_id: 'c2', tipo: 'licenca_pausada', descricao: 'x' })
    const id = a.store.ocorrencias[0].id
    expect((await chamar(a.ctx(), '/admin/ocorrencias/resolver', JWT_LUIZ, { id })).status).toBe(200)
    expect(a.store.ocorrencias[0]).toMatchObject({ resolvida: true, resolvida_por: 'luiz@atlas.com', resolvida_em: a.deps.agora() })
    expect((await chamar(a.ctx(), '/admin/ocorrencias/resolver', JWT_LUIZ, { id })).status).toBe(404)
    expect((await chamar(a.ctx(), '/admin/ocorrencias/resolver', JWT_LUIZ, { id: { $ne: 1 } })).status).toBe(400)
  })

  it('ver entregas e marca d’água: recentes, por licença e por marca (rastrear vazamento)', async () => {
    const a = await montarAdmin()
    const t = a.deps.agora()
    a.store.entregas.push(
      { licenca_id: 'l1', obra_id: 'obra-1', marca_dagua: 'marca-da-ana-0001', baixado_em: new Date(t.getTime() - HORA) },
      { licenca_id: 'l2', obra_id: 'obra-9', marca_dagua: 'marca-do-beto-0002', baixado_em: t },
    )
    const todas = await (await chamar(a.ctx(), '/admin/entregas', JWT_LUIZ)).json()
    expect(todas.entregas.map((e: { cliente: string }) => e.cliente)).toEqual(['Beto', 'Ana'])
    const daAna = await (await chamar(a.ctx(), '/admin/entregas', JWT_LUIZ, { licenca_id: 'l1' })).json()
    expect(daAna.entregas).toHaveLength(1)
    const marca = await (await chamar(a.ctx(), '/admin/entregas', JWT_LUIZ, { marca: 'marca-do-beto-0002' })).json()
    expect(marca.entregas).toMatchObject([{ cliente: 'Beto', obra_id: 'obra-9' }])
    expect((await chamar(a.ctx(), '/admin/entregas', JWT_LUIZ, { marca: "x' or 1=1 --" })).status).toBe(400)
  })

  it('ver cadastros: respostas e quem ainda não respondeu', async () => {
    const a = await montarAdmin()
    Object.assign(a.store.clientes[0], { empresa: 'Loja da Ana', ramo: 'roupas', cadastro_em: a.deps.agora() })
    const { cadastros } = await (await chamar(a.ctx(), '/admin/cadastros', JWT_LUIZ)).json()
    expect(cadastros.find((c: { nome: string }) => c.nome === 'Ana')).toMatchObject({ empresa: 'Loja da Ana', ramo: 'roupas', email: 'ana@loja.com', situacao: 'feito' })
    expect(cadastros.find((c: { nome: string }) => c.nome === 'Beto').situacao).toBe('pendente')
    expect(JSON.stringify(cadastros)).not.toMatch(/auth_user_id|auth-ana/)
  })
})
