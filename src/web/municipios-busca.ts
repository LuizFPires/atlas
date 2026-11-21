// Busca de município para o cadastro. A base (IBGE, ~5570 municípios) só é baixada no primeiro foco/dígito do campo.
export interface Municipio { nome: string; uf: string }

export const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

interface Indexado extends Municipio { n: string }
let cache: Promise<Indexado[]> | null = null

/** Carrega a base sob demanda (dynamic import) e guarda na memória. */
export function carregarMunicipios(): Promise<Indexado[]> {
  cache ??= import('./municipios-br').then(({ MUNICIPIOS_TXT }) =>
    MUNICIPIOS_TXT.split('\n').map((l) => { const [nome, uf] = l.split('|'); return { nome, uf, n: normalizar(nome) } }))
  // Se o download falhar, não guarda a promessa quebrada: a próxima tentativa baixa de novo.
  const atual = cache
  atual.catch(() => { if (cache === atual) cache = null })
  return atual
}

/** Município cujo nome bate exatamente (sem acento/caixa) e é o único com esse nome; senão null (ex.: "Santa Rita" existe em vários estados). */
export function municipioUnicoExato(base: Municipio[], termo: string): Municipio | null {
  const t = normalizar(termo)
  if (!t) return null
  const lista = base as Partial<Indexado>[] as Indexado[]
  const achados = lista.filter((c) => (c.n ?? normalizar(c.nome)) === t)
  return achados.length === 1 ? { nome: achados[0].nome, uf: achados[0].uf } : null
}

/** Melhores correspondências: nome que começa com o termo primeiro, depois os que contêm. "sao paulo sp" ou "Santa Rita – PB" filtram pela UF. */
export function buscarMunicipios(base: Municipio[], termo: string, limite = 8): Municipio[] {
  const lista = base as Partial<Indexado>[] as Indexado[]
  const idx = (c: Indexado) => c.n ?? normalizar(c.nome)
  let t = normalizar(termo.replace(/[–—-]/g, ' '))
  if (!t) return []
  let uf = ''
  const m = t.match(/^(.*\S)\s+([a-z]{2})$/)
  if (m && lista.some((c) => c.uf.toLowerCase() === m[2] && idx(c).startsWith(m[1]))) { t = m[1]; uf = m[2] }
  const ini: Municipio[] = [], meio: Municipio[] = []
  for (const c of lista) {
    if (uf && c.uf.toLowerCase() !== uf) continue
    const n = idx(c)
    if (n.startsWith(t)) ini.push({ nome: c.nome, uf: c.uf })
    else if (n.includes(t)) meio.push({ nome: c.nome, uf: c.uf })
  }
  return [...ini, ...meio].slice(0, limite)
}

export const rotuloMunicipio = (m: Municipio) => `${m.nome} – ${m.uf}`
