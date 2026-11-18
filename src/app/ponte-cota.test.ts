import { criarCotaFixture, cotaIndisponivel } from './ponte-cota'
import { criarPainelFixture } from './ponte-painel'

test('o mock da cota liga e desliga a parada "cota" do painel; retomar volta a obra e avisa o celular, sem ação do cliente', async () => {
  const painel = criarPainelFixture()
  const cota = criarCotaFixture((esgotada) => painel.simular.pararPor(esgotada ? 'cota' : null))
  cota.simular.esgotar(new Date(2026, 10, 18, 14))
  expect((await painel.ler('x')).parada).toBe('cota')
  const antes = await cota.ler('x')
  expect(antes.esgotada).toBe(true)
  expect(antes.renovada).toBe(false)
  cota.simular.renovar()
  await cota.retomar('x')
  expect((await painel.ler('x')).parada).toBeNull()
  expect((await cota.ler('x')).esgotada).toBe(false)
  expect(cota.avisos).toHaveLength(1)
  await cota.retomar('x')
  expect(cota.avisos).toHaveLength(1)
})

test('sem adaptador (produção) não finge que sabe da cota', async () => {
  await expect(cotaIndisponivel.ler('x')).rejects.toThrow('indisponivel')
  await expect(cotaIndisponivel.retomar('x')).rejects.toThrow('indisponivel')
})
