import { screen } from '@testing-library/react'
import { clicar, montar, passoDe, quem } from './publicando-teste'
import { guiaLojas } from './publicar-passos'

const ctx = { obra: 'Cadeira 1', slug: 'cadeira1', endereco: 'cadeira1.vercel.app', dominio: 'cadeira1.com.br', dns: null }

test('lojas: 13 passos, cada um com VOCÊ ou O ATLAS, na ordem do protótipo', () => {
  const g = guiaLojas(ctx)
  expect(g.passos).toHaveLength(13)
  expect(g.passos.map((p) => (p.quem === 'voce' ? 'V' : 'A')).join('')).toBe('AVVAVVAVVVVAA')
})

test('INVARIANTE: pagamento e "Enviar para revisão" são do cliente; o Atlas nunca faz esses passos', () => {
  const g = guiaLojas(ctx)
  const revisao = g.passos.find((p) => p.en === 'Submit for Review')
  expect(revisao?.quem).toBe('voce')
  expect(revisao?.pt).toBe('Enviar para revisão')
  for (const p of g.passos.filter((x) => /Custa US\$|taxa|pague|Pix/.test(x.faca + x.calma))) expect(p.quem).toBe('voce')
  // nenhum passo do Atlas diz que ele paga, cria conta, digita senha ou envia para revisão
  for (const p of g.passos.filter((x) => x.quem === 'atlas')) expect(p.faca).not.toMatch(/\b(paga|pago|cria a sua conta|digita|aperta|enviar para revis|envia para revis)/i)
  // login da Apple: quem entra é o cliente, o Atlas não guarda
  const login = g.passos.find((p) => /Apple ID/.test(p.faca) && !p.abre)
  expect(login?.quem).toBe('voce')
  expect(login?.calma).toMatch(/não vê nem guarda/)
})

test('sites em inglês vêm traduzidos', () => {
  const g = guiaLojas(ctx)
  const traducao = Object.fromEntries(g.passos.filter((p) => p.en).map((p) => [p.en, p.pt]))
  expect(traducao).toEqual({ 'Start Your Enrollment': 'Começar a inscrição', 'Create account': 'Criar conta', 'New App': 'Novo app', 'Submit for Review': 'Enviar para revisão' })
})

test('lojas na tela: passa pelos 13 passos, abre só os sites oficiais e o último passo leva à entrega', async () => {
  const { pub, onConcluir, onPedirAjuda } = montar({ lojas: true })
  await clicar(/App Store e Google Play/)
  expect(await passoDe(1, 13)).toBeInTheDocument()
  expect(await quem()).toBe('O ATLAS')
  await clicar('Continuar →')
  expect(screen.getByText('Start Your Enrollment', { selector: 'b' })).toBeInTheDocument()
  expect(await quem()).toBe('VOCÊ')
  await clicar('Abrir o site →')
  await clicar('Abrir o site →')
  await clicar('Continuar →')
  await clicar('Abrir o site →')
  await clicar('Fiz isso →')
  await clicar('Continuar →')
  await clicar('Abrir o site →')
  await clicar('Fiz isso →')
  await clicar('Fiz isso →')
  expect(await passoDe(11, 13)).toBeInTheDocument()
  expect(screen.getByText('Submit for Review', { selector: 'b' })).toBeInTheDocument()
  expect(screen.getByText(/Enviar para revisão/, { selector: 'b' })).toBeInTheDocument()
  await clicar('Não consegui fazer este passo')
  expect(onPedirAjuda).toHaveBeenCalledWith(expect.objectContaining({ origem: 'F13b', conta: 'App Store e Google Play', passo: 11, totalPassos: 13 }))
  await clicar('Fiz isso →')
  expect(await passoDe(12, 13)).toBeInTheDocument()
  await clicar('Continuar →')
  expect(await passoDe(13, 13)).toBeInTheDocument()
  expect(pub.abertos.map((a) => a.destino)).toEqual(['apple-inscricao', 'google-console', 'app-store-connect', 'testflight'])
  await clicar('Ver a entrega das chaves →')
  expect(onConcluir).toHaveBeenCalled()
})

test('dados para copiar do App Store Connect (nome e identificador do app)', async () => {
  montar({ lojas: true })
  await clicar(/App Store e Google Play/)
  for (let i = 0; i < 3; i++) { await clicar(i === 0 ? 'Continuar →' : 'Abrir o site →') }
  await clicar('Continuar →')
  expect(await passoDe(5, 13)).toBeInTheDocument()
  expect(screen.getByText('br.com.cadeira1.app')).toBeInTheDocument()
})
