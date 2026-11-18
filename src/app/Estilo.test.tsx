import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Estilo } from './Estilo'
import { criarArquivosFixture, type ArquivosFixture } from './ponte-arquivos'

const OBRA = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }

const montar = (arquivos: ArquivosFixture = criarArquivosFixture()) => {
  const onVoltar = vi.fn()
  render(<TemaProvider><Estilo obra={OBRA} arquivos={arquivos} onVoltar={onVoltar} /></TemaProvider>)
  return { arquivos, onVoltar }
}
const clicar = (n: string | RegExp) => userEvent.click(screen.getByRole('button', { name: n }))
const colar = async (txt: string) => {
  await userEvent.type(screen.getByLabelText(/Cole um link/), txt)
  await clicar('Adicionar link')
}

test('pede 2 ou 3 referências e o sentimento, com microfone nos campos de texto', () => {
  montar()
  expect(screen.getByRole('heading', { name: 'Qual é a cara do seu sistema?' })).toBeInTheDocument()
  expect(screen.getByText('Mande 2 ou 3 sites ou apps que você acha bonitos')).toBeInTheDocument()
  expect(screen.getByText('O que o seu cliente deve sentir ao abrir o sistema?')).toBeInTheDocument()
  expect(screen.getByText(/PROJETO · AGENDA DA BARBEARIA DO ZÉ/)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByRole('button', { name: 'Falar o que você gosta' })).toBeInTheDocument()
})

test('link colado vira referência (aceita só o endereço do site) e dá para tirar', async () => {
  montar()
  await colar('aesop.com')
  expect(screen.getByText('aesop.com')).toBeInTheDocument()
  await colar('javascript:alert(1)')
  expect(screen.getByRole('alert')).toHaveTextContent('não parece certo')
  await clicar('Tirar aesop.com')
  expect(screen.queryByText('aesop.com')).toBeNull()
})

test('print entra pelo port de arquivos e é guardado na subpasta da obra', async () => {
  const { arquivos } = montar()
  arquivos.fila.push({ nome: 'Print do Nubank.PNG', tamanho: 5000 })
  await clicar('Mandar print')
  expect(await screen.findByText('Print: print-do-nubank.png')).toBeInTheDocument()
  expect(arquivos.guardados).toEqual(['C:\\Users\\Zé\\Atlas\\Obras\\agenda-da-barbearia-do-ze\\estilo\\referencias\\print-do-nubank.png'])
})

test('arquivo que não é imagem recebe recado calmo e não é guardado', async () => {
  const { arquivos } = montar()
  arquivos.fila.push({ nome: 'virus.exe', tamanho: 10 })
  await clicar('Mandar print')
  expect(await screen.findByRole('alert')).toHaveTextContent('não consigo ler')
  expect(arquivos.guardados).toEqual([])
})

test('no máximo 3 referências', async () => {
  montar()
  await colar('aesop.com')
  await colar('nubank.com.br')
  await colar('apple.com')
  await colar('google.com')
  expect(screen.getByRole('alert')).toHaveTextContent('Três referências já bastam')
  expect(screen.queryByText('google.com')).toBeNull()
})

test('sentimentos são marcados e desmarcados', async () => {
  montar()
  await clicar('Confiança')
  expect(screen.getByRole('button', { name: 'Confiança' })).toHaveAttribute('aria-pressed', 'true')
  await clicar('Confiança')
  expect(screen.getByRole('button', { name: 'Confiança' })).toHaveAttribute('aria-pressed', 'false')
})

test('voltar chama onVoltar', async () => {
  const { onVoltar } = montar()
  await clicar('← Voltar')
  expect(onVoltar).toHaveBeenCalled()
})
