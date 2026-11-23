import { textoDoPlano } from './plano-no-menu'

// Cartão "Plano Claude" do menu: só o que o app lê de verdade (pedido do Luiz, 22/11/2026: o cartão era texto fixo do protótipo).
test('mostra a assinatura que o Claude informa, com a primeira letra maiúscula', () => {
  expect(textoDoPlano({ conectado: true, plano: 'pro', assinatura: 'pro' })).toEqual({ valor: 'Pro', sub: 'Conectado neste computador' })
  expect(textoDoPlano({ conectado: true, assinatura: 'ultra' })).toEqual({ valor: 'Ultra', sub: 'Conectado neste computador' })
})

test('conectado sem saber o plano: não inventa', () => {
  expect(textoDoPlano({ conectado: true })).toEqual({ valor: 'Conectado', sub: 'Conectado neste computador' })
})

test('desconectado ou sem leitura: diz isso, sem cota nem horário inventados', () => {
  expect(textoDoPlano({ conectado: false })).toEqual({ valor: 'Não conectado', sub: 'Conecte o Claude para construir' })
  expect(textoDoPlano(null)).toBeNull()
})
