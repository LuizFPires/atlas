import { criarTestarFixture, type AgenteNaCena, type PonteTestar } from './ponte-testar'
import { amostrarCena, LIMITE_RESUMO, lerResumoTeste, montarResumoTeste } from './teste-celular'

const grande = (): PonteTestar => {
  const f = criarTestarFixture()
  const agentes: AgenteNaCena[] = Array.from({ length: 1000 }, (_, i) => ({ id: `a${String(i).padStart(4, '0')}`, nome: 'Maria Aparecida', idade: 40, tracos: { Profissão: 'Mestre de obras', Cidade: 'Belo Horizonte', 'Uso de celular': 'Só WhatsApp', Jeito: 'Desconfiado' }, r: i % 2 ? 'usaria' : 'nao', fala: 'x'.repeat(140), mudou: i % 50 === 0 }))
  const eventos = Array.from({ length: 300 }, (_, i) => ({ rodada: 1, de: agentes[i * 3].id, para: agentes[i * 3 + 1].id, acao: 'comentar' as const, texto: 'y'.repeat(140), r: 'usaria' as const }))
  return { ...f, cena: async () => ({ agentes, eventos }) }
}

test('o resumo de 1.000 agentes cabe no limite do servidor e leva o relatório inteiro', async () => {
  const r = (await montarResumoTeste(grande(), 'p'))!
  expect(new TextEncoder().encode(JSON.stringify(r)).length).toBeLessThanOrEqual(LIMITE_RESUMO)
  expect(r.relatorios['1'].fortes.length).toBeGreaterThan(0)
  expect(r.relatorios['1'].fortes[0].ids).toEqual([])
  expect(r.cenas['1'].agentes.length).toBeGreaterThanOrEqual(10)
})

test('obra sem nenhum teste: nada para publicar', async () => {
  expect(await montarResumoTeste({ ...criarTestarFixture(), listar: async () => [] }, 'p')).toBeNull()
})

test('amostra da Praça: entrevistados e quem mudou de ideia vão primeiro; conversa só entre quem está na amostra', () => {
  const ag = (id: string, mudou = false): AgenteNaCena => ({ id, nome: id, idade: 30, tracos: { A: '1', B: '2', C: '3', D: '4' }, r: 'usaria', fala: null, mudou })
  const c = amostrarCena({ agentes: [ag('a1'), ag('a2'), ag('a3', true), ag('a4')], eventos: [{ rodada: 1, de: 'a3', para: 'a1', acao: 'comentar', texto: 'oi', r: 'usaria' }, { rodada: 1, de: 'a1', para: 'a4', acao: 'comentar', texto: 'oi', r: 'usaria' }] }, 2, new Set(['a4']))
  expect(c.agentes.map((a) => a.id)).toEqual(['a4', 'a3'])
  expect(Object.keys(c.agentes[0].tracos)).toEqual(['A', 'B', 'C'])
  expect(c.eventos).toEqual([{ rodada: 1, de: 'a3', para: null, acao: 'comentar', texto: 'oi', r: 'usaria' }])
})

test('o celular descarta o que não tem o formato esperado', () => {
  expect(lerResumoTeste(null)).toBeNull()
  expect(lerResumoTeste({ testes: [{ n: 'x' }] })).toBeNull()
  const r = lerResumoTeste({ testes: [{ n: 1, estado: 'pronto', quantidade: 500 }], relatorios: { 1: { geral: {} }, 2: 'lixo' }, cenas: { 1: { agentes: [{ id: 'a1', nome: 'A', tracos: {} }, { nome: 'sem id' }], eventos: 'x' } }, entrevistas: { 1: { a1: [{ de: 'voce', texto: 'oi' }, { de: 'hacker', texto: 'x' }] } } })!
  expect(r.relatorios).toEqual({})
  expect(r.cenas['1'].agentes.map((a) => a.id)).toEqual(['a1'])
  expect(r.cenas['1'].eventos).toEqual([])
  expect(r.entrevistas['1'].a1).toEqual([{ de: 'voce', texto: 'oi' }])
})
