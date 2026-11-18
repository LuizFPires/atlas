// Validação do PLAN.md das obras do cliente: o painel (.claude/hooks/plano.cjs) só entende este formato.
// Reaproveita o gerador do M18 (montarPlanMd); aqui está o porteiro que recusa qualquer PLAN fora do formato.

export interface ResultadoPlan { ok: boolean; erros: string[]; milestones: number; tarefas: number }

// Mesmo cabeçalho que o painel aceita (plano.cjs).
const RE_MS = /^##\s+(?:Milestone\s+|M)(\d+)\s*[—–:-]\s*(.+?)\s*$/i
const RE_TAREFA = /^\s*[-*]\s+\[( |x|X)\]/

interface Bloco { n: number; titulo: string; peso?: number; spec: boolean; tela: boolean; tarefas: number; notas: boolean }

/** Confere cada milestone: cabeçalho numerado em sequência, `peso:` 1 a 3, `spec:`, `tela:`, tarefas `- [ ]` e `Notas:`. */
export function validarPlanObra(md: string): ResultadoPlan {
  const erros: string[] = []
  const linhas = md.split(/\r?\n/)
  if (!/^#\s+PLAN\s+[—–-]\s+\S/.test(linhas.find((l) => l.trim()) ?? '')) erros.push('A primeira linha deve ser "# PLAN — <nome da obra>".')
  if (!linhas.some((l) => /^Fonte da verdade:\s*\S/.test(l))) erros.push('Falta a linha "Fonte da verdade: prototipo/ ...".')

  let atual = null as Bloco | null
  const blocos: Bloco[] = []
  for (const l of linhas) {
    const m = l.match(RE_MS)
    if (m) { atual = { n: Number(m[1]), titulo: m[2], spec: false, tela: false, tarefas: 0, notas: false }; blocos.push(atual); continue }
    if (/^##\s/.test(l)) { atual = null; continue }
    if (!atual) continue
    const p = l.match(/^peso:\s*(\d+(?:[.,]\d+)?)\s*$/i)
    if (p) atual.peso = Number(p[1].replace(',', '.'))
    if (/^spec:/i.test(l)) atual.spec = true
    if (/^tela:/i.test(l)) atual.tela = true
    if (RE_TAREFA.test(l)) atual.tarefas++
    if (/^Notas:/i.test(l)) atual.notas = true
  }
  if (!blocos.length) erros.push('Nenhum milestone no formato "## Milestone N — título".')
  blocos.forEach((b, i) => {
    const nome = `Milestone ${b.n}`
    if (b.n !== i + 1) erros.push(`${nome}: a numeração deve seguir a ordem (esperado ${i + 1}).`)
    if (b.peso === undefined) erros.push(`${nome}: falta "peso: N".`)
    else if (b.peso < 1 || b.peso > 3) erros.push(`${nome}: o peso vai de 1 a 3.`)
    if (!b.spec) erros.push(`${nome}: falta a linha "spec:".`)
    if (!b.tela) erros.push(`${nome}: falta a linha "tela:".`)
    if (b.tarefas === 0) erros.push(`${nome}: precisa de ao menos uma tarefa "- [ ]".`)
    if (!b.notas) erros.push(`${nome}: falta a linha "Notas:".`)
  })
  return { ok: erros.length === 0, erros, milestones: blocos.length, tarefas: blocos.reduce((s, b) => s + b.tarefas, 0) }
}

/** Para plano novo de obra: além do formato, nada pode começar marcado como feito. */
export function validarPlanNovo(md: string): ResultadoPlan {
  const r = validarPlanObra(md)
  if (/^\s*[-*]\s+\[[xX]\]/m.test(md)) { r.erros.push('Uma obra nova não pode começar com tarefas já marcadas.'); r.ok = false }
  return r
}
