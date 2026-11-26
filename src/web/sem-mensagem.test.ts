import { expect, test } from 'vitest'
import { semMensagem } from './sem-mensagem'

test('retorno sem mensagem do servidor ainda diz o que houve, o que fazer e o código', () => {
  expect(semMensagem(500)).toMatch(/teve um problema.*Tente de novo em alguns minutos.*código 500/)
  expect(semMensagem(429)).toMatch(/Espere uns 10 minutos/)
  expect(semMensagem(400)).toMatch(/não aceitou o pedido \(código 400\).*Confira/)
})
