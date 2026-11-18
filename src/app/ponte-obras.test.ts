import { criarObrasFixture, nomeParaPasta, obrasIndisponivel, pastaLivre, raizDasObras } from './ponte-obras'

test('a pasta das obras fica em Atlas\\Obras do usuário, nunca em Desktop ou Documentos', () => {
  const raiz = raizDasObras('Zé')
  expect(raiz).toBe('C:\\Users\\Zé\\Atlas\\Obras')
  expect(raiz).not.toMatch(/Desktop|Documentos|Documents|OneDrive/i)
})

test('nome de obra vira nome de pasta seguro', () => {
  expect(nomeParaPasta('Agenda da Barbearia do Zé')).toBe('agenda-da-barbearia-do-ze')
  expect(nomeParaPasta('../../Windows\\System32')).toBe('windows-system32')
  expect(nomeParaPasta('   ')).toBe('obra')
  expect(nomeParaPasta('CON')).toBe('con-obra')
  expect(nomeParaPasta('a'.repeat(200)).length).toBeLessThanOrEqual(60)
  expect(nomeParaPasta('Caixa/do:dia?*')).not.toMatch(/[\\/:*?"<>|.]/)
})

test('nunca sobrescreve: nome repetido ganha número', () => {
  expect(pastaLivre('Agenda', ['agenda'])).toBe('agenda-2')
  expect(pastaLivre('Agenda', ['agenda', 'agenda-2'])).toBe('agenda-3')
  expect(pastaLivre('Agenda', ['AGENDA'])).toBe('agenda-2')
})

test('o mock cria a subpasta só na memória e lista', async () => {
  const o = criarObrasFixture('Zé')
  const a = await o.criarSubpasta('Agenda online')
  const b = await o.criarSubpasta('Agenda online')
  expect(a).toEqual({ pasta: 'agenda-online', caminho: 'C:\\Users\\Zé\\Atlas\\Obras\\agenda-online' })
  expect(b.pasta).toBe('agenda-online-2')
  expect(await o.listar()).toEqual(['agenda-online', 'agenda-online-2'])
})

test('sem adaptador real, não finge que criou a pasta', async () => {
  await expect(obrasIndisponivel.criarSubpasta('x')).rejects.toThrow()
  await expect(obrasIndisponivel.abrirPasta()).rejects.toThrow()
})
