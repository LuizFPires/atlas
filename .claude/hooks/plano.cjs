// Lê o PLAN.md e calcula o avanço. Usado pelo painel e pelo progresso.cjs. Não gasta tokens.
const fs = require('fs');
const path = require('path');

// aceita "## Milestone 3 — título", "## M3 — título" e "## M3: título"
const RE_MS = /^##\s+(?:Milestone\s+|M)(\d+)\s*[—–:-]\s*(.+?)\s*$/i;

function arquivoPlano(raiz) {
  for (const p of ['PLAN.md', 'docs/PLAN.md']) {
    const a = path.join(raiz, p);
    if (fs.existsSync(a)) return a;
  }
  return null;
}

function lerPlano(raiz) {
  const arq = arquivoPlano(raiz);
  if (!arq) return null;
  const linhas = fs.readFileSync(arq, 'utf8').split(/\r?\n/);
  const milestones = [];
  let atual = null;
  for (const l of linhas) {
    const m = l.match(RE_MS);
    if (m) {
      atual = { n: Number(m[1]), titulo: m[2], peso: 1, total: 0, feitas: 0 };
      milestones.push(atual);
      continue;
    }
    if (/^##\s/.test(l)) { atual = null; continue; }
    if (!atual) continue;
    const p = l.match(/^peso:\s*(\d+(?:[.,]\d+)?)/i);
    if (p) atual.peso = Number(p[1].replace(',', '.'));
    const t = l.match(/^\s*[-*]\s+\[( |x|X)\]/);
    if (t) { atual.total++; if (t[1] !== ' ') atual.feitas++; }
  }
  let pesoTotal = 0, pesoFeito = 0, tarefas = 0, feitas = 0;
  for (const m of milestones) {
    const frac = m.total ? m.feitas / m.total : 0;
    m.pct = Math.round(frac * 100);
    m.status = m.total && m.feitas === m.total ? 'concluido' : m.feitas > 0 ? 'andamento' : 'pendente';
    pesoTotal += m.peso; pesoFeito += m.peso * frac;
    tarefas += m.total; feitas += m.feitas;
  }
  const proximo = milestones.find(m => m.status !== 'concluido') || null;
  const pctTotal = pesoTotal ? Math.round((pesoFeito / pesoTotal) * 1000) / 10 : 0;
  // Rodada (ampliação): .canteiro/rodada.json {nome, inicio, desde} faz o avanço contar só a partir do milestone `inicio`
  const rodada = lerRodada(raiz);
  if (rodada) {
    const da = milestones.filter(m => m.n >= rodada.inicio);
    let pt = 0, pf = 0, t = 0, f = 0;
    for (const m of da) { const frac = m.total ? m.feitas / m.total : 0; pt += m.peso; pf += m.peso * frac; t += m.total; f += m.feitas; }
    return {
      arquivo: path.relative(raiz, arq), milestones, tarefas: t, feitas: f,
      pct: pt ? Math.round((pf / pt) * 1000) / 10 : 0,
      proximo: proximo ? proximo.n : null,
      rodada: { ...rodada, milestones: da.length, pctTotal, tarefasTotal: tarefas, feitasTotal: feitas },
    };
  }
  return {
    arquivo: path.relative(raiz, arq),
    milestones, tarefas, feitas,
    pct: pctTotal,
    proximo: proximo ? proximo.n : null,
  };
}

function lerRodada(raiz) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(raiz, '.canteiro', 'rodada.json'), 'utf8'));
    return r && Number(r.inicio) > 0 ? { nome: String(r.nome || 'nova rodada'), inicio: Number(r.inicio), desde: r.desde || null } : null;
  } catch { return null; }
}

// Devolve só o texto de um milestone (para o coordenador não ler o PLAN inteiro).
function blocoMilestone(raiz, n) {
  const arq = arquivoPlano(raiz);
  if (!arq) return null;
  const linhas = fs.readFileSync(arq, 'utf8').split(/\r?\n/);
  const saida = [];
  let dentro = false;
  for (const l of linhas) {
    const m = l.match(RE_MS);
    if (m) { if (dentro) break; dentro = Number(m[1]) === Number(n); }
    else if (dentro && /^##\s/.test(l)) break;
    if (dentro) saida.push(l);
  }
  return saida.length ? saida.join('\n').trim() : null;
}

// Estado do roteiro (.codex/roteiro.json tem prioridade, como no roteiro-milestone original).
function lerRoteiro(raiz) {
  for (const p of ['.codex/roteiro.json', '.claude/roteiro.json']) {
    try { return JSON.parse(fs.readFileSync(path.join(raiz, p), 'utf8')); } catch {}
  }
  return null;
}

module.exports = { lerRodada, lerPlano, blocoMilestone, lerRoteiro };
