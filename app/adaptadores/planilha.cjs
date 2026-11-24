// Raio-X de uma planilha do cliente (prototipo/caminho-novo/X1–X3, aprovadas pelo Luiz em 24/11/2026: "essa transformação de
// Excel em sistema vai ser muito comum ... tem que ser um ponto forte"). Roda AQUI no computador, sem o Claude e sem dependência
// nova: o .xlsx/.xlsm é um zip de XML, lido pelo leitor de zip endurecido do Atlas (zip-leitor.cjs: limites, CRC, sem bomba).
//
// O QUE ACHA, por aba: linha do cabeçalho, colunas com título e tipo (texto, número, moeda, percentual, data, sim/não), listas
// suspensas (validação de dados, inclusive apontando para outra aba), fórmulas (com exemplo), ligações com outras abas (PROCV,
// PROCX, ÍNDICE/CORRESP ou referência direta), regras de cor (formatação condicional), tabelas, tabelas dinâmicas e gráficos.
// No arquivo: nomes definidos e se tem macro (o código da macro não é lido; o Atlas pergunta o que ela faz).
// CONFERÊNCIA: refaz cada fórmula que sabe calcular (aritmética, SOMA, MÉDIA, MÍN, MÁX, CONT.NÚM, CONT.VALORES, ARRED, ABS, SE,
// E, OU, NÃO, SEERRO, SOMASE, CONT.SE) com os valores que o próprio Excel guardou e compara com o resultado guardado. Só conta o
// que conseguiu calcular; o resto fica como "sem conferir" (nunca finge).
// .csv: separador e números no padrão brasileiro ou americano. .xls (formato antigo): pede para salvar como .xlsx.
//
// PRIVACIDADE: o raio-X guarda só estrutura e no máximo 3 linhas de exemplo por aba (texto cortado). Os dados inteiros ficam no
// arquivo do cliente, dentro da obra, e só entram no sistema se ele mandar ("levar os dados").
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { listar, extrairEntrada } = require('./zip-leitor.cjs')

const MB = 1024 * 1024
const LIMITES = { arquivo: 50 * MB, entrada: 60 * MB, total: 200 * MB, razao: 200, pisoRazao: MB }
const MAX_LINHAS_TIPO = 300
const MAX_CONFERIR = 5000
const MAX_AMOSTRA = 3

class ErroPlanilha extends Error {}
const erro = (m) => new ErroPlanilha(m)

