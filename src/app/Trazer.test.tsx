import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { TrazerPrototipo } from './Trazer'
import { RECADO } from './trazer-dados'
import { arquivoZip, criarImportarFixture, importarIndisponivel, pacoteExemplo, type ImportarFixture } from './ponte-importar'
import { criarObrasFixture } from './ponte-obras'

const montar = (importar: ImportarFixture = criarImportarFixture()) => {
  const user = userEvent.setup()
  const onVoltar = vi.fn()
  const obras = criarObrasFixture()
  render(<TemaProvider><TrazerPrototipo obras={obras} importar={importar} onVoltar={onVoltar} /></TemaProvider>)
  return { user, onVoltar, obras, importar }
}

test('mostra o recado pronto e o botão copia o texto inteiro', async () => {
  const { user } = montar()
  expect(screen.getByRole('heading', { name: 'Fez o protótipo em outra IA? Traga para cá.' })).toBeInTheDocument()
  expect(screen.getByLabelText('Recado para a outra IA')).toHaveTextContent('prototipo-atlas.zip')
  await user.click(screen.getByRole('button', { name: 'Copiar recado' }))
  expect(await navigator.clipboard.readText()).toBe(RECADO)
  expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument()
})

test('se não der para copiar, avisa com calma e mantém o texto à vista', async () => {
  const { user } = montar()
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('negado'))
  await user.click(screen.getByRole('button', { name: 'Copiar recado' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Não consegui copiar sozinho')
  expect(screen.getByRole('button', { name: 'Copiar recado' })).toBeInTheDocument()
})

test('Voltar leva de volta às obras', async () => {
  const { user, onVoltar } = montar()
  await user.click(screen.getByRole('button', { name: /Voltar/ }))
  expect(onVoltar).toHaveBeenCalledTimes(1)
})

test('o passo 2 tem microfone nos campos de texto', () => {
  montar()
  expect(screen.getAllByRole('button', { name: 'Falar' }).length).toBeGreaterThanOrEqual(2)
})

test('recebe o .zip dentro da pasta da obra e anota o link', async () => {
  const { user, obras, importar } = montar()
  await user.type(screen.getByLabelText(/Nome da obra/), 'Agenda da Barbearia do Zé')
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  expect(await screen.findByText(/recebido · 2,3 MB/)).toBeInTheDocument()
  expect(obras.criadas).toContain('agenda-da-barbearia-do-ze')
  expect((importar as ImportarFixture).guardados[0]).toContain('\\agenda-da-barbearia-do-ze\\prototipo\\')
  await user.type(screen.getByLabelText(/Link do protótipo/), 'agenda-ze.lovable.app')
  await user.click(screen.getByRole('button', { name: 'Anotar link' }))
  expect(screen.getByText('agenda-ze.lovable.app')).toBeInTheDocument()
})

test('link perigoso ou com senha é recusado', async () => {
  const { user } = montar()
  for (const l of ['javascript:alert(1)', 'https://eu:senha@x.com', 'file:///c:/x']) {
    await user.clear(screen.getByLabelText(/Link do protótipo/))
    await user.type(screen.getByLabelText(/Link do protótipo/), l)
    await user.click(screen.getByRole('button', { name: 'Anotar link' }))
    expect(screen.getByRole('alert')).toHaveTextContent('não parece certo')
  }
})

test('pede o nome da obra antes de abrir o arquivo', async () => {
  const { user } = montar()
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  expect(screen.getByRole('alert')).toHaveTextContent('dê um nome para a obra')
})

test('um .zip com programa dentro é recusado com recado calmo e nada fica "recebido"', async () => {
  const importar = criarImportarFixture()
  importar.fila.push({ nome: 'prototipo-atlas.zip', tamanho: 1000, entradas: [...pacoteExemplo().entradas, arquivoZip('instalar.exe')] })
  const { user } = montar(importar)
  await user.type(screen.getByLabelText(/Nome da obra/), 'Teste')
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não abri nada')
  expect(screen.queryByText(/recebido ·/)).toBeNull()
  expect(importar.guardados).toHaveLength(0)
})

test('confere o que chegou: o exemplo do protótipo tem 7 telas, 12 regras e avisa do login e dos dados de mentirinha', async () => {
  const { user } = montar()
  await user.type(screen.getByLabelText(/Nome da obra/), 'Agenda do Zé')
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  expect(await screen.findByText('7 telas encontradas')).toBeInTheDocument()
  expect(screen.getByText('Design system')).toBeInTheDocument()
  expect(screen.getByText(/12 regras/)).toBeInTheDocument()
  expect(screen.getByText('Faltou a tela de entrar (login)')).toBeInTheDocument()
  expect(screen.getByText('Dados de mentirinha')).toBeInTheDocument()
  expect(screen.getByText('Falta o link do protótipo')).toBeInTheDocument()
  expect(screen.getByText((_, el) => el?.tagName === 'B' && el.textContent === String.raw`Atlas\Obras\agenda-do-ze`)).toBeInTheDocument()
})

test('antes do .zip mostra a lista do que ele deve conter, e o botão de seguir fica desligado', () => {
  montar()
  for (const n of ['telas/', 'design-system.md', 'telas.md', 'regras.md', 'imagens/ (opcional)']) expect(screen.getByText(n)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Abrir no Atlas e ajustar/ })).toBeDisabled()
})

test('um .zip sem design-system.md nem regras.md aponta o que falta para o Claude completar', async () => {
  const importar = criarImportarFixture()
  importar.fila.push({ nome: 'prototipo-atlas.zip', tamanho: 1000, entradas: [arquivoZip('telas/login.html'), arquivoZip('telas.md', 50, '- a')] })
  const { user } = montar(importar)
  await user.type(screen.getByLabelText(/Nome da obra/), 'X')
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  expect(await screen.findByText('Faltou o design-system.md')).toBeInTheDocument()
  expect(screen.getByText('Faltou o regras.md')).toBeInTheDocument()
  expect(screen.getByText('Sem imagens nem logomarca')).toBeInTheDocument()
  expect(screen.queryByText('Faltou a tela de entrar (login)')).toBeNull()
  expect(screen.getByRole('button', { name: /Abrir no Atlas e ajustar/ })).toBeEnabled()
})

test('pacote recusado não deixa subpasta vazia da obra', async () => {
  const importar = criarImportarFixture()
  importar.fila.push({ nome: 'prototipo-atlas.zip', tamanho: 1000, entradas: [arquivoZip('a.html'), arquivoZip('instalar.exe')] })
  const { user, obras } = montar(importar)
  await user.type(screen.getByLabelText(/Nome da obra/), 'Teste')
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não abri nada')
  expect(obras.criadas).toHaveLength(0)
})

test('sem adaptador de importação: recado honesto, sem "tente de novo", e nenhuma pasta criada', async () => {
  const obras = criarObrasFixture()
  const user = userEvent.setup()
  render(<TemaProvider><TrazerPrototipo obras={obras} importar={importarIndisponivel} onVoltar={vi.fn()} /></TemaProvider>)
  await user.type(screen.getByLabelText(/Nome da obra/), 'Teste')
  await user.click(screen.getByRole('button', { name: /prototipo-atlas.zip: escolher arquivo/ }))
  const a = await screen.findByRole('alert')
  expect(a).toHaveTextContent('A importação ainda não está ligada neste computador')
  expect(a).not.toHaveTextContent('Tente de novo')
  expect(obras.criadas).toHaveLength(0)
})
