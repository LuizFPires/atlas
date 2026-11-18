import { criarPainelFixture } from './ponte-painel'
import { criarCotaFixture } from './ponte-cota'
import { CLIQUES_PARA_RETOMAR, OBRA_PARADA_EXEMPLO, criarRetomarFixture, estaEmAndamento, quandoParou, religarLinha, retomarIndisponivel, saudacao } from './ponte-retomar'

test('obra em andamento: começou e ainda não chegou a 100%', () => {
  expect(estaEmAndamento(62)).toBe(true)
  expect(estaEmAndamento(0)).toBe(true)
  expect(estaEmAndamento(100)).toBe(false)
  expect(estaEmAndamento(Number.NaN)).toBe(false)
})

test('fixture: sem obra não há o que retomar; com obra pronta (100%) também não', async () => {
  expect(await criarRetomarFixture().obraEmAndamento()).toBeNull()
  expect(await criarRetomarFixture({ ...OBRA_PARADA_EXEMPLO, pct: 100 }).obraEmAndamento()).toBeNull()
  expect((await criarRetomarFixture(OBRA_PARADA_EXEMPLO).obraEmAndamento())?.nome).toContain('Barbearia')
})

test('produção sem adaptador não finge obra nem religa nada', async () => {
  expect(await retomarIndisponivel.obraEmAndamento()).toBeNull()
  await expect(retomarIndisponivel.continuar({ pasta: 'x' })).rejects.toThrow()
})

test('quando parou, no jeito de gente', () => {
  const agora = new Date(2026, 10, 18, 9, 0)
  expect(quandoParou(new Date(2026, 10, 17, 22, 14).toISOString(), agora)).toBe('ontem às 22h14')
  expect(quandoParou(new Date(2026, 10, 18, 7, 0).toISOString(), agora)).toBe('hoje às 7h')
  expect(quandoParou(new Date(2026, 10, 16, 22, 5).toISOString(), agora)).toBe('anteontem às 22h05')
  expect(quandoParou(new Date(2026, 10, 1, 22, 14).toISOString(), agora)).toBe('em 01/11 às 22h14')
  expect(quandoParou(null, agora)).toBeNull()
  expect(quandoParou('lixo', agora)).toBeNull()
})

test('saudação por hora e nome', () => {
  expect(saudacao(8, 'Zé')).toBe('BOM DIA, ZÉ')
  expect(saudacao(15, 'Zé')).toBe('BOA TARDE, ZÉ')
  expect(saudacao(22, '')).toBe('BOA NOITE')
})

test('religar a linha: tira a pausa do cliente e, se a cota já renovou, retoma pela cota', async () => {
  const painel = criarPainelFixture()
  const cota = criarCotaFixture((e) => painel.simular.pararPor(e ? 'cota' : null))
  await painel.pausar('p')
  cota.simular.esgotar(new Date())
  cota.simular.renovar()
  await religarLinha({ painel, cota }, 'p')
  expect(cota.chamadas).toContain('retomar')
  expect(painel.chamadas).toContain('continuar')
  expect((await painel.ler('p')).pausadaPorVoce).toBe(false)
})

test('religar não retoma a cota que ainda não renovou (o Claude precisa ter respondido)', async () => {
  const painel = criarPainelFixture()
  const cota = criarCotaFixture((e) => painel.simular.pararPor(e ? 'cota' : null))
  cota.simular.esgotar(new Date())
  await religarLinha({ painel, cota }, 'p')
  expect(cota.chamadas).not.toContain('retomar')
})

test('retomar custa 1 clique, dentro do limite de 2 do milestone', () => {
  expect(CLIQUES_PARA_RETOMAR).toBeLessThanOrEqual(2)
})