// ---------- utilidades ----------
const desfazXml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&')
const atributo = (tag, nome) => { const m = new RegExp(`\\s${nome}="([^"]*)"`).exec(tag); return m ? desfazXml(m[1]) : null }
const colNum = (letras) => { let n = 0; for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64); return n }
const colLetra = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) } return s }
const partirRef = (ref) => { const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(ref); return m ? { c: colNum(m[1]), l: Number(m[2]) } : null }
const curto = (v, n = 40) => { const s = String(v ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s }

/** Desloca as referências relativas de uma fórmula compartilhada (as com $ ficam). */
function deslocar(formula, dLin, dCol) {
  let fora = ''
  const partes = String(formula).split('"')
  for (let i = 0; i < partes.length; i++) {
    if (i % 2 === 1) { fora += `"${partes[i]}"`; continue }
    fora += partes[i].replace(/(^|[^A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g, (_, ant, dc, col, dl, lin) => {
      const c = dc ? col : colLetra(colNum(col) + dCol)
      const l = dl ? lin : String(Number(lin) + dLin)
      return `${ant}${dc}${c}${dl}${l}`
    })
  }
  return fora
}

// ---------- calculadora de fórmulas (só o que sabe; o resto lança 'nao-sei') ----------
const NAO_SEI = () => { const e = new Error('nao-sei'); e.naoSei = true; return e }

function tokens(f) {
  const out = []
  let i = 0
  const s = String(f).replace(/_xlfn\./g, '')
  while (i < s.length) {
    const ch = s[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '"') { let j = i + 1; let t = ''; for (;;) { if (j >= s.length) throw NAO_SEI(); if (s[j] === '"') { if (s[j + 1] === '"') { t += '"'; j += 2; continue } break } t += s[j++] } out.push({ t: 'str', v: t }); i = j + 1; continue }
    const ref = /^(?:'((?:[^']|'')+)'|([A-Za-z_À-ɏ][\w.À-ɏ]*))?(!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/.exec(s.slice(i))
    if (ref && (ref[3] || !ref[1] && !ref[2]) && !/^[\d(]/.test(s.slice(i + ref[0].length)) && /^\$?[A-Z]{1,3}\$?\d+/.test(ref[4])) {
      const aba = ref[1] !== undefined ? ref[1].replace(/''/g, "'") : (ref[3] ? ref[2] : null)
      out.push({ t: 'ref', aba, a: ref[4].replace(/\$/g, ''), b: ref[5] ? ref[5].replace(/\$/g, '') : null }); i += ref[0].length; continue
    }
    const num = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i))
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue }
    const fn = /^([A-Za-z][A-Za-z0-9.]*)\(/.exec(s.slice(i))
    if (fn) { out.push({ t: 'fn', v: fn[1].toUpperCase() }); i += fn[0].length; continue }
    const bool = /^(TRUE|FALSE)(?![\w(])/i.exec(s.slice(i))
    if (bool) { out.push({ t: 'bool', v: bool[1].toUpperCase() === 'TRUE' }); i += bool[0].length; continue }
    const op = /^(<=|>=|<>|[-+*/^&=<>(),%;])/.exec(s.slice(i))
    if (op) { out.push({ t: 'op', v: op[1] === ';' ? ',' : op[1] }); i += op[1].length; continue }
    throw NAO_SEI()
  }
  return out
}

function avaliar(formula, ctx) {
  const tk = tokens(formula)
  let p = 0
  const ver = () => tk[p]
  const pega = (v) => { const t = tk[p]; if (!t || t.v !== v) throw NAO_SEI(); p++ }
  const num = (x) => {
    if (Array.isArray(x)) throw NAO_SEI()
    if (x === null || x === undefined || x === '') return 0
    if (typeof x === 'boolean') return x ? 1 : 0
    if (typeof x === 'number') return x
    const n = Number(x); if (Number.isFinite(n)) return n
    throw NAO_SEI()
  }
  const plano = (args) => args.flatMap((a) => (Array.isArray(a) ? a.flat() : [a]))
  const criterio = (c) => {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(c))
    const op = m[1] || '='
    const alvo = m[2]
    const n = Number(alvo)
    return (v) => {
      const comparaNum = alvo !== '' && Number.isFinite(n) && typeof v === 'number'
      const a = comparaNum ? v : String(v ?? '').toLowerCase()
      const b = comparaNum ? n : alvo.toLowerCase()
      return op === '=' ? a === b : op === '<>' ? a !== b : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b
    }
  }
  const FN = {
    SUM: (a) => plano(a).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0),
    AVERAGE: (a) => { const n = plano(a).filter((v) => typeof v === 'number'); if (!n.length) throw NAO_SEI(); return n.reduce((s, v) => s + v, 0) / n.length },
    MIN: (a) => { const n = plano(a).filter((v) => typeof v === 'number'); return n.length ? Math.min(...n) : 0 },
    MAX: (a) => { const n = plano(a).filter((v) => typeof v === 'number'); return n.length ? Math.max(...n) : 0 },
    COUNT: (a) => plano(a).filter((v) => typeof v === 'number').length,
    COUNTA: (a) => plano(a).filter((v) => v !== null && v !== undefined && v !== '').length,
    ROUND: (a) => { const f = 10 ** num(a[1] ?? 0); return Math.round(num(a[0]) * f + Math.sign(num(a[0])) * 1e-9) / f },
    ABS: (a) => Math.abs(num(a[0])),
    AND: (a) => plano(a).every((v) => !!num(v)),
    OR: (a) => plano(a).some((v) => !!num(v)),
    NOT: (a) => !num(a[0]),
    SUMIF: (a) => { const r = plano([a[0]]); const s = a[2] !== undefined ? plano([a[2]]) : r; if (r.length !== s.length) throw NAO_SEI(); const ok = criterio(a[1]); return r.reduce((t, v, i) => t + (ok(v) && typeof s[i] === 'number' ? s[i] : 0), 0) },
    COUNTIF: (a) => { const ok = criterio(a[1]); return plano([a[0]]).filter((v) => ok(v)).length },
  }
  const args = () => {
    const out = []
    if (ver() && ver().v === ')') { p++; return out }
    for (;;) { out.push(expr()); const t = tk[p++]; if (!t) throw NAO_SEI(); if (t.v === ')') return out; if (t.v !== ',') throw NAO_SEI() }
  }
  function primario() {
    const t = tk[p++]
    if (!t) throw NAO_SEI()
    if (t.t === 'num' || t.t === 'str' || t.t === 'bool') return t.v
    if (t.t === 'ref') return t.b ? ctx.faixa(t.aba, t.a, t.b) : ctx.celula(t.aba, t.a)
    if (t.t === 'op' && t.v === '(') { const v = expr(); pega(')'); return v }
    if (t.t === 'op' && t.v === '-') return -num(primario())
    if (t.t === 'op' && t.v === '+') return num(primario())
    if (t.t === 'fn') {
      if (t.v === 'IF') { const a = args(); return num(a[0]) ? a[1] : (a.length > 2 ? a[2] : false) }
      if (t.v === 'IFERROR') { const ini = p; try { const a = args(); return a[0] } catch (e) { if (!e.erroExcel) throw e; p = ini; let nivel = 1; while (p < tk.length && nivel) { const x = tk[p++]; if (x.t === 'fn' || x.v === '(') nivel++; else if (x.v === ')') nivel-- } throw NAO_SEI() } }
      const f = FN[t.v]
      if (!f) throw NAO_SEI()
      return f(args())
    }
    throw NAO_SEI()
  }
  function potencia() { let v = primario(); while (ver() && ver().v === '%') { p++; v = num(v) / 100 } while (ver() && ver().v === '^') { p++; v = num(v) ** num(primario()) } return v }
  function mult() { let v = potencia(); while (ver() && (ver().v === '*' || ver().v === '/')) { const o = tk[p++].v; const d = num(potencia()); if (o === '/' && d === 0) { const e = NAO_SEI(); e.erroExcel = true; throw e } v = o === '*' ? num(v) * d : num(v) / d } return v }
  function soma() { let v = mult(); while (ver() && (ver().v === '+' || ver().v === '-')) { const o = tk[p++].v; const d = num(mult()); v = o === '+' ? num(v) + d : num(v) - d } return v }
  function junta() { let v = soma(); while (ver() && ver().v === '&') { p++; v = String(v ?? '') + String(soma() ?? '') } return v }
  function expr() {
    const v = junta()
    const t = ver()
    if (t && ['=', '<>', '<', '>', '<=', '>='].includes(t.v)) {
      p++
      const d = junta()
      const a = typeof v === 'string' ? v.toLowerCase() : v
      const b = typeof d === 'string' ? d.toLowerCase() : d
      return t.v === '=' ? a === b : t.v === '<>' ? a !== b : t.v === '<' ? a < b : t.v === '>' ? a > b : t.v === '<=' ? a <= b : a >= b
    }
    return v
  }
  const r = expr()
  if (p !== tk.length) throw NAO_SEI()
  if (Array.isArray(r)) throw NAO_SEI()
  return r
}

