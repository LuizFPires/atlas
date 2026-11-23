// M33 — chamadas do notebook ao servidor do Atlas para o celular (sempre com a credencial da ativação no cabeçalho).
import { criarCanalRemotoApi } from './celular-canal'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria } from './ponte'

const API = 'https://api.test/functions/v1/api'
function montar(resp: (rota: string, corpo: Record<string, unknown>) => { status: number; corpo: unknown }) {
  const chamadas: Array<{ rota: string; corpo: Record<string, unknown>; disp: string | null }> = []
  const f = (async (url: string, init: RequestInit) => {
    const rota = String(url).slice(API.length)
    const corpo = JSON.parse(String(init.body))
    chamadas.push({ rota, corpo, disp: new Headers(init.headers).get('X-Atlas-Dispositivo') })
    const r = resp(rota, corpo)
    return new Response(JSON.stringify(r.corpo), { status: r.status })
  }) as typeof fetch
  const cofre = criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 'TOK', email: 'ana@loja.com', nome: 'Ana' }) })
  const canal = criarCanalRemotoApi({ cofre, hashComputador: async () => 'a'.repeat(64) }, API, f)
  return { canal, chamadas }
}

test('sinal manda e-mail, computador e o que está fazendo; o token vai só no cabeçalho', async () => {
  const { canal, chamadas } = montar(() => ({ status: 200, corpo: { pedidos: [{ id: 'a'.repeat(32), tipo: 'pausar', obra_id: 'c1', dados: {}, criado_em: '2026-11-23T10:00:00Z' }] } }))
  const pedidos = await canal.sinal('Desenhando as telas')
  expect(pedidos).toHaveLength(1)
  expect(chamadas[0]).toEqual({ rota: '/celular/sinal', corpo: { email: 'ana@loja.com', computador_hash: 'a'.repeat(64), ocupado: 'Desenhando as telas' }, disp: 'TOK' })
})

test('pedido com formato estranho é descartado (nunca executa algo que não entende)', async () => {
  const { canal } = montar(() => ({ status: 200, corpo: { pedidos: [{ id: 'x', tipo: 'apagar', obra_id: 'c1', dados: {} }, { id: 'b'.repeat(32), tipo: 'ajuste', obra_id: 'c1', dados: { texto: 'maior' }, criado_em: 'x' }] } }))
  expect((await canal.sinal(null)).map((p) => p.tipo)).toEqual(['ajuste'])
})

test('servidor recusou ou caiu: sinal devolve lista vazia; as outras chamadas lançam erro', async () => {
  const { canal } = montar(() => ({ status: 403, corpo: { erro: 'nao_autorizado' } }))
  expect(await canal.sinal(null)).toEqual([])
  await expect(canal.responder('a'.repeat(32), 'feito', '')).rejects.toThrow()
})

test('projeto e referência usam as rotas certas', async () => {
  const { canal, chamadas } = montar((rota) => ({ status: 200, corpo: rota === '/celular/referencia' ? { imagem: 'data:image/jpeg;base64,AAAA' } : { ok: true } }))
  await canal.projeto('c1', { nome: 'B', fase: 'desenhando', progresso: { feitas: 0, total: 0, atual: '', telas: [] }, nomes: [], mensagem: '' }, '<!doctype html>')
  expect(await canal.referencia('c'.repeat(32))).toBe('data:image/jpeg;base64,AAAA')
  expect(chamadas.map((c) => c.rota)).toEqual(['/celular/projeto', '/celular/referencia'])
  expect(chamadas[0].corpo).toMatchObject({ obra_id: 'c1', documento: '<!doctype html>', projeto: { fase: 'desenhando' } })
})
