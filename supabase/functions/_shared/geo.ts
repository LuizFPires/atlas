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
 * UF do acesso, a partir dos cabeçalhos que a borda já preenche (nunca do IP).
 * Só vale se o país for o Brasil; cabeçalho ausente, de outro país ou com valor estranho = null.
 */
export function ufDoAcesso(h: Pick<Headers, 'get'>): string | null {
  const pais = (h.get('cf-ipcountry') ?? h.get('x-vercel-ip-country') ?? '').trim().toUpperCase()
  if (pais && pais !== 'BR') return null
  const reg = (h.get('cf-region-code') ?? h.get('x-vercel-ip-country-region') ?? '').trim().toUpperCase()
  return ufValida(reg)
}
