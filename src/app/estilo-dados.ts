// Textos e regras de F06bEstilo (prototipo/F06bEstilo.dc.html, nota u06b).

export const SENTIMENTOS = ['Confiança', 'Tradição', 'Elegância', 'Alegria', 'Rapidez', 'Modernidade'] as const

export const FASES = [
  { n: '1', nome: 'Estilo' },
  { n: '2', nome: 'Telas' },
  { n: '3', nome: 'Nome e marca' },
] as const

export const MAX_REFERENCIAS = 3
export const MIN_REFERENCIAS = 2

export const MODOS = [
  { id: 'criar', nome: 'Me ajude a criar' },
  { id: 'tenho', nome: 'Já tenho a minha identidade visual' },
] as const

export const UPLOADS = [
  { id: 'logo', icone: 'imagem', nome: 'Logomarca', desc: 'PNG, SVG ou PDF' },
  { id: 'cores', icone: 'paleta', nome: 'Cores', desc: 'Os códigos das cores ou uma foto da fachada' },
  { id: 'manual', icone: 'livro', nome: 'Manual da marca ou design system pronto', desc: 'PDF, link do Figma ou o arquivo design-system.md que outra IA gerou' },
] as const

/**
 * Deixa um link colado em forma de endereço seguro, ou devolve null.
 * Só http/https com ponto no endereço ("aesop.com" vira "https://aesop.com/"). O app nunca abre este link sozinho.
 */
export function normalizarLink(texto: string): string | null {
  const t = texto.trim().replace(/\s+/g, '')
  if (!t || t.length > 300) return null
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(comEsquema)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.') || u.username || u.password) return null
    return u.toString()
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
