// Testar a ideia no celular (Luiz, 28/11/2026). O teste roda no notebook; o celular lê só um RESUMO que o notebook publica no
// servidor do Atlas: os últimos testes, os relatórios dos mais recentes, uma amostra da Praça e as entrevistas. O servidor
// aceita até 60 KB, então o resumo é montado aqui com folga e encolhido se passar.
import type { AgenteNaCena, CenaTeste, EventoConversa, MensagemEntrevista, PonteTestar, RelatorioTeste, ResumoTeste } from './ponte-testar'

export interface ResumoTesteCelular {
  testes: ResumoTeste[]
  relatorios: Record<string, RelatorioTeste>
  cenas: Record<string, CenaTeste>
  entrevistas: Record<string, Record<string, MensagemEntrevista[]>>
}

export const LIMITE_RESUMO = 52_000
const corta = (t: unknown, max: number) => String(t ?? '').slice(0, max)

/** O relatório sem o que o celular não usa (ids dos agentes por tema, telas) e com listas curtas. */
export function enxugarRelatorio(r: RelatorioTeste): RelatorioTeste {
  const tema = (t: RelatorioTeste['fortes'][number]) => ({ tema: corta(t.tema, 80), n: t.n, ids: [], exemplo: t.exemplo ? { id: t.exemplo.id, fala: corta(t.exemplo.fala, 160), quem: corta(t.exemplo.quem, 60) } : null })
  return {
    ...r,
    aviso: corta(r.aviso, 300),
    produto: { ...r.produto, nome: corta(r.produto.nome, 60), oQueE: corta(r.produto.oQueE, 160), paraQuem: corta(r.produto.paraQuem, 120), telas: [] },
    porTipo: Object.fromEntries(Object.entries(r.porTipo).slice(0, 8).map(([k, v]) => [k, v.slice(0, 10).map((x) => ({ ...x, valor: corta(x.valor, 40) }))])),
    preco: r.preco.slice(0, 8),
    fortes: r.fortes.slice(0, 5).map(tema),
    fracos: r.fracos.slice(0, 5).map(tema),
    ideias: r.ideias.slice(0, 6).map((i) => ({ titulo: corta(i.titulo, 80), como: corta(i.como, 200), tema: i.tema ? corta(i.tema, 80) : null, n: i.n })),
  }
}

/** Uma amostra da Praça: quem mudou de ideia, quem falou na conversa, quem já foi entrevistado e o resto misturado. */
export function amostrarCena(c: CenaTeste, max: number, manter: Set<string> = new Set()): CenaTeste {
  const falou = new Set(c.eventos.map((e) => e.de))
  const pontos = (a: AgenteNaCena) => (manter.has(a.id) ? 4 : 0) + (a.mudou ? 2 : 0) + (falou.has(a.id) ? 1 : 0)
  const passo = Math.max(1, Math.floor(c.agentes.length / Math.max(1, max)))
  const ordem = c.agentes.map((a, i) => ({ a, p: pontos(a), mistura: i % passo === 0 ? 0 : 1, i })).sort((x, y) => y.p - x.p || x.mistura - y.mistura || x.i - y.i)
  const escolhidos = ordem.slice(0, max).map(({ a }) => ({
    id: a.id, nome: corta(a.nome, 30), idade: a.idade, r: a.r, fala: a.fala ? corta(a.fala, 120) : null, mudou: !!a.mudou,
    tracos: Object.fromEntries(Object.entries(a.tracos).slice(0, 3).map(([k, v]) => [corta(k, 30), corta(v, 40)])),
  }))
  const ids = new Set(escolhidos.map((a) => a.id))
  const eventos: EventoConversa[] = c.eventos.filter((e) => ids.has(e.de)).slice(-24).map((e) => ({ ...e, para: e.para && ids.has(e.para) ? e.para : null, texto: corta(e.texto, 120) }))
  return { agentes: escolhidos, eventos }
}

const tamanho = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length

