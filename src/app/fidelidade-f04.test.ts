// Fidelidade com o protótipo F04Contas: os textos que o cliente lê são os mesmos da tela desenhada.
// O protótipo usa emoji em alguns textos; o app usa ícones SVG, então o emoji sai e o texto fica.
import proto from '../../prototipo/F04Contas.dc.html?raw'
import { CONTAS, TEXTO_OPCIONAL } from './contas-passos'

const semEmoji = (t: string) => t.replace(/ ✓$/, '')

test('as 4 contas (nome, o quê, porquê) batem com o protótipo', () => {
  expect(CONTAS.map((c) => c.nome)).toEqual(['GitHub', 'Supabase', 'Hospedagem', 'Pagamentos'])
  for (const c of CONTAS) {
    expect(proto).toContain(`id: '${c.id}', nome: '${c.nome}'`)
    expect(proto).toContain(c.oque)
    expect(proto).toContain(c.porque)
  }
})

test('os passos (faça, calma, site, tradução) batem com o protótipo', () => {
  expect(CONTAS.map((c) => c.passos.length)).toEqual([5, 4, 4, 1])
  for (const c of CONTAS) for (const p of c.passos) {
    if (p.faca) expect(proto.replace(/ 🎉/g, '').replace(/ ✓/g, '')).toContain(semEmoji(p.faca))
    if (p.calma) expect(proto).toContain(p.calma)
    expect(proto).toContain(p.site.url)
    expect(proto.replace(/ 🎉/g, '')).toContain(p.site.titulo)
    for (const i of p.site.itens) expect(proto).toContain(i.txt)
    if (p.en) { expect(proto).toContain(`en: '${p.en}'`); expect(proto).toContain(`pt: '${p.pt}'`) }
  }
})

test('os textos fixos da tela batem com o protótipo', () => {
  for (const t of [TEXTO_OPCIONAL.titulo, TEXTO_OPCIONAL.texto, TEXTO_OPCIONAL.nota, 'Não consegui fazer este passo', 'Tudo bem, acontece com todo mundo.', 'Ver este passo em vídeo (40 s)', 'Pedir ajuda ao Atlas (mande um print)', 'É assim que vai aparecer na sua tela:', 'Abrir o site →', 'Fiz isso →', 'Próxima conta →', 'Último passo →', '← Voltar', 'CONTA {{c.num}} DE 4']) {
    expect(proto).toContain(t)
  }
})
