// @vitest-environment node
// Luiz, 26/11/2026: o link de instalação saiu como atlas-ia-plum.vercel.app (o segredo ATLAS_INSTALAR_URL ainda apontava para o
// endereço provisório da Vercel). Link que vai para o cliente usa sempre o domínio próprio.
import { expect, it } from 'vitest'
import { urlPublica } from '../functions/_shared/url-publica.ts'

it('endereço provisório da Vercel (ou vazio/inválido) vira o domínio próprio; domínio próprio configurado é respeitado', () => {
  const padrao = 'https://atlas-ia.app.br/instalar'
  expect(urlPublica('https://atlas-ia-plum.vercel.app/instalar', padrao)).toBe(padrao)
  expect(urlPublica(undefined, padrao)).toBe(padrao)
  expect(urlPublica('', padrao)).toBe(padrao)
  expect(urlPublica('http://atlas-ia.app.br/instalar', padrao)).toBe(padrao)
  expect(urlPublica('nao é url', padrao)).toBe(padrao)
  expect(urlPublica('https://www.atlas-ia.app.br/instalar/', padrao)).toBe('https://www.atlas-ia.app.br/instalar')
})
