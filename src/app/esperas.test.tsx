import { render, screen, within } from '@testing-library/react'
import { TemaProvider } from '../tema/tema'
import { Prototipo } from './Prototipo'
import { Aprovar } from './Aprovar'
import { Batismo } from './Batismo'
import { criarPrototipoFixture } from './ponte-prototipo'
import { ESTILOS_EXEMPLO } from './ponte-estilo'
import { criarConstrucaoFixture, criarModoObraFixture } from './ponte-construcao'
import { criarClaudeFixture } from './ponte-claude'
import { criarBatismoFixture, criarNomesFixture } from './ponte-batismo'
import { criarArquivosFixture } from './ponte-arquivos'

const obra = { nome: 'Colore', pasta: 'colore' }
const nunca = <T,>() => new Promise<T>(() => {})

test.each([
  ['telas', () => <Prototipo obra={obra} estilo={ESTILOS_EXEMPLO[0]} prototipo={{ ...criarPrototipoFixture(), desenhar: () => nunca() }} onVoltar={() => {}} onConcluir={() => {}} />, 'O Claude está desenhando as telas'],
  ['plano da obra', () => <Aprovar obra={obra} construcao={{ ...criarConstrucaoFixture(), planejar: () => nunca() }} claude={criarClaudeFixture({ conectado: true, plano: 'pro' })} modos={criarModoObraFixture()} onVoltar={() => {}} />, 'O Atlas está montando o plano da obra'],
  ['nomes', () => <Batismo obra={obra} batismo={{ ...criarBatismoFixture(), sugerir: () => nunca() }} nomes={criarNomesFixture()} arquivos={criarArquivosFixture()} onVoltar={() => {}} onConcluir={() => {}} />, 'O Claude está pensando nos nomes'],
])('espera de %s: barra que anda, etapas e tempo (nunca só uma frase parada)', async (_n, tela, titulo) => {
  render(<TemaProvider>{tela()}</TemaProvider>)
  const caixa = await screen.findByRole('status', { name: titulo })
  expect(within(caixa).getByRole('progressbar')).toBeInTheDocument()
  expect(within(caixa).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
})
