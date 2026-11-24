import { recadoDoErroAprovar } from './Aprovar'

test('erros conhecidos de "Começar a obra" ganham recado claro', () => {
  expect(recadoDoErroAprovar(new Error('claude-falhou'))).toMatch(/O Claude não respondeu/)
  expect(recadoDoErroAprovar(new Error('plano-invalido'))).toMatch(/não consegui ler o plano/i)
  expect(recadoDoErroAprovar(new Error('kit-indisponivel'))).toMatch(/instruções da obra/)
  expect(recadoDoErroAprovar(new Error('sem-etapas'))).toMatch(/plano da obra ainda não ficou pronto/)
})

test('erro desconhecido mostra um código curto, para uma foto da tela dizer o que houve', () => {
  expect(recadoDoErroAprovar(new Error('EPERM: operation not permitted, open C:\\x'))).toBe('Não consegui começar a obra agora. Tente de novo em instantes. (código: EPERM)')
  expect(recadoDoErroAprovar(new Error('kit-faltando'))).toBe('Não consegui começar a obra agora. Tente de novo em instantes. (código: kit-faltando)')
  expect(recadoDoErroAprovar('x')).toBe('Não consegui começar a obra agora. Tente de novo em instantes.')
})
