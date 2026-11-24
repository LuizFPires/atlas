// Economia de tokens da linha de produção (Luiz, 24/11/2026: "os tokens do Guilherme já estouraram… Precisamos otimizar!!").
//
// A obra do Guilherme ligou a linha 65 vezes; a cada vez o coordenador gastava 8 a 10 passos só para descobrir onde estava
// (etapa.cjs, progresso, PLAN, roteiro.json, recomendado.json, gh auth status, git remote, git log, gh pr list…). Aqui o Atlas
// lê isso dos arquivos, sem gastar token nenhum, e entrega pronto na entrada do /construir (o retrato).
//  - retratoDaObra: o estado da obra em poucas linhas (avanço, milestone, branch, roteiro, modo, por que parou da última vez).
//  - marcaDeAvanco: impressão digital do avanço (tarefas feitas, commit da branch, etapa salva). O vigia só religa a linha
//    sozinho se a marca mudou desde o último religar (sem avanço, religar de novo só gasta cota).
//  - consumo: os números de cada turno (passos, tokens, custo estimado), em <obra>\.atlas\consumo.jsonl (sem texto da conversa).
// Tudo só leitura de arquivo: nada de processo, nada de rede, nada de segredo.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { lerTexto, lerJson, gravarAtomico } = require('./obra-fs.cjs')
const { lerPlanoDoTexto } = require('./painel.cjs')

const MAX_CONSUMO = 200
/** Texto que vem de arquivo escrito pelo Claude: uma linha só, curta, sem marcação nem sinal de comando. */
const dado = (v, max = 120) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/#{2,}/g, '').replace(/[`$<>|;{}\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

function lerPlan(cwd) {
  const t = lerTexto(path.join(cwd, 'PLAN.md'), 400_000) ?? lerTexto(path.join(cwd, 'docs', 'PLAN.md'), 400_000)
  return t === null ? null : lerPlanoDoTexto(t)
}

function lerRoteiro(cwd) {
  for (const p of ['.atlas/roteiro.json', '.codex/roteiro.json', '.claude/roteiro.json']) {
    try { const j = lerJson(path.join(cwd, p)); if (j && typeof j === 'object') return j } catch { /* próximo */ }
  }
  return null
}

/** Branch e commit atuais, lidos do .git (sem rodar git). */
function lerGit(cwd) {
  const git = path.join(cwd, '.git')
  const head = lerTexto(path.join(git, 'HEAD'), 4096)
  if (head === null) return { branch: null, commit: null }
  const m = /^ref:\s*refs\/heads\/(\S+)/.exec(head.trim())
  if (!m) return { branch: null, commit: /^[0-9a-f]{40}$/.test(head.trim()) ? head.trim() : null }
  const branch = m[1]
  let commit = null
  if (/^[\w./-]+$/.test(branch) && !branch.includes('..')) {
    const solto = lerTexto(path.join(git, 'refs', 'heads', ...branch.split('/')), 4096)
    if (solto !== null && /^[0-9a-f]{40}/.test(solto.trim())) commit = solto.trim().slice(0, 40)
    else {
      const packed = lerTexto(path.join(git, 'packed-refs'), 2_000_000) || ''
      const l = packed.split(/\r?\n/).find((x) => x.endsWith(` refs/heads/${branch}`))
      if (l) commit = l.slice(0, 40)
    }
  }
  return { branch: /^[\w./-]{1,100}$/.test(branch) ? branch : null, commit }
}

const MOTIVO_FIM = {
  cota: 'parou porque a cota do Claude acabou (já voltou)',
  pausada: 'o cliente pausou e agora mandou continuar',
  concluiu: 'terminou um turno normalmente',
  'sem-avanco': 'parou sem conseguir avançar',
  erro: 'parou com um erro',
  fechou: 'o Atlas foi fechado no meio do trabalho',
  'precisa-voce': 'parou esperando o cliente',
}

