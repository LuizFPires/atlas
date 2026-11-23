import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Estilo } from './Estilo'
import { criarArquivosFixture } from './ponte-arquivos'
import { criarEstiloFixture } from './ponte-estilo'

const OBRA = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }
const BS = String.fromCharCode(92)

const montar = () => {
  const arquivos = criarArquivosFixture()
  const est = criarEstiloFixture()
  const onConcluir = vi.fn()
  render(<TemaProvider><Estilo obra={OBRA} arquivos={arquivos} estilo={est} onVoltar={() => {}} onConcluir={onConcluir} /></TemaProvider>)
  return { arquivos, est, onConcluir }
}
const clicar = (n: string | RegExp) => userEvent.click(screen.getByRole('button', { name: n }))

test('"Já tenho a minha identidade visual" troca o painel pelos 3 envios, sem os 3 estilos', async () => {
  montar()
  await clicar('Já tenho a minha identidade visual')
  expect(screen.getByText('Mande o que você já tem')).toBeInTheDocument()
  expect(screen.getByText('O Atlas lê tudo e monta o design system do seu sistema a partir disso.')).toBeInTheDocument()
  expect(screen.getByText('Logomarca')).toBeInTheDocument()
  expect(screen.getByText('Cores')).toBeInTheDocument()
  expect(screen.getByText('Manual da marca ou design system pronto')).toBeInTheDocument()
  expect(screen.queryByText('Mande 2 ou 3 sites ou apps que você acha bonitos')).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByRole('button', { name: /Usar a minha identidade/ })).toBeDisabled()
})

test('logo e cores sobem pelo port para estilo/identidade e viram o design-system.md', async () => {
  const { arquivos, est, onConcluir } = montar()
  await clicar('Já tenho a minha identidade visual')
  await clicar('Logomarca: escolher arquivo')
  expect(await screen.findByText('logo-barbearia.png')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText(/Ou conte as cores/), 'azul #1D3557')
  await clicar(/Usar a minha identidade/)
  expect(await screen.findByText('Identidade visual guardada!')).toBeInTheDocument()
  expect(arquivos.guardados[0].endsWith(['estilo', 'identidade', 'logo-barbearia.png'].join(BS))).toBe(true)
  expect(est.escritos[0].texto).toContain('estilo/identidade/logo-barbearia.png')
  expect(est.escritos[0].texto).toContain('azul #1D3557')
  await clicar('Desenhar as telas →')
  expect(onConcluir).toHaveBeenCalled()
})

test('design-system.md pronto vai para a raiz da obra, prevalece e nenhum esqueleto é gravado por cima', async () => {
  const { arquivos, est } = montar()
  await clicar('Já tenho a minha identidade visual')
  arquivos.fila.push({ nome: 'design-system.md', tamanho: 3000 })
  await clicar('Manual da marca ou design system pronto: escolher arquivo')
  expect(await screen.findByLabelText('Arquivos de Manual da marca ou design system pronto')).toBeInTheDocument()
  expect(arquivos.guardados[0].endsWith([OBRA.pasta, 'design-system.md'].join(BS))).toBe(true)
  await clicar(/Usar a minha identidade/)
  await screen.findByText('Identidade visual guardada!')
  expect(est.escritos).toHaveLength(0)
  expect(screen.getByText(/design-system\.md$/, { selector: 'code' })).toBeInTheDocument()
})

test('se já havia um design-system.md na raiz, o do cliente é rastreado pelo nome realmente gravado', async () => {
  const { arquivos, est } = montar()
  await clicar('Já tenho a minha identidade visual')
  arquivos.fila.push({ nome: 'design-system.md', tamanho: 10 }, { nome: 'design-system.md', tamanho: 10 })
  await clicar('Manual da marca ou design system pronto: escolher arquivo')
  await clicar('Manual da marca ou design system pronto: escolher arquivo')
  expect(await screen.findByText('design-system-2.md')).toBeInTheDocument()
  await clicar(/Usar a minha identidade/)
  await screen.findByText('Identidade visual guardada!')
  expect(est.escritos).toHaveLength(0)
})

test('logo em SVG é recusada', async () => {
  const { arquivos } = montar()
  await clicar('Já tenho a minha identidade visual')
  arquivos.fila.push({ nome: 'logo.svg', tamanho: 10 })
  await clicar('Logomarca: escolher arquivo')
  expect(await screen.findByRole('alert')).toHaveTextContent('não consigo ler')
  expect(arquivos.guardados).toEqual([])
})

test('arquivo de tipo errado recebe recado calmo; desistir do diálogo não faz nada', async () => {
  const { arquivos } = montar()
  await clicar('Já tenho a minha identidade visual')
  arquivos.fila.push({ nome: 'logo.exe', tamanho: 10 }, null)
  await clicar('Logomarca: escolher arquivo')
  expect(await screen.findByRole('alert')).toHaveTextContent('não consigo ler')
  await clicar('Logomarca: escolher arquivo')
  expect(arquivos.guardados).toEqual([])
  expect(screen.getByRole('button', { name: /Usar a minha identidade/ })).toBeDisabled()
})

test('link do Figma inválido não passa; tirar um envio funciona', async () => {
  montar()
  await clicar('Já tenho a minha identidade visual')
  await clicar('Cores: escolher arquivo')
  await userEvent.type(screen.getByLabelText(/Link do manual ou do Figma/), 'file:///c:/segredo')
  await clicar(/Usar a minha identidade/)
  expect(await screen.findByRole('alert')).toHaveTextContent('não parece certo')
  await clicar('Tirar cores-da-fachada.jpg')
  expect(screen.queryByText('cores-da-fachada.jpg')).toBeNull()
})

test('cores escolhidas na paleta (tocando ou pelo código) vão para o design-system.md', async () => {
  const { est } = montar()
  await clicar('Já tenho a minha identidade visual')
  expect(screen.getByRole('button', { name: /Usar a minha identidade/ })).toBeDisabled()
  await clicar('Usar a cor #1D3557')
  await userEvent.type(screen.getByRole('textbox', { name: 'Código da cor 2' }), 'd8b45a{enter}')
  expect(screen.getByRole('button', { name: /Usar a minha identidade/ })).toBeEnabled()
  await clicar(/Usar a minha identidade/)
  await screen.findByText('Identidade visual guardada!')
  expect(est.escritos[0].texto).toContain('#1D3557')
  expect(est.escritos[0].texto).toContain('#D8B45A')
})