const bate = (calc, guardado) => {
  if (typeof guardado === 'number') {
    const n = typeof calc === 'boolean' ? (calc ? 1 : 0) : Number(calc)
    return Number.isFinite(n) && Math.abs(n - guardado) <= Math.max(1e-6, Math.abs(guardado) * 1e-9)
  }
  if (typeof guardado === 'boolean') return calc === guardado
  return String(calc ?? '') === String(guardado ?? '')
}

// ---------- tipos ----------
const FORMATOS_DATA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])
function tipoDoFormato(id, codigo) {
  if (FORMATOS_DATA.has(id)) return 'data'
  if (id === 9 || id === 10) return 'percentual'
  if (id >= 5 && id <= 8) return 'moeda'
  if (!codigo) return null
  const c = codigo.replace(/"[^"]*"/g, (m) => (/R\$|\$|€/.test(m) ? 'MOEDA' : '')).replace(/\[[^\]]*\]/g, (m) => (/\$/.test(m) ? 'MOEDA' : ''))
  if (/MOEDA|R\$|\$|€/.test(c)) return 'moeda'
  if (/%/.test(c)) return 'percentual'
  if (/[dy]/i.test(c) && /m/i.test(c)) return 'data'
  return null
}

function tipoDaColuna(valores) {
  const v = valores.filter((x) => x.v !== null && x.v !== undefined && x.v !== '')
  if (!v.length) return 'vazio'
  const conta = {}
  for (const x of v) {
    const t = x.fmt || (typeof x.v === 'boolean' ? 'sim-nao' : typeof x.v === 'number' ? 'numero' : 'texto')
    const t2 = t === 'numero' && typeof x.v !== 'number' ? 'texto' : t
    conta[t2] = (conta[t2] || 0) + 1
  }
  return Object.entries(conta).sort((a, b) => b[1] - a[1])[0][0]
}