/** O retrato que vai junto do /construir. '' quando não há o que dizer (sem PLAN). */
function retratoDaObra(cwd, { modo = null, ultimoFim = null } = {}) {
  const p = lerPlan(cwd)
  if (!p || !p.milestones.length) return ''
  const prox = p.milestones.find((m) => m.n === p.proximo)
  const r = lerRoteiro(cwd)
  const g = lerGit(cwd)
  const linhas = ['Estado da obra (lido pelo Atlas agora mesmo, sem gastar seus tokens):']
  linhas.push(`- Avanço: ${String(p.pct).replace('.', ',')}% (${p.feitas} de ${p.tarefas} tarefas). ${prox ? `Próximo: Milestone ${prox.n} — ${dado(prox.titulo, 80)} (${prox.feitas} de ${prox.total} tarefas).` : 'Todos os milestones concluídos.'}`)
  if (g.branch) linhas.push(`- Branch atual: ${g.branch}.`)
  if (r) {
    const pend = Array.isArray(r.pendencias) ? r.pendencias.slice(0, 4).map((x) => dado(x, 100)).filter(Boolean) : []
    linhas.push(`- Roteiro salvo: ${dado(r.milestone, 10) || '?'} · etapa concluída ${Number.isInteger(r.etapa_concluida) ? r.etapa_concluida : 0}${Number.isInteger(r.pr) ? ` · PR #${r.pr}` : ''}${pend.length ? ` · pendências: ${pend.join('; ')}` : ''}.`)
  }
  if (modo === 'automatico') linhas.push('- Modo: automático (não pare entre etapas nem para checkpoint; depois do merge do milestone, encerre o turno: o Atlas religa você de contexto limpo).')
  else if (modo === 'passo-a-passo') linhas.push('- Modo: passo a passo (siga sem parar dentro do milestone; pare só depois do merge dele).')
  if (ultimoFim && MOTIVO_FIM[ultimoFim.motivo]) linhas.push(`- Última vez: ${MOTIVO_FIM[ultimoFim.motivo]}.`)
  linhas.push('- O GitHub, a Vercel e o Supabase deste computador já foram conferidos pelo Atlas.')
  linhas.push('Confie neste retrato: pule os passos 1 a 4 e 7 de "Descubra onde estamos". Do passo 5, rode só `git status --short` e, se houver PR, `gh pr checks <n>`. Depois siga a etapa.')
  return linhas.join('\n')
}

/** Impressão digital do avanço: muda quando a linha fez algo que fica (tarefa, commit, etapa salva, PR). */
function marcaDeAvanco(cwd) {
  const p = lerPlan(cwd)
  const r = lerRoteiro(cwd) || {}
  const g = lerGit(cwd)
  const base = JSON.stringify([p ? p.feitas : -1, g.branch, g.commit, r.milestone ?? null, r.etapa_concluida ?? null, r.pr ?? null])
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 16)
}

/** Os números do evento final do Claude (stream-json "result"). Nunca guarda o texto. */
function consumoDoResultado(j) {
  if (!j || j.type !== 'result') return null
  const u = j.usage && typeof j.usage === 'object' ? j.usage : {}
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    passos: n(j.num_turns), duracaoMs: n(j.duration_ms), custoUsd: n(j.total_cost_usd),
    entrada: n(u.input_tokens), saida: n(u.output_tokens), cacheLido: n(u.cache_read_input_tokens), cacheCriado: n(u.cache_creation_input_tokens),
    modelos: j.modelUsage && typeof j.modelUsage === 'object' ? Object.keys(j.modelUsage).filter((k) => /^[\w.-]{1,60}$/.test(k)).sort() : [],
  }
}

const arqConsumo = (cwd) => path.join(cwd, '.atlas', 'consumo.jsonl')
function lerConsumo(cwd) {
  const t = lerTexto(arqConsumo(cwd), 2_000_000)
  if (!t) return []
  const out = []
  for (const l of t.split('\n')) { if (!l.trim()) continue; try { out.push(JSON.parse(l)) } catch { /* linha quebrada */ } }
  return out
}
/** Um turno a mais no registro (guarda os últimos 200). */
function registrarConsumo(cwd, item) {
  try {
    fs.mkdirSync(path.join(cwd, '.atlas'), { recursive: true })
    const todos = [...lerConsumo(cwd), item].slice(-MAX_CONSUMO)
    gravarAtomico(arqConsumo(cwd), todos.map((x) => JSON.stringify(x)).join('\n') + '\n')
  } catch { /* registro é extra */ }
}

module.exports = { retratoDaObra, marcaDeAvanco, consumoDoResultado, registrarConsumo, lerConsumo, lerGit }
