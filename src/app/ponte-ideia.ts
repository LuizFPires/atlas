import type { ResultadoPolitica } from './ponte-politica'
// Roteiro da ideia (caminho novo, pedido do Luiz em 23/11/2026). O adaptador real é app/adaptadores/ideia.cjs (Claude rápido, sem pasta).
export type IdTopico = 'problema' | 'quem' | 'primeiro' | 'essencial' | 'informacoes' | 'hoje' | 'mais'

/** Os 7 tópicos do roteiro, na ordem (iguais a TOPICOS de ideia.cjs), com a dica que aparece no tópico da vez. */
export const TOPICOS: { id: IdTopico; pergunta: string; dica: string }[] = [
  { id: 'problema', pergunta: 'Qual problema você resolve?', dica: 'O que dá trabalho hoje? O que você quer que fique fácil?' },
  { id: 'quem', pergunta: 'Quem vai usar?', dica: 'Você, a equipe, os clientes? Pelo celular ou pelo computador?' },
  { id: 'primeiro', pergunta: 'O que a pessoa faz primeiro?', dica: 'Conte o caminho: abre o aplicativo e faz o quê?' },
  { id: 'essencial', pergunta: 'O que não pode faltar?', dica: 'As 3 coisas sem as quais o sistema não serve.' },
  { id: 'informacoes', pergunta: 'Que informações aparecem?', dica: 'Telas, relatórios, números que você quer ver.' },
  { id: 'hoje', pergunta: 'Já usa alguma coisa hoje?', dica: 'Planilha, papel, outro aplicativo? O que você gosta e o que não gosta?' },
  { id: 'mais', pergunta: 'Algo mais que você imagina?', dica: 'Qualquer ideia solta vale.' },
]

/** titulo: só no fim — 2 a 4 palavras do que o sistema faz (vira o nome da pasta; o nome de verdade vem no batismo). */
/** politica: só no fim — o porteiro do M65 (a ideia é um sistema que constrói sistemas?). */
export type Conferencia = { cobertos: { id: IdTopico; resumo: string }[]; faltam: { pergunta: string; porque: string }[]; titulo?: string; politica?: ResultadoPolitica; venda?: { paraVender: boolean; motivo: string } | null }

export interface PonteIdeia {
  /** Quais tópicos o relato já respondeu. fim = true: também o que faltou (no máximo 3 perguntas). */
  conferir(relato: string, fim?: boolean): Promise<Conferencia>
}

/** Modo fixture: reconhece palavras simples de cada tópico, para a demonstração andar sem o Claude. */
const PISTAS: Record<IdTopico, RegExp> = {
  problema: /\b(problema|papel|trabalho|perco|demora|hoje [ée])\b/i,
  quem: /\b(quem vai usar|usar|funcion[aá]rios?|clientes?|equipe|pedreiros?)\b/i,
  primeiro: /\b(abre|primeiro|entra|come[çc]a)\b/i,
  essencial: /\b(n[aã]o pode faltar|essencial|principal|precisa ter)\b/i,
  informacoes: /\b(relat[oó]rio|ver as|n[uú]meros|horas|total)\b/i,
  hoje: /\b(planilha|caderno|uso hoje|outro aplicativo)\b/i,
  mais: /\b(tamb[eé]m|al[eé]m disso|seria legal)\b/i,
}
export function criarIdeiaFixture(): PonteIdeia {
  return {
    async conferir(relato, fim) {
      const cobertos = TOPICOS.filter((t) => PISTAS[t.id].test(relato)).map((t) => ({ id: t.id, resumo: 'Você já contou isso.' }))
      const faltam = fim && cobertos.length < TOPICOS.length ? [{ pergunta: 'Como as pessoas entram no sistema?', porque: 'Você não contou se cada um tem login próprio.' }] : []
      return fim ? { cobertos, faltam, titulo: 'Meu sistema' } : { cobertos, faltam }
    },
  }
}

/** Sem o Atlas instalado: o roteiro fica como guia, sem marcar sozinho. */
export const ideiaIndisponivel: PonteIdeia = { async conferir() { return { cobertos: [], faltam: [] } } }
