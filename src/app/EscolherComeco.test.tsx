// M51 (Q1Escolher, aprovado pelo Luiz em 25/11/2026): outra obra já está trabalhando; o cliente escolhe como começar.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Aprovar } from './Aprovar'
import { EscolherComeco } from './EscolherComeco'
import { criarConstrucaoFixture, criarModoObraFixture } from './ponte-construcao'
import { criarClaudeFixture } from './ponte-claude'
import { estimarCaminhos, quando, recomendado } from './fila-obras'

const obra = { nome: 'Estoque da Loja', pasta: 'estoque' }
const agora = () => new Date(2026, 10, 25, 9, 0) // quarta, 9h

test('as contas de cada caminho: fila não mexe na primeira; juntas no Pro atrasa a primeira e quase não adianta a nova', () => {
  const pro = estimarCaminhos(10, 40, 'pro')
  expect(pro.fila).toEqual({ atual: 10, nova: 50 })
  expect(pro.juntas).toEqual({ atual: 20, nova: 50 })
  expect(pro.primeiro).toEqual({ nova: 40, atual: 50 })
  const max = estimarCaminhos(10, 40, 'max')
  expect(max.juntas.nova).toBeLessThan(max.fila.nova)
  expect(recomendado('pro')).toBe('fila')
  expect(recomendado('max')).toBe('juntas')
  expect(quando(agora(), 9)).toBe('hoje, ~18h')
  expect(quando(agora(), 24)).toBe('amanhã, ~9h')
})

test('a janela mostra as 3 escolhas com o que muda, a fila recomendada no Pro e ao mesmo tempo no Max', async () => {
  const onEscolher = vi.fn()
  const user = userEvent.setup()
  const { rerender } = render(<TemaProvider><EscolherComeco nova="Estoque da Loja" atual={{ nome: 'Meu Ponto', restanteMin: 9 * 60 }} novaH={48} plano="pro" agora={agora} onEscolher={onEscolher} onCancelar={() => {}} /></TemaProvider>)
  const dialogo = screen.getByRole('dialog', { name: 'Como começar esta obra' })
  const opcoes = within(dialogo).getAllByRole('radio')
  expect(opcoes).toHaveLength(3)
  expect(opcoes[0]).toHaveAttribute('aria-checked', 'true')
  expect(opcoes[0]).toHaveTextContent('RECOMENDADO')
  expect(opcoes[0]).toHaveTextContent('Pronta hoje, ~18h (como previsto)')
  expect(opcoes[1]).toHaveTextContent('Acaba umas 2× mais rápido')
  expect(dialogo).not.toHaveTextContent(/token/i)
  await user.click(opcoes[1])
  await user.click(within(dialogo).getByRole('button', { name: 'Começar ao mesmo tempo →' }))
  expect(onEscolher).toHaveBeenCalledWith('juntas')
  rerender(<TemaProvider><EscolherComeco nova="Estoque da Loja" atual={{ nome: 'Meu Ponto', restanteMin: null }} novaH={null} plano="max" agora={agora} onEscolher={onEscolher} onCancelar={() => {}} /></TemaProvider>)
  expect(screen.getAllByRole('radio')[1]).toHaveTextContent('RECOMENDADO')
})

test('Começar a obra com outra trabalhando: abre a escolha e, na fila, a obra espera a vez', async () => {
  const construcao = criarConstrucaoFixture(criarModoObraFixture(), undefined, [{ pasta: 'ponto', nome: 'Meu Ponto', restanteMin: 600 }])
  const user = userEvent.setup()
  render(<TemaProvider><Aprovar obra={obra} construcao={construcao} claude={criarClaudeFixture({ conectado: true, plano: 'pro' })} modos={criarModoObraFixture()} onVoltar={() => {}} /></TemaProvider>)
  await user.click(await screen.findByRole('button', { name: 'Começar a obra' }))
  const dialogo = await screen.findByRole('dialog', { name: 'Como começar esta obra' })
  expect(dialogo).toHaveTextContent('O ATLAS JÁ ESTÁ TRABALHANDO NA OBRA MEU PONTO')
  await user.click(within(dialogo).getByRole('button', { name: 'Colocar na fila →' }))
  expect(construcao.iniciadas[0].como).toBe('fila')
  expect(construcao.naFila).toEqual([{ pasta: 'estoque', depoisDe: 'ponto' }])
  expect(screen.queryByRole('dialog', { name: 'Como começar esta obra' })).toBeNull()
})

test('no painel, a obra da fila diz que espera a vez e não pede nada', async () => {
  const { momentoDaObra } = await import('./momento-obra')
  const base = { pct: 0, tarefas: 3, feitas: 0, etapa: null, etapas: [], restante: null, previsao: null, agora: [], pausadaPorVoce: false, parada: null, etapaPronta: null, temTeste: false }
  const m = momentoDaObra({ ...base, naFila: { depoisDe: 'meu-ponto', nome: 'Meu ponto' } }, 'andando')
  expect(m.selo).toBe('Na fila')
  expect(m.titulo).toBe('Na fila: começa sozinha quando a obra Meu ponto ficar pronta.')
  expect(m.acoes).toEqual(['diario'])
})