// ---------- xlsx ----------
async function lerZip(arquivo) {
  const fd = fs.openSync(arquivo, 'r')
  try {
    const { entradas } = listar(fd, fs.fstatSync(fd).size)
    const contador = { total: 0, limites: { arquivo: LIMITES.entrada, total: LIMITES.total, razao: LIMITES.razao, pisoRazao: LIMITES.pisoRazao } }
    const mapa = new Map(entradas.filter((e) => e.tipo === 'arquivo' || e.tipo === undefined).map((e) => [e.nome, e]))
    const nomes = entradas.map((e) => e.nome)
    const texto = async (nome) => {
      const e = mapa.get(nome)
      if (!e) return null
      const partes = []
      await extrairEntrada(fd, e, (b) => partes.push(Buffer.from(b)), contador)
      return Buffer.concat(partes).toString('utf8')
    }
    return { nomes, texto, fechar: () => fs.closeSync(fd) }
  } catch (e) { fs.closeSync(fd); throw e }
}

const alvoRel = (base, alvo) => (alvo.startsWith('/') ? alvo.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(base), alvo)))
function rels(xml, base) {
  const out = []
  for (const m of String(xml || '').matchAll(/<Relationship\b[^>]*>/g)) out.push({ id: atributo(m[0], 'Id'), tipo: atributo(m[0], 'Type') || '', alvo: alvoRel(base, atributo(m[0], 'Target') || '') })
  return out
}
const relsDe = (parte) => `${path.posix.dirname(parte)}/_rels/${path.posix.basename(parte)}.rels`

function textoSi(si) {
  let t = ''
  for (const m of si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) t += desfazXml(m[1])
  return t
}

/** Lê as células de uma aba: Map ref → {v, f, s}. Fórmulas compartilhadas viram a fórmula de cada célula. */
function celulasDaAba(xml, compartilhadas, estilos) {
  const celulas = new Map()
  const mestres = {}
  let maxL = 0
  let maxC = 0
  const dados = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)
  const corpo = dados ? dados[1] : ''
  for (const m of corpo.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const tag = `<c${m[1]}>`
    const ref = atributo(tag, 'r')
    if (!ref) continue
    const pos = partirRef(ref)
    if (!pos) continue
    const t = atributo(tag, 't')
    const s = Number(atributo(tag, 's') || 0)
    const dentro = m[2] || ''
    const vm = /<v>([\s\S]*?)<\/v>/.exec(dentro)
    let v = vm ? desfazXml(vm[1]) : null
    if (t === 's' && v !== null) v = compartilhadas[Number(v)] ?? ''
    else if (t === 'b') v = v === '1'
    else if (t === 'inlineStr') { const is = /<is>([\s\S]*?)<\/is>/.exec(dentro); v = is ? textoSi(is[1]) : '' }
    else if (t === 'e') v = { erro: v }
    else if (t !== 'str' && v !== null && v !== '') { const n = Number(v); v = Number.isFinite(n) ? n : v }
    let f = null
    const fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(dentro)
    if (fm) {
      const ft = `<f${fm[1]}>`
      const corpoF = fm[2] ? desfazXml(fm[2]) : ''
      if (atributo(ft, 't') === 'shared') {
        const si = atributo(ft, 'si')
        if (corpoF) { mestres[si] = { f: corpoF, pos }; f = corpoF } else if (mestres[si]) f = deslocar(mestres[si].f, pos.l - mestres[si].pos.l, pos.c - mestres[si].pos.c)
      } else f = corpoF || null
    }
    if (v === null && !f) continue
    celulas.set(ref.replace(/\$/g, ''), { v, f, fmt: estilos[s] || null, l: pos.l, c: pos.c })
    if (pos.l > maxL) maxL = pos.l
    if (pos.c > maxC) maxC = pos.c
  }
  return { celulas, maxL, maxC }
}

