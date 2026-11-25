import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Admin } from './Admin'
import { criarAdminFixture } from './admin-fixture'

describe('aba Política (o Atlas não constrói outro Atlas)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

  it('lista o caso embargado com o que o cliente pediu e a explicação dele', async () => {
    render(<TemaProvider><Admin api={criarAdminFixture()} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('link', { name: 'Política' }))
    const casos = await screen.findByRole('region', { name: 'Casos' })
    const caso = within(casos).getByRole('article', { name: /Paulo R\./ })
    expect(within(caso).getByText(/receba ideias e use agentes/)).toBeInTheDocument()
    expect(within(caso).getByText(/gerador de orçamentos/)).toBeInTheDocument()
    expect(within(caso).getByText('Embargada')).toBeInTheDocument()
  })

  it('a equipe decide: liberar muda a situação do caso', async () => {
    render(<TemaProvider><Admin api={criarAdminFixture()} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('link', { name: 'Política' }))
    const casos = await screen.findByRole('region', { name: 'Casos' })
    await userEvent.click(within(casos).getByRole('button', { name: 'Liberar a obra de Paulo R.' }))
    expect(await screen.findByText(/Pronto, obra liberada/)).toBeInTheDocument()
    expect(within(casos).getByText('Liberada')).toBeInTheDocument()
  })

  it('recusar o uso pede confirmação antes', async () => {
    const api = criarAdminFixture()
    const espia = vi.spyOn(api, 'decidirPolitica')
    render(<TemaProvider><Admin api={api} /></TemaProvider>)
    await userEvent.click(await screen.findByRole('link', { name: 'Política' }))
    const casos = await screen.findByRole('region', { name: 'Casos' })
    await userEvent.click(within(casos).getByRole('button', { name: 'Recusar o uso de Paulo R.' }))
    expect(espia).not.toHaveBeenCalled()
    await userEvent.click(within(casos).getByRole('button', { name: 'Sim, recusar o uso' }))
    expect(espia).toHaveBeenCalledWith('lic-0042', 'fabrica-de-apps', 'recusar')
  })
})
