// Espelho em CommonJS de montarPlanMd (src/app/ponte-construcao.ts), comoDado (src/app/ponte-estilo.ts) e validarPlanObra /
// validarPlanNovo (src/kit/plan-obra.ts). O processo principal do Electron não importa TypeScript; manter em sincronia.
// Gera o PLAN.md da obra no formato que o painel do canteiro (.claude/hooks/plano.cjs) lê, e recusa PLAN fora desse formato.
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (construcao.teste.cjs confere formato e validação).
'use strict'

const INVISIVEIS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g

/** Texto livre vira dado: sem controle nem HTML, sem marcação de título/lista/citação/código, uma linha por item. */
function comoDado(texto, max = 1500) {
  return String(texto)
    .normalize('NFC').replace(INVISIVEIS, '').slice(0, max).split(/\r?\n/)
    .map((l) => l.replace(/</g, '‹').replace(/>/g, '›').replace(/`/g, "'").replace(/^[\s#>*+\-=|~_]+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const umaLinha = (t, max, vazio) => comoDado(t, max * 2).join(' ').slice(0, max).trim() || vazio

function montarPlanMd(obraNome, etapas) {
  const nome = umaLinha(obraNome, 80, 'Obra')
  const saida = [
    `# PLAN — ${nome}`,
    'Fonte da verdade: prototipo/ (aprovado pelo cliente)',
    '',
    'Cada milestone é uma etapa da obra. Detalhe do que construir está em telas.md e regras.md, na pasta da obra.',
  ]
  etapas.forEach((e, i) => {
    const n = i + 1
    const titulo = umaLinha(e.nome, 60, `Etapa ${n}`)
    const desc = umaLinha(e.desc, 160, titulo)
    const tela = typeof e.tela === 'string' && /^[a-zA-Z0-9._\-/]+$/.test(e.tela) && !e.tela.includes('..') && !e.tela.startsWith('/') ? e.tela : ''
    saida.push('', `## Milestone ${n} — ${titulo}`, 'peso: 2', 'spec: regras.md, telas.md', `tela: ${tela}`,
      `- [ ] Construir: ${desc}`, '- [ ] Testar o que foi feito', '- [ ] Conferir com o protótipo aprovado', 'Notas:')
  })
  return saida.join('\n') + '\n'
}

const RE_MS = /^##\s+(?:Milestone\s+|M)(\d+)\s*[—–:-]\s*(.+?)\s*$/i
const RE_TAREFA = /^\s*[-*]\s+\[( |x|X)\]/

function validarPlanObra(md) {
  const erros = []
  const linhas = md.split(/\r?\n/)
  if (!/^#\s+PLAN\s+[—–-]\s+\S/.test(linhas.find((l) => l.trim()) ?? '')) erros.push('primeira-linha')
  if (!linhas.some((l) => /^Fonte da verdade:\s*\S/.test(l))) erros.push('fonte-da-verdade')
  let atual = null
  const blocos = []
  for (const l of linhas) {
    const m = l.match(RE_MS)
    if (m) { atual = { n: Number(m[1]), spec: false, tela: false, tarefas: 0, notas: false }; blocos.push(atual); continue }
    if (/^##\s/.test(l)) { atual = null; continue }
    if (!atual) continue
    const p = l.match(/^peso:\s*(\d+(?:[.,]\d+)?)\s*$/i)
    if (p) atual.peso = Number(p[1].replace(',', '.'))
    if (/^spec:/i.test(l)) atual.spec = true
    if (/^tela:/i.test(l)) atual.tela = true
    if (RE_TAREFA.test(l)) atual.tarefas++
    if (/^Notas:/i.test(l)) atual.notas = true
  }
  if (!blocos.length) erros.push('sem-milestone')
  blocos.forEach((b, i) => {
    if (b.n !== i + 1) erros.push(`ms${b.n}-numeracao`)
    if (b.peso === undefined || b.peso < 1 || b.peso > 3) erros.push(`ms${b.n}-peso`)
    if (!b.spec) erros.push(`ms${b.n}-spec`)
    if (!b.tela) erros.push(`ms${b.n}-tela`)
    if (b.tarefas === 0) erros.push(`ms${b.n}-tarefas`)
    if (!b.notas) erros.push(`ms${b.n}-notas`)
  })
  return { ok: erros.length === 0, erros, milestones: blocos.length }
}

/** Plano novo: além do formato, nada pode começar marcado como feito. */
function validarPlanNovo(md) {
  const r = validarPlanObra(md)
  if (/^\s*[-*]\s+\[[xX]\]/m.test(md)) { r.erros.push('ja-marcado'); r.ok = false }
  return r
}

module.exports = { montarPlanMd, validarPlanObra, validarPlanNovo, comoDado }
