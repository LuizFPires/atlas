#!/usr/bin/env node
// Hook do Claude Code: grava cada evento numa linha de .canteiro/eventos.jsonl.
// Roda fora do modelo: não gasta tokens. Nunca bloqueia nada (sempre sai com 0).
const fs = require('fs');
const path = require('path');

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (entrada += c));
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(entrada || '{}');
    const raiz = process.env.CLAUDE_PROJECT_DIR || d.cwd || process.cwd();
    const dir = path.join(raiz, '.canteiro');
    fs.mkdirSync(dir, { recursive: true });

    const ti = d.tool_input || {};
    const ferramenta = d.tool_name || '';
    const despacho = /^(Task|Agent)$/.test(ferramenta);
    let alvo = ti.file_path || ti.path || ti.pattern || ti.command || ti.description || '';
    if (despacho) alvo = ti.subagent_type || 'general-purpose';
    alvo = String(alvo).replace(raiz + path.sep, '').slice(0, 80);

    const linha = {
      ts: Date.now(),
      ev: d.hook_event_name || '',
      agente: d.agent_type || 'coordenador',
      id: d.agent_id || null,
      ferramenta,
      alvo,
      despacho,
    };
    fs.appendFileSync(path.join(dir, 'eventos.jsonl'), JSON.stringify(linha) + '\n');
    require('./obras.cjs').registrar(raiz); // entra na carteira de obras do painel
    try { // relógio de trabalho e histórico do avanço, para o prazo restante
      const prazo = require('./prazo.cjs');
      prazo.tique(raiz, linha.ts, linha.ev);
      if (/PLAN\.md$/i.test(alvo) || /^(SubagentStop|Stop)$/.test(linha.ev)) prazo.registrarAvanco(raiz, linha.ts);
    } catch (_) {}
  } catch (_) { /* o painel nunca pode atrapalhar o trabalho */ }
  process.exit(0);
});
