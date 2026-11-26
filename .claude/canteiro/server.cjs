#!/usr/bin/env node
// Painel do canteiro: UM servidor local para TODAS as obras deste computador.
// Uso: node .claude/canteiro/server.cjs [porta]   → http://localhost:4747
// Pode ser ligado de dentro de qualquer projeto: ele registra esse projeto e mostra a carteira inteira.
// Se já houver um canteiro no ar, este comando só registra o projeto e avisa (não briga pela porta).
// Subido pelo app Atlas (env CANTEIRO_NONCE): /obras?desafio=X devolve também `prova` = HMAC-SHA256(nonce, X), para o app confirmar
// que a porta é deste processo e não de outro programa; e porta ocupada = sai com erro (não reaproveita o "outro canteiro").
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { lerPlano, lerRoteiro } = require('../hooks/plano.cjs');
const { lerObras, registrar, remover } = require('../hooks/obras.cjs');
const { calcularPrazo } = require('../hooks/prazo.cjs');

const PORTA = Number(process.argv[2] || process.env.CANTEIRO_PORTA || 4747);
const NONCE = process.env.CANTEIRO_NONCE || '';
const ATIVO_MS = 30000;
const PAPEIS = ['coordenador', 'designer', 'escritor', 'revisor', 'implementador', 'qa', 'seguranca', 'desempenho', 'despachante', 'plantonista', 'vistoriador', 'implantador', 'corretor', 'incorporador', 'sindico'];
const ESQUECER_MS = 30 * 24 * 3600 * 1000; // obra sem movimento há 30 dias sai da carteira (volta sozinha no próximo evento)

// o projeto de onde o painel foi ligado entra na carteira
const origem = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const ehProjeto = d => ['PLAN.md', 'docs/PLAN.md', 'docs/briefing.md', 'prototipo'].some(p => fs.existsSync(path.join(d, p)));
const ID_ORIGEM = ehProjeto(origem) ? registrar(origem) : null;

