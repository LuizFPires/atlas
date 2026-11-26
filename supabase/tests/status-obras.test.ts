// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { limparTexto } from '../functions/_shared/status-obras.ts'
import { H1, H2, TOKEN } from './helpers.ts'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO, JWT_INTRUSO } from './helpers-portal.ts'

const obra = (extra: Record<string, unknown> = {}) => ({
  id: 'o1', nome: 'Agenda da Barbearia', segmento: 'Barbearia', etapa_atual: { numero: 3, rotulo: 'Agendamento' }, total_etapas: 5,
  percentual: 60, estado: 'construindo', ativa_agora: true, ultima_noticia: 'Terminei a tela de horários.', quando: '2026-11-18T11:00:00Z', ...extra,
})

async function preparar() {
  const m = await comDoisClientes()
  const c = m.ctx()
  const publicar = (corpo: object, h: Record<string, string> = { 'X-Atlas-Dispositivo': TOKEN }) =>
    tratar(c, new Request('https://x.test/functions/v1/status-obras/publicar', { method: 'POST', headers: h, body: JSON.stringify(corpo) }))
  const pedido = (obras: unknown, extra: object = {}) => ({ email: 'ana@loja.com', computador_hash: 'a'.repeat(64), obras, ...extra })
  return { m, c, publicar, pedido }
}

describe('/status-obras/publicar — autenticação', () => {
  it('sem dispositivo, token errado, computador errado ou e-mail errado: 403 e nada gravado', async () => {
    const { m, publicar, pedido } = await preparar()
    expect((await publicar(pedido([obra()]), {})).status).toBe(403)
    expect((await publicar(pedido([obra()]), { 'X-Atlas-Dispositivo': 'errado' })).status).toBe(403)
    expect((await publicar(pedido([obra()], { computador_hash: H2 }))).status).toBe(403)
    expect((await publicar(pedido([obra()], { email: 'x@y.com' }))).status).toBe(403)
    expect((await publicar(pedido([obra()], { computador_hash: 'curto' }))).status).toBe(400)
    expect(m.store.statusObras).toHaveLength(0)
  })
  it('a licença vem do servidor: licenca_id no corpo é ignorado', async () => {
    const { m, publicar, pedido } = await preparar()
    expect((await publicar(pedido([obra()], { licenca_id: 'l2' }))).status).toBe(200)
    expect(m.store.statusObras.map((s) => s.licenca_id)).toEqual(['l1'])
  })
  it('limita a frequência por licença, com folga para o notebook mandar o andamento a cada 30 s (mais as pausas)', async () => {
    const { publicar, pedido } = await preparar()
    const status: number[] = []
    for (let i = 0; i < 245; i++) status.push((await publicar(pedido([obra()]))).status)
    expect(status.slice(0, 200).every((s) => s === 200)).toBe(true)
    expect(status[status.length - 1]).toBe(429)
  })
})

