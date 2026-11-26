// Caminho novo (Luiz, 23/11/2026): a obra começa pela ideia contada livremente, com um roteiro de 7 tópicos ao lado.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Ideia } from './Ideia'
import type { PonteIdeia } from './ponte-ideia'

const montar = (ideia: PonteIdeia, onConcluir = vi.fn()) => {
  render(<TemaProvider><Ideia ideia={ideia} onVoltar={() => {}} onConcluir={onConcluir} esperaMs={10} /></TemaProvider>)
  return { onConcluir }
}
const roteiro = () => screen.getByRole('list', { name: 'Roteiro da conversa' })
const topico = (nome: RegExp) => within(roteiro()).getByText(nome).closest('li')!

test('o roteiro mostra os 7 tópicos; o 1º é o da vez e os outros esperam', () => {
  montar({ conferir: vi.fn(async () => ({ cobertos: [], faltam: [] })) })
  expect(within(roteiro()).getAllByRole('listitem')).toHaveLength(7)
  expect(topico(/Qual problema você resolve\?/)).toHaveAttribute('data-estado', 'agora')
  expect(topico(/Quem vai usar\?/)).toHaveAttribute('data-estado', 'depois')
})

test('a pessoa conta: depois de uma pausa o Atlas confere e as bolinhas dos tópicos respondidos ficam verdes', async () => {
  const conferir = vi.fn(async () => ({ cobertos: [{ id: 'problema' as const, resumo: 'Ponto no papel.' }, { id: 'quem' as const, resumo: 'Pedreiros.' }], faltam: [] }))
  montar({ conferir })
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), 'hoje o ponto é no papel e os pedreiros vão usar')
  await act(async () => { await new Promise((ok) => setTimeout(ok, 30)) })
  expect(conferir).toHaveBeenCalledWith('hoje o ponto é no papel e os pedreiros vão usar', false)
  expect(topico(/Qual problema você resolve\?/)).toHaveAttribute('data-estado', 'feito')
  expect(topico(/Qual problema você resolve\?/)).toHaveTextContent('Ponto no papel.')
  expect(topico(/O que a pessoa faz primeiro\?/)).toHaveAttribute('data-estado', 'agora')
})

test('"Pular este tópico" passa para o próximo', async () => {
  montar({ conferir: vi.fn(async () => ({ cobertos: [], faltam: [] })) })
  await userEvent.click(screen.getByRole('button', { name: 'Pular este tópico' }))
  expect(topico(/Qual problema você resolve\?/)).toHaveAttribute('data-estado', 'pulado')
  expect(topico(/Quem vai usar\?/)).toHaveAttribute('data-estado', 'agora')
})

test('com pouca coisa contada não dá para seguir; contando mais, segue', async () => {
  montar({ conferir: vi.fn(async () => ({ cobertos: [], faltam: [] })) })
  expect(screen.getByRole('button', { name: /Conte um pouco mais/ })).toBeDisabled()
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), 'quero um sistema de ponto para a minha equipe nas obras com localização e relatório do mês para pagar')
  expect(screen.getByRole('button', { name: /Pronto: começar o protótipo/ })).toBeEnabled()
})

test('no fim, se faltou algo, o Atlas pergunta só isso; a resposta entra no relato e segue com o título sugerido', async () => {
  const conferir = vi.fn(async (_r: string, fim?: boolean) => (fim
    ? { cobertos: [], faltam: [{ pergunta: 'Como os funcionários entram?', porque: 'Você não contou como cada um entra.' }], titulo: 'Controle de ponto' }
    : { cobertos: [], faltam: [] }))
  const { onConcluir } = montar({ conferir })
  const relato = 'quero um sistema de ponto para a minha equipe nas obras com localização e relatório do mês para pagar'
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), relato)
  await userEvent.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  expect(await screen.findByRole('heading', { name: /Só faltou/ })).toBeInTheDocument()
  expect(screen.getByText('Você não contou como cada um entra.')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Como os funcionários entram?' }), 'com o CPF')
  await userEvent.click(screen.getByRole('button', { name: /Seguir para o visual/ }))
  expect(onConcluir).toHaveBeenCalledWith({ relato: `${relato}\n\nComo os funcionários entram? com o CPF`, titulo: 'Controle de ponto' })
})

test('nada faltou: segue direto, sem a tela de complemento', async () => {
  const conferir = vi.fn(async (_r: string, fim?: boolean) => (fim ? { cobertos: [], faltam: [], titulo: 'Agenda' } : { cobertos: [], faltam: [] }))
  const { onConcluir } = montar({ conferir })
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), 'uma agenda para a barbearia com horários, barbeiros, lembrete no whatsapp e cadastro de clientes')
  await userEvent.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  await vi.waitFor(() => expect(onConcluir).toHaveBeenCalledWith({ relato: 'uma agenda para a barbearia com horários, barbeiros, lembrete no whatsapp e cadastro de clientes', titulo: 'Agenda' }))
})

