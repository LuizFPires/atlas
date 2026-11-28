import { criarApiCelularFixture } from './api'
import { criarPonteTestarCelular, leitorComCache } from './ponte-testar-celular'

const montar = (opcoes: { ligado?: boolean } = {}, limites = {}) => {
  const api = criarApiCelularFixture(opcoes)
  const ponte = criarPonteTestarCelular(api, 'o1', { ler: () => api.estado(), esperaMs: 1, limiteEntrevistaMs: 200, limiteRevisaoMs: 200, ...limites })
  return { api, ponte }
}

test('lista o teste que o notebook publicou e abre o relatório', async () => {
  const { ponte } = montar()
  const t = await ponte.listar('o1')
  expect(t.map((x) => [x.n, x.estado])).toEqual([[1, 'pronto']])
  expect((await ponte.relatorio('o1', 1))?.fortes[0].tema).toBe('Bater ponto com foto e localização')
  expect((await ponte.cena('o1', 1)).agentes.length).toBeGreaterThan(0)
})

test('novo teste: deixa o pedido para o notebook; até ele começar, o celular já mostra o teste "começando"; não deixa pedir dois', async () => {
  const api = criarApiCelularFixture({ ligado: false })
  const ponte = criarPonteTestarCelular(api, 'o1', { ler: () => api.estado(), esperaMs: 1 })
  expect(await ponte.iniciar('o1', { quantidade: 250, mesmosDe: 1 })).toEqual({ n: 2 })
  expect(api.pedidos.at(-1)).toEqual({ tipo: 'testar', obra_id: 'o1', dados: { quantidade: 250, mesmos: true } })
  expect(await ponte.estado('o1', 2)).toEqual(expect.objectContaining({ n: 2, estado: 'rodando', etapa: 'entender', quantidade: 250 }))
  expect((await ponte.listar('o1')).map((t) => t.n)).toEqual([2, 1])
  await expect(ponte.iniciar('o1', { quantidade: 100 })).rejects.toThrow('teste-em-andamento')
})

test('entrevista: o notebook responde e a resposta do agente chega', async () => {
  const { api, ponte } = montar()
  const r = await ponte.entrevistar('o1', 1, 'a3', 'Por que você não usaria?')
  expect(r.resposta).toMatch(/sinal some/)
  expect(api.pedidos.at(-1)).toEqual({ tipo: 'entrevistar', obra_id: 'o1', dados: { teste: 1, agente: 'a3', pergunta: 'Por que você não usaria?' } })
  expect((await ponte.entrevistas('o1', 1)).a3.map((m) => m.de)).toEqual(['voce', 'agente'])
})

test('entrevista com erro: o código do notebook vira a mesma explicação do computador; sem código, "o notebook não conseguiu"', async () => {
  const { api, ponte } = montar()
  api.falharPedido('entrevistar', 'codigo:claude-cota')
  await expect(ponte.entrevistar('o1', 1, 'a3', 'oi')).rejects.toThrow('claude-cota')
  const b = montar()
  b.api.falharPedido('entrevistar', 'Não deu certo agora no notebook.')
  await expect(b.ponte.entrevistar('o1', 1, 'a3', 'oi')).rejects.toThrow('notebook-recusou')
})

test('notebook desligado: a entrevista desiste com "o notebook demorou" (o pedido fica na fila)', async () => {
  const { ponte } = montar({ ligado: false })
  await expect(ponte.entrevistar('o1', 1, 'a3', 'oi')).rejects.toThrow('notebook-demorou')
})

test('revisar o protótipo: manda as ideias como ajuste e devolve a versão nova', async () => {
  const { api, ponte } = montar()
  expect(await ponte.revisarPrototipo('- Bater ponto sem internet')).toBe(4)
  expect(api.pedidos.at(-1)).toEqual({ tipo: 'ajuste', obra_id: 'o1', dados: { texto: '- Bater ponto sem internet' } })
})

test('leitura com cache: várias partes da tela leem juntas, o servidor recebe uma só', async () => {
  const api = criarApiCelularFixture()
  const estado = vi.spyOn(api, 'estado')
  const ler = leitorComCache(api, 10_000)
  await Promise.all([ler(), ler(), ler()])
  expect(estado).toHaveBeenCalledTimes(1)
  await ler(true)
  expect(estado).toHaveBeenCalledTimes(2)
})
