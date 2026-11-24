import { fichaDaTrava, quandoLibera } from './travas'

const agora = new Date(2026, 10, 24, 10, 0) // 24/11/2026 10h (hora local)

test('quando libera: hoje, amanhã ou o dia', () => {
  expect(quandoLibera(new Date(2026, 10, 24, 15, 0).toISOString(), agora)).toBe('hoje às 15h')
  expect(quandoLibera(new Date(2026, 10, 25, 9, 30).toISOString(), agora)).toBe('amanhã às 9h30')
  expect(quandoLibera(new Date(2026, 11, 1, 0, 0).toISOString(), agora)).toBe('dia 1º')
  expect(quandoLibera(new Date(2026, 11, 12, 0, 0).toISOString(), agora)).toBe('dia 12')
  expect(quandoLibera(null, agora)).toBeNull()
})

test('GitHub sem minutos: segue sozinho, conferir aqui é o recomendado e já está ativo; público pede confirmação', () => {
  const f = fichaDaTrava({ id: 1, tipo: 'github-minutos', servico: 'GitHub', liberaEm: new Date(2026, 11, 1).toISOString() }, agora)
  expect(f.precisaDeVoce).toBe(false)
  expect(f.selo).toBe('SEGUINDO SEM O GITHUB')
  expect(f.volta).toBe('GITHUB VOLTA DIA 1º · SOZINHO')
  expect(f.blocos.map((b) => b.rotulo)).toEqual(['O QUE ACONTECEU', 'PASSA SOZINHO?', 'O QUE O ATLAS FAZ'])
  expect(f.opcoes[0]).toMatchObject({ recomendado: true, acao: 'feito' })
  expect(f.opcoes.find((o) => o.acao === 'publico')?.atencao).toBe(true)
})

test('Vercel no limite: publica sozinha na hora marcada', () => {
  const f = fichaDaTrava({ id: 2, tipo: 'vercel-limite', servico: 'Vercel', liberaEm: new Date(2026, 10, 25, 9).toISOString() }, agora)
  expect(f.precisaDeVoce).toBe(false)
  expect(f.volta).toBe('PUBLICA AMANHÃ ÀS 9H · SOZINHO')
  expect(f.titulo).toMatch(/Amanhã às 9h publica sozinha/)
})

test('Supabase dormindo e conta desligada precisam de você, com o botão certo', () => {
  const s = fichaDaTrava({ id: 3, tipo: 'supabase-dormindo', servico: 'Supabase', liberaEm: null }, agora)
  expect(s.precisaDeVoce).toBe(true)
  expect(s.opcoes[0]).toMatchObject({ recomendado: true, acao: 'site' })
  expect(s.guia?.en).toBe('Restore project')
  const c = fichaDaTrava({ id: 4, tipo: 'conta-desligada', servico: 'Vercel', liberaEm: null }, agora)
  expect(c.precisaDeVoce).toBe(true)
  expect(c.titulo).toMatch(/Vercel/)
  expect(c.opcoes[0]).toMatchObject({ acao: 'ligar' })
})
