import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { AppDesktop } from './AppDesktop'
import { CHAVE_COFRE } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'
import { criarLicencaFixture, criarPosObraFixture } from './ponte-posobra'
import { OBRA_PARADA_EXEMPLO, criarRetomarFixture } from './ponte-retomar'

test('no app: "Pedir mudança" dentro da obra usa a obra aberta, pede licença e roda só com ela em dia', async () => {
  const user = userEvent.setup()
  const cofre = criarCofreMemoria({ [CHAVE_COFRE]: JSON.stringify({ token: 't', email: 'ze@x.com', nome: 'Zé' }) })
  const posobra = criarPosObraFixture()
  const licenca = criarLicencaFixture('pausada')
  render(<TemaProvider><AppDesktop ponte={criarPonteFixture(['--tela=F12'], cofre)} retomar={criarRetomarFixture(OBRA_PARADA_EXEMPLO)} posobra={posobra} licenca={licenca} /></TemaProvider>)
  await user.click(await screen.findByRole('button', { name: 'Continuar obra' }))
  await user.click(await screen.findByRole('tab', { name: 'Pedir mudança' }))
  await user.type(await screen.findByRole('textbox'), 'Trocar a cor do botão')
  await user.click(screen.getByRole('button', { name: 'Enviar para o Claude' }))
  await user.click(await screen.findByRole('button', { name: 'Pode fazer' }))
  expect((await screen.findByRole('status')).textContent).toMatch(/licença precisa estar em dia/)
  expect(posobra.executados).toHaveLength(0)
  licenca.motivo = null
  await user.click(screen.getByRole('button', { name: 'Pode fazer' }))
  expect(await screen.findByText(/Combinado! Comecei/)).toBeInTheDocument()
  expect(posobra.executados).toHaveLength(1)
})
