#!/usr/bin/env node
// Avanço do PLAN.md no terminal, sem gastar tokens com a leitura do arquivo inteiro.
// Uso: node .claude/hooks/progresso.cjs            → todos os milestones
//      node .claude/hooks/progresso.cjs --curto    → avanço e próximo milestone
//      node .claude/hooks/progresso.cjs --milestone 3 → só o texto do Milestone 3
const { lerPlano, blocoMilestone, lerRoteiro } = require('./plano.cjs');
const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const iM = process.argv.indexOf('--milestone');
if (iM > -1) {
  const b = blocoMilestone(raiz, process.argv[iM + 1]);
  console.log(b || `Milestone ${process.argv[iM + 1]} não encontrado no PLAN.md.`);
  process.exit(b ? 0 : 1);
}

const p = lerPlano(raiz);
if (!p) { console.log('PLAN.md não encontrado (procurei em PLAN.md e docs/PLAN.md).'); process.exit(0); }
if (!p.milestones.length) {
  console.log(`${p.arquivo} fora do formato: nenhum "## Milestone N — título" encontrado.`);
  process.exit(1);
}
const barra = (pct, n = 20) => '█'.repeat(Math.round(pct / 100 * n)).padEnd(n, '░');
console.log(`Avanço ${barra(p.pct)} ${p.pct.toLocaleString('pt-BR')}%  (${p.feitas}/${p.tarefas} tarefas)`);
const pz = require('./prazo.cjs').calcularPrazo(raiz);
if (pz.status === 'estimado') {
  console.log(`Prazo restante ≈ ${pz.restante} de trabalho (entre ${pz.faixa}; confiança ${pz.confianca})`);
  console.log(`  ritmo ${pz.ritmo} · ${pz.trabalhado} trabalhadas${pz.porDia ? ` · ~${pz.porDia} por dia` : ''}${pz.dataTxt ? ` · previsão de conclusão: ${pz.dataTxt}${pz.baseData ? ` (${pz.baseData})` : ''}` : ''}`);
} else console.log(`Prazo restante: ${pz.texto}`);
const r = lerRoteiro(raiz);
if (r) console.log(`Roteiro: ${r.milestone || '?'} · etapa ${r.etapa_concluida ?? 0}/4 concluída${r.pr ? ` · PR #${r.pr}` : ''}`);
if (process.argv.includes('--curto')) {
  console.log(p.proximo ? `Próximo: Milestone ${p.proximo}` : 'Todos os milestones concluídos.');
  process.exit(0);
}
const icone = { concluido: '✔', andamento: '◐', pendente: '·' };
for (const m of p.milestones) {
  console.log(`${icone[m.status]} M${m.n} ${m.titulo} — ${m.feitas}/${m.total} (peso ${m.peso})`);
}