test('o Claude não respondeu no fim: segue mesmo assim, sem travar a pessoa', async () => {
  const conferir = vi.fn(async (_r: string, fim?: boolean) => { if (fim) throw new Error('claude-falhou'); return { cobertos: [], faltam: [] } })
  const { onConcluir } = montar({ conferir })
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), 'uma agenda para a barbearia com horários, barbeiros, lembrete no whatsapp e cadastro de clientes')
  await userEvent.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  await vi.waitFor(() => expect(onConcluir).toHaveBeenCalledWith(expect.objectContaining({ titulo: '' })))
})

test('o que a pessoa contou fica guardado: sair e voltar não perde nada', async () => {
  const ideia = { conferir: vi.fn(async () => ({ cobertos: [], faltam: [] })) }
  const r = render(<TemaProvider><Ideia ideia={ideia} onVoltar={() => {}} onConcluir={() => {}} esperaMs={10} /></TemaProvider>)
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), 'minha ideia de ponto')
  r.unmount()
  montar(ideia)
  expect(screen.getByRole('textbox', { name: 'O que você contou' })).toHaveValue('minha ideia de ponto')
})

test('não conseguiu criar a obra: avisa e o que foi contado continua guardado', async () => {
  const conferir = vi.fn(async (_r: string, fim?: boolean) => (fim ? { cobertos: [], faltam: [], titulo: 'Agenda' } : { cobertos: [], faltam: [] }))
  const onConcluir = vi.fn(async () => { throw new Error('sem-nome-livre') })
  render(<TemaProvider><Ideia ideia={{ conferir }} onVoltar={() => {}} onConcluir={onConcluir} esperaMs={10} /></TemaProvider>)
  const texto = 'uma agenda para a barbearia com horários, barbeiros, lembrete no whatsapp e cadastro de clientes'
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), texto)
  await userEvent.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui criar a pasta da obra')
  expect(localStorage.getItem('atlas:rascunho:ideia')).toContain('barbearia')
})

test('voltou do estilo: mostra de novo o que já tinha contado', () => {
  render(<TemaProvider><Ideia ideia={{ conferir: vi.fn(async () => ({ cobertos: [], faltam: [] })) }} relatoInicial="o que eu contei antes" onVoltar={() => {}} onConcluir={() => {}} /></TemaProvider>)
  expect(screen.getByRole('textbox', { name: 'O que você contou' })).toHaveValue('o que eu contei antes')
})

// M64 (Luiz, 25/11/2026): o Atlas deduz se é para vender e confirma numa linha (prototipo/caminho-novo/CN1bVenda).
const LONGO = 'hoje o ponto é no papel e os pedreiros vão usar pelo celular, abre e bate o ponto com a localização da obra e eu vejo as horas do mês de cada um, e outras construtoras vão assinar por mês'
test('para vender: confirma numa linha e a obra já nasce sabendo (dados por empresa, cadastro, planos, LGPD)', async () => {
  const conferir = vi.fn(async (_r: string, fim?: boolean) => (fim ? { cobertos: [], faltam: [], titulo: 'Ponto', venda: { paraVender: true, motivo: 'Você falou que outras construtoras vão assinar.' } } : { cobertos: [], faltam: [] }))
  const { onConcluir } = montar({ conferir })
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), LONGO)
  await userEvent.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  expect(await screen.findByRole('heading', { name: 'Pelo que você contou, é para vender a outras empresas. Certo?' })).toBeInTheDocument()
  expect(screen.getByText(/outras construtoras vão assinar/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Sim, é para vender' }))
  expect(onConcluir).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Ponto', paraVender: true }))
  expect(onConcluir.mock.calls[0][0].relato).toMatch(/## Para vender a outras empresas/)
  expect(onConcluir.mock.calls[0][0].relato).toMatch(/dados de cada empresa separados/)
})

test('o cliente corrige: "Não, é só para a minha empresa" vira uso interno, sem o bloco de venda', async () => {
  const conferir = vi.fn(async (_r: string, fim?: boolean) => (fim ? { cobertos: [], faltam: [], titulo: 'Ponto', venda: { paraVender: true, motivo: 'x' } } : { cobertos: [], faltam: [] }))
  const { onConcluir } = montar({ conferir })
  await userEvent.type(screen.getByRole('textbox', { name: 'O que você contou' }), LONGO)
  await userEvent.click(screen.getByRole('button', { name: /Pronto: começar o protótipo/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Não, é só para a minha empresa' }))
  expect(onConcluir).toHaveBeenCalledWith(expect.objectContaining({ paraVender: false }))
  expect(onConcluir.mock.calls[0][0].relato).not.toMatch(/Para vender a outras empresas/)
})

test('o primeiro passo diz que o Atlas faz aplicativo, sistema ou site (M35)', () => {
  montar({ conferir: vi.fn(async () => ({ cobertos: [], faltam: [] })) })
  expect(screen.getByText('Aplicativo, sistema ou site: o Atlas faz os três.')).toBeInTheDocument()
})