function faixaRefs(a, b) {
  const p1 = partirRef(a); const p2 = partirRef(b)
  if (!p1 || !p2) return []
  const out = []
  for (let l = Math.min(p1.l, p2.l); l <= Math.max(p1.l, p2.l); l++) {
    const linha = []
    for (let c = Math.min(p1.c, p2.c); c <= Math.max(p1.c, p2.c); c++) linha.push(`${colLetra(c)}${l}`)
    out.push(linha)
  }
  return out
}

function lerEstilos(xml) {
  const formatos = {}
  for (const m of String(xml || '').matchAll(/<numFmt\b[^>]*>/g)) formatos[Number(atributo(m[0], 'numFmtId'))] = atributo(m[0], 'formatCode')
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(String(xml || ''))
  const out = []
  if (xfs) for (const m of xfs[1].matchAll(/<xf\b[^>]*>/g)) { const id = Number(atributo(m[0], 'numFmtId') || 0); out.push(tipoDoFormato(id, formatos[id])) }
  return out
}

const OPERADORES = { greaterThan: 'maior que', lessThan: 'menor que', equal: 'igual a', notEqual: 'diferente de', greaterThanOrEqual: 'maior ou igual a', lessThanOrEqual: 'menor ou igual a', between: 'entre', notBetween: 'fora de', containsText: 'contém' }

async function lerXlsx(arquivo, nomeArquivo) {
  const z = await lerZip(arquivo)
  try {
    const wb = await z.texto('xl/workbook.xml')
    if (!wb) throw erro('nao-e-planilha')
    const relWb = rels(await z.texto('xl/_rels/workbook.xml.rels'), 'xl/workbook.xml')
    const compXml = await z.texto('xl/sharedStrings.xml')
    const compartilhadas = compXml ? [...compXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoSi(m[1])) : []
    const estilos = lerEstilos(await z.texto('xl/styles.xml'))
    const nomes = [...wb.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)].map((m) => ({ nome: atributo(`<x${m[1]}>`, 'name'), ref: desfazXml(m[2]) })).filter((n) => n.nome && !n.nome.startsWith('_xlnm'))
    const abasDef = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({ nome: atributo(m[0], 'name'), rid: atributo(m[0], 'r:id'), oculta: atributo(m[0], 'state') === 'hidden' }))

    const lidas = []
    for (const a of abasDef) {
      const rel = relWb.find((r) => r.id === a.rid)
      if (!rel || !/worksheet/.test(rel.tipo)) continue
      const xml = await z.texto(rel.alvo)
      if (xml === null) continue
      const { celulas, maxL, maxC } = celulasDaAba(xml, compartilhadas, estilos)
      const relAba = rels(await z.texto(relsDe(rel.alvo)), rel.alvo)
      let graficos = 0
      for (const d of relAba.filter((r) => /\/drawing$/.test(r.tipo))) graficos += rels(await z.texto(relsDe(d.alvo)), d.alvo).filter((r) => /\/chart$/.test(r.tipo)).length
      const tabelas = []
      for (const t of relAba.filter((r) => /\/table$/.test(r.tipo))) { const tx = await z.texto(t.alvo); const tag = tx && /<table\b[^>]*>/.exec(tx); if (tag) tabelas.push(atributo(tag[0], 'displayName') || atributo(tag[0], 'name')) }
      const validacoes = [...xml.matchAll(/<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>/g)].map((m) => ({ tipo: atributo(`<x${m[1]}>`, 'type'), sqref: atributo(`<x${m[1]}>`, 'sqref') || '', f1: (/<formula1>([\s\S]*?)<\/formula1>/.exec(m[2]) || [])[1] })).filter((v) => v.tipo === 'list' && v.f1)
      const cores = []
      for (const m of xml.matchAll(/<conditionalFormatting\b([^>]*)>([\s\S]*?)<\/conditionalFormatting>/g)) {
        const sqref = atributo(`<x${m[1]}>`, 'sqref') || ''
        for (const r of m[2].matchAll(/<cfRule\b([^>]*)>([\s\S]*?)<\/cfRule>/g)) {
          const tag = `<x${r[1]}>`
          const fs1 = [...r[2].matchAll(/<formula>([\s\S]*?)<\/formula>/g)].map((x) => desfazXml(x[1]))
          const tipo = atributo(tag, 'type')
          const regra = tipo === 'cellIs' ? `${OPERADORES[atributo(tag, 'operator')] || atributo(tag, 'operator')} ${fs1.join(' e ')}` : tipo === 'expression' ? `quando ${fs1[0] || ''}` : tipo
          cores.push({ sqref, regra })
        }
      }
      lidas.push({ nome: a.nome, oculta: a.oculta, celulas, maxL, maxC, graficos, tabelas, validacoes, cores, dinamica: relAba.some((r) => /pivotTable$/.test(r.tipo)) })
    }
    const macros = z.nomes.some((n) => /vbaProject\.bin$/i.test(n))
    return montarRaio(nomeArquivo, /\.xlsm$/i.test(nomeArquivo) ? 'xlsm' : 'xlsx', lidas, nomes, macros)
  } finally { z.fechar() }
}

