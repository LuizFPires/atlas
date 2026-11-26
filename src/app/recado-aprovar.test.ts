import { recadoDoErroAprovar } from './Aprovar'

test('erros conhecidos de "Começar a obra" ganham recado claro', () => {
  expect(recadoDoErroAprovar(new Error('claude-falhou'))).toMatch(/O Claude não respondeu/)
  expect(recadoDoErroAprovar(new Error('plano-invalido'))).toMatch(/não consegui ler o plano/i)
  expect(recadoDoErroAprovar(new Error('kit-indisponivel'))).toMatch(/instruções da obra/)
  expect(recadoDoErroAprovar(new Error('sem-etapas'))).toMatch(/plano da obra ainda não ficou pronto/)
})

test('erro do Windows ou código sem recado próprio: explica o que houve, o que fazer e mostra o código curto (nunca o caminho)', () => {
  const eperm = recadoDoErroAprovar(new Error('EPERM: operation not permitted, open C:\\x'))
  expect(eperm).toMatch(/^Não consegui começar a obra\. O Windows não deixou mexer num arquivo da obra.*Feche a pasta da obra.*\(código: EPERM\)$/)
  expect(eperm).not.toMatch(/C:/)
  expect(recadoDoErroAprovar(new Error('kit-faltando'))).toMatch(/instruções de construção do Atlas não chegaram.*Confira a internet.*\(código: kit-faltando\)$/)
  expect(recadoDoErroAprovar('x')).toMatch(/^Não consegui começar a obra\. Isso é um defeito do Atlas.*Falar com o Atlas/)
})
