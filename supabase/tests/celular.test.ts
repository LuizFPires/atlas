// @vitest-environment node
// M33 — canal celular ↔ computador: o celular deixa pedidos, o notebook do cliente busca, executa e publica o resultado.
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { criarCanalCelularMemoria } from '../functions/_shared/memoria.ts'
import type { ArmazemPrototipos } from '../functions/_shared/prototipo-link.ts'
import { TOKEN } from './helpers.ts'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO } from './helpers-portal.ts'

const DOC = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><section id="tela-inicio">oi</section>'
const PNG = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff\xe0' + 'x'.repeat(200))

async function preparar() {
  const m = await comDoisClientes()
  const canal = criarCanalCelularMemoria()
  const guardados = new Map<string, unknown>()
  const prototipos: ArmazemPrototipos = { guardar: async (t, v) => { guardados.set(t, v) }, ler: async (t) => (guardados.get(t) as never) ?? null }
  const c = m.ctx({ celular: canal, prototipos })
  const pc = (rota: string, corpo: object = {}, h: Record<string, string> = { 'X-Atlas-Dispositivo': TOKEN }) =>
    tratar(c, new Request(`https://x.test/functions/v1/api${rota}`, { method: 'POST', headers: h, body: JSON.stringify({ email: 'ana@loja.com', computador_hash: 'a'.repeat(64), ...corpo }) }))
  const cel = (rota: string, corpo: object = {}, jwt = JWT_ANA) => chamar(c, rota, jwt, corpo)
  const relato = 'Tenho uma barbearia com 3 cadeiras e a agenda vive dando horário duplicado.'
  const obraNova = (extra: object = {}) => ({ tipo: 'obra_nova', dados: { relato, visual: { modo: 'sugere', observacao: '', cores: ['#10233B', '#E8C27A'], referencias: [] }, ...extra } })
  return { m, c, canal, guardados, pc, cel, obraNova }
}

describe('celular → pedidos', () => {
  it('obra nova: o servidor cria o id da obra, guarda o pedido e o notebook recebe na próxima batida', async () => {
    const { pc, cel, obraNova } = await preparar()
    const r = await cel('/portal/celular/pedido', obraNova())
    expect(r.status).toBe(200)
    const { id, obra_id } = await r.json()
    expect(obra_id).toMatch(/^c[0-9a-f]{16}$/)
    const s = await (await pc('/celular/sinal', { ocupado: null })).json()
    expect(s.pedidos).toEqual([expect.objectContaining({ id, tipo: 'obra_nova', obra_id, dados: expect.objectContaining({ relato: expect.stringContaining('barbearia') }) })])
    // Entregue: não vem de novo na batida seguinte.
    expect((await (await pc('/celular/sinal')).json()).pedidos).toEqual([])
  })
  it('sem login, licença de outro ou tipo/dados inválidos: recusa e nada entra na fila', async () => {
    const { canal, cel, obraNova } = await preparar()
    expect((await cel('/portal/celular/pedido', obraNova(), '')).status).toBe(401)
    for (const ruim of [
      { tipo: 'apagar_tudo', dados: {} },
      obraNova({ relato: 'curto' }),
      obraNova({ relato: 'x'.repeat(20_001) }),
      obraNova({ visual: { modo: 'sugere', cores: ['vermelho'], referencias: [] } }),
      obraNova({ visual: { modo: 'qualquer', cores: [], referencias: [] } }),
      { tipo: 'ajuste', obra_id: '../x', dados: { texto: 'maior' } },
      { tipo: 'ajuste', obra_id: 'c0123456789abcdef', dados: { texto: '' } },
      { tipo: 'construir', obra_id: 'c0123456789abcdef', dados: { modo: 'turbo' } },
    ]) expect((await cel('/portal/celular/pedido', ruim)).status).toBe(400)
    expect(canal.pedidos).toHaveLength(0)
  })
  it('um dono não vê nem recebe os pedidos do outro', async () => {
    const { m, c, pc, cel, obraNova } = await preparar()
    await cel('/portal/celular/pedido', obraNova(), JWT_BETO)
    expect((await (await pc('/celular/sinal')).json()).pedidos).toEqual([])
    const estadoAna = await (await cel('/portal/celular')).json()
    expect(estadoAna.pedidos).toEqual([])
    void m; void c
  })
  it('cortesia vencida não pede nada', async () => {
    const { m, cel, obraNova } = await preparar()
    Object.assign(m.store.licencas[0], { tipo: 'cortesia', validade_em: new Date(m.deps.agora().getTime() - 1000) })
    const r = await cel('/portal/celular/pedido', obraNova())
    expect(r.status).toBe(403)
    expect((await r.json()).erro).toBe('licenca_inativa')
  })
  it('limita a fila: no máximo 20 pedidos esperando', async () => {
    const { cel } = await preparar()
    let ultimo = 200
    for (let i = 0; i < 21; i++) ultimo = (await cel('/portal/celular/pedido', { tipo: 'ajuste', obra_id: 'c0123456789abcdef', dados: { texto: `ajuste ${i}` } })).status
    expect(ultimo).toBe(429)
  })
  it('pedido entregue e sem resposta há mais de 10 minutos volta a ser entregue (o notebook pode ter desligado no meio)', async () => {
    const { m, pc, cel } = await preparar()
    await cel('/portal/celular/pedido', { tipo: 'pausar', obra_id: 'c0123456789abcdef', dados: {} })
    expect((await (await pc('/celular/sinal')).json()).pedidos).toHaveLength(1)
    m.avancar(11 * 60_000)
    expect((await (await pc('/celular/sinal')).json()).pedidos).toHaveLength(1)
  })
})

