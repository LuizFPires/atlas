#!/usr/bin/env node
// Registra a etapa atual da linha para o painel. Uso: node .claude/hooks/etapa.cjs <etapa>
const fs = require('fs');
const path = require('path');
const ETAPAS = ['briefing', 'design', 'prototipo', 'documentacao', 'revisao', 'construcao', 'lancamento', 'entregue'];
const etapa = (process.argv[2] || '').toLowerCase();
if (!ETAPAS.includes(etapa)) {
  console.log('Etapa inválida. Use: ' + ETAPAS.join(', '));
  process.exit(1);
}
const dir = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.canteiro');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'etapa.json'), JSON.stringify({ etapa, desde: new Date().toISOString() }));
fs.appendFileSync(path.join(dir, 'eventos.jsonl'),
  JSON.stringify({ ts: Date.now(), ev: 'Etapa', agente: 'coordenador', alvo: etapa }) + '\n');
require('./obras.cjs').registrar(process.env.CLAUDE_PROJECT_DIR || process.cwd());
console.log('Etapa: ' + etapa);
