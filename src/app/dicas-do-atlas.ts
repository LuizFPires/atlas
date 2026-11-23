// Dicas do Atlas no protótipo (Milestone 36; protótipo prototipo/caminho-novo/P2Dicas, aprovado pelo Luiz em 23/11/2026):
// uma dica por vez, conforme a tela aberta, para a pessoa descobrir o que dá para pedir. Cada dica traz o pedido já escrito.
import { aparelhoDaTela, type TelaDesenhada } from './ponte-prototipo'

export type Dica = { tipo: 'versoes' | 'pedido'; titulo: string; texto: string; acao: string; pedido: string }

const FORMULARIO = /cadastr|formul|novo|nova|criar|editar|pedido|inscri|agendar|marcar/i

export function dicasDaTela(tela: TelaDesenhada, telas: TelaDesenhada[]): Dica[] {
  const n = tela.nome
  const out: Dica[] = []
  if (FORMULARIO.test(`${tela.id} ${n}`)) {
    out.push({ tipo: 'versoes', titulo: `Na dúvida sobre "${n}"? Veja 3 jeitos antes de escolher.`, texto: 'Eu desenho três versões desta tela, lado a lado. Você testa cada uma e fica com a melhor, ou mistura o que gostou.', acao: `Ver 3 versões de "${n}"`, pedido: `Desenhe 3 jeitos diferentes da tela "${n}" para eu escolher.` })
  }
  if (!telas.some((t) => aparelhoDaTela(t) === 'computador')) {
    out.push({ tipo: 'pedido', titulo: 'Precisa de um painel no computador?', texto: 'Muitos sistemas têm duas partes: o app no celular e um painel no computador para o escritório acompanhar tudo.', acao: 'Pedir o painel no computador', pedido: 'Crie as telas de um painel no computador para o escritório acompanhar tudo o que acontece no app.' })
  }
  out.push(
    { tipo: 'pedido', titulo: 'Quer ver com o logo e as cores da sua empresa?', texto: 'Mande uma foto do logo pelo clipe e eu aplico em todas as telas.', acao: 'Usar a minha marca', pedido: 'Use o logo e as cores da minha empresa em todas as telas.' },
    { tipo: 'pedido', titulo: `Como "${n}" fica num dia cheio?`, texto: 'Ver a tela com muitos dados mostra se a lista continua fácil de ler.', acao: 'Simular um dia cheio', pedido: `Mostre a tela "${n}" com bastante coisa, como num dia cheio de movimento.` },
    { tipo: 'pedido', titulo: 'Faltou alguma tela?', texto: 'Conte o que a pessoa precisa fazer e eu desenho a tela e ligo com as outras.', acao: 'Pedir uma tela nova', pedido: 'Crie uma tela para ' },
  )
  return out
}