/** Primeira linha (entre as 10 primeiras) com 2+ textos e algo embaixo: é o cabeçalho. */
function linhaCabecalho(celulas, maxL, maxC) {
  for (let l = 1; l <= Math.min(10, maxL); l++) {
    let textos = 0
    for (let c = 1; c <= maxC; c++) { const x = celulas.get(`${colLetra(c)}${l}`); if (x && typeof x.v === 'string' && x.v.trim() && !x.f) textos++ }
    let embaixo = false
    for (let c = 1; c <= maxC && !embaixo; c++) if (celulas.get(`${colLetra(c)}${l + 1}`)) embaixo = true
    if (textos >= 2 && embaixo) return l
  }
  return 0
}

function colunasDoSqref(sqref) {
  return String(sqref).split(/\s+/).filter(Boolean).map((r) => { const m = /^\$?([A-Z]{1,3})/.exec(r); return m ? colNum(m[1]) : null }).filter(Boolean)
}

function montarRaio(arquivo, formato, lidas, nomes, macros) {
  const porNome = new Map(lidas.map((a) => [a.nome, a]))
  const valorEm = (abaAtual, aba, ref) => {
    const a = aba ? porNome.get(aba) : abaAtual
    if (!a) throw NAO_SEI()
    const x = a.celulas.get(ref)
    if (x && x.v && typeof x.v === 'object' && 'erro' in x.v) { const e = NAO_SEI(); e.erroExcel = true; throw e }
    return x ? x.v : null
  }
  const contas = { conferidas: 0, batem: 0, divergem: [], semConferir: 0 }
  const abas = []
  for (const a of lidas) {
    const cab = linhaCabecalho(a.celulas, a.maxL, a.maxC)
    const ini = cab ? cab + 1 : 1
    const colunas = []
    for (let c = 1; c <= a.maxC; c++) {
      const letra = colLetra(c)
      const titulo = cab ? String(a.celulas.get(`${letra}${cab}`)?.v ?? '').trim() : ''
      const valores = []
      let formula = null
      let nFormulas = 0
      for (let l = ini; l <= a.maxL && valores.length < MAX_LINHAS_TIPO; l++) {
        const x = a.celulas.get(`${letra}${l}`)
        if (!x) continue
        valores.push(x)
        if (x.f) { nFormulas++; if (!formula) formula = x.f }
      }
      if (!titulo && !valores.length) continue
      const col = { letra, titulo: titulo || letra, tipo: tipoDaColuna(valores) }
      if (formula) { col.formula = formula; col.formulas = nFormulas }
      if (formula) {
        const outras = [...formula.matchAll(/(?:'((?:[^']|'')+)'|([A-Za-z_À-ɏ][\w.À-ɏ]*))!/g)].map((m) => (m[1] ?? m[2]).replace(/''/g, "'")).filter((n) => n !== a.nome && porNome.has(n))
        if (outras.length) col.ligacao = { aba: outras[0], busca: /\b(VLOOKUP|XLOOKUP|INDEX|MATCH|HLOOKUP)\(/i.test(formula) }
      }
      const val = a.validacoes.find((v) => colunasDoSqref(v.sqref).includes(c))
      if (val) {
        const f1 = desfazXml(val.f1)
        if (/^".*"$/.test(f1)) col.lista = f1.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 50)
        else {
          const nome = nomes.find((n) => n.nome === f1.replace(/^=/, ''))
          const alvo = (nome ? nome.ref : f1).replace(/^=/, '')
          const m = /^(?:'((?:[^']|'')+)'|([^!]+))!(\$?[A-Z]{1,3}\$?\d+):(\$?[A-Z]{1,3}\$?\d+)$/.exec(alvo) || /^()()(\$?[A-Z]{1,3}\$?\d+):(\$?[A-Z]{1,3}\$?\d+)$/.exec(alvo)
          if (m) {
            const aba = m[1] ? m[1].replace(/''/g, "'") : (m[2] || a.nome)
            const origem = porNome.get(aba)
            if (origem) { col.lista = faixaRefs(m[3].replace(/\$/g, ''), m[4].replace(/\$/g, '')).flat().map((r) => origem.celulas.get(r)?.v).filter((v) => v !== null && v !== undefined && v !== '').map(String).slice(0, 50); col.listaDe = aba }
          }
        }
      }
      const cor = a.cores.find((x) => colunasDoSqref(x.sqref).includes(c))
      if (cor) col.cor = cor.regra
      colunas.push(col)
    }
    // conferência
    const ctx = { celula: (aba, ref) => valorEm(a, aba, ref), faixa: (aba, r1, r2) => faixaRefs(r1, r2).map((linha) => linha.map((r) => valorEm(a, aba, r))) }
    for (const x of a.celulas.values()) {
      if (!x.f) continue
      if (contas.conferidas + contas.semConferir >= MAX_CONFERIR) break
      if (x.v === null || (typeof x.v === 'object')) { contas.semConferir++; continue }
      try {
        const r = avaliar(x.f, ctx)
        contas.conferidas++
        if (bate(r, x.v)) contas.batem++
        else if (contas.divergem.length < 10) contas.divergem.push({ aba: a.nome, celula: `${colLetra(x.c)}${x.l}`, formula: curto(x.f, 80), excel: x.v, atlas: r })
      } catch (e) { if (e && e.naoSei) contas.semConferir++; else throw e }
    }
    const amostra = []
    for (let l = ini; l <= a.maxL && amostra.length < MAX_AMOSTRA; l++) {
      const linha = colunas.map((col) => { const x = a.celulas.get(`${col.letra}${l}`); return x ? curto(x.v && typeof x.v === 'object' ? '#ERRO' : x.v) : '' })
      if (linha.some((v) => v !== '')) amostra.push(linha)
    }
    let linhas = 0
    for (let l = ini; l <= a.maxL; l++) { let tem = false; for (const col of colunas) if (a.celulas.has(`${col.letra}${l}`)) { tem = true; break } if (tem) linhas++ }
    abas.push({ nome: a.nome, oculta: !!a.oculta, cabecalho: cab, linhas, colunas, amostra, tabelas: a.tabelas || [], graficos: a.graficos || 0, dinamica: !!a.dinamica })
  }
  return { versao: 1, arquivo, formato, abas, nomes: nomes.slice(0, 50), macros: !!macros, contas }
}