function ultimosEventos(dir, max = 400) {
  const arq = path.join(dir, 'eventos.jsonl');
  if (!fs.existsSync(arq)) return [];
  const st = fs.statSync(arq);
  const ler = Math.min(st.size, 200000);
  const fd = fs.openSync(arq, 'r');
  const buf = Buffer.alloc(ler);
  fs.readSync(fd, buf, 0, ler, st.size - ler);
  fs.closeSync(fd);
  return buf.toString('utf8').split('\n').slice(-max).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// M63: fase do lançamento da obra (o Atlas grava .atlas/lancamento.json e .atlas/vendas.json): 'nada' | 'obra' | 'pronto'.
function faseLancamento(RAIZ) {
  try {
    const l = JSON.parse(fs.readFileSync(path.join(RAIZ, '.atlas', 'lancamento.json'), 'utf8'));
    if (!l || l.comecado !== true) return 'nada';
    let v = null;
    try { v = JSON.parse(fs.readFileSync(path.join(RAIZ, '.atlas', 'vendas.json'), 'utf8')); } catch { v = null; }
    return v && v.fase === 'aberta' ? 'pronto' : 'obra';
  } catch { return 'nada'; }
}

function estado(RAIZ) {
  const DIR = path.join(RAIZ, '.canteiro');
  const eventos = ultimosEventos(DIR);
  const agora = Date.now();
  const agentes = {};
  for (const p of PAPEIS) agentes[p] = { papel: p, ativo: false, ferramenta: '', alvo: '', ts: 0, sessoes: 0 };

  for (const e of eventos) {
    let papel = PAPEIS.includes(e.agente) ? e.agente : null;
    if (!papel) papel = 'implementador'; // subagentes genéricos trabalham na obra
    const a = agentes[papel];
    if (e.ev === 'SubagentStart') { a.ativo = true; a.sessoes++; a.ferramenta = 'chegou'; a.alvo = ''; }
    else if (e.ev === 'SubagentStop') { a.ativo = false; a.ferramenta = 'entregou'; a.alvo = ''; }
    else if (e.ev === 'Stop' && papel === 'coordenador') { a.ativo = false; a.ferramenta = 'aguardando você'; a.alvo = ''; }
    else if (e.ev === 'PreToolUse' || e.ev === 'UserPromptSubmit' || e.ev === 'Etapa') {
      a.ativo = true;
      a.ferramenta = e.ev === 'UserPromptSubmit' ? 'ouvindo você' : e.ev === 'Etapa' ? 'etapa' : e.ferramenta;
      a.alvo = e.alvo || '';
      if (e.despacho && PAPEIS.includes(e.alvo)) {
        agentes[e.alvo].ativo = true; agentes[e.alvo].ferramenta = 'chegou'; agentes[e.alvo].ts = e.ts;
      }
    }
    a.ts = e.ts;
  }
  for (const p of PAPEIS) {
    const a = agentes[p];
    if (a.ativo && agora - a.ts > ATIVO_MS * (p === 'coordenador' ? 1 : 4)) a.ativo = false;
  }

  let etapa = null;
  try { etapa = JSON.parse(fs.readFileSync(path.join(DIR, 'etapa.json'), 'utf8')).etapa; } catch {}
  const plano = lerPlano(RAIZ);
  if (!etapa) etapa = plano ? 'construcao' : 'briefing';

  let nome = path.basename(RAIZ);
  try {
    const t = fs.readFileSync(path.join(RAIZ, plano ? plano.arquivo : 'PLAN.md'), 'utf8').match(/^#\s+PLAN\s*[—–-]\s*(.+)$/m);
    if (t) nome = t[1].trim();
  } catch {}

  const feed = eventos
    .filter(e => e.ev === 'PreToolUse' || e.ev === 'SubagentStart' || e.ev === 'SubagentStop' || e.ev === 'Etapa' || e.ev === 'UserPromptSubmit')
    .slice(-40).reverse();

  let ocorrencias = [];
  try { ocorrencias = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs', 'ocorrencias.json'), 'utf8')).ocorrencias.filter(o => o.status === 'aberta'); } catch {}
  const ultimo = eventos.length ? eventos[eventos.length - 1].ts : 0;
  let prazo = null;
  try { prazo = calcularPrazo(RAIZ, agora); } catch {}
  return { nome, raiz: RAIZ, etapa, plano, roteiro: lerRoteiro(RAIZ), ocorrencias, agentes, feed, ultimo, agora, prazo, lancamento: faseLancamento(RAIZ) };
}

function carteira() {
  const obras = lerObras();
  const lista = [];
  for (const [id, o] of Object.entries(obras)) {
    if (!fs.existsSync(o.raiz)) continue; // pasta apagada ou movida
    const e = estado(o.raiz);
    const ultimo = Math.max(e.ultimo || 0, o.visto || 0);
    if (Date.now() - ultimo > ESQUECER_MS) continue;
    lista.push({
      id, nome: e.nome, raiz: o.raiz, etapa: e.etapa,
      pct: e.plano ? e.plano.pct : 0,
      milestones: e.plano ? e.plano.milestones.length : 0,
      proximo: e.plano ? e.plano.proximo : null,
      roteiro: e.roteiro ? { milestone: e.roteiro.milestone, etapa_concluida: e.roteiro.etapa_concluida, pr: e.roteiro.pr } : null,
      ativos: Object.values(e.agentes).filter(a => a.ativo).map(a => a.papel),
      ocorrencias: e.ocorrencias.length,
      prazo: e.prazo && e.prazo.status === 'estimado' ? { restante: e.prazo.restante, dataTxt: e.prazo.dataTxt } : null,
      ultimo,
    });
  }
  lista.sort((a, b) => (b.ativos.length - a.ativos.length) || (b.ultimo - a.ultimo));
  return { obras: lista, origem: ID_ORIGEM, agora: Date.now() };
}

function json(res, dados, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(dados));
}

const INDEX = path.join(__dirname, 'index.html');
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/obras') {
    const dados = carteira();
    const desafio = url.searchParams.get('desafio');
    if (NONCE && desafio && desafio.length <= 128) dados.prova = crypto.createHmac('sha256', NONCE).update(desafio).digest('hex');
    return json(res, dados);
  }
  if (url.pathname === '/estado') {
    const obras = lerObras();
    let id = url.searchParams.get('obra');
    if (!id || !obras[id]) {
      const c = carteira().obras;
      id = (ID_ORIGEM && obras[ID_ORIGEM]) ? ID_ORIGEM : (c[0] && c[0].id);
    }
    if (!id || !obras[id]) return json(res, { vazio: true });
    return json(res, { id, ...estado(obras[id].raiz) });
  }
  if (url.pathname === '/remover' && req.method === 'POST') {
    const id = url.searchParams.get('obra');
    if (id) remover(id);
    return json(res, { ok: true });
  }
  // arquivos estáticos do painel (cena 3D e Three.js embutido), sem sair da pasta canteiro/
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const arq = rel ? path.normalize(path.join(__dirname, rel)) : INDEX;
  const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain' };
  if (arq.startsWith(__dirname + path.sep) && fs.existsSync(arq) && fs.statSync(arq).isFile()) {
    res.writeHead(200, { 'Content-Type': (TIPOS[path.extname(arq)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(arq).pipe(res);
  }
  if (rel && rel !== 'index.html') { res.writeHead(404); return res.end('não encontrado'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  fs.createReadStream(INDEX).pipe(res);
});

servidor.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;
  if (NONCE) { console.error(`A porta ${PORTA} já está ocupada.`); process.exit(1); } // subido pelo app: nunca confiar em quem já estava lá
  // já existe algo na porta: se for um canteiro, ótimo, ele já mostra esta obra também
  http.get(`http://127.0.0.1:${PORTA}/obras`, r => {
    let s = ''; r.on('data', c => (s += c)); r.on('end', () => {
      try {
        const n = JSON.parse(s).obras.length;
        console.log(`O canteiro já está no ar em http://localhost:${PORTA} e mostra todas as obras (${n}).`);
        if (ID_ORIGEM) console.log(`Esta obra entrou na carteira: http://localhost:${PORTA}/?obra=${ID_ORIGEM}`);
        console.log('Você pode fechar esta janela.');
      } catch { console.log(`A porta ${PORTA} está ocupada por outro programa. Use outra: node .claude/canteiro/server.cjs 4800`); }
    });
  }).on('error', () => console.log(`A porta ${PORTA} está ocupada. Use outra: node .claude/canteiro/server.cjs 4800`));
});

servidor.listen(PORTA, '127.0.0.1', () => {
  const n = carteira().obras.length;
  console.log(`Canteiro no ar: http://localhost:${PORTA}  ·  ${n} obra(s) na carteira`);
  console.log('Deixe esta janela aberta. Ela serve para todos os projetos ao mesmo tempo.');
});
