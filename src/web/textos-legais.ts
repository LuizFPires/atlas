// Textos legais servidos no site. O conteúdo vem de docs/legal/*.md (o texto jurídico é do advogado/usuário).
import privacidade from '../../docs/legal/politica-de-privacidade.md?raw'
import termos from '../../docs/legal/termos-de-uso.md?raw'
import licenca from '../../docs/legal/licenca-de-uso.md?raw'
// M31: tradução em inglês (em revisão jurídica; o original em português prevalece, e o próprio texto avisa).
import privacyEn from '../../docs/legal/en/privacy-policy.md?raw'
import termsEn from '../../docs/legal/en/terms-of-use.md?raw'
import licenseEn from '../../docs/legal/en/software-license.md?raw'

/** Versão dos termos que o cliente aceita. Mude junto com o "Versão x.y" dos textos em docs/legal. */
export const VERSAO_TERMOS = '1.2'

export type IdLegal = 'privacidade' | 'termos' | 'licenca'
export const DOCS_LEGAIS: Record<IdLegal, { caminho: string; titulo: string; md: string }> = {
  privacidade: { caminho: '/privacidade', titulo: 'Política de Privacidade', md: privacidade },
  termos: { caminho: '/termos', titulo: 'Termos de Uso', md: termos },
  licenca: { caminho: '/licenca', titulo: 'Licença de Uso do Software', md: licenca },
}

export const DOCS_LEGAIS_EN: Record<IdLegal, { caminho: string; titulo: string; md: string }> = {
  privacidade: { caminho: '/en/privacy', titulo: 'Privacy Policy', md: privacyEn },
  termos: { caminho: '/en/terms', titulo: 'Terms of Use', md: termsEn },
  licenca: { caminho: '/en/license', titulo: 'Software License', md: licenseEn },
}

/** Os textos legais no idioma da página. */
export const docsLegais = (idioma: 'pt' | 'en' = 'pt') => (idioma === 'en' ? DOCS_LEGAIS_EN : DOCS_LEGAIS)

export const idLegalDoCaminho = (caminho: string): IdLegal | null =>
  (Object.keys(DOCS_LEGAIS) as IdLegal[]).find((k) => DOCS_LEGAIS[k].caminho === caminho || DOCS_LEGAIS_EN[k].caminho === caminho) ?? null

export const idiomaLegalDoCaminho = (caminho: string): 'pt' | 'en' => (caminho.startsWith('/en/') ? 'en' : 'pt')
