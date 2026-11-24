#!/usr/bin/env node
// Espera o CI do PR em silêncio e devolve UMA linha (economia de tokens, 24/11/2026).
// `gh pr checks --watch` reimprime a tabela inteira a cada 10 s: num CI de 8 minutos, são centenas de linhas despejadas na
// conversa da linha de produção (e relidas a cada passo seguinte). Aqui o resultado é uma linha só.
// Uso: node .claude/hooks/esperar-ci.cjs <número do PR> [minutos máximos, padrão e teto 9: cabe no limite de 10 min do Bash]
//      Se voltar "ainda rodando", rode de novo.
// Saída: "CI verde: 4 checks." | "CI vermelho: build (falhou), testes (falhou)." | "CI ainda rodando depois de 9 min: build." |
//        "CI ausente: nenhum check neste PR." | "CI travado pela cobrança do GitHub: …"
'use strict';

const TERMINAL_OK = new Set(['pass', 'skipping']);
const TERMINAL_RUIM = new Set(['fail', 'cancel']);
const RE_COBRANCA = /recent account payments have failed|spending limit|billing/i;

/** checks: [{ name, bucket, state, description? }] (gh pr checks --json name,bucket,state,description). */
function resumoDosChecks(checks) {
  const lista = Array.isArray(checks) ? checks.filter((c) => c && typeof c.name === 'string') : [];
  if (!lista.length) return { fim: true, texto: 'CI ausente: nenhum check neste PR.' };
  const cobranca = lista.find((c) => RE_COBRANCA.test(String(c.description || '')));
  if (cobranca) return { fim: true, texto: `CI travado pela cobrança do GitHub: ${String(cobranca.description).slice(0, 160)}` };
  const pendentes = lista.filter((c) => !TERMINAL_OK.has(c.bucket) && !TERMINAL_RUIM.has(c.bucket));
  if (pendentes.length) return { fim: false, texto: `CI rodando: ${pendentes.map((c) => c.name).join(', ')}.` };
  const ruins = lista.filter((c) => TERMINAL_RUIM.has(c.bucket));
  if (ruins.length) return { fim: true, texto: `CI vermelho: ${ruins.map((c) => `${c.name} (${c.bucket === 'cancel' ? 'cancelado' : 'falhou'})`).join(', ')}. Detalhe só do que falhou: gh run view <id> --log-failed | tail -60` };
  return { fim: true, texto: `CI verde: ${lista.length} ${lista.length === 1 ? 'check' : 'checks'}.` };
}

async function esperar({ pr, maxMin = 9, consultar, dormir = (ms) => new Promise((r) => setTimeout(r, ms)), intervaloMs = 20000 }) {
  const fimEm = Date.now() + maxMin * 60000;
  let ultimo = null;
  for (;;) {
    try { ultimo = resumoDosChecks(consultar(pr)); } catch { ultimo = { fim: false, texto: 'CI: não consegui consultar o GitHub agora.' }; }
    if (ultimo.fim) return ultimo.texto;
    if (Date.now() >= fimEm) return `${ultimo.texto.replace(/^CI rodando:/, `CI ainda rodando depois de ${maxMin} min:`)}`;
    await dormir(intervaloMs);
  }
}

if (require.main === module) {
  const pr = process.argv[2];
  const maxMin = Math.min(9, Math.max(1, Number(process.argv[3]) || 9));
  if (!/^\d{1,7}$/.test(String(pr || ''))) { console.log('Uso: node .claude/hooks/esperar-ci.cjs <número do PR> [minutos]'); process.exit(1); }
  const consultar = (n) => {
    const r = require('child_process').spawnSync('gh', ['pr', 'checks', String(n), '--json', 'name,bucket,state,description'], { cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(), encoding: 'utf8', timeout: 60000 });
    const saida = String(r.stdout || '').trim();
    if (!saida && /no checks reported/i.test(String(r.stderr || ''))) return [];
    return JSON.parse(saida || '[]');
  };
  esperar({ pr, maxMin, consultar }).then((t) => { console.log(t); process.exit(/^CI (verde|ausente)/.test(t) ? 0 : 1); });
}

module.exports = { resumoDosChecks, esperar };
