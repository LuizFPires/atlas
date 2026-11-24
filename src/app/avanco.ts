// Como o avanço da obra aparece para o cliente (pedido do Luiz, 24/11/2026: "o 0% pregado na tela" parece obra parada).
// Sempre 2 casas no padrão brasileiro, arredondando para BAIXO: nunca mostra mais do que foi feito; "100" só quando acabou.
export function textoAvanco(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0,00'
  if (pct >= 100) return '100'
  const v = Math.floor(pct * 100 + 1e-6) / 100
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
