// Prazo restante da construção, medido pelo ritmo real da própria obra. Não gasta tokens.
//
// Como funciona:
// 1. Relógio de trabalho (.canteiro/relogio.json): a cada evento dos hooks, soma o tempo desde o evento
//    anterior, desde que não tenha havido pausa longa (o Claude parado esperando você não conta).
//    Um comando em andamento (ex.: esperando o CI) conta até 60 min.
// 2. Histórico do avanço (.canteiro/avanco.jsonl): cada vez que o % do PLAN muda durante a construção,
//    grava {ts, pct, ativoMs}.
// 3. Estimativa: ritmo = % avançado ÷ horas de trabalho desde o início da construção.
//    Restante = % que falta ÷ ritmo. A data prevista usa as horas trabalhadas por dia nos últimos 14 dias.
const fs = require('fs');
const path = require('path');
const { lerPlano } = require('./plano.cjs');

const PAUSA_MS = 10 * 60e3;        // intervalo maior que isso entre eventos = obra parada
const COMANDO_MS = 60 * 60e3;      // ferramenta em execução (CI, build) conta até 1 h
const JANELA_DIAS = 14;

const dirDe = raiz => path.join(raiz, '.canteiro');
const diaLocal = ts => new Date(ts).toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do computador

function lerJSON(arq, padrao) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } }
function gravarJSON(arq, dados) {
  const tmp = arq + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dados));
  fs.renameSync(tmp, arq);
}

// Chamado pelo evento.cjs a cada evento.
function tique(raiz, ts = Date.now(), ev = '') {
  const arq = path.join(dirDe(raiz), 'relogio.json');
  const r = lerJSON(arq, { ultimo: 0, ultimoEv: '', ativoMs: 0, dias: {} });
  const gap = ts - (r.ultimo || 0);
  const limite = r.ultimoEv === 'PreToolUse' ? COMANDO_MS : PAUSA_MS;
  if (r.ultimo && gap > 0 && gap <= limite) {
    r.ativoMs += gap;
    const d = diaLocal(ts);
    r.dias[d] = (r.dias[d] || 0) + gap;
  }
  r.inicio = r.inicio || {};
  if (!r.inicio[diaLocal(ts)]) r.inicio[diaLocal(ts)] = ts;
  r.ultimo = ts; r.ultimoEv = ev;
  const corte = diaLocal(ts - 40 * 86400e3);
  for (const d of Object.keys(r.dias)) if (d < corte) delete r.dias[d];
  for (const d of Object.keys(r.inicio)) if (d < corte) delete r.inicio[d];
  gravarJSON(arq, r);
  return r;
}

function etapaAtual(raiz) {
  const e = lerJSON(path.join(dirDe(raiz), 'etapa.json'), null);
  return e && e.etapa ? e.etapa : 'construcao'; // projeto adotado sem etapa.json: está em construção
}

