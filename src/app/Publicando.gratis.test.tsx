import { screen, waitFor } from '@testing-library/react'
import { clicar, montar, passoDe, quem } from './publicando-teste'

test('endereço grátis: 5 passos, cada um mostra quem faz; o Atlas publica e só então libera o passo', async () => {
  const { pub, onConcluir } = montar({ gratis: true })
  expect(await passoDe(1, 5)).toBeInTheDocument()
  expect(await quem()).toBe('O ATLAS')
  await clicar('Continuar →')
  expect(await passoDe(2, 5)).toBeInTheDocument()
  expect(await quem()).toBe('VOCÊ')
  await clicar('Fiz isso →')
  expect(await passoDe(3, 5)).toBeInTheDocument()
  expect(await quem()).toBe('O ATLAS')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No ar: cadeira1.vercel.app'))
  expect(pub.publicados).toEqual(['cadeira1'])
  await clicar('Continuar →')
  expect(await quem()).toBe('VOCÊ')
  await clicar('Fiz isso →')
  expect(await passoDe(5, 5)).toBeInTheDocument()
  expect(screen.getByText(/cadeira1.vercel.app está no ar/)).toBeInTheDocument()
  await clicar('Ver a entrega das chaves →')
  expect(onConcluir).toHaveBeenCalled()
})

test('se publicar falhar, avisa com calma, não libera o passo e deixa tentar de novo', async () => {
  const { pub } = montar({ gratis: true })
  pub.simular.falharPublicacao(true)
  await clicar('Continuar →'); await clicar('Fiz isso →')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Não consegui colocar no ar agora/))
  expect(screen.getByRole('button', { name: 'Continuar →' })).toBeDisabled()
  pub.simular.falharPublicacao(false)
  await clicar('Tentar de novo')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar →' })).toBeEnabled())
})

test('"Não consegui" abre a Ajuda do Atlas com o print do passo; voltar funciona', async () => {
  const { onPedirAjuda } = montar({ gratis: true })
  await clicar('Continuar →')
  await clicar('Não consegui fazer este passo')
  expect(onPedirAjuda).toHaveBeenCalledWith({ origem: 'F13b', conta: 'Endereço grátis', passo: 2, totalPassos: 5, print: { url: 'vercel.com', titulo: 'Endereço do sistema', botaoCerto: 'cadeira1.vercel.app' } })
  await clicar('← Voltar')
  expect(await passoDe(1, 5)).toBeInTheDocument()
})

test('app instalável: 5 passos, iPhone/Android traduzidos e o Atlas gera o cartaz com QR; o grátis vem antes', async () => {
  const { pub } = montar({ pwa: true })
  // o endereço grátis é a base: o guia dele vem primeiro
  expect(await screen.findAllByRole('button', { name: /Endereço grátis|App instalável/ })).toHaveLength(2)
  await clicar(/App instalável/)
  expect(await passoDe(1, 5)).toBeInTheDocument()
  await clicar('Continuar →')
  expect(screen.getByText('Install app')).toBeInTheDocument()
  expect(await quem()).toBe('VOCÊ')
  await clicar('Fiz isso →')
  expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
  await clicar('Fiz isso →')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cartaz pronto na pasta da obra: cartaz-instalar-app.pdf'))
  expect(pub.cartazes).toEqual(['cadeira1.vercel.app'])
  await clicar('Continuar →')
  expect(await passoDe(5, 5)).toBeInTheDocument()
})

test('continua do passo em que parou quando o cliente volta', async () => {
  const { pub } = montar({ gratis: true })
  await clicar('Continuar →')
  await passoDe(2, 5)
  await waitFor(async () => expect(await pub.lerProgresso('C:/Atlas/Obras/cadeira1')).toEqual({ guia: 'gratis', passo: 1 }))
  document.body.innerHTML = ''
  montar({ gratis: true }, pub)
  expect(await passoDe(2, 5)).toBeInTheDocument()
})
