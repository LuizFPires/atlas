// M31 ("real só com CPF", Luiz, 26/11/2026): pagar em real exige um documento brasileiro válido (CPF ou CNPJ, conferido pelos
// dígitos verificadores). Quem não tem compra pela página em inglês, em dólar. A mesma regra está em src/web/documento.ts.

export type DocumentoBR = { tipo: 'cpf' | 'cnpj'; digitos: string }

function dv(base: string, pesos: number[]): number {
  const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0)
  const r = soma % 11
  return r < 2 ? 0 : 11 - r
}

/** CPF ou CNPJ válido (com ou sem pontuação); qualquer outra coisa = null. */
export function documentoBR(texto: unknown): DocumentoBR | null {
  const d = typeof texto === 'string' ? texto.replace(/\D/g, '') : ''
  if (/^(\d)\1+$/.test(d)) return null
  if (d.length === 11) {
    const ok = dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10])
    return ok ? { tipo: 'cpf', digitos: d } : null
  }
  if (d.length === 14) {
    const ok = dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13])
    return ok ? { tipo: 'cnpj', digitos: d } : null
  }
  return null
}
