// @vitest-environment node
// Bug de 26/11/2026: o servidor novo (M65) lia politica_obras ao entregar o kit, mas a migration 0031 ainda não foi aplicada no
// banco. A leitura dava erro, o /entregar-kit respondia 500 e NENHUMA obra recebia o kit ("código: kit-indisponivel").
import { expect, it } from 'vitest'
import { semTabelaEhVazio, tabelaAusente } from '../functions/_shared/tabela-ausente.ts'

it('reconhece "tabela não existe" do PostgREST e do Postgres; o resto não', () => {
  expect(tabelaAusente({ code: 'PGRST205', message: "Could not find the table 'public.politica_obras' in the schema cache" })).toBe(true)
  expect(tabelaAusente({ code: '42P01', message: 'relation "politica_obras" does not exist' })).toBe(true)
  expect(tabelaAusente({ code: '42501', message: 'permission denied for table politica_obras' })).toBe(false)
  expect(tabelaAusente(null)).toBe(false)
})

it('tabela que ainda não existe = nenhuma linha (nenhuma obra embargada); outro erro continua estourando', async () => {
  expect(await semTabelaEhVazio(async () => { throw Object.assign(new Error('banco (listar): PGRST205 Could not find the table'), { causa: { code: 'PGRST205' } }) })).toEqual([])
  expect(await semTabelaEhVazio(async () => [{ obra_id: 'ponto' }])).toEqual([{ obra_id: 'ponto' }])
  await expect(semTabelaEhVazio(async () => { throw new Error('banco (listar): 57014 canceling statement due to statement timeout') })).rejects.toThrow(/57014/)
})
