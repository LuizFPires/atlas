// Geografia do Brasil usada pelo servidor: as 27 UFs, a região de cada uma e a leitura da UF do acesso.
// Regra de privacidade: o servidor NUNCA lê nem guarda o IP para isso. A UF vem de um cabeçalho que a borda
// (Cloudflare/Vercel) já derivou do IP; se não vier, a UF fica desconhecida (nulo) e nada é chutado.
export type Regiao = 'N' | 'NE' | 'CO' | 'SE' | 'S'

export const REGIAO_DA_UF: Readonly<Record<string, Regiao>> = {
  AC: 'N', AM: 'N', AP: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  DF: 'CO', GO: 'CO', MS: 'CO', MT: 'CO',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'S', RS: 'S', SC: 'S',
}
export const UFS: readonly string[] = Object.keys(REGIAO_DA_UF).sort()

/** Devolve a UF em maiúsculas se for uma das 27; senão null. */
export function ufValida(v: unknown): string | null {
  const u = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return u in REGIAO_DA_UF ? u : null
}

/**
 * UF do acesso lida de UM cabeçalho cujo nome o operador confirmou que o edge do deploy SEMPRE sobrescreve
 * (variável ATLAS_GEO_HEADER_UF, ligada em api/index.ts). Qualquer outro cabeçalho de geolocalização (cf-*, x-vercel-*) pode ser
 * mandado pelo CLIENTE e forjado para mascarar a região e furar o Radar, então NUNCA é lido por padrão: sem nome confiável
 * configurado a UF é desconhecida (null). Melhor dado faltando do que dado envenenado. O IP não é lido nem guardado aqui.
 */
export function ufDoCabecalhoConfiavel(h: Pick<Headers, 'get'>, nome: string | null | undefined): string | null {
  const n = (nome ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]{3,60}$/.test(n)) return null
  return ufValida(h.get(n))
}