describe('notebook → sinal, resposta e projeto', () => {
  it('sinal: só o computador ativado com o token certo; o celular vê "ligado" por 90 segundos', async () => {
    const { m, pc, cel } = await preparar()
    expect((await pc('/celular/sinal', {}, { 'X-Atlas-Dispositivo': 'errado' })).status).toBe(403)
    expect((await (await cel('/portal/celular')).json()).computador).toEqual({ ligado: false, visto_em: null, ocupado: null })
    await pc('/celular/sinal', { ocupado: 'Desenhando as telas' })
    expect((await (await cel('/portal/celular')).json()).computador).toMatchObject({ ligado: true, ocupado: 'Desenhando as telas' })
    m.avancar(91_000)
    expect((await (await cel('/portal/celular')).json()).computador).toMatchObject({ ligado: false, visto_em: expect.any(String) })
  })
  it('resposta marca o pedido como feito ou com erro, e o celular vê', async () => {
    const { pc, cel } = await preparar()
    const { id } = await (await cel('/portal/celular/pedido', { tipo: 'pausar', obra_id: 'c0123456789abcdef', dados: {} })).json()
    await pc('/celular/sinal')
    expect((await pc('/celular/resposta', { pedido_id: id, estado: 'erro', mensagem: 'A obra não existe mais neste notebook.' })).status).toBe(200)
    const e = await (await cel('/portal/celular')).json()
    expect(e.pedidos[0]).toMatchObject({ id, estado: 'erro', mensagem: 'A obra não existe mais neste notebook.' })
    expect((await pc('/celular/resposta', { pedido_id: id, estado: 'explodiu' })).status).toBe(400)
  })
  it('projeto: o notebook publica a fase, o progresso, os nomes e as telas; o celular lê com o token das telas', async () => {
    const { pc, cel, guardados } = await preparar()
    const r = await pc('/celular/projeto', {
      obra_id: 'c0123456789abcdef', documento: DOC,
      projeto: { nome: 'Barbearia', fase: 'telas_prontas', progresso: { feitas: 2, total: 2, atual: '', telas: [{ nome: 'Início', pronta: true }, { nome: 'Agenda', pronta: true }] }, nomes: [{ nome: 'Navalha', porque: 'Curto e forte.' }], mensagem: '' },
    })
    expect(r.status).toBe(200)
    const e = await (await cel('/portal/celular')).json()
    expect(e.projetos).toEqual([expect.objectContaining({ obra_id: 'c0123456789abcdef', fase: 'telas_prontas', telas_token: expect.stringMatching(/^[A-Za-z0-9_-]{40,64}$/), nomes: [{ nome: 'Navalha', porque: 'Curto e forte.' }] })])
    expect(guardados.size).toBe(1)
    // As telas abrem pelo mesmo /prototipo/ver do link do celular.
    const ver = await (await cel('/prototipo/ver', { token: e.projetos[0].telas_token })).json()
    expect(ver.documento).toBe(DOC)
  })
  it('projeto: fase inválida, telas sem a proteção ou lixo no texto são recusados ou limpos', async () => {
    const { pc } = await preparar()
    const base = { nome: 'B', fase: 'desenhando', progresso: { feitas: 0, total: 3, atual: 'Início', telas: [] }, nomes: [], mensagem: '' }
    expect((await pc('/celular/projeto', { obra_id: 'c0123456789abcdef', projeto: { ...base, fase: 'voando' } })).status).toBe(400)
    expect((await pc('/celular/projeto', { obra_id: 'c0123456789abcdef', projeto: base, documento: '<html><script>x</script>' })).status).toBe(400)
    expect((await pc('/celular/projeto', { obra_id: 'c0123456789abcdef', projeto: { ...base, progresso: { ...base.progresso, total: 41 } } })).status).toBe(400)
  })
})

describe('fotos de referência', () => {
  it('o celular manda, o notebook baixa uma vez e a foto some do servidor', async () => {
    const { canal, pc, cel } = await preparar()
    const r = await cel('/portal/celular/referencia', { imagem: PNG })
    expect(r.status).toBe(200)
    const { id } = await r.json()
    const b = await (await pc('/celular/referencia', { id })).json()
    expect(b.imagem).toBe(PNG)
    expect(canal.referencias.size).toBe(0)
    expect((await pc('/celular/referencia', { id })).status).toBe(404)
  })
  it('recusa o que não é imagem, imagem grande demais e mais de 6 guardadas', async () => {
    const { cel } = await preparar()
    expect((await cel('/portal/celular/referencia', { imagem: 'data:text/html;base64,PGh0bWw+' })).status).toBe(400)
    expect((await cel('/portal/celular/referencia', { imagem: 'data:image/jpeg;base64,' + 'A'.repeat(2_900_000) })).status).toBe(400)
    let ultimo = 200
    for (let i = 0; i < 7; i++) ultimo = (await cel('/portal/celular/referencia', { imagem: PNG })).status
    expect(ultimo).toBe(429)
  })
  it('a foto de um dono não é baixada pelo computador de outro', async () => {
    const { pc, cel } = await preparar()
    const { id } = await (await cel('/portal/celular/referencia', { imagem: PNG }, JWT_BETO)).json()
    expect((await pc('/celular/referencia', { id })).status).toBe(404)
  })
  it('o pedido de obra nova só aceita referências do próprio dono', async () => {
    const { cel, obraNova } = await preparar()
    const { id } = await (await cel('/portal/celular/referencia', { imagem: PNG }, JWT_BETO)).json()
    const r = await cel('/portal/celular/pedido', obraNova({ visual: { modo: 'prints', observacao: 'gostei', cores: [], referencias: [id] } }))
    expect(r.status).toBe(400)
  })
})