describe('/status-obras/publicar — validação, sanitização e substituição', () => {
  it('recusa estado, percentual e formato inválidos (nada parcial)', async () => {
    const { m, publicar, pedido } = await preparar()
    for (const ruim of [
      [obra({ estado: 'explodindo' })], [obra({ percentual: 101 })], [obra({ percentual: -1 })], [obra({ percentual: 50.5 })],
      [obra({ nome: '   ' })], [obra({ id: '../etc' })], [obra(), obra()], [obra(), obra({ id: 'o2', percentual: 'x' })], 'texto',
      Array.from({ length: 21 }, (_, i) => obra({ id: `o${i}` })),
    ]) expect((await publicar(pedido(ruim))).status).toBe(400)
    expect(m.store.statusObras).toHaveLength(0)
  })
  it('limpa e-mail, link, caminho, segredo e controle; corta o tamanho', async () => {
    const { m, publicar, pedido } = await preparar()
    const r = await publicar(pedido([obra({
      nome: 'Loja\u0007 da Ana', ultima_noticia: 'Veja https://x.com/a e ana@loja.com em C:\\Users\\Ana\\Atlas\\Obras\\app.ts com sk_live_abcdefgh12345678 senha: 123 ok',
      etapa_atual: { numero: 1, rotulo: 'r'.repeat(500) },
    })]))
    expect(r.status).toBe(200)
    const s = m.store.statusObras[0]
    expect(s.nome).toBe('Loja da Ana')
    expect(s.ultima_noticia).not.toMatch(/https?:|@|C:|sk_live|123|Users/)
    expect(s.ultima_noticia).toContain('ok')
    expect(s.etapa_atual_rotulo.length).toBeLessThanOrEqual(80)
    expect(limparTexto('a'.repeat(900), 280)).toHaveLength(280)
  })
  it('no máximo uma obra ativa; data futura vira a do servidor', async () => {
    const { m, publicar, pedido } = await preparar()
    await publicar(pedido([obra(), obra({ id: 'o2', quando: '2030-01-01T00:00:00Z' })]))
    expect(m.store.statusObras.filter((s) => s.ativa_agora)).toHaveLength(1)
    expect(m.store.statusObras.find((s) => s.obra_id === 'o2')!.ultima_noticia_em.toISOString()).toBe('2026-11-18T12:00:00.000Z')
  })
  it('a lista SUBSTITUI o conjunto da licença (atualiza, adiciona e remove) sem tocar nas de outra licença', async () => {
    const { m, publicar, pedido } = await preparar()
    await m.store.substituirStatusObras('l2', [{ obra_id: 'b1', nome: 'Do Beto', segmento: null, etapa_atual_numero: 1, etapa_atual_rotulo: '', total_etapas: 2, percentual: 10, estado: 'pausada', ativa_agora: false, ultima_noticia: '', ultima_noticia_em: new Date() }])
    await publicar(pedido([obra(), obra({ id: 'o2', ativa_agora: false })]))
    await publicar(pedido([obra({ percentual: 80 }), obra({ id: 'o3', ativa_agora: false })]))
    const ana = m.store.statusObras.filter((s) => s.licenca_id === 'l1')
    expect(ana.map((s) => s.obra_id).sort()).toEqual(['o1', 'o3'])
    expect(ana.find((s) => s.obra_id === 'o1')!.percentual).toBe(80)
    expect(m.store.statusObras.filter((s) => s.licenca_id === 'l2').map((s) => s.obra_id)).toEqual(['b1'])
    await publicar(pedido([]))
    expect(m.store.statusObras.filter((s) => s.licenca_id === 'l1')).toHaveLength(0)
  })
})

describe('/portal/obras — leitura escopada pelo dono', () => {
  it('sem login, token inválido ou sem compra: recusa', async () => {
    const { c } = await preparar()
    expect((await chamar(c, '/portal/obras', null)).status).toBe(401)
    expect((await chamar(c, '/portal/obras', 'lixo')).status).toBe(401)
    expect((await chamar(c, '/portal/obras', JWT_INTRUSO)).status).toBe(403)
  })
  it('cada dono vê SÓ as suas obras (anti-IDOR), mesmo mandando licenca_id/obra de outro no corpo', async () => {
    const { m, c, publicar, pedido } = await preparar()
    await publicar(pedido([obra({ id: 'ana-1', nome: 'Obra da Ana' })]))
    await m.store.substituirStatusObras('l2', [{ obra_id: 'beto-1', nome: 'Obra do Beto', segmento: null, etapa_atual_numero: 2, etapa_atual_rotulo: 'Meio', total_etapas: 4, percentual: 50, estado: 'pronta', ativa_agora: false, ultima_noticia: 'ok', ultima_noticia_em: new Date('2026-11-18T10:00:00Z') }])
    const ana = await (await chamar(c, '/portal/obras', JWT_ANA, { licenca_id: 'l2', obra_id: 'beto-1' })).json()
    expect(ana.obras.map((o: { id: string }) => o.id)).toEqual(['ana-1'])
    const beto = await (await chamar(c, '/portal/obras', JWT_BETO, { licenca_id: 'l1' })).json()
    expect(beto.obras).toEqual([{ id: 'beto-1', nome: 'Obra do Beto', etapa_atual: { numero: 2, rotulo: 'Meio' }, total_etapas: 4, percentual: 50, estado: 'pronta', ativa_agora: false, ultima_noticia: 'ok', quando: '2026-11-18T10:00:00.000Z' }])
    expect(JSON.stringify(beto)).not.toMatch(/licenca|l1|l2|hash/)
  })
  it('sem nada publicado: lista vazia', async () => {
    const { c } = await preparar()
    expect(await (await chamar(c, '/portal/obras', JWT_ANA)).json()).toEqual({ obras: [] })
  })
})

void H1
