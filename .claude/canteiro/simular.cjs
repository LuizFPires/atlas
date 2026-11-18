#!/usr/bin/env node
// Simulação de uma obra completa no canteiro, para demonstração. Não usa o Claude nem gasta tokens:
// este script faz o papel dos agentes e grava os mesmos eventos que os hooks gravariam.
// Uso: node .claude/canteiro/simular.cjs [--rapido] [--repetir] [--abrir]
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { registrar, idDe } = require('../hooks/obras.cjs');
const prazo = require('../hooks/prazo.cjs');

const args = process.argv.slice(2);
const FATOR = args.includes('--rapido') ? 0.6 : 1.6;
const PORTA = Number(process.env.CANTEIRO_PORTA || 4747);
const RAIZ = path.join(process.env.CANTEIRO_HOME || path.join(os.homedir(), '.canteiro'), 'simulacao', 'Diario-de-Obra-DEMO');
const DIR = path.join(RAIZ, '.canteiro');
const espera = s => new Promise(r => setTimeout(r, s * 1000 * FATOR));

const MILESTONES = [
  { t: 'Base, login e perfis', peso: 1, tarefas: ['Projeto e CI configurados', 'Login com e-mail', 'Perfis: engenheiro, mestre, cliente', 'Testes do login'] },
  { t: 'Cadastro de obras', peso: 2, tarefas: ['Lista de obras', 'Formulário de obra', 'Equipe da obra', 'Conferir fidelidade com o protótipo'] },
  { t: 'Diário do dia', peso: 3, tarefas: ['Registro do dia com clima', 'Efetivo por função', 'Fotos com legenda', 'Publicar em produção'] },
  { t: 'Feed da obra', peso: 2, tarefas: ['Feed estilo Instagram', 'Comentários', 'Notificações'] },
  { t: 'Relatório em PDF', peso: 2, tarefas: ['Relatório fotográfico', 'Assinatura do responsável', 'Envio por e-mail'] },
  { t: 'Ajustes finais', peso: 1, tarefas: ['Acessibilidade', 'Desempenho', 'Conferir fidelidade com o protótipo'] },
];
const feitas = MILESTONES.map(() => 0);

function plano() {
  let s = '# PLAN — Diário de Obra (DEMO)\nFonte da verdade: prototipo/ (aprovado)\n\n';
  MILESTONES.forEach((m, i) => {
    s += `## M${i + 1} — ${m.t}\npeso: ${m.peso}\n`;
    m.tarefas.forEach((t, j) => (s += `- [${j < feitas[i] ? 'x' : ' '}] ${t}\n`));
    s += 'Notas:\n\n';
  });
  fs.writeFileSync(path.join(RAIZ, 'PLAN.md'), s);
  prazo.registrarAvanco(RAIZ);
}
function ev(agente, ferramenta, alvo = '', extra = {}) {
  prazo.tique(RAIZ, Date.now(), 'PreToolUse');
  fs.appendFileSync(path.join(DIR, 'eventos.jsonl'), JSON.stringify({ ts: Date.now(), ev: 'PreToolUse', agente, ferramenta, alvo, ...extra }) + '\n');
}
function bruto(ev_, agente, alvo = '') {
  prazo.tique(RAIZ, Date.now(), ev_);
  fs.appendFileSync(path.join(DIR, 'eventos.jsonl'), JSON.stringify({ ts: Date.now(), ev: ev_, agente, alvo }) + '\n');
}
function etapa(e) {
  fs.writeFileSync(path.join(DIR, 'etapa.json'), JSON.stringify({ etapa: e }));
  bruto('Etapa', 'coordenador', e);
  console.log(`  ▸ etapa: ${e}`);
}
function roteiro(m, ec, pr) {
  fs.writeFileSync(path.join(RAIZ, '.claude', 'roteiro.json'), JSON.stringify({ milestone: 'M' + m, titulo: MILESTONES[m - 1].t, etapa_concluida: ec, pr }));
}
function ocorrencias(lista) {
  fs.writeFileSync(path.join(RAIZ, 'docs', 'ocorrencias.json'), JSON.stringify({ proximo_id: 2, ocorrencias: lista }, null, 2));
}
async function equipe(papel, passos, intervalo = 2.2) {
  ev('coordenador', 'Agent', papel, { despacho: true });
  await espera(1);
  bruto('SubagentStart', papel);
  for (const [f, a] of passos) { await espera(intervalo); ev(papel, f, a); }
  await espera(1.5);
  bruto('SubagentStop', papel);
}