/** Monta o resumo de uma obra para o celular. null = a obra não tem nenhum teste. */
export async function montarResumoTeste(testar: PonteTestar, pasta: string): Promise<ResumoTesteCelular | null> {
  const testes = (await testar.listar(pasta)).slice(0, 6)
  if (!testes.length) return null
  const prontos = testes.filter((t) => t.estado === 'pronto').slice(0, 2)
  const comCena = [...new Set([testes[0].n, ...prontos.map((t) => t.n)])].slice(0, 2)
  const relatorios: Record<string, RelatorioTeste> = {}
  for (const t of prontos) { const r = await testar.relatorio(pasta, t.n).catch(() => null); if (r) relatorios[t.n] = enxugarRelatorio(r) }
  const entrevistas: Record<string, Record<string, MensagemEntrevista[]>> = {}
  for (const t of prontos) {
    const e = await testar.entrevistas(pasta, t.n).catch(() => ({} as Record<string, MensagemEntrevista[]>))
    const ag = Object.entries(e).filter(([, m]) => m.length).slice(-6)
    if (ag.length) entrevistas[t.n] = Object.fromEntries(ag.map(([id, m]) => [id, m.slice(-8).map((x) => ({ de: x.de, texto: corta(x.texto, 400), em: x.em }))]))
  }
  const brutas: Record<string, CenaTeste> = {}
  for (const n of comCena) brutas[n] = await testar.cena(pasta, n).catch(() => ({ agentes: [], eventos: [] }))
  // encolhe a Praça até caber (a Praça é a parte grande; os números do relatório vão sempre)
  for (let max = 100; max >= 10; max = Math.floor(max * 0.7)) {
    const cenas = Object.fromEntries(Object.entries(brutas).map(([n, c]) => [n, amostrarCena(c, max, new Set(Object.keys(entrevistas[n] ?? {})))]))
    const r = { testes, relatorios, cenas, entrevistas }
    if (tamanho(r) <= LIMITE_RESUMO) return r
  }
  const r = { testes, relatorios, cenas: {}, entrevistas: {} }
  return tamanho(r) <= LIMITE_RESUMO ? r : { testes, relatorios: {}, cenas: {}, entrevistas: {} }
}

/** Lado do celular: confere o formato do que veio do servidor (o que não confere é descartado). */
export function lerResumoTeste(x: unknown): ResumoTesteCelular | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
  const testes = (Array.isArray(o.testes) ? o.testes : []).filter((t): t is ResumoTeste => !!t && typeof t === 'object' && Number.isInteger((t as ResumoTeste).n) && typeof (t as ResumoTeste).estado === 'string' && typeof (t as ResumoTeste).quantidade === 'number')
  if (!testes.length) return null
  const relatorios = Object.fromEntries(Object.entries(obj(o.relatorios)).filter(([, r]) => { const x = r as RelatorioTeste; return !!x && typeof x === 'object' && !!x.geral && Array.isArray(x.fortes) && Array.isArray(x.fracos) && Array.isArray(x.ideias) && Array.isArray(x.preco) && !!x.porTipo && typeof x.porTipo === 'object' })) as Record<string, RelatorioTeste>
  const cenas = Object.fromEntries(Object.entries(obj(o.cenas)).map(([n, c]) => { const x = obj(c); return [n, { agentes: (Array.isArray(x.agentes) ? x.agentes : []).filter((a) => a && typeof a.id === 'string' && typeof a.nome === 'string' && a.tracos && typeof a.tracos === 'object'), eventos: (Array.isArray(x.eventos) ? x.eventos : []).filter((e) => e && typeof e.de === 'string' && typeof e.texto === 'string') }] })) as Record<string, CenaTeste>
  const entrevistas = Object.fromEntries(Object.entries(obj(o.entrevistas)).map(([n, e]) => [n, Object.fromEntries(Object.entries(obj(e)).map(([id, m]) => [id, (Array.isArray(m) ? m : []).filter((x) => x && (x.de === 'voce' || x.de === 'agente') && typeof x.texto === 'string')]))])) as ResumoTesteCelular['entrevistas']
  return { testes, relatorios, cenas, entrevistas }
}
