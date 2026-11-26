import { DOCS_LEGAIS, VERSAO_TERMOS } from './textos-legais'

// Trava da entrega (decisão do Luiz, 22/11/2026): os Termos explicam que a publicação libera a partir do 8º dia.
test('os Termos explicam a entrega em produção a partir do 8º dia e que o teste grátis não publica', () => {
  const t = DOCS_LEGAIS.termos.md
  expect(t).toMatch(/3\.3\. .*prévia.*a partir do 8º \(oitavo\) dia/s)
  expect(t).toMatch(/teste grátis.*não inclui a entrega em produção/s)
})

test('mudou o texto, mudou a versão: a versão aceita na compra é a mesma escrita nos Termos', () => {
  expect(VERSAO_TERMOS).toBe('1.2')
  expect(DOCS_LEGAIS.termos.md).toContain(`**Versão ${VERSAO_TERMOS} ·`)
})

// M65 (Luiz, 25/11/2026): o Atlas não constrói outro Atlas. Os Termos dizem o que é proibido e o que acontece (embargo → análise).
test('os Termos proíbem criar um sistema que constrói sistemas e explicam o embargo da obra e a análise da equipe', () => {
  const t = DOCS_LEGAIS.termos.md
  expect(t).toMatch(/sistema que constrói sistemas/)
  expect(t).toMatch(/chatbots?, aplicativos? ou sites? que usam inteligência artificial.*permitid/is)
  expect(t).toMatch(/embargad/)
  expect(t).toMatch(/a decisão é sempre da equipe/i)
})
