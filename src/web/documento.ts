// M31 ("real só com CPF", Luiz, 26/11/2026): a mesma regra do servidor (supabase/functions/_shared/documento.ts), para a tela
// avisar antes de ir ao pagamento. Quem decide de verdade é o servidor.
export { documentoBR, type DocumentoBR } from '../../supabase/functions/_shared/documento.ts'

const NUMEROS: Record<string, string> = { zero: '0', um: '1', uma: '1', dois: '2', duas: '2', tres: '3', três: '3', quatro: '4', cinco: '5', seis: '6', sete: '7', oito: '8', nove: '9' }

/** Só os números (aceita fala: "cinco dois nove") com a pontuação do CPF (até 11) ou do CNPJ (12 a 14). */
export function mascaraDocumento(texto: string): string {
  const d = texto.toLowerCase().split(/[\s,]+/).map((p) => NUMEROS[p] ?? p.replace(/\D/g, '')).join('').slice(0, 14)
  if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, (_, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? `-${f}` : ''}`)
}
