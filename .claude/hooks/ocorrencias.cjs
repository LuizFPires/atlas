#!/usr/bin/env node
// Livro de ocorrências: bloqueios externos (billing, cota, serviço fora do ar, credencial de terceiro)
// que não podem parar a obra. Fica em docs/ocorrencias.json, versionado, para qualquer sessão enxergar.
//
// Uso:
//   node .claude/hooks/ocorrencias.cjs abrir --servico Vercel --motivo "cota de deploy estourada" \
//        --acao "deploy de produção da main" --teste "npx vercel whoami" --liberar-em 2026-11-02T12:00 --bloqueia "M4:5,M5:2"
//   node .claude/hooks/ocorrencias.cjs listar            → todas as abertas
//   node .claude/hooks/ocorrencias.cjs vencidas          → abertas cujo horário de liberação já passou (ou sem horário)
//   node .claude/hooks/ocorrencias.cjs bloqueia M4       → diz se o milestone depende de alguma ocorrência aberta
//   node .claude/hooks/ocorrencias.cjs tentativa 3 --nota "ainda 402" [--liberar-em ...]
//   node .claude/hooks/ocorrencias.cjs resolver 3 --nota "deploy ok: https://..."
const fs = require('fs');
const path = require('path');

const RAIZ = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const ARQ = path.join(RAIZ, 'docs', 'ocorrencias.json');

function ler() {
  try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch { return { proximo_id: 1, ocorrencias: [] }; }
}
function gravar(d) {
  fs.mkdirSync(path.dirname(ARQ), { recursive: true });
  fs.writeFileSync(ARQ, JSON.stringify(d, null, 2) + '\n');
}
function args(lista) {
  const o = { _: [] };
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].startsWith('--')) { o[lista[i].slice(2)] = lista[i + 1]; i++; } else o._.push(lista[i]);
  }
  return o;
}
function dataISO(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d)) { console.error(`Data inválida: ${s}. Use AAAA-MM-DDTHH:MM.`); process.exit(1); }
  return d.toISOString();
}
const hora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem horário';
const linha = o => `#${o.id} [${o.servico}] ${o.motivo} → quando liberar: ${o.acao} · libera: ${hora(o.liberar_em)} · bloqueia: ${o.bloqueia.join(', ') || 'nada'} · tentativas: ${o.tentativas.length}`;

const [cmd, ...resto] = process.argv.slice(2);
const a = args(resto);
const d = ler();
const abertas = d.ocorrencias.filter(o => o.status === 'aberta');

switch (cmd) {
  case 'abrir': {
    for (const c of ['servico', 'motivo', 'acao']) if (!a[c]) { console.error(`Falta --${c}`); process.exit(1); }
    const o = {
      id: d.proximo_id++, status: 'aberta', servico: a.servico, motivo: a.motivo, acao: a.acao,
      teste: a.teste || null, liberar_em: dataISO(a['liberar-em']),
      bloqueia: (a.bloqueia || '').split(',').map(s => s.trim()).filter(Boolean),
      criada_em: new Date().toISOString(), tentativas: [], resolvida_em: null, nota_final: null,
    };
    d.ocorrencias.push(o); gravar(d);
    console.log('Ocorrência aberta: ' + linha(o));
    break;
  }
  case 'listar':
    console.log(abertas.length ? abertas.map(linha).join('\n') : 'Nenhuma ocorrência aberta.');
    break;
  case 'vencidas': {
    const agora = Date.now();
    const v = abertas.filter(o => !o.liberar_em || new Date(o.liberar_em).getTime() <= agora);
    console.log(v.length ? v.map(linha).join('\n') : 'Nenhuma ocorrência vencida.');
    break;
  }
  case 'bloqueia': {
    const m = (a._[0] || '').toUpperCase();
    const b = abertas.filter(o => o.bloqueia.some(x => x.toUpperCase() === m || x.toUpperCase().startsWith(m + ':')));
    console.log(b.length ? `${m} depende de: ` + b.map(o => `#${o.id} ${o.servico} (${o.bloqueia.filter(x => x.toUpperCase().startsWith(m)).join(', ')})`).join('; ') : `${m} não depende de nenhuma ocorrência aberta.`);
    break;
  }
  case 'tentativa':
  case 'resolver': {
    const o = d.ocorrencias.find(x => x.id === Number(a._[0]));
    if (!o) { console.error('Ocorrência não encontrada.'); process.exit(1); }
    if (cmd === 'tentativa') {
      o.tentativas.push({ em: new Date().toISOString(), nota: a.nota || '' });
      if (a['liberar-em']) o.liberar_em = dataISO(a['liberar-em']);
    } else {
      o.status = 'resolvida'; o.resolvida_em = new Date().toISOString(); o.nota_final = a.nota || '';
    }
    gravar(d);
    console.log((cmd === 'resolver' ? 'Resolvida: ' : 'Tentativa registrada: ') + linha(o));
    break;
  }
  default:
    console.log('Comandos: abrir, listar, vencidas, bloqueia <Mn>, tentativa <id>, resolver <id>');
}