// ---------- csv ----------
function lerCsv(texto, arquivo) {
  const t = texto.replace(/^﻿/, '')
  const primeira = t.split(/\r?\n/, 1)[0] || ''
  const sep = [';', '\t', ','].map((s) => [s, primeira.split(s).length]).sort((a, b) => b[1] - a[1])[0][0]
  const linhas = []
  let campo = ''; let linha = []; let aspas = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (aspas) { if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++ } else aspas = false } else campo += ch; continue }
    if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = '' }
    else campo += ch
    if (linhas.length > 200_000) break
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  const converter = (s) => {
    const v = String(s).trim()
    if (!v) return { v: null }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return { v, fmt: 'data' }
    const moeda = /^(R\$|\$|€)\s*/.test(v)
    const n = v.replace(/^(R\$|\$|€)\s*/, '').replace(/%$/, '')
    let num = null
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(n) || /^-?\d+,\d+$/.test(n)) num = Number(n.replace(/\./g, '').replace(',', '.'))
    else if (/^-?\d+(\.\d+)?$/.test(n) || /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(n)) num = Number(n.replace(/,/g, ''))
    if (num !== null && Number.isFinite(num)) return { v: num, fmt: moeda ? 'moeda' : v.endsWith('%') ? 'percentual' : null }
    return { v }
  }
  const celulas = new Map()
  let maxC = 0
  linhas.forEach((ln, i) => ln.forEach((s, j) => { const x = converter(s); if (x.v === null) return; celulas.set(`${colLetra(j + 1)}${i + 1}`, { v: x.v, f: null, fmt: x.fmt || null, l: i + 1, c: j + 1 }); if (j + 1 > maxC) maxC = j + 1 }))
  const nome = path.basename(arquivo).replace(/\.[^.]+$/, '')
  return montarRaio(arquivo, 'csv', [{ nome, celulas, maxL: linhas.length, maxC, graficos: 0, tabelas: [], validacoes: [], cores: [], dinamica: false }], [], false)
}

