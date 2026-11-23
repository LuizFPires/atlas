// Conferência automática do protótipo (Milestone 36; "altíssima fidelidade", Luiz em 23/11/2026): antes de a pessoa aprovar, o
// Atlas olha cada tela e aponta o que um bom app não teria: botão que não leva a nada, algo mais largo que o aparelho (rolagem de
// lado) e letra pequena demais para ler. Só lê o HTML (não executa nada).
import { aparelhoDaTela, type TelaDesenhada } from './ponte-prototipo'

export type PontoDeConferencia = { tipo: 'sem-destino' | 'largura' | 'letra'; tela: string; texto: string }

const textoDoLink = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30)

export function conferirTelas(telas: TelaDesenhada[]): PontoDeConferencia[] {
  const ids = new Set(telas.map((t) => t.id))
  const out: PontoDeConferencia[] = []
  for (const t of telas) {
    const mortos: string[] = []
    for (const m of t.html.matchAll(/<a\b[^>]*href\s*=\s*["']#tela-([a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      if (!ids.has(m[1])) mortos.push(textoDoLink(m[2]) || m[1])
    }
    if (mortos.length) out.push({ tipo: 'sem-destino', tela: t.nome, texto: `Botões que ainda não levam a nada: ${[...new Set(mortos)].slice(0, 5).join(', ')}.` })
    const limite = aparelhoDaTela(t) === 'computador' ? 1280 : 390
    const larguras = [...t.html.matchAll(/(?:^|[;{\s"'])(?:min-)?width\s*:\s*(\d{3,5})px/gi)].map((m) => Number(m[1]))
    if (larguras.some((w) => w > limite)) out.push({ tipo: 'largura', tela: t.nome, texto: `Tem uma parte mais larga que o ${limite === 390 ? 'celular' : 'computador'}: no aparelho, a tela vai rolar para o lado.` })
    const letras = [...t.html.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((m) => Number(m[1]))
    if (letras.some((f) => f < 11)) out.push({ tipo: 'letra', tela: t.nome, texto: 'Tem letra pequena demais para ler no aparelho.' })
  }
  return out
}

/** O pedido que conserta tudo de uma vez (a pessoa só confere e envia). */
export function pedidoDaConferencia(pontos: PontoDeConferencia[]): string {
  return `Corrija estes pontos do protótipo: ${pontos.map((p) => `na tela "${p.tela}", ${p.texto.charAt(0).toLowerCase()}${p.texto.slice(1)}`).join(' ')} Desenhe as telas que faltam para os botões levarem a algum lugar.`
}
