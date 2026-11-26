// Idioma do Atlas (M31, Luiz em 26/11/2026): português (Brasil) ou inglês (EUA). Na página de vendas, a escolha guardada
// pela bandeirinha vence; sem escolha, o endereço decide (/en ou o domínio de fora). Depois da compra o idioma não muda mais.

export type Idioma = 'pt' | 'en'
export type Dicionario<T> = { pt: T; en: T }

/** Domínio do Atlas para fora do Brasil (comprado pelo Luiz em 26/11/2026). */
export const DOMINIO_FORA = 'use-atlas-ai.com'
/** Cookie da bandeirinha. */
export const COOKIE_IDIOMA = 'atlas_idioma'

const ehIdioma = (v: unknown): v is Idioma => v === 'pt' || v === 'en'

export function idiomaDaPagina(o: { caminho: string; host: string; cookie: string | null }): Idioma {
  if (ehIdioma(o.cookie)) return o.cookie
  const host = o.host.toLowerCase()
  if (host === DOMINIO_FORA || host === `www.${DOMINIO_FORA}`) return 'en'
  return /^\/en(\/|$)/.test(o.caminho) ? 'en' : 'pt'
}

/** Valor inteiro em reais ou dólares, no formato de cada país: R$ 4.800 / $1,700. */
export function dinheiro(centavos: number, idioma: Idioma): string {
  const inteiro = Math.round(centavos / 100)
  return idioma === 'en' ? `$${inteiro.toLocaleString('en-US')}` : `R$ ${inteiro.toLocaleString('pt-BR')}`
}

/** Lê o cookie da bandeirinha (sem quebrar onde não há document). */
export function lerCookieIdioma(): Idioma | null {
  try {
    const m = /(?:^|;\s*)atlas_idioma=(pt|en)(?:;|$)/.exec(document.cookie)
    return m ? (m[1] as Idioma) : null
  } catch { return null }
}

/** Guarda a escolha da bandeirinha por 1 ano, no site todo. */
export function guardarIdioma(i: Idioma) {
  try { document.cookie = `${COOKIE_IDIOMA}=${i}; Path=/; Max-Age=31536000; SameSite=Lax` } catch { /* sem cookie: vale só nesta visita */ }
}