async function obra() {
  fs.rmSync(RAIZ, { recursive: true, force: true });
  for (const d of [DIR, path.join(RAIZ, '.claude'), path.join(RAIZ, 'docs')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'LEIA-ME.txt'), 'Obra de demonstração do canteiro. Pode apagar esta pasta.\n');
  try { fs.unlinkSync(path.join(DIR, 'registro')); } catch {}
  registrar(RAIZ);
  feitas.fill(0);

  console.log('\n🏗  Obra de demonstração: Diário de Obra');
  etapa('briefing');
  bruto('UserPromptSubmit', 'coordenador');
  await espera(2);
  for (const a of ['docs/briefing.md', 'docs/briefing.md']) { await espera(2.5); ev('coordenador', 'Write', a); }

  etapa('design');
  await equipe('designer', [['Read', 'docs/briefing.md'], ['Write', 'docs/design-system.md'], ['Edit', 'docs/design-system.md']]);

  etapa('prototipo');
  for (const a of ['prototipo/index.html#tela-login', 'prototipo/index.html#tela-obras', 'prototipo/index.html#tela-diario', 'prototipo/index.html#tela-feed']) { await espera(2.2); ev('coordenador', 'Edit', a); }

  etapa('documentacao');
  await equipe('escritor', [['Read', 'prototipo/TELAS.md'], ['Write', 'PRD.md'], ['Write', 'SPEC.md'], ['Write', 'PLAN.md']], 1.8);
  plano();
  etapa('revisao');
  await equipe('revisor', [['Read', 'CLAUDE.md'], ['Edit', 'CLAUDE.md'], ['Edit', 'PLAN.md']], 1.8);

  etapa('construcao');
  prazo.registrarAvanco(RAIZ); // ponto de partida do prazo
  await equipe('despachante', [['Bash', 'gh auth status'], ['Bash', 'gh repo create diario-de-obra --private']], 1.6);

  let pr = 3;
  for (let i = 0; i < MILESTONES.length; i++) {
    const m = i + 1, nome = MILESTONES[i].t, n = MILESTONES[i].tarefas.length;
    console.log(`  ▸ M${m} — ${nome}`);
    if (m === 5) {
      ev('coordenador', 'Bash', 'ocorrencias.cjs vencidas');
      await equipe('plantonista', [['Bash', 'npx vercel whoami'], ['Bash', 'npx vercel --prod'], ['Bash', 'ocorrencias.cjs resolver 1']], 2);
      ocorrencias([]);
      feitas[2] = MILESTONES[2].tarefas.length; plano();
      console.log('    ✔ ocorrência #1 resolvida: deploy feito');
    }
    roteiro(m, 0, null);
    ev('coordenador', 'Bash', `git checkout -b feat/m${m}`);
    await espera(1.5);
    roteiro(m, 1, null);
    const arquivos = ['src/app/page.tsx', 'src/telas/' + nome.split(' ')[0] + '.tsx', 'src/lib/supabase.ts', 'supabase/migrations/00' + (m + 10) + '.sql'];
    await equipe('implementador', [['Read', 'SPEC.md'], ...arquivos.map(a => ['Edit', a]), ['Bash', 'pnpm test']], 1.6);
    pr++;
    ev('coordenador', 'Bash', `gh pr create (PR #${pr})`);
    roteiro(m, 2, pr);
    await equipe('qa', [['Bash', `git diff main...HEAD`], ['Bash', 'pnpm test'], ['Bash', 'playwright test']], 1.6);
    roteiro(m, 3, pr);
    let medir = n;
    if (m === 3) { // a cota da Vercel estoura: a obra não para
      medir = n - 1;
      ocorrencias([{ id: 1, status: 'aberta', servico: 'Vercel', motivo: 'cota de deploy estourada', acao: 'deploy de produção da main', liberar_em: new Date(Date.now() + 90e3 * FATOR).toISOString(), bloqueia: ['M3:4'], tentativas: [] }]);
      ev('coordenador', 'Bash', 'ocorrencias.cjs abrir --servico Vercel');
      console.log('    ⏸ ocorrência #1: cota da Vercel estourada — a obra segue');
    }
    for (let k = feitas[i]; k < medir; k++) { feitas[i] = k + 1; plano(); await espera(0.8); }
    ev('coordenador', 'Bash', `gh pr merge ${pr} --merge`);
    roteiro(m, 4, pr);
    await espera(2.5);
  }
  bruto('Stop', 'coordenador');

  etapa('lancamento');
  await equipe('vistoriador', [['Grep', 'enable row level security'], ['Grep', 'service_role'], ['Bash', 'pnpm build']], 1.8);
  await equipe('implantador', [['Bash', 'npx supabase db push'], ['Bash', 'flyctl deploy'], ['Bash', 'npx vercel --prod'], ['Bash', 'curl https://diario.app']], 1.8);
  await equipe('corretor', [['Edit', 'apps/mobile/app.json'], ['Write', 'store/textos.md'], ['Bash', 'npx eas-cli build --platform all'], ['Bash', 'npx eas-cli submit --latest']], 1.8);
  etapa('entregue');
  bruto('Stop', 'coordenador');
  console.log('🎆 Obra entregue: 100%\n');
}

function painelNoAr() {
  return new Promise(ok => {
    http.get(`http://127.0.0.1:${PORTA}/obras`, r => { let s = ''; r.on('data', c => (s += c)); r.on('end', () => { try { JSON.parse(s).obras; ok('novo'); } catch { ok('antigo'); } }); })
      .on('error', () => ok(null));
  });
}

(async () => {
  const url = `http://localhost:${PORTA}/?obra=${idDe(RAIZ)}&modo=3d`;
  const estado = await painelNoAr();
  if (!estado) console.log(`⚠ O painel não está no ar. Em outra janela, rode: node .claude/canteiro/server.cjs`);
  if (estado === 'antigo') console.log('⚠ Há um painel antigo na porta ' + PORTA + '. Feche essa janela e ligue o painel desta versão do kit.');
  console.log(`Abra no navegador: ${url}`);
  if (args.includes('--abrir')) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    setTimeout(() => exec(cmd), 2500);
  }
  do { await obra(); if (args.includes('--repetir')) await espera(15); } while (args.includes('--repetir'));
})();
