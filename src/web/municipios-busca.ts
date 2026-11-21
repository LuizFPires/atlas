// Busca de município para o cadastro. A base (IBGE, ~5570 municípios) só é baixada no primeiro foco/dígito do campo.
export interface Municipio { nome: string; uf: string }

export const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

interface Indexado extends Municipio { n: string }
let cache: Promise<Indexado[]> | null = null

/** Carrega a base sob demanda (dynamic import) e guarda na memória. */
export function carregarMunicipios(): Promise<Indexado[]> {
  cache ??= import('./municipios-br').then(({ MUNICIPIOS_TXT }) =>
    MUNICIPIOS_TXT.split('\n').map((l) => { const [nome, uf] = l.split('|'); return { nome, uf, n: normalizar(nome) } }))
  return cache
}

/** Melhores correspondências: nome que começa com o termo primeiro, depois os que contêm. "sao paulo sp" também vale. */
export function buscarMunicipios(base: Municipio[], termo: string, limite = 8): Municipio[] {
  let t = normalizar(termo.replace(/[–—-]\s*[A-Za-z]{2}\s*$/, ' ' + (termo.match(/[–—-]\s*([A-Za-z]{2})\s*$/)?.[1] ?? '')))
  if (!t) return []
  let uf = ''
  const m = t.match(/^(.*\S)\s+([a-z]{2})$/)
  if (m && (base as Indexado[]).some((c) => c.uf.toLowerCase() === m[2])) { /* só trata como UF se a cidade existir com esse sufixo */
    const resto = m[1]
    if ((base as Indexado[]).some((c) => (c.n ?? normalizar(c.nome)).startsWith(resto))) { t = resto; uf = m[2] }
  }
  const ini: Municipio[] = [], meio: Municipio[] = []
  for (const c of base as Indexado[]) {
    if (uf && c.uf.toLowerCase() !== uf) continue
    const n = c.n ?? normalizar(c.nome)
    if (n.startsWith(t)) ini.push({ nome: c.nome, uf: c.uf })
    else if (n.includes(t)) meio.push({ nome: c.nome, uf: c.uf })
    if (ini.length >= limite) break
  }
  return [...ini, ...meio].slice(0, limite)
}

export const rotuloMunicipio = (m: Municipio) => `${m.nome} – ${m.uf}`
