// Caminho novo (pedido do Luiz, 23/11/2026): a pessoa conta a ideia falando, com um roteiro de 7 tópicos ao lado. A cada pausa,
// o Atlas pergunta ao Claude (modelo rápido, SEM pasta: não lê arquivo nenhum) quais tópicos o relato já respondeu, para a
// bolinha ficar verde. No fim (fim: true), o Claude também diz o que faltou, em no máximo 3 perguntas com o porquê.
// O relato entra como DADO delimitado (blocoDoCliente + REGRA_CONTEUDO_CLIENTE). A resposta é limpa aqui: só tópicos da lista,
// textos curtos, nada repetido.
//
// COMO TESTAR: `node --test app/adaptadores/ideia.teste.cjs`. No Windows (Claude logado): na tela "Conte a sua ideia", falar
// sobre o problema e quem usa; em poucos segundos as duas primeiras bolinhas ficam verdes.
'use strict'
const { REGRA_CONTEUDO_CLIENTE, blocoDoCliente, umaLinha, extrairJson } = require('./projeto-comum.cjs')
const { REGRA_POLITICA, politicaDoJson } = require('./politica.cjs')

const TOPICOS = [
  { id: 'problema', pergunta: 'Qual problema você resolve?' },
  { id: 'quem', pergunta: 'Quem vai usar?' },
  { id: 'primeiro', pergunta: 'O que a pessoa faz primeiro?' },
  { id: 'essencial', pergunta: 'O que não pode faltar?' },
  { id: 'informacoes', pergunta: 'Que informações aparecem?' },
  { id: 'hoje', pergunta: 'Já usa alguma coisa hoje?' },
  { id: 'mais', pergunta: 'Algo mais que você imagina?' },
]
const IDS = new Set(TOPICOS.map((t) => t.id))
const MAX_FALTAM = 3

function pedido(relato, fim) {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Um dono de pequeno negócio está contando, falando, o sistema que quer construir. Leia o RELATO e diga quais destes tópicos ele JÁ respondeu (mesmo que com outras palavras):',
    ...TOPICOS.map((t) => `- ${t.id}: ${t.pergunta}`),
    'Para cada tópico respondido, escreva um resumo de até 12 palavras, em português simples, do que ele disse.',
    fim
      ? `Depois, olhe o relato inteiro e diga o que FALTOU para desenhar as telas do sistema: no máximo ${MAX_FALTAM} perguntas curtas, em português simples, cada uma com o porquê em uma frase ("Você não contou..."). Só o que for importante; se nada faltou, lista vazia.`
      : 'Não faça perguntas agora: "faltam" fica vazio.',
    ...(fim ? ['Dê também um "titulo" provisório para o sistema: de 2 a 4 palavras, o que ele faz (ex.: "Agenda da barbearia"), sem inventar marca.', REGRA_POLITICA, 'Se bloquear, diga em "politica" até 4 "sinais" curtos (o que no relato mostra isso).'] : []),
    'Você não grava nada e não roda comandos.',
    `Responda SOMENTE com um objeto JSON, sem texto antes nem depois: {"cobertos":[{"id":"problema","resumo":"..."}],"faltam":[{"pergunta":"...?","porque":"..."}]${fim ? ',"titulo":"...","politica":{"bloqueia":false,"sinais":[]}' : ''}}`,
    '',
    'Relato do cliente:',
    ...blocoDoCliente(relato, '(vazio)'),
  ].join('\n')
}

/** deps: { disparo } — um disparo com o modelo rápido (criarDisparo com modelo: () => ['--model', <haiku>]). */
function criarIdeia({ disparo }) {
  return {
    async conferir(relato, { fim = false } = {}) {
      const texto = typeof relato === 'string' ? relato.slice(0, 20_000) : ''
      if (!texto.trim()) return { cobertos: [], faltam: [] }
      const j = extrairJson(await disparo.perguntar(null, pedido(texto, !!fim), { timeoutMs: 90_000, maxSaida: 200_000 }), 'objeto')
      const vistos = new Set()
      const cobertos = (Array.isArray(j.cobertos) ? j.cobertos : [])
        .filter((c) => c && IDS.has(c.id) && !vistos.has(c.id) && vistos.add(c.id))
        .map((c) => ({ id: c.id, resumo: umaLinha(c.resumo, 120) }))
      const faltam = fim && Array.isArray(j.faltam)
        ? j.faltam.filter((f) => f && typeof f.pergunta === 'string' && f.pergunta.trim()).slice(0, MAX_FALTAM).map((f) => ({ pergunta: umaLinha(f.pergunta, 160), porque: umaLinha(f.porque, 200) }))
        : []
      if (!fim) return { cobertos, faltam }
      const t = umaLinha(j.titulo, 60)
      return { cobertos, faltam, titulo: t.length > 40 ? t.slice(0, 40).replace(/\s+\S*$/, '') : t, politica: politicaDoJson(j) }
    },
  }
}

module.exports = { criarIdeia, TOPICOS }
