import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Painel } from './Painel'
import { criarModoObraFixture, type ModoObra, type PonteModoObra } from './ponte-construcao'
import { criarPainelFixture, painelIndisponivel, type PontePainel } from './ponte-painel'

const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda' }
const agora = () => new Date(2026, 10, 18, 14, 40)
const PCT = /^54,\d\d%$/

const montar = (modo: ModoObra | null = 'automatico', opcoes: { painel?: PontePainel; modos?: PonteModoObra; endereco?: string | null; sondagemMs?: number; onPedirAjuda?: () => void; onLigarContas?: () => void } = {}) => {
  const fx = criarPainelFixture({ agora, endereco: opcoes.endereco })
  const painel = opcoes.painel ?? fx
  const modos = opcoes.modos ?? criarModoObraFixture(modo ? { [obra.pasta]: modo } : {})
  const onPublicar = vi.fn()
  const user = userEvent.setup()
  render(<TemaProvider><Painel obra={obra} painel={painel} modos={modos} onPublicar={onPublicar} onPedirAjuda={opcoes.onPedirAjuda} onLigarContas={opcoes.onLigarContas} sondagemMs={opcoes.sondagemMs ?? 0} /></TemaProvider>)
  return { fx, user, onPublicar, modos }
}

test('mostra o % ponderado do PLAN, o prazo e o agora na obra', async () => {
  montar()
  expect(await screen.findByText(PCT)).toBeInTheDocument()
  expect(screen.getByText('13 de 24 tarefas')).toBeInTheDocument()
  expect(screen.getByText('M5 · Confirmação por WhatsApp')).toBeInTheDocument()
  expect(screen.getByText('≈ 2 h 12')).toBeInTheDocument()
  expect(screen.getByText('Hoje, ~17h')).toBeInTheDocument()
  expect(screen.getByText('Equipe de execução')).toBeInTheDocument()
  expect(screen.getByText('Inspetor de qualidade')).toBeInTheDocument()
  expect(screen.getByText('Fiscal')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Agenda da Barbearia do Zé' })).toBeInTheDocument()
  expect(screen.getByText('● Obra em andamento')).toBeInTheDocument()
})

test('o canteiro é 3D: sem canteiro vivo mostra a imagem 3D; com canteiro vivo, a cena real em iframe com sandbox', async () => {
  const a = montar()
  expect(await screen.findByRole('img', { name: /Canteiro em 3D/ })).toBeInTheDocument()
  expect(screen.getByText('CANTEIRO 3D · ARRASTE PARA GIRAR')).toBeInTheDocument()
  expect(document.querySelector('iframe')).toBeNull()
  a.fx.chamadas.length = 0
})

test('com canteiro vivo a cena real entra num iframe com sandbox', async () => {
  montar('automatico', { endereco: 'http://127.0.0.1:4747/?obra=agenda' })
  const frame = await screen.findByTitle(/Canteiro em 3D/)
  expect(frame.getAttribute('src')).toBe('http://127.0.0.1:4747/?obra=agenda&modo=3d')
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  expect(screen.queryByRole('img', { name: /Canteiro em 3D/ })).toBeNull()
})

test('endereço de canteiro que não é o servidor local nunca vira iframe', async () => {
  montar('automatico', { endereco: 'http://evil.com/' })
  expect(await screen.findByRole('img', { name: /Canteiro em 3D/ })).toBeInTheDocument()
  expect(document.querySelector('iframe')).toBeNull()
})

test('detalhes técnicos ficam atrás de "ver detalhes"', async () => {
  const { user } = montar()
  await screen.findByText(PCT)
  expect(screen.queryByRole('list', { name: 'Detalhes das etapas' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Ver detalhes' }))
  const lista = screen.getByRole('list', { name: 'Detalhes das etapas' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(8)
  expect(within(lista).getByText('Base e login')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Esconder detalhes' }))
  expect(screen.queryByRole('list', { name: 'Detalhes das etapas' })).toBeNull()
})

test('AUTOMÁTICO: ao fim da etapa o painel libera sozinho e nunca pede aprovação', async () => {
  const { fx } = montar('automatico', { sondagemMs: 20 })
  await screen.findByText(PCT)
  fx.simular.concluirEtapa()
  await waitFor(() => expect(fx.chamadas).toContain('aprovarEtapa'))
  expect(screen.queryByRole('button', { name: 'Pode seguir' })).toBeNull()
  expect(screen.getByText('● Obra em andamento')).toBeInTheDocument()
})

test('PASSO A PASSO: ao fim da etapa o painel para e pede o OK; só segue quando o cliente diz', async () => {
  const { fx, user } = montar('passo-a-passo', { sondagemMs: 20 })
  await screen.findByText(PCT)
  fx.simular.concluirEtapa()
  expect(await screen.findByText('● Esperando o seu OK')).toBeInTheDocument()
  expect(screen.getByText(/Ficou pronta a etapa M5/)).toBeInTheDocument()
  await new Promise((r) => setTimeout(r, 80))
  expect(fx.chamadas).not.toContain('aprovarEtapa')
  await user.click(screen.getByRole('button', { name: 'Pode seguir' }))
  expect(fx.chamadas).toContain('aprovarEtapa')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Pode seguir' })).toBeNull())
  expect(screen.getByText('● Obra em andamento')).toBeInTheDocument()
})

test.each(['automatico', 'passo-a-passo'] as const)('parada real (cota) vale no modo %s, com tom calmo', async (modo) => {
  {
    const { fx, user } = montar(modo)
    await screen.findByText(PCT)
    fx.simular.pararPor('cota')
    await user.click(screen.getByRole('button', { name: 'Pausar obra' }))
    expect(await screen.findByText('● Pausada: a cota do plano acabou')).toBeInTheDocument()
    expect(screen.getByText(/Isto não é erro/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar obra' })).toBeNull()
  }
})

test('o modo fica sempre à vista, em dois botões discretos, sem abrir nem fechar (regrava o modo.json e a linha de produção)', async () => {
  const { fx, user, modos } = montar('automatico')
  const caixa = await screen.findByRole('region', { name: 'Modo da obra' })
  expect(within(caixa).queryByRole('button', { name: /Trocar o modo|Fechar/ })).toBeNull()
  expect(within(caixa).getAllByRole('radio')).toHaveLength(2)
  expect(within(caixa).getByRole('radio', { name: 'Automático' })).toHaveAttribute('aria-checked', 'true')
  await user.click(within(caixa).getByRole('radio', { name: 'Passo a passo' }))
  expect(await modos.ler(obra.pasta)).toBe('passo-a-passo')
  expect(fx.modoAplicado).toBe('passo-a-passo')
  expect(within(caixa).getByRole('radio', { name: 'Passo a passo' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByText(/Pronto: ao fim de cada etapa/)).toBeInTheDocument()
})

test('o (i) abre uma gaveta lateral explicando a diferença dos dois modos', async () => {
  const { user } = montar('automatico')
  await screen.findByRole('region', { name: 'Modo da obra' })
  expect(screen.queryByRole('dialog', { name: 'Os dois modos da obra' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Entender os modos' }))
  const gaveta = screen.getByRole('dialog', { name: 'Os dois modos da obra' })
  expect(within(gaveta).getByText(/Automático do começo ao fim/)).toBeInTheDocument()
  expect(within(gaveta).getByText(/Me chamar para aprovar cada etapa/)).toBeInTheDocument()
  expect(within(gaveta).getByText('RECOMENDADO')).toBeInTheDocument()
  expect(within(gaveta).getByText(/só para nas paradas de verdade/)).toBeInTheDocument()
  await user.click(within(gaveta).getByRole('button', { name: 'Fechar a explicação' }))
  expect(screen.queryByRole('dialog', { name: 'Os dois modos da obra' })).toBeNull()
})

test('trocar para o automático com uma etapa esperando o OK libera a obra', async () => {
  const { fx, user } = montar('passo-a-passo')
  await screen.findByText(PCT)
  fx.simular.concluirEtapa()
  await user.click(screen.getByRole('button', { name: 'Pausar obra' }))
  await user.click(screen.getByRole('button', { name: 'Continuar obra' }))
  expect(await screen.findByRole('button', { name: 'Pode seguir' })).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Automático' }))
  await waitFor(() => expect(fx.chamadas).toContain('aprovarEtapa'))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Pode seguir' })).toBeNull())
})

test('sem modo guardado o painel não adivinha: espera o OK e pede a escolha', async () => {
  const { fx, user } = montar(null)
  await screen.findByText(PCT)
  expect(screen.getByText('Você ainda não escolheu.')).toBeInTheDocument()
  fx.simular.concluirEtapa()
  await user.click(screen.getByRole('button', { name: 'Pausar obra' }))
  await user.click(screen.getByRole('button', { name: 'Continuar obra' }))
  expect(await screen.findByRole('button', { name: 'Pode seguir' })).toBeInTheDocument()
})

test('pausar e continuar a obra', async () => {
  const { fx, user } = montar()
  await user.click(await screen.findByRole('button', { name: 'Pausar obra' }))
  expect(await screen.findByText('● Pausada por você')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continuar obra' }))
  expect(await screen.findByText('● Obra em andamento')).toBeInTheDocument()
  expect(fx.chamadas).toEqual(['pausar', 'continuar'])
})

test('ao concluir (100%) aparece "Publicar o sistema"; antes disso não aparece', async () => {
  const { fx, user, onPublicar } = montar('automatico', { sondagemMs: 20 })
  await screen.findByText(PCT)
  expect(screen.queryByRole('button', { name: /Publicar o sistema/ })).toBeNull()
  fx.simular.concluirObra()
  expect(await screen.findByText('Obra pronta! Falta só escolher onde o seu sistema vai morar.')).toBeInTheDocument()
  expect(screen.getByText('100%')).toBeInTheDocument()
  expect(screen.getByText('● Obra concluída')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Publicar o sistema →' }))
  expect(onPublicar).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Ver como ficou' })).toBeInTheDocument()
})

test('sem adaptador real não finge andamento: recado calmo', async () => {
  montar('automatico', { painel: painelIndisponivel })
  expect(await screen.findByRole('alert')).toHaveTextContent('Quem acompanha a obra ainda não está ligado')
})

describe('vigia (bug de 24/11): a obra nunca fica parada em silêncio', () => {
  test('tentando de novo: o painel avisa na hora, com a tentativa, e "Tentar agora" religa', async () => {
    const { fx, user } = montar('automatico', { sondagemMs: 30 })
    fx.simular.vigia({ situacao: 'tentando', tentativa: 0, de: 3, motivo: 'A linha de produção ligou, mas não conseguiu trabalhar e parou em seguida.', proximaEm: '2026-11-24T10:05:00.000Z' })
    const aviso = await screen.findByRole('status', { name: 'A obra parou' })
    expect(aviso).toHaveTextContent(/O Atlas já está cuidando disso/)
    expect(aviso).toHaveTextContent(/tentativa 1 de 3/)
    expect(screen.queryByText(/a obra está pronta/)).toBeNull()
    await user.click(within(aviso).getByRole('button', { name: 'Tentar agora' }))
    expect(fx.chamadas).toContain('continuar')
  })

  test('depois de 3 tentativas: alerta que pede você, com o motivo e a Ajuda', async () => {
    const ajuda = vi.fn()
    const { fx, user } = montar('automatico', { onPedirAjuda: ajuda, sondagemMs: 30 })
    fx.simular.vigia({ situacao: 'precisa-voce', tentativa: 3, de: 3, motivo: 'O Claude deste computador saiu da conta: é preciso entrar de novo.' })
    const alerta = await screen.findByRole('alert', { name: 'A obra parou' })
    expect(alerta).toHaveTextContent(/precisa de você/)
    expect(alerta).toHaveTextContent(/saiu da conta/)
    await user.click(within(alerta).getByRole('button', { name: 'Falar com o Atlas' }))
    expect(ajuda).toHaveBeenCalled()
  })

  test('"a obra está pronta" só com a obra pronta de verdade', async () => {
    const { fx } = montar('automatico', { sondagemMs: 30 })
    fx.simular.semNinguem()
    expect(await screen.findByText('Ninguém trabalhando agora.')).toBeInTheDocument()
    expect(screen.queryByText(/a obra está pronta/)).toBeNull()
  })
})

test('vigia: a linha esperando a pessoa mostra o que ela disse e o botão da conta certa (obra do Guilherme, 24/11)', async () => {
  const ligar = vi.fn()
  const { fx, user } = montar('automatico', { onLigarContas: ligar, sondagemMs: 30 })
  fx.simular.vigia({ situacao: 'precisa-voce', tentativa: 0, de: 3, motivo: 'A obra está esperando uma coisa que só você pode fazer.', fala: 'Ligue o GitHub na tela As contas do Atlas (botão Ligar).', conta: 'GitHub' })
  const alerta = await screen.findByRole('alert', { name: 'A obra parou' })
  expect(alerta).toHaveTextContent('A obra está esperando uma coisa que só você pode fazer.')
  expect(alerta).toHaveTextContent('“Ligue o GitHub na tela As contas do Atlas (botão Ligar).”')
  expect(alerta).not.toHaveTextContent(/tentou/)
  await user.click(within(alerta).getByRole('button', { name: 'Ligar o GitHub' }))
  expect(ligar).toHaveBeenCalled()
})

test('as contas da obra têm entrada fixa no painel (Guilherme, 24/11: "Onde fica essa tela? Não encontrei")', async () => {
  const ligar = vi.fn()
  const { user } = montar('automatico', { onLigarContas: ligar })
  await user.click(await screen.findByRole('button', { name: 'Contas ligadas' }))
  expect(ligar).toHaveBeenCalled()
})
