// Cronograma da obra (M41, aprovado pelo Luiz em 24/11/2026): previsto x realizado por etapa (milestone), pausas de cota e o
// término esperado com dia e hora. Fica em <obra>/.atlas/cronograma.json.
//  - PREVISTO: calculado uma vez, quando a construção começa, repartindo a duração prevista pelo peso das etapas. Não muda mais
//    (etapa que o PLAN ganhar depois entra no fim, com a duração média por peso).
//  - REAL: o Atlas anota a hora em que cada etapa começa e é entregue (visto a cada leitura do painel).
//  - ESPERADO: o término vem do ritmo real da obra (prazo.cjs do kit) e é repartido entre as etapas que faltam pelo peso e pelo
//    que a etapa atual já andou. Sem ritmo medido ainda, segue o previsto a partir de agora.
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const iso = (ms) => new Date(ms).toISOString()
const ms = (s) => Date.parse(s)

function criarCronograma({ agora = () => new Date() } = {}) {
  const arquivo = (dir) => path.join(dir, '.atlas', 'cronograma.json')
  const ler = (dir) => {
    try { const j = JSON.parse(fs.readFileSync(arquivo(dir), 'utf8')); if (j && j.versao === 1 && Array.isArray(j.previsto) && j.real && typeof j.inicio === 'string') return j } catch { /* novo */ }
    return null
  }
  const gravar = (dir, j) => {
    try {
      fs.mkdirSync(path.dirname(arquivo(dir)), { recursive: true })
      const tmp = arquivo(dir) + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(j))
      fs.renameSync(tmp, arquivo(dir))
    } catch { /* cronograma é extra: mostra o que der */ }
  }

  /**
   * Atualiza e devolve o cronograma. `etapas`: milestones do PLAN ({ n, titulo, peso, status, pct }).
   * `o.previstoMs`: duração prevista da construção (só usada na 1ª vez). `o.terminoMs`: término pelo ritmo real (ou null).
   * `o.pausas`: [{ inicio, fim|null }] de cota (do diário).
   */
  function atualizar(dir, etapas, o = {}) {
    const t = agora().getTime()
    const lista = (etapas || []).filter((e) => e && Number.isFinite(e.n)).map((e) => ({ ...e, peso: e.peso > 0 ? e.peso : 1 }))
    const pesoTotal = lista.reduce((s, e) => s + e.peso, 0) || 1
    let j = ler(dir)
    if (!j) {
      const total = Number.isFinite(o.previstoMs) && o.previstoMs > 0 ? o.previstoMs : lista.length * 6 * 3600_000
      let ini = t
      const previsto = lista.map((e) => { const d = (total * e.peso) / pesoTotal; const p = { n: e.n, inicio: iso(ini), fim: iso(ini + d) }; ini += d; return p })
      j = { versao: 1, inicio: iso(t), porPeso: total / pesoTotal, previsto, real: {} }
    }
    // Etapa nova no PLAN: entra no fim do previsto, com a duração média por peso.
    for (const e of lista) {
      if (j.previsto.some((p) => p.n === e.n)) continue
      const ultimo = j.previsto.length ? ms(j.previsto[j.previsto.length - 1].fim) : ms(j.inicio)
      j.previsto.push({ n: e.n, inicio: iso(ultimo), fim: iso(ultimo + (j.porPeso || 6 * 3600_000) * e.peso) })
    }
    // Real: hora de começo (a etapa atual) e de entrega (concluída). A próxima começa quando a anterior é entregue.
    let fimAnterior = j.inicio
    const atual = lista.find((e) => e.status !== 'concluido')
    for (const e of lista) {
      const r = j.real[e.n] || {}
      if (e.status === 'concluido') {
        if (!r.inicio) r.inicio = fimAnterior
        if (!r.fim) r.fim = iso(t)
        j.real[e.n] = r
        fimAnterior = r.fim
      } else if (atual && e.n === atual.n) {
        if (!r.inicio) r.inicio = fimAnterior
        j.real[e.n] = r
      }
    }
    gravar(dir, j)

    // Esperado: reparte [agora, término] pelo que falta de cada etapa (peso × parte que falta).
    const faltaDe = (e) => (e.status === 'concluido' ? 0 : e.peso * (1 - Math.min(100, Math.max(0, Number(e.pct) || 0)) / 100))
    const falta = lista.reduce((s, e) => s + faltaDe(e), 0)
    const termino = Number.isFinite(o.terminoMs) && o.terminoMs > t ? o.terminoMs : t + falta * (j.porPeso || 6 * 3600_000)
    let cursor = t
    const visao = lista.map((e) => {
      const prev = j.previsto.find((p) => p.n === e.n)
      const real = j.real[e.n] || null
      let esperado = null
      if (e.status !== 'concluido') {
        const d = falta > 0 ? ((termino - t) * faltaDe(e)) / falta : 0
        esperado = { inicio: iso(cursor), fim: iso(cursor + d) }
        cursor += d
      }
      return { n: e.n, nome: e.titulo, status: e.status === 'concluido' ? 'entregue' : atual && e.n === atual.n ? 'andamento' : 'falta', pct: Number(e.pct) || 0, previsto: prev ? { inicio: prev.inicio, fim: prev.fim } : null, real: real && real.inicio ? { inicio: real.inicio, ...(real.fim ? { fim: real.fim } : {}) } : null, esperado }
    })
    const ultimoPrevisto = lista.map((e) => j.previsto.find((p) => p.n === e.n)).filter(Boolean).pop()
    const previstoFim = ultimoPrevisto ? ultimoPrevisto.fim : j.inicio
    const esperadoFim = atual ? iso(termino) : (visao.length ? visao[visao.length - 1].real?.fim ?? iso(t) : iso(t))
    const pausas = (o.pausas || []).filter((p) => p && typeof p.inicio === 'string').map((p) => ({ inicio: p.inicio, fim: typeof p.fim === 'string' ? p.fim : null }))
    const pausaMs = pausas.reduce((s, p) => s + Math.max(0, (p.fim ? ms(p.fim) : t) - ms(p.inicio)), 0)
    return {
      inicio: j.inicio,
      previstoFim,
      esperadoFim,
      diferencaMs: ms(esperadoFim) - ms(previstoFim),
      pausaMs,
      entregues: lista.filter((e) => e.status === 'concluido').length,
      total: lista.length,
      etapas: visao,
      pausas,
    }
  }

  return { atualizar }
}

module.exports = { criarCronograma }
