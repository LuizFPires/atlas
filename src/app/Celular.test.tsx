import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Celular } from './Celular'
import { celularIndisponivel, criarArmazemLocal, criarCelularFixture, PREFS_PADRAO, type PrefsCelular } from './ponte-celular'

const armazemEspiao = (inicial: PrefsCelular = PREFS_PADRAO) => {
  const guardado: PrefsCelular[] = []
  return { guardado, armazem: { ler: () => inicial, guardar: (p: PrefsCelular) => { guardado.push(p) } } }
}

const montar = (celular = criarCelularFixture(), inicial?: PrefsCelular) => {
  const onVoltar = vi.fn(), onConcluir = vi.fn()
  const { armazem, guardado } = armazemEspiao(inicial)
  render(<TemaProvider><Celular celular={celular} armazem={armazem} onVoltar={onVoltar} onConcluir={onConcluir} /></TemaProvider>)
  return { celular, onVoltar, onConcluir, guardado }
}

test('mostra o QR do app do Claude e a conta do cliente', () => {
  montar()
  expect(screen.getByRole('img', { name: 'QR code para baixar o app do Claude' })).toBeInTheDocument()
  expect(screen.getByText('1. Baixe o app do Claude no celular')).toBeInTheDocument()
  expect(screen.getByText('ÚLTIMO PASSO')).toBeInTheDocument()
})

test('voltar e concluir', async () => {
  const { onVoltar, onConcluir } = montar()
  await userEvent.click(screen.getByRole('button', { name: '← Voltar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Concluir e ir para as obras →' }))
  expect(onVoltar).toHaveBeenCalled()
  expect(onConcluir).toHaveBeenCalled()
})

test('escolher a frequência: guarda, passa para a sessão e muda a prévia do celular', async () => {
  const { celular, guardado } = montar()
  expect(screen.getByRole('radio', { name: 'A cada 1 hora' })).toBeChecked()
  expect(screen.getByText('Próxima notícia: 16h.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'A cada 30 min' }))
  expect(screen.getByText('Próxima notícia: 15h30.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'A cada 3 horas' }))
  expect(screen.getByText('Próxima notícia: 18h.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Só quando terminar uma etapa' }))
  expect(screen.getByText('Próxima notícia: quando a etapa 5 terminar.')).toBeInTheDocument()
  expect(celular.aplicadas.at(-1)?.frequencia).toBe('etapa')
  expect(guardado.at(-1)).toMatchObject({ frequencia: 'etapa' })
})

test('sem o celular ligado ao computador, a escolha fica guardada e o recado é calmo', async () => {
  const guardado: PrefsCelular[] = []
  const armazem = { ler: () => PREFS_PADRAO, guardar: (p: PrefsCelular) => { guardado.push(p) } }
  render(<TemaProvider><Celular celular={celularIndisponivel} armazem={armazem} onVoltar={() => {}} onConcluir={() => {}} /></TemaProvider>)
  await userEvent.click(screen.getByRole('radio', { name: 'A cada 3 horas' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Guardei a sua escolha')
  expect(guardado).toHaveLength(1)
})

test('o armazém local guarda e relê; lixo volta para o padrão', () => {
  const dados: Record<string, string> = {}
  const st = { getItem: (k: string) => dados[k] ?? null, setItem: (k: string, v: string) => { dados[k] = v } }
  const a = criarArmazemLocal(st)
  expect(a.ler()).toEqual(PREFS_PADRAO)
  a.guardar({ frequencia: '3h', avisos: { precisa: true, etapa: false, fim: true } })
  expect(criarArmazemLocal(st).ler().frequencia).toBe('3h')
  dados['atlas.celular.prefs'] = '{"frequencia":"x"}'
  expect(criarArmazemLocal(st).ler()).toEqual(PREFS_PADRAO)
  dados['atlas.celular.prefs'] = 'nao-e-json'
  expect(criarArmazemLocal(st).ler()).toEqual(PREFS_PADRAO)
})
