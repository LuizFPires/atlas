import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Prototipo } from './Prototipo'
import { ESTILOS_EXEMPLO } from './ponte-estilo'
import { caminhoDaVersao, criarPrototipoFixture, montarSrcDoc, MAX_HTML, prototipoIndisponivel, type PontePrototipo, type PrototipoFixture } from './ponte-prototipo'

const BS = String.fromCharCode(92)
const RAIZ = ['C:', 'Users', 'Zé', 'Atlas', 'Obras'].join(BS)
const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda-da-barbearia-do-ze' }
const montar = (prototipo: PontePrototipo = criarPrototipoFixture(), estilo = ESTILOS_EXEMPLO[0]) => {
  const user = userEvent.setup()
  const onVoltar = vi.fn()
  const onConcluir = vi.fn()
  render(<TemaProvider><Prototipo obra={obra} estilo={estilo} prototipo={prototipo} onVoltar={onVoltar} onConcluir={onConcluir} /></TemaProvider>)
  return { user, onVoltar, onConcluir, prototipo }
}

test('desenha as telas no estilo escolhido e mostra o rótulo do projeto', async () => {
  montar()
  expect(await screen.findByText(/Projeto 2 de 3 · Telas · Estilo "Couro e madeira" · Versão 1/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Agenda da Barbearia do Zé' })).toBeInTheDocument()
  expect(screen.getByText(/Fiz as primeiras telas no estilo que você escolheu/)).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Marcar horário', 'Agenda do dia', 'Confirmação', 'Início'])
})

test('o preview é um iframe com sandbox VAZIO (sem scripts, sem mesma origem) e CSP; nada de HTML no DOM do app', async () => {
  const p = criarPrototipoFixture()
  const mal = await p.desenhar('x', '<img src=x onerror=alert(1)>', { ...ESTILOS_EXEMPLO[0], destaque: 'red;}</style><script>alert(1)</script>' })
  expect(mal.versoes[0].telas[0].html).not.toContain('<script')
  expect(mal.versoes[0].telas[0].html).not.toContain('<img')
  montar()
  const frame = await screen.findByTitle(/Tela Marcar horário no celular/)
  expect(frame.tagName).toBe('IFRAME')
  expect(frame.getAttribute('sandbox')).toBe('')
  expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'")
  // O texto da tela está só dentro do iframe, nunca no DOM do app.
  expect(screen.queryByText('Escolha o barbeiro')).not.toBeInTheDocument()
})

test('HTML hostil vai inteiro para o srcdoc (não é interpretado pelo app) e tela gigante vira aviso seguro', () => {
  const hostil = '<script>window.parent.x=1</script><iframe src="https://x"></iframe>'
  expect(montarSrcDoc(hostil)).toContain(hostil)
  expect(montarSrcDoc(hostil)!.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true)
  expect(montarSrcDoc('a'.repeat(MAX_HTML + 1))).toBeNull()
})

test('troca de aba muda a tela do celular', async () => {
  const { user } = montar()
  await user.click(await screen.findByRole('tab', { name: 'Agenda do dia' }))
  expect(screen.getByTitle(/Tela Agenda do dia no celular/).getAttribute('srcdoc')).toContain('Agenda de hoje')
})

test('Voltar e o botão final avisam quem chamou', async () => {
  const { user, onVoltar, onConcluir } = montar()
  await user.click(await screen.findByRole('button', { name: /Telas do meu jeito/ }))
  expect(onConcluir).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: /← Voltar/ }))
  expect(onVoltar).toHaveBeenCalledTimes(1)
})

test('sem adaptador real não finge: explica com calma', async () => {
  montar(prototipoIndisponivel)
  expect(await screen.findByRole('alert')).toHaveTextContent('ainda não está ligado')
})

test('as versões vão para a subpasta da obra e o caminho não sai dela', async () => {
  const p: PrototipoFixture = criarPrototipoFixture(RAIZ)
  await p.desenhar(obra.pasta, obra.nome, ESTILOS_EXEMPLO[0])
  expect(p.escritos[0].caminho).toBe([RAIZ, 'agenda-da-barbearia-do-ze', 'prototipo', 'versoes', 'v001', 'telas', 'agendar.html'].join(BS))
  for (const ruim of ['..', '../x', 'a' + BS + 'b', 'A', '']) expect(() => caminhoDaVersao(RAIZ, ruim, 1)).toThrow()
  expect(() => caminhoDaVersao(RAIZ, 'ok', 0)).toThrow()
  expect(() => caminhoDaVersao(RAIZ, 'ok', 1, '..' + BS + 'x')).toThrow()
})

test('o celular fica dentro da seção de preview', async () => {
  montar()
  const sec = await screen.findByRole('region', { name: 'Preview do celular' })
  expect(within(sec).getByTitle(/no celular/)).toBeInTheDocument()
})
