import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Instalar } from './Instalar'
import { criarInstalarApi, criarInstalarFixture, type InstalarApi } from './instalar-api'

const T = 'a'.repeat(30)

test('sem token: mensagem honesta, sem chamar o servidor', async () => {
  const abrir = vi.fn()
  render(<Instalar api={{ ...criarInstalarFixture(), abrir }} token="" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/não está completo/)
  expect(abrir).not.toHaveBeenCalled()
})

test('token inválido: mostra o recado do servidor', async () => {
  const api: InstalarApi = { ...criarInstalarFixture(), abrir: async () => ({ ok: false, mensagem: 'Esse link venceu.' }) }
  render(<Instalar api={api} token={T} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse link venceu.')
})

test('celular: aviso e reenvio para o computador', async () => {
  const enviar = vi.fn(async () => ({ ok: true as const }))
  render(<Instalar api={{ ...criarInstalarFixture(true), enviarParaComputador: enviar }} token={T} />)
  expect(await screen.findByRole('heading', { name: /acesso está liberado/ })).toBeInTheDocument()
  expect(screen.getByText(/Abra no computador/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Enviar para o meu computador/ }))
  expect(enviar).toHaveBeenCalledWith(T)
  expect(await screen.findByRole('status')).toHaveTextContent(/Mandei o acesso de novo/)
})

test('celular: limite de pedidos aparece como erro honesto', async () => {
  const api: InstalarApi = { ...criarInstalarFixture(true), enviarParaComputador: async () => ({ ok: false, mensagem: 'Espere uns minutos.', limite: true }) }
  render(<Instalar api={api} token={T} />)
  await userEvent.click(await screen.findByRole('button', { name: /Enviar para o meu computador/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Espere uns minutos.')
})

test('computador, instalador ainda não publicado: acesso liberado, sem link nem botão de download inventado', async () => {
  const { container } = render(<Instalar api={criarInstalarFixture(false)} token={T} />)
  expect(await screen.findByRole('heading', { name: /acesso está liberado/ })).toBeInTheDocument()
  expect(screen.getByTestId('download-pendente')).toHaveTextContent(/ainda não está disponível/)
  expect(screen.queryByRole('button')).toBeNull()
  expect(container.querySelector('a[download], a[href$=".exe"]')).toBeNull()
})

test('adaptador: 429 vira limite e sem servidor responde com honestidade', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify({ mensagem: 'Muitas.' }), { status: 429 })) as unknown as typeof fetch
  const api = criarInstalarApi({ api: 'https://x.test' }, f)
  expect(await api.enviarParaComputador(T)).toMatchObject({ ok: false, limite: true })
  expect(await criarInstalarApi(null).abrir(T)).toMatchObject({ ok: false })
})

// ---- baixar o instalador -----------------------------------------------------------------------------------------------------

const comInstalador = (extra: Partial<InstalarApi> = {}): InstalarApi => ({
  ...criarInstalarFixture(false),
  abrir: async () => ({ ok: true, celular: false, aviso: null, podeReenviar: false, expiraEm: null, instalador: true }),
  ...extra,
})

test('computador com instalador publicado: o botão pede o endereço e começa o download', async () => {
  const baixar = vi.fn(async () => ({ ok: true as const, url: 'https://arquivos.test/Atlas-Instalador.exe?assinatura=1' }))
  const ir = vi.fn()
  render(<Instalar api={comInstalador({ baixar })} token={T} ir={ir} />)
  expect(screen.queryByTestId('download-pendente')).toBeNull()
  await userEvent.click(await screen.findByRole('button', { name: /Baixar o Atlas para Windows/ }))
  expect(baixar).toHaveBeenCalledWith(T, 'windows')
  expect(ir).toHaveBeenCalledWith('https://arquivos.test/Atlas-Instalador.exe?assinatura=1')
  expect(await screen.findByRole('status')).toHaveTextContent(/download começou/)
})

test('são só dois passos: baixar e abrir o arquivo; ninguém precisa voltar à página', async () => {
  render(<Instalar api={comInstalador()} token={T} ir={vi.fn()} />)
  // Só os passos de fora: o aviso do Windows, dentro do passo 2, tem a sua própria listinha.
  const passos = [...(await screen.findByRole('list', { name: 'Passos para instalar' })).querySelectorAll(':scope > li')]
  expect(passos).toHaveLength(2)
  expect(passos[1]).toHaveTextContent(/Abra o arquivo que você baixou/)
  expect(passos[1]).toHaveTextContent(/O Atlas abre sozinho e segue com você dali/)
  expect(screen.queryByText(/Volte aqui/)).toBeNull()
})

test('reserva para quem mudou o nome do arquivo: o link de liberar fica guardado, fora dos passos', async () => {
  render(<Instalar api={comInstalador()} token={T} ir={vi.fn()} />)
  const reserva = await screen.findByText('O Atlas pediu para liberar este computador?')
  await userEvent.click(reserva)
  expect(screen.getByRole('link', { name: /Liberar o Atlas neste computador/ })).toHaveAttribute('href', `atlas://ativar?t=${T}`)
})

test('o servidor não entregou o arquivo: recado honesto, nada é baixado e dá para tentar de novo', async () => {
  const ir = vi.fn()
  const api = comInstalador({ baixar: async () => ({ ok: false, mensagem: 'O instalador ainda não está disponível para baixar.' }) })
  render(<Instalar api={api} token={T} ir={ir} />)
  await userEvent.click(await screen.findByRole('button', { name: /Baixar o Atlas para Windows/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('O instalador ainda não está disponível para baixar.')
  expect(ir).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Baixar o Atlas para Windows/ })).toBeEnabled()
})

