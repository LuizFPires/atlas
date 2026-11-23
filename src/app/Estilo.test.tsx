import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Estilo } from './Estilo'
import { criarEstiloFixture, type EstiloFixture } from './ponte-estilo'
import { criarArquivosFixture, type ArquivosFixture } from './ponte-arquivos'

const OBRA = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }

const montar = (arquivos: ArquivosFixture = criarArquivosFixture()) => {
  const onVoltar = vi.fn()
  render(<TemaProvider><Estilo obra={OBRA} arquivos={arquivos} estilo={criarEstiloFixture()} onVoltar={onVoltar} /></TemaProvider>)
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

describe('3 estilos e design system', () => {
  const montarCompleto = (est: EstiloFixture = criarEstiloFixture()) => {
    const arquivos = criarArquivosFixture()
    const onConcluir = vi.fn()
    render(<TemaProvider><Estilo obra={OBRA} arquivos={arquivos} estilo={est} onVoltar={() => {}} onConcluir={onConcluir} /></TemaProvider>)
    return { est, arquivos, onConcluir }
  }
  const preencher = async () => {
    await colar('aesop.com')
    await colar('nubank.com.br')
    await clicar('Confiança')
    await clicar('Tradição')
  }

  test('sem 2 referências ou sem sentimento não propõe, com recado amigo', async () => {
    const { est } = montarCompleto()
    await clicar('Mostrar 3 estilos')
    expect(screen.getByRole('alert')).toHaveTextContent('pelo menos 2 referências')
    await colar('aesop.com')
    await colar('nubank.com.br')
    await clicar('Mostrar 3 estilos')
    expect(screen.getByRole('alert')).toHaveTextContent('jeito que o seu cliente deve se sentir')
    expect(est.pedidos).toHaveLength(0)
  })

  test('enquanto monta os estilos, um pincel pinta a tela do sistema; quando chegam, os 3 aparecem', async () => {
    let soltar: () => void = () => {}
    const base = criarEstiloFixture()
    const est = { ...base, propor: (e: Parameters<typeof base.propor>[0], p: string) => new Promise<Awaited<ReturnType<typeof base.propor>>>((ok) => { soltar = () => void base.propor(e, p).then(ok) }) }
    montarCompleto(est as EstiloFixture)
    await preencher()
    await clicar('Mostrar 3 estilos')
    const atelie = screen.getByRole('img', { name: /pincel/i })
    expect(atelie).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'O que o pintor está fazendo' })).toHaveTextContent(/cores|letras|botões|acabamento/)
    soltar()
    expect(await screen.findAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('img', { name: /pincel/i })).toBeNull()
  })

  test('propõe 3 estilos pela porta e o escolhido vira o design-system.md na pasta da obra', async () => {
    const { est, onConcluir } = montarCompleto()
    await preencher()
    await clicar('Mostrar 3 estilos')
    expect(est.pedidos[0].sentimentos).toEqual(['Confiança', 'Tradição'])
    expect(est.pedidos[0].referencias.map((r) => r.tipo)).toEqual(['link', 'link'])
    expect(await screen.findAllByRole('radio')).toHaveLength(3)
    await userEvent.click(screen.getByRole('radio', { name: /Navalha/ }))
    await clicar('Usar "Navalha" e desenhar as telas →')
    expect(await screen.findByText('Estilo "Navalha" guardado!')).toBeInTheDocument()
    expect(est.escritos).toHaveLength(1)
    expect(est.escritos[0].caminho).toBe(['C:', 'Users', 'Zé', 'Atlas', 'Obras', 'agenda-da-barbearia-do-ze', 'design-system.md'].join(String.fromCharCode(92)))
    expect(est.escritos[0].texto).toContain('Estilo: Navalha')
    expect(est.escritos[0].texto).toContain('- Confiança')
    expect(est.escritos[0].texto).toContain('- Tradição')
    await clicar('Desenhar as telas →')
    expect(onConcluir).toHaveBeenCalled()
  })

  test('falha do Claude não perde as referências e mostra recado calmo', async () => {
    const { est } = montarCompleto({ ...criarEstiloFixture(), propor: async () => { throw new Error('x') } })
    expect(est).toBeTruthy()
    await preencher()
    await clicar('Mostrar 3 estilos')
    expect(await screen.findByRole('alert')).toHaveTextContent('Suas referências continuam aqui')
    expect(screen.getByText('aesop.com')).toBeInTheDocument()
  })
})

test('sem WebGL (computador antigo ou teste) o pincel cai no desenho em SVG', async () => {
  const { temWebGL } = await import('./Pintor')
  expect(temWebGL()).toBe(false)
})
