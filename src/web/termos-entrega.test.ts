import { DOCS_LEGAIS, VERSAO_TERMOS } from './textos-legais'

// Trava da entrega (decisão do Luiz, 22/11/2026): os Termos explicam que a publicação libera a partir do 8º dia.
test('os Termos explicam a entrega em produção a partir do 8º dia e que o teste grátis não publica', () => {
  const t = DOCS_LEGAIS.termos.md
  expect(t).toMatch(/3\.3\. .*prévia.*a partir do 8º \(oitavo\) dia/s)
  expect(t).toMatch(/teste grátis.*não inclui a entrega em produção/s)
})

test('mudou o texto, mudou a versão: a versão aceita na compra é a mesma escrita nos Termos', () => {
  expect(VERSAO_TERMOS).toBe('1.1')
  expect(DOCS_LEGAIS.termos.md).toContain(`**Versão ${VERSAO_TERMOS} ·`)
})
