// Textos e regras de F06bEstilo (prototipo/F06bEstilo.dc.html, nota u06b).

export const SENTIMENTOS = ['Confiança', 'Tradição', 'Elegância', 'Alegria', 'Rapidez', 'Modernidade'] as const

export const FASES = [
  { n: '1', nome: 'Estilo' },
  { n: '2', nome: 'Telas' },
  { n: '3', nome: 'Nome e marca' },
] as const

export const MAX_REFERENCIAS = 3
// 23/11/2026 (Luiz): "Referência pode deixar com pelo menos uma".
export const MIN_REFERENCIAS = 1

export const MODOS = [
  { id: 'criar', nome: 'Me ajude a criar' },
  { id: 'tenho', nome: 'Já tenho a minha identidade visual' },
] as const

export const UPLOADS = [
  { id: 'logo', icone: 'imagem', nome: 'Logomarca', desc: 'PNG, JPG, WebP ou PDF' },
  { id: 'cores', icone: 'paleta', nome: 'Cores', desc: 'Os códigos das cores ou uma foto da fachada' },
  { id: 'manual', icone: 'livro', nome: 'Manual da marca ou design system pronto', desc: 'PDF, link do Figma ou o arquivo design-system.md que outra IA gerou' },
] as const

/**
 * Deixa um link colado em forma de endereço seguro, ou devolve null.
 * Só http/https com ponto no endereço ("aesop.com" vira "https://aesop.com/"). O app nunca abre este link sozinho.
 */
// Rastreio de anúncio e de rede social: não muda a página, só aumenta o link.
const RASTREIO = /^(utm_.*|fbclid|gclid|gbraid|wbraid|msclkid|dclid|igshid|mc_cid|mc_eid|_hs.*|ttclid|twclid|li_fat_id|yclid|ref_src)$/i

export function normalizarLink(texto: string): string | null {
  const t = texto.trim().replace(/\s+/g, '')
  if (!t || t.length > 4000) return null
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(comEsquema)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.') || u.username || u.password) return null
    for (const k of [...u.searchParams.keys()]) if (RASTREIO.test(k)) u.searchParams.delete(k)
    u.hash = ''
    let final = u.toString()
    // Mesmo limpo, longo demais: para referência de estilo basta o endereço da página.
    if (final.length > 300) { u.search = ''; final = u.toString() }
    return final.length > 300 ? null : final
  } catch { return null }
}

/** O que mostrar na linha do link: "aesop.com" (sem www e sem barra no fim). */
export const linkCurto = (link: string) => {
  try {
    const u = new URL(link)
    const r = `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`
    return r.length > 48 ? `${r.slice(0, 47)}…` : r
  } catch { return link }
}
