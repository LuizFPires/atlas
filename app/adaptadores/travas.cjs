// Travas conhecidas de uma conta do cliente (prototipo/caminho-novo/T1Travas e TF1–TF5, aprovadas pelo Luiz em 24/11/2026).
// Lê o livro de ocorrências da obra (docs/ocorrencias.json, escrito pela linha) e reconhece as travas que o Atlas sabe explicar:
//  - github-minutos: os minutos grátis do GitHub Actions acabaram (passa sozinho no dia 1º; o Atlas confere no computador);
//  - vercel-limite: a Vercel já publicou o máximo do dia (passa sozinho; publica na hora marcada);
//  - supabase-dormindo: o projeto do Supabase foi pausado por falta de uso (precisa de você: um clique);
//  - conta-desligada: o login de GitHub, Vercel ou Supabase caiu neste computador (precisa de você: Ligar de novo).
// Trava conhecida NÃO para a obra: ela segue com o que não depende (painel.cjs não a transforma em "parada").
// Só sai daqui dado limpo: tipo (fixo), serviço (fixo), data de liberação (ISO) e o id. Texto vindo do livro nunca vai à tela.
'use strict'

const SERVICOS = { github: 'GitHub', vercel: 'Vercel', supabase: 'Supabase' }
const PRECISA_DE_VOCE = new Set(['supabase-dormindo', 'conta-desligada'])

function tipoDaTrava(o) {
  if (!o || o.status !== 'aberta') return null
  const serv = String(o.servico || '').toLowerCase()
  const txt = `${serv} ${String(o.motivo || '').toLowerCase()}`
  const qual = Object.keys(SERVICOS).find((s) => serv.includes(s))
  if (!qual) return null
  if (/desligad|login|logad|autentic|credencial|unauthori|not logged/.test(txt)) return 'conta-desligada'
  if (qual === 'github' && /billing|minut|spending|actions|pagamento|payment|cobran|gasto/.test(txt)) return 'github-minutos'
  if (qual === 'vercel' && /limit|deploy/.test(txt)) return 'vercel-limite'
  if (qual === 'supabase' && /paus|dorm|inativ|inactiv/.test(txt)) return 'supabase-dormindo'
  return null
}

const servicoDe = (o) => SERVICOS[Object.keys(SERVICOS).find((s) => String(o.servico || '').toLowerCase().includes(s))]

/** A trava conhecida mais importante da obra (a que precisa de você primeiro) ou null. */
function travaDaObra(livro) {
  const abertas = livro && Array.isArray(livro.ocorrencias) ? livro.ocorrencias : []
  const achadas = abertas.map((o) => ({ o, tipo: tipoDaTrava(o) })).filter((x) => x.tipo && Number.isInteger(x.o.id))
  if (!achadas.length) return null
  achadas.sort((a, b) => Number(PRECISA_DE_VOCE.has(b.tipo)) - Number(PRECISA_DE_VOCE.has(a.tipo)))
  const { o, tipo } = achadas[0]
  const d = o.liberar_em ? new Date(o.liberar_em) : null
  return { id: o.id, tipo, servico: servicoDe(o), liberaEm: d && Number.isFinite(d.getTime()) ? d.toISOString() : null }
}

module.exports = { tipoDaTrava, travaDaObra, PRECISA_DE_VOCE }
