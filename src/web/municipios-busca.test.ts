import { buscarMunicipios, carregarMunicipios, normalizar } from './municipios-busca'

test('a base do IBGE tem todos os municípios e a busca ignora acento e caixa', async () => {
  const base = await carregarMunicipios()
  expect(base.length).toBeGreaterThan(5500)
  expect(normalizar('São  Paulo')).toBe('sao paulo')
  expect(buscarMunicipios(base, 'sao paulo')[0]).toEqual({ nome: 'São Paulo', uf: 'SP' })
  expect(buscarMunicipios(base, 'SÃO PAULO')[0]).toEqual({ nome: 'São Paulo', uf: 'SP' })
  expect(buscarMunicipios(base, '')).toEqual([])
})

test('nome repetido em estados diferentes aparece uma vez por UF e dá para filtrar pela UF', async () => {
  const base = await carregarMunicipios()
  const ufs = buscarMunicipios(base, 'santa rita', 20).filter((m) => m.nome === 'Santa Rita').map((m) => m.uf)
  expect(ufs.length).toBeGreaterThan(1)
  expect(buscarMunicipios(base, 'Santa Rita – PB')).toEqual([{ nome: 'Santa Rita', uf: 'PB' }])
  expect(buscarMunicipios(base, 'santa rita pb')[0]).toEqual({ nome: 'Santa Rita', uf: 'PB' })
})
