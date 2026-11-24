import { momentoDaObra } from './momento-obra'
import type { EstadoObra } from './ponte-painel'

// M41 (protótipo O1–O4 aprovado pelo Luiz em 24/11/2026): a obra nunca fica no escuro. Em qualquer situação há um selo (4 estados),
// uma frase do que está acontecendo e pelo menos uma ação.
const AGORA = new Date('2026-11-24T15:00:00.000Z')
const base: EstadoObra = {
  pct: 64.37, tarefas: 20, feitas: 12, etapa: { n: 4, nome: 'Relatórios' }, etapas: [], restante: null, previsao: null,
  agora: [{ sigla: 'IM', quem: 'Equipe de execução', oque: 'Escrevendo o código', tom: 'ativo' }],
  pausadaPorVoce: false, parada: null, etapaPronta: null, temTeste: true, vigia: null, sinal: '2026-11-24T14:59:48.000Z',
}

test('trabalhando: o que está fazendo agora e o último sinal medido pelo Atlas', () => {
  const m = momentoDaObra(base, 'andando', AGORA)
  expect(m.nivel).toBe('trabalhando')
  expect(m.selo).toBe('Trabalhando')
  expect(m.titulo).toBe('Escrevendo o código')
  expect(m.sinal).toBe('Último sinal há 12 s')
  expect(m.acoes).toContain('diario')
})

test('esperando a cota: hora de volta, quanto falta e os planos do Claude como opção', () => {
  const m = momentoDaObra({ ...base, agora: [], parada: 'cota', voltaEm: '2026-11-24T18:12:00.000Z' }, 'cota', AGORA)
  expect(m.nivel).toBe('esperando')
  expect(m.selo).toBe('Esperando')
  expect(m.rotulo).toBe('PAROU · NÃO É ERRO')
  expect(m.titulo).toMatch(/^A cota do seu plano do Claude acabou\. A obra volta sozinha às \d\d:\d\d\.$/)
  expect(m.texto).toMatch(/Faltam 3 h 12 min/)
  expect(m.acoes).toEqual(['planos', 'esperar'])
})

test('esperando a cota sem a hora de volta: diz que volta sozinha quando renovar', () => {
  const m = momentoDaObra({ ...base, agora: [], parada: 'cota' }, 'cota', AGORA)
  expect(m.titulo).toBe('A cota do seu plano do Claude acabou. A obra volta sozinha quando a cota renovar.')
})

test('vigia tentando: esperando, com a hora da próxima tentativa e "Tentar agora"', () => {
  const m = momentoDaObra({ ...base, agora: [], vigia: { situacao: 'tentando', tentativa: 0, de: 3, motivo: 'A linha parou.', proximaEm: '2026-11-24T15:02:00.000Z' } }, 'andando', AGORA)
  expect(m.nivel).toBe('esperando')
  expect(m.titulo).toBe('A obra parou sozinha. O Atlas já está cuidando disso.')
  expect(m.texto).toMatch(/tentativa 1 de 3/)
  expect(m.acoes[0]).toBe('tentar')
})

test('pedido da linha à pessoa: precisa de você, com a fala e a conta certa', () => {
  const m = momentoDaObra({ ...base, agora: [], vigia: { situacao: 'precisa-voce', tentativa: 0, de: 3, motivo: 'A obra está esperando uma coisa que só você pode fazer.', fala: 'Ligue o Supabase.', conta: 'Supabase' } }, 'andando', AGORA)
  expect(m.nivel).toBe('precisa')
  expect(m.selo).toBe('Precisa de você')
  expect(m.fala).toBe('Ligue o Supabase.')
  expect(m.acoes).toEqual(['contas', 'ajuda'])
})

test('desistiu depois das tentativas: com defeito (nunca culpa o cliente) e a Ajuda primeiro', () => {
  const m = momentoDaObra({ ...base, agora: [], vigia: { situacao: 'precisa-voce', tentativa: 3, de: 3, motivo: 'A linha parou com um erro.' } }, 'andando', AGORA)
  expect(m.nivel).toBe('defeito')
  expect(m.selo).toBe('Com defeito')
  expect(m.rotulo).toBe('O ATLAS TENTOU 3 VEZES')
  expect(m.titulo).toBe('A obra parou. O Atlas não conseguiu continuar sozinho.')
  expect(m.acoes).toEqual(['ajuda', 'tentar', 'diario'])
})

test('etapa pronta no passo a passo: precisa de você (o OK)', () => {
  const m = momentoDaObra({ ...base, agora: [], etapaPronta: { n: 4, nome: 'Relatórios' } }, 'espera-ok', AGORA)
  expect(m.nivel).toBe('precisa')
  expect(m.acoes).toEqual(['teste', 'ok'])
})

test('ninguém trabalhando sem motivo conhecido: nunca em silêncio, sempre com "Tentar agora"', () => {
  const m = momentoDaObra({ ...base, agora: [], sinal: null }, 'andando', AGORA)
  expect(m.nivel).toBe('esperando')
  expect(m.titulo).toBe('Ninguém trabalhando agora.')
  expect(m.acoes[0]).toBe('tentar')
})

test('pausada por você e obra pronta', () => {
  expect(momentoDaObra({ ...base, agora: [], pausadaPorVoce: true }, 'pausada', AGORA)).toMatchObject({ nivel: 'pausada', selo: 'Pausada por você', acoes: ['continuar'] })
  expect(momentoDaObra({ ...base, pct: 100, agora: [] }, 'concluida', AGORA)).toMatchObject({ nivel: 'pronta', selo: 'Obra concluída' })
})

test('com defeito: as 10 conferências do diagnóstico vão para a faixa', () => {
  const checagens = [{ nome: 'Internet', ok: true }, { nome: 'Trabalho da etapa', ok: false, dica: 'O teste falhou.' }]
  const m = momentoDaObra({ ...base, agora: [], vigia: { situacao: 'precisa-voce', tentativa: 3, de: 3, motivo: 'Erro.', checagens } }, 'andando', AGORA)
  expect(m.checagens).toEqual(checagens)
})
