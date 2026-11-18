import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { NovaObra } from './NovaObra'
import { PERGUNTAS } from './obras-dados'
import { criarObrasFixture, type ObrasFixture, type PonteObras } from './ponte-obras'

const montar = (o: PonteObras = criarObrasFixture(), p: Partial<React.ComponentProps<typeof NovaObra>> = {}) => {
  const onConcluir = vi.fn()
  const onVoltar = vi.fn()
  render(<TemaProvider><NovaObra obras={o} onVoltar={onVoltar} onConcluir={onConcluir} {...p} /></TemaProvider>)
  return { o, onConcluir, onVoltar }
}
const clicar = (n: string | RegExp) => userEvent.click(screen.getByRole('button', { name: n }))

test('uma pergunta por vez, com microfone em cada uma', async () => {
  montar(criarObrasFixture(), { ideia: 'Agenda online' })
  for (let i = 0; i < PERGUNTAS.length; i++) {
    expect(screen.getByText(`NOVA OBRA · PERGUNTA ${i + 1} DE 5`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: PERGUNTAS[i].titulo })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Falar' })).toBeInTheDocument()
    if (i < PERGUNTAS.length - 1) await clicar('Próxima pergunta')
  }
})

test('transcrição editável: o texto aparece num campo que dá para corrigir; "digitar em vez de falar" abre o campo', async () => {
  montar(criarObrasFixture(), { ideia: 'Agenda online' })
  const campo = screen.getByLabelText(/O Atlas escreveu assim/)
  await userEvent.clear(campo)
  await userEvent.type(campo, 'Agenda do Zé')
  expect(screen.getByText('Agenda do Zé', { selector: 'b' })).toBeInTheDocument()
  await clicar('Próxima pergunta')
  expect(screen.queryByRole('textbox')).toBeNull()
  await clicar('Digitar em vez de falar')
  expect(screen.getByRole('textbox')).toBeInTheDocument()
})

test('sem nome não avança, com recado amigo', async () => {
  montar()
  await clicar('Próxima pergunta')
  expect(screen.getByRole('alert')).toHaveTextContent(/Dê um nome/)
  expect(screen.getByText('NOVA OBRA · PERGUNTA 1 DE 5')).toBeInTheDocument()
})

test('quem usa: toque em vários e o painel mostra o que o Atlas entendeu', async () => {
  montar(criarObrasFixture(), { ideia: 'Agenda' })
  await clicar('Próxima pergunta'); await clicar('Próxima pergunta')
  await clicar(/Os barbeiros/)
  await clicar(/Eu, o dono/)
  expect(screen.getByLabelText('O que o Atlas já entendeu')).toHaveTextContent('Os barbeiros')
  expect(screen.getByLabelText('O que o Atlas já entendeu')).not.toHaveTextContent('Eu, o dono')
})

test('ao terminar, cria a subpasta da obra em Atlas/Obras e mostra onde ficou', async () => {
  const o: ObrasFixture = criarObrasFixture('Zé')
  const { onConcluir } = montar(o, { ideia: 'Agenda da Barbearia do Zé' })
  for (let i = 0; i < 4; i++) await clicar('Próxima pergunta')
  await clicar('Começar a obra')
  expect(await screen.findByRole('heading', { name: 'Obra começada!' })).toBeInTheDocument()
  expect(o.criadas).toEqual(['agenda-da-barbearia-do-ze'])
  expect(screen.getByText('C:\\Users\\Zé\\Atlas\\Obras\\agenda-da-barbearia-do-ze')).toBeInTheDocument()
  await clicar(/Ver minhas obras/)
  expect(onConcluir).toHaveBeenCalledTimes(1)
  expect(onConcluir.mock.calls[0][0].pasta.pasta).toBe('agenda-da-barbearia-do-ze')
})

test('se a pasta não puder ser criada, as respostas ficam e o recado é calmo', async () => {
  const o: PonteObras = { ...criarObrasFixture(), criarSubpasta: async () => { throw new Error('x') } }
  montar(o, { ideia: 'Agenda' })
  for (let i = 0; i < 4; i++) await clicar('Próxima pergunta')
  await clicar('Começar a obra')
  expect(await screen.findByRole('alert')).toHaveTextContent(/Não consegui criar a pasta/)
  expect(screen.getByRole('button', { name: 'Começar a obra' })).toBeEnabled()
})

test('Voltar na primeira pergunta sai; nas outras volta uma pergunta', async () => {
  const { onVoltar } = montar(criarObrasFixture(), { ideia: 'Agenda' })
  await clicar('Próxima pergunta')
  await clicar('Voltar')
  expect(screen.getByText('NOVA OBRA · PERGUNTA 1 DE 5')).toBeInTheDocument()
  await clicar('Voltar')
  expect(onVoltar).toHaveBeenCalledTimes(1)
})

test('com o estilo ligado, "Escolher o estilo" leva a obra criada para o F06b', async () => {
  const onEstilo = vi.fn()
  montar(criarObrasFixture('Zé'), { ideia: 'Agenda da Barbearia do Zé', onEstilo })
  for (let i = 0; i < 4; i++) await clicar('Próxima pergunta')
  await clicar('Começar a obra')
  await clicar('Escolher o estilo →')
  expect(onEstilo.mock.calls[0][0].pasta.pasta).toBe('agenda-da-barbearia-do-ze')
  expect(onEstilo.mock.calls[0][0].respostas.nome).toBe('Agenda da Barbearia do Zé')
})