/** Lê a planilha e devolve o raio-X. Erros calmos: 'formato-antigo' (.xls), 'grande-demais', 'nao-e-planilha'. */
async function raioX(arquivo, nomeOriginal = path.basename(arquivo)) {
  const st = fs.statSync(arquivo)
  if (!st.isFile()) throw erro('nao-e-planilha')
  if (st.size > LIMITES.arquivo) throw erro('grande-demais')
  const fd = fs.openSync(arquivo, 'r')
  const cab = Buffer.alloc(8)
  try { fs.readSync(fd, cab, 0, 8, 0) } finally { fs.closeSync(fd) }
  if (cab.readUInt32BE(0) === 0xD0CF11E0) throw erro('formato-antigo')
  if (cab.readUInt32LE(0) === 0x04034b50) {
    try { return await lerXlsx(arquivo, nomeOriginal) } catch (e) { if (e instanceof ErroPlanilha) throw e; throw erro('nao-e-planilha') }
  }
  if (/\.(csv|txt)$/i.test(nomeOriginal)) return lerCsv(fs.readFileSync(arquivo, 'utf8'), nomeOriginal)
  throw erro('nao-e-planilha')
}

const TIPO_PT = { texto: 'texto', numero: 'número', moeda: 'valor em R$', percentual: 'percentual', data: 'data', 'sim-nao': 'sim/não', vazio: 'vazia' }

/** Resumo em texto para o Claude (só estrutura e até 3 linhas de exemplo por aba). */
function resumoParaClaude(r) {
  const L = [`# Raio-X da planilha "${r.arquivo}" (${r.formato})`, '']
  for (const a of r.abas) {
    L.push(`## Aba "${a.nome}"${a.oculta ? ' (oculta)' : ''} · ${a.linhas} linhas${a.tabelas.length ? ` · tabelas: ${a.tabelas.join(', ')}` : ''}${a.dinamica ? ' · tem tabela dinâmica' : ''}${a.graficos ? ` · ${a.graficos} gráfico(s)` : ''}`)
    for (const c of a.colunas) {
      const extras = []
      if (c.formula) extras.push(`fórmula: \`${curto(c.formula, 120)}\``)
      if (c.ligacao) extras.push(`ligada à aba "${c.ligacao.aba}"${c.ligacao.busca ? ' (busca)' : ''}`)
      if (c.lista) extras.push(`lista: ${c.lista.slice(0, 12).join(' | ')}${c.listaDe ? ` (da aba "${c.listaDe}")` : ''}`)
      if (c.cor) extras.push(`cor quando: ${c.cor}`)
      L.push(`- ${c.letra} "${curto(c.titulo, 60)}": ${TIPO_PT[c.tipo] || c.tipo}${extras.length ? ` · ${extras.join(' · ')}` : ''}`)
    }
    if (a.amostra.length) { L.push('Exemplo de linhas:'); for (const x of a.amostra) L.push(`  | ${x.join(' | ')} |`) }
    L.push('')
  }
  if (r.nomes.length) L.push(`Nomes definidos: ${r.nomes.map((n) => `${n.nome}=${curto(n.ref, 60)}`).join('; ')}`)
  if (r.macros) L.push('Tem macro (VBA): o código não foi lido; pergunte ao cliente o que ela faz.')
  L.push(`Conferência das fórmulas: ${r.contas.conferidas} recalculadas, ${r.contas.batem} batem com o Excel, ${r.contas.divergem.length} divergem, ${r.contas.semConferir} sem conferir.`)
  return L.join('\n')
}

module.exports = { raioX, resumoParaClaude, avaliar, deslocar, tokens, ErroPlanilha, LIMITES, lerCsv }