function lerAvanco(raiz) {
  try {
    return fs.readFileSync(path.join(dirDe(raiz), 'avanco.jsonl'), 'utf8').split('\n')
      .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// Grava um ponto no histórico quando o % muda (só durante a construção).
function registrarAvanco(raiz, ts = Date.now()) {
  if (etapaAtual(raiz) !== 'construcao') return;
  const p = lerPlano(raiz);
  if (!p || !p.milestones.length) return;
  const pts = lerAvanco(raiz);
  const ult = pts[pts.length - 1];
  if (ult && ult.pct === p.pct) return;
  const r = lerJSON(path.join(dirDe(raiz), 'relogio.json'), { ativoMs: 0 });
  fs.appendFileSync(path.join(dirDe(raiz), 'avanco.jsonl'), JSON.stringify({ ts, pct: p.pct, ativoMs: r.ativoMs || 0 }) + '\n');
}

function fmtDur(ms) {
  const min = Math.round(ms / 60e3);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = ms / 3600e3;
  if (h < 10) { let hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh += 1; mm = 0; } return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`; }
  return `${Math.round(h)} h`;
}
function fmtData(ts) {
  const d = new Date(ts);
  const hoje = diaLocal(Date.now()), dia = diaLocal(ts), amanha = diaLocal(Date.now() + 86400e3);
  const h = `~${d.getHours()}h`;
  if (dia === hoje) return `hoje, ${h}`;
  if (dia === amanha) return `amanhã, ${h}`;
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
}

// Estimativa para o painel e para o terminal.
function calcularPrazo(raiz, agora = Date.now()) {
  const p = lerPlano(raiz);
  const etapa = etapaAtual(raiz);
  if (!p || !p.milestones.length) return { status: 'sem-plano', texto: 'aparece na construção' };
  if (p.pct >= 100 || etapa === 'lancamento' || etapa === 'entregue') return { status: 'concluido', texto: 'construção concluída', pct: 100 };
  if (etapa !== 'construcao') return { status: 'aguardando', texto: 'começa a medir na construção', pct: p.pct };

  const desde = p.rodada && p.rodada.desde ? Date.parse(p.rodada.desde) : 0;
  const pts = lerAvanco(raiz).filter(x => x.ts >= desde);
  const rel = lerJSON(path.join(dirDe(raiz), 'relogio.json'), { ativoMs: 0, dias: {} });
  const base = pts[0];
  const dPct = base ? p.pct - base.pct : 0;
  const dAtivo = base ? (rel.ativoMs || 0) - base.ativoMs : 0;
  if (!base || dPct <= 0 || dAtivo < 60e3) {
    return { status: 'aguardando', texto: 'calculando: precisa do 1º avanço medido', pct: p.pct };
  }

  const restanteMs = (100 - p.pct) / dPct * dAtivo;
  const confianca = dPct < 10 ? 'baixa' : dPct < 30 ? 'média' : 'alta';
  const [fMin, fMax] = { baixa: [0.6, 1.8], 'média': [0.8, 1.3], alta: [0.9, 1.15] }[confianca];

  // Data prevista. Com dias anteriores trabalhados: média de horas por dia (sem contar hoje, que ainda
  // não acabou). Só com o dia de hoje: supõe que a obra segue no ritmo de hoje (fração do tempo com equipe trabalhando).
  const hoje = diaLocal(agora);
  const corte = diaLocal(agora - (JANELA_DIAS - 1) * 86400e3);
  const dias = Object.entries(rel.dias || {}).filter(([d, ms]) => d >= corte && d < hoje && ms >= 5 * 60e3).sort();
  let data = null, porDia = null, base_data = null;
  if (dias.length) {
    porDia = dias.reduce((s, [, ms]) => s + ms, 0) / dias.length;
    const span = Math.max(1, Math.round((new Date(hoje) - new Date(dias[0][0])) / 86400e3));
    const fracao = Math.min(1, dias.length / span);
    const hojeFeito = (rel.dias || {})[hoje] || 0;
    const sobraHoje = Math.max(0, porDia - hojeFeito);
    if (restanteMs <= sobraHoje) data = agora;
    else {
      const falta = restanteMs - sobraHoje;
      data = new Date(hoje).getTime() + 86400e3 + 12 * 3600e3 + (Math.ceil(falta / porDia / fracao) - 1) * 86400e3;
    }
    base_data = 'média dos últimos dias';
  } else {
    const ini = (rel.inicio || {})[hoje];
    const feitoHoje = (rel.dias || {})[hoje] || 0;
    if (ini && agora - ini > 10 * 60e3 && feitoHoje > 0) {
      const fracao = Math.max(0.05, Math.min(1, feitoHoje / (agora - ini)));
      data = agora + restanteMs / fracao;
      base_data = 'se mantiver o ritmo de hoje';
    }
  }

  return {
    status: 'estimado',
    pct: p.pct,
    restanteMs,
    restante: fmtDur(restanteMs),
    faixa: `${fmtDur(restanteMs * fMin)} e ${fmtDur(restanteMs * fMax)}`,
    trabalhado: fmtDur(dAtivo),
    ritmo: `${(dPct / (dAtivo / 3600e3)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% por hora`,
    porDia: porDia ? fmtDur(porDia) : null,
    baseData: base_data,
    data,
    dataTxt: data ? fmtData(data) : null,
    confianca,
    texto: `≈ ${fmtDur(restanteMs)} de trabalho${data ? ` · previsão ${fmtData(data)}` : ''}`,
  };
}

module.exports = { tique, registrarAvanco, calcularPrazo, fmtDur };
