import type { RelatorioTeste } from './ponte-testar'

export const AVISO_IA = 'São agentes de IA, não pessoas reais. Serve como termômetro, não como pesquisa de mercado. O Atlas não recomenda nem garante nada.'

/** Compara os temas contra de dois testes pelo nome (o que caiu, o que subiu, o que é novo). */
export function compararTemas(a: RelatorioTeste, b: RelatorioTeste): { tema: string; antes: number; depois: number }[] {
  const chave = (s: string) => s.trim().toLocaleLowerCase('pt-BR')
  const antes = new Map(b.fracos.map((t) => [chave(t.tema), t]))
  const depois = new Map(a.fracos.map((t) => [chave(t.tema), t]))
  const nomes = [...new Set([...antes.keys(), ...depois.keys()])]
  return nomes.map((k) => ({ tema: (depois.get(k) ?? antes.get(k))!.tema, antes: antes.get(k)?.n ?? 0, depois: depois.get(k)?.n ?? 0 })).sort((x, y) => Math.max(y.antes, y.depois) - Math.max(x.antes, x.depois)).slice(0, 6)
}

/** Título do veredito e quem mais gostou/torceu o nariz, só a partir das contas do programa (grupos com 20 agentes ou mais). */
export function frasesDoVeredito(rel: RelatorioTeste): { titulo: string; quem: string | null } {
  const g = rel.geral
  const dif = g.pctUsaria - g.pctNao
  const titulo = g.total === 0 ? 'Ninguém respondeu.' : dif >= 10 ? 'Termômetro: mais a favor do que contra.' : dif <= -10 ? 'Termômetro: mais contra do que a favor.' : 'Termômetro: dividido.'
  const dim = rel.porTipo['Profissão'] ? 'Profissão' : Object.keys(rel.porTipo)[0]
  const grupos = (dim ? rel.porTipo[dim] : []).filter((x) => x.total >= 20)
  if (grupos.length < 2) return { titulo, quem: null }
  const fa = [...grupos].sort((a, b) => b.pctUsaria - a.pctUsaria)[0]
  const co = [...grupos].sort((a, b) => b.pctNao - a.pctNao)[0]
  const partes = [`Quem mais gostou: ${fa.valor} (${fa.pctUsaria}% a favor).`]
  if (co.valor !== fa.valor && co.pctNao > 0) partes.push(`Quem mais torceu o nariz: ${co.valor} (${co.pctNao}% contra).`)
  return { titulo, quem: partes.join(' ') }
}