test('no celular não aparece botão de baixar, mesmo com o instalador publicado', async () => {
  const api = comInstalador({ abrir: async () => ({ ok: true, celular: true, aviso: 'Abra no computador.', podeReenviar: true, expiraEm: null, instalador: true }) })
  render(<Instalar api={api} token={T} />)
  expect(await screen.findByRole('button', { name: /Enviar para o meu computador/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Baixar o Atlas para Windows/ })).toBeNull()
})

test('adaptador: /instalar/abrir informa o instalador e /instalar/baixar só aceita endereço https', async () => {
  const respostas: Record<string, unknown> = {
    '/instalar/abrir': { valido: true, celular: false, aviso: null, pode_reenviar: false, expira_em: null, instalador: true },
    '/instalar/baixar': { url: 'https://arquivos.test/a.exe' },
  }
  const f = vi.fn(async (u: string) => new Response(JSON.stringify(respostas[u.replace('https://x.test', '')]), { status: 200 })) as unknown as typeof fetch
  const api = criarInstalarApi({ api: 'https://x.test' }, f)
  expect(await api.abrir(T)).toMatchObject({ ok: true, instalador: true })
  expect(await api.baixar(T)).toEqual({ ok: true, url: 'https://arquivos.test/a.exe' })
  respostas['/instalar/baixar'] = { url: 'javascript:alert(1)' }
  expect(await api.baixar(T)).toMatchObject({ ok: false })
  expect(await criarInstalarApi(null).baixar(T)).toMatchObject({ ok: false })
})

test('avisa antes da tela azul do Windows, com os dois cliques que o cliente vai dar', async () => {
  render(<Instalar api={comInstalador()} token={T} ir={vi.fn()} />)
  const aviso = await screen.findByRole('note', { name: 'Aviso do Windows' })
  expect(aviso).toHaveTextContent('O Windows vai pedir uma confirmação')
  expect(aviso).toHaveTextContent('O Windows protegeu o computador')
  expect(aviso).toHaveTextContent('Mais informações')
  expect(aviso).toHaveTextContent('Executar assim mesmo')
})

// ---- M47: a página reconhece o computador (Mac e Windows) --------------------------------------------------------------------

const comDois = (extra: Partial<InstalarApi> = {}): InstalarApi => comInstalador({
  abrir: async () => ({ ok: true, celular: false, aviso: null, podeReenviar: false, expiraEm: null, instalador: true, instaladorMac: true }),
  ...extra,
})

test('Mac: a página já diz que é Mac e o botão baixa o arquivo do Mac (ninguém escolhe nada)', async () => {
  const baixar = vi.fn(async () => ({ ok: true as const, url: 'https://arquivos.test/Atlas.dmg?assinatura=1' }))
  render(<Instalar api={comDois({ baixar })} token={T} ir={vi.fn()} sistemaInicial="mac" />)
  expect(await screen.findByTestId('sistema-reconhecido')).toHaveTextContent('Mac')
  expect(screen.queryByRole('note', { name: 'Aviso do Windows' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Baixar o Atlas para Mac/ }))
  expect(baixar).toHaveBeenCalledWith(T, 'mac')
})

test('Mac depois de baixar: arrastar para Aplicativos e "Já arrastei: abrir o Atlas" leva o código pelo atlas://', async () => {
  render(<Instalar api={comDois({ baixar: async () => ({ ok: true as const, url: 'https://arquivos.test/Atlas.dmg' }) })} token={T} ir={vi.fn()} sistemaInicial="mac" />)
  await userEvent.click(await screen.findByRole('button', { name: /Baixar o Atlas para Mac/ }))
  expect(await screen.findByText(/Arraste o Atlas para a pasta Aplicativos/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Já arrastei: abrir o Atlas/ })).toHaveAttribute('href', `atlas://ativar?t=${T}`)
  expect(screen.getByText(/clique em/)).toHaveTextContent(/Abrir/)
})

test('"Não é um Mac?" troca para o Windows (e vice-versa) sem recarregar', async () => {
  const baixar = vi.fn(async () => ({ ok: true as const, url: 'https://arquivos.test/x.exe' }))
  render(<Instalar api={comDois({ baixar })} token={T} ir={vi.fn()} sistemaInicial="mac" />)
  await userEvent.click(await screen.findByRole('button', { name: /Não é um Mac\? Baixar para Windows/ }))
  expect(screen.getByTestId('sistema-reconhecido')).toHaveTextContent('Windows')
  await userEvent.click(screen.getByRole('button', { name: /Baixar o Atlas para Windows/ }))
  expect(baixar).toHaveBeenCalledWith(T, 'windows')
})

test('Mac sem o arquivo publicado ainda: recado honesto e o caminho do Windows à mão', async () => {
  render(<Instalar api={comInstalador()} token={T} ir={vi.fn()} sistemaInicial="mac" />)
  expect(await screen.findByText(/versão do Atlas para Mac fica pronta em breve/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Baixar o Atlas para Mac/ })).toBeNull()
  expect(screen.getByRole('button', { name: /Baixar para Windows/ })).toBeInTheDocument()
})

// ---- M31: a página de instalação em inglês (o link do e-mail em inglês traz ?idioma=en) -----------------------------------
test('em inglês: Windows reconhecido, botão de baixar e aviso da tela azul em inglês, sem português', async () => {
  const { container } = render(<Instalar api={comInstalador()} token={T} idioma="en" sistemaInicial="windows" />)
  expect(await screen.findByRole('heading', { name: 'Your access is ready!' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Download Atlas for Windows/ })).toBeInTheDocument()
  expect(screen.getByRole('note', { name: 'Windows notice' })).toHaveTextContent('Windows protected your PC')
  expect(container.textContent).not.toMatch(/[ãõçáéíóúâêô]/)
})
