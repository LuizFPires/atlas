// Textos da tela F06c (prototipo/F06cTrazer.dc.html). O recado é copiado do protótipo, palavra por palavra.

export const RECADO = `Oi! Vou construir de verdade o sistema deste protótipo usando o Atlas. Preciso que você me entregue o protótipo assim:

1. Um arquivo prototipo-atlas.zip com:
   • telas/ — cada tela num arquivo HTML que abre sozinho no navegador (01-inicio.html, 02-marcar-horario.html…)
   • design-system.md — cores (com os códigos), letras, tamanhos, botões, cantos e espaçamentos
   • telas.md — o que cada tela faz, quem usa e para onde leva cada botão
   • regras.md — as regras do negócio que combinamos
   • imagens/ — logomarca e imagens usadas
2. Publique o protótipo num link que eu consiga abrir no celular e me mande o link.
3. No fim, me diga em até 5 linhas o que ficou faltando ou só de mentirinha (dados falsos, botões sem função).

Não precisa me explicar código. Só me entregue o .zip e o link.`

/** O que o .zip deve conter (lista de verificação mostrada ao cliente e usada na conferência). */
export const LISTA_VERIFICACAO = [
  { id: 'telas', nome: 'telas/', desc: 'cada tela num arquivo HTML', obrigatorio: true },
  { id: 'design', nome: 'design-system.md', desc: 'cores, letras, botões, cantos e espaçamentos', obrigatorio: true },
  { id: 'telasmd', nome: 'telas.md', desc: 'o que cada tela faz e para onde leva cada botão', obrigatorio: true },
  { id: 'regras', nome: 'regras.md', desc: 'as regras do negócio combinadas', obrigatorio: true },
  { id: 'imagens', nome: 'imagens/', desc: 'logomarca e imagens usadas', obrigatorio: false },
] as const

export interface ItemConferencia {
  id: string
  /** ok = chegou; falta = não veio ou precisa de atenção (o Claude completa no mesmo estilo). */
  tipo: 'ok' | 'falta'
  titulo: string
  txt: string
}

/** Entrada mínima para conferir: só o que o Atlas já sabe (nomes dentro de prototipo/ e o texto dos .md, que é DADO). */
export interface ParaConferir {
  arquivos: readonly { destino: string }[]
  textos: Partial<Record<'design-system.md' | 'telas.md' | 'regras.md', string>>
}

const NOME_TELA = /^telas\/[^/]+\.html$/
const TELA_LOGIN = /login|entrar|acesso|cadastro/
const ITEM_DE_LISTA = /^\s*(?:[-*•]|\d+[.)])\s+\S/

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Confere o que chegou e aponta o que falta. Nunca lê o HTML (é dado de fora); usa só nomes de arquivo e a contagem de itens das regras. */
export function conferirPacote(r: ParaConferir, link: string | null): ItemConferencia[] {
  const nomes = r.arquivos.map((a) => a.destino)
  const telas = nomes.filter((n) => NOME_TELA.test(n))
  const tem = (n: string) => nomes.includes(n)
  const completa = 'Sem problema: o Claude completa no mesmo estilo e te mostra.'
  const itens: ItemConferencia[] = []

  itens.push(telas.length
    ? { id: 'telas', tipo: 'ok', titulo: `${plural(telas.length, 'tela encontrada', 'telas encontradas')}`, txt: 'Cada uma abre sozinha no navegador e vira uma tela da obra.' }
    : { id: 'telas', tipo: 'falta', titulo: 'Não achei as telas', txt: `Esperava arquivos .html dentro da pasta telas/. ${completa}` })

  itens.push(tem('design-system.md')
    ? { id: 'design', tipo: 'ok', titulo: 'Design system', txt: 'Cores, letras e botões lidos do design-system.md. Viram o estilo da obra.' }
    : { id: 'design', tipo: 'falta', titulo: 'Faltou o design-system.md', txt: `O Claude tira o estilo das telas. ${completa}` })

  itens.push(tem('telas.md')
    ? { id: 'telasmd', tipo: 'ok', titulo: 'Descrição das telas', txt: 'O telas.md diz o que cada tela faz e para onde leva cada botão.' }
    : { id: 'telasmd', tipo: 'falta', titulo: 'Faltou o telas.md', txt: `Sem ele não sei para onde cada botão leva. ${completa}` })

  if (tem('regras.md')) {
    const n = (r.textos['regras.md'] ?? '').split(/\r?\n/).filter((l) => ITEM_DE_LISTA.test(l)).length
    itens.push({ id: 'regras', tipo: 'ok', titulo: 'Regras do negócio', txt: n ? `${plural(n, 'regra', 'regras')}, como "horário ocupado não pode ser marcado".` : 'O regras.md chegou, mas não achei regras em lista. O Claude te pergunta o que faltar.' })
  } else {
    itens.push({ id: 'regras', tipo: 'falta', titulo: 'Faltou o regras.md', txt: `O Claude te pergunta as regras do seu negócio. ${completa}` })
  }

  if (!nomes.some((n) => n.startsWith('imagens/'))) {
    itens.push({ id: 'imagens', tipo: 'falta', titulo: 'Sem imagens nem logomarca', txt: 'Sem problema: você pode mandar a logo depois, ou o Claude cria uma no estilo da obra.' })
  }

  if (telas.length && !telas.some((t) => TELA_LOGIN.test(t))) {
    itens.push({ id: 'login', tipo: 'falta', titulo: 'Faltou a tela de entrar (login)', txt: completa })
  }

  itens.push({ id: 'mentirinha', tipo: 'falta', titulo: 'Dados de mentirinha', txt: 'Protótipo quase sempre usa clientes inventados. Na obra, vira dado de verdade.' })

  itens.push(link
    ? { id: 'link', tipo: 'ok', titulo: 'Link do protótipo no ar', txt: 'Anotado. Você pode abrir no celular para ver como ficou.' }
    : { id: 'link', tipo: 'falta', titulo: 'Falta o link do protótipo', txt: 'Cole o link no passo 2. Se a outra IA não deu, dá para seguir só com o .zip.' })

  return itens
}
