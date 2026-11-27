// Desempenho da obra (aprovado pelo Luiz em 26/11/2026): a curva S do CONSUMO do plano do Claude (previsto, realizado e projetado),
// o ritmo de gasto e o término projetado com as PAUSAS DA COTA. O consumo é o que manda no prazo: cada vez que a cota da janela de
// 5 h acaba, a obra espera a janela renovar.
//  - Unidade: o custo equivalente que o próprio Claude Code informa a cada rodada (.atlas/consumo.jsonl). Pesa entrada, saída e
//    cache do jeito certo. Na tela vira % do orçamento da obra; o número em si nunca aparece.
//  - ORÇAMENTO: até a 1ª etapa entregue, estimativa pelo tamanho do PLAN (peso × PADRAO.custoPorPeso). Na 1ª entrega, fica fixado
//    em quanto a obra inteira custaria naquele ritmo (o chamador guarda em .atlas/desempenho.json).
//  - COTA da janela de 5 h: aprendida pelas pausas que já aconteceram (quanto foi gasto na janela até parar; a mediana). Antes da
//    1ª pausa, estimativa por plano. A Anthropic não publica esse tamanho. Ultra (verificado) não tem janela de 5 h.
//  - Só conta o que foi gasto depois que a construção começou (o protótipo e o nome ficam de fora).
//  - PROJEÇÃO: o que falta (pelo custo por peso medido) no ritmo das últimas horas de trabalho, parando quando a cota da janela acaba.
'use strict'

const H = 3600_000
const JANELA = 5 * H
const PADRAO = Object.freeze({ custoPorPeso: 5, cota: Object.freeze({ pro: 15, max: 75 }) })
const ms = (s) => Date.parse(s)
const iso = (t) => new Date(t).toISOString()
const suave = (x) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u) } // curva S (smoothstep)
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r2 = (v) => Math.round(v * 100) / 100

/** Reduz uma série a no máximo `max` pontos (mantém o primeiro e o último). */
function reduzir(pontos, max = 200) {
  if (pontos.length <= max) return pontos
  const passo = (pontos.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => pontos[Math.round(i * passo)])
}

/**
 * @param o { inicio, previstoFim, etapas:[{n,peso,status,pct}], consumo:[{fim,custoUsd,duracaoMs}], pausas:[{inicio,fim|null}],
 *            plano:'pro'|'max'|'ultra'|null, agora:Date, orcamentoGuardado?:number }
 */
function calcularDesempenho(o) {
  const agora = o.agora.getTime()
  const inicio = ms(o.inicio)
  const previstoFim = Math.max(inicio + H, ms(o.previstoFim))
  const plano = o.plano === 'max' || o.plano === 'ultra' ? o.plano : 'pro'
  const etapas = (o.etapas || []).map((e) => ({ ...e, peso: e.peso > 0 ? e.peso : 1 }))
  const pesoTotal = etapas.reduce((s, e) => s + e.peso, 0) || 1
  const feitoDe = (e) => (e.status === 'concluido' ? 1 : Math.min(100, Math.max(0, Number(e.pct) || 0)) / 100)
  const pesoFeito = etapas.reduce((s, e) => s + e.peso * feitoDe(e), 0)

  const turnos = (o.consumo || []).filter((c) => c && Number.isFinite(ms(c.fim)) && ms(c.fim) >= inicio && Number(c.custoUsd) > 0).map((c) => ({ t: ms(c.fim), v: Number(c.custoUsd), d: Number(c.duracaoMs) || 0 })).sort((a, b) => a.t - b.t)
  const realizado = turnos.reduce((s, c) => s + c.v, 0)
  const gastoEntre = (de, ate) => turnos.reduce((s, c) => s + (c.t > de && c.t <= ate ? c.v : 0), 0)

  // Só conta como "feito com este gasto" o que foi feito DEPOIS que a medição começou (27/11/2026). Etapa entregue antes do 1º
  // começo da construção (obra trazida pronta em parte, ou feita antes de o Atlas medir) gastou o que não está no registro: se entrasse
  // na conta, o orçamento sairia minúsculo e o consumo e o ritmo virariam milhares de % (o caso do Eduardo).
  const medidoDe = (e) => (e.status === 'concluido' && e.antesDaObra ? 0 : feitoDe(e))
  const pesoMedido = etapas.reduce((s, e) => s + e.peso * medidoDe(e), 0)
  // O orçamento cobre só o escopo medido: o que já estava pronto antes de medir fica fora (não gastou deste registro).
  const escopoMedido = Math.max(pesoMedido, pesoTotal - (pesoFeito - pesoMedido)) || 1
  const entreguesMedidas = etapas.filter((e) => e.status === 'concluido' && medidoDe(e) === 1).length

  // Orçamento (BAC) e estimativa no fim (EAC).
  const custoPorPeso = pesoMedido >= 0.2 && realizado > 0 ? realizado / pesoMedido : null
  const eac = Math.max(realizado, custoPorPeso ? realizado + custoPorPeso * (pesoTotal - pesoFeito) : PADRAO.custoPorPeso * pesoTotal)
  const guardado = Number(o.orcamentoGuardado) > 0 ? Number(o.orcamentoGuardado) : null
  const fixar = !guardado && entreguesMedidas >= 1 && custoPorPeso ? eac : null
  // Sem medição suficiente, o orçamento é estimativa e cresce com o gasto (nunca mostra "estourou" antes de saber o tamanho).
  const orcamento = guardado ?? fixar ?? Math.max(PADRAO.custoPorPeso * escopoMedido, realizado * 1.25)
  const estimativaInicial = !guardado && !fixar

  // Pausas de cota que já aconteceram: aprendem a cota (o gasto na janela até parar).
  const pausas = (o.pausas || []).filter((p) => p && Number.isFinite(ms(p.inicio))).map((p) => ({ i: ms(p.inicio), f: p.fim ? ms(p.fim) : null })).sort((a, b) => a.i - b.i)
  const amostras = []
  let fimAnterior = inicio
  for (const p of pausas) {
    const ini = Math.max(fimAnterior, inicio, p.i - JANELA)
    const g = gastoEntre(ini, p.i)
    if (g > 0) amostras.push(g)
    fimAnterior = p.f ?? p.i
  }
  const cotaAprendida = plano !== 'ultra' && amostras.length > 0
  const cota = plano === 'ultra' ? null : cotaAprendida ? mediana(amostras) : PADRAO.cota[plano]

  // Trechos SEM TRABALHO (Luiz, 27/11/2026): nenhuma rodada do Claude por mais de 30 min e sem pausa de cota no meio. Na prática,
  // o computador desligado, o Atlas fechado ou a obra pausada. A linha do realizado segue reta neles e o gráfico marca o trecho.
  const MIN_PARADA = 30 * 60_000
  const semTrabalho = []
  const tirarPausas = (a, b) => {
    let trechos = [[a, b]]
    for (const p of pausas) {
      const pf = p.f ?? agora
      trechos = trechos.flatMap(([x, y]) => (pf <= x || p.i >= y ? [[x, y]] : [[x, Math.max(x, p.i)], [Math.min(y, pf), y]].filter(([u, v]) => v > u)))
    }
    return trechos
  }
  const marcarParada = (a, b, ateAgora) => {
    for (const [x, y] of tirarPausas(a, b)) if (y - x >= MIN_PARADA) semTrabalho.push({ inicio: iso(x), fim: iso(y), ate_agora: ateAgora && y === b })
  }
  {
    let prev = turnos.length ? turnos[0].t : null
    for (const c of turnos.slice(1)) { const comeco = c.t - Math.max(0, c.d); if (comeco - prev > MIN_PARADA) marcarParada(prev, comeco, false); prev = Math.max(prev, c.t) }
    if (prev !== null && agora - prev > MIN_PARADA) marcarParada(prev, agora, true)
  }

  // Ritmo de gasto por hora de trabalho: últimas 3 h fora das pausas; sem isso, pela duração das rodadas; sem nada, pelo previsto.
  const emPausa = (a, b) => pausas.reduce((s, p) => s + Math.max(0, Math.min(b, p.f ?? agora) - Math.max(a, p.i)), 0)
  const de3h = Math.max(inicio, agora - 3 * H)
  const ativo3h = agora - de3h - emPausa(de3h, agora)
  const ultimas = turnos.slice(-30)
  const duracao = ultimas.reduce((s, c) => s + c.d, 0)
  const porHora = ativo3h >= 0.5 * H && gastoEntre(de3h, agora) > 0 ? gastoEntre(de3h, agora) / (ativo3h / H)
    : duracao >= 10 * 60_000 ? ultimas.reduce((s, c) => s + c.v, 0) / (duracao / H)
      : eac / ((previstoFim - inicio) / H)

  // Projeção: trabalha no ritmo até a cota da janela acabar; espera a janela renovar (5 h desde que ela começou).
  const pausasPrevistas = []
  const projetado = [{ t: agora, v: realizado }]
  let t = agora
  let falta = Math.max(0, eac - realizado)
  const aberta = pausas.length && pausas[pausas.length - 1].f === null ? pausas[pausas.length - 1] : null
  const ultimoFim = pausas.filter((p) => p.f !== null).reduce((m, p) => Math.max(m, p.f), inicio)
  let janelaIni = Math.max(inicio, ultimoFim, agora - JANELA)
  let usado = gastoEntre(janelaIni, agora)
  if (aberta && cota !== null) {
    const ini = Math.max(ultimoFim, inicio, aberta.i - JANELA)
    const fim = Math.max(agora, ini + JANELA)
    pausasPrevistas.push({ inicio: iso(aberta.i), fim: iso(fim) })
    t = fim; janelaIni = fim; usado = 0
    projetado.push({ t, v: realizado })
  }
  let acum = realizado
  for (let i = 0; i < 500 && falta > 1e-9; i++) {
    if (cota === null) { t += (falta / porHora) * H; acum += falta; falta = 0; projetado.push({ t, v: acum }); break }
    const espaco = cota - usado
    if (espaco <= 1e-9) {
      const fim = Math.max(janelaIni + JANELA, t + 15 * 60_000)
      pausasPrevistas.push({ inicio: iso(t), fim: iso(fim) })
      t = fim; janelaIni = fim; usado = 0
      projetado.push({ t, v: acum })
      continue
    }
    const gasto = Math.min(espaco, falta)
    t += (gasto / porHora) * H; acum += gasto; falta -= gasto; usado += gasto
    projetado.push({ t, v: acum })
  }

  const pct = (v) => r2((v / orcamento) * 100)
  const previstoSerie = Array.from({ length: 41 }, (_, k) => { const tt = inicio + ((previstoFim - inicio) * k) / 40; return { t: iso(tt), v: r2(suave((tt - inicio) / (previstoFim - inicio)) * 100) } })
  let soma = 0
  // Cada rodada gasta ao longo do tempo em que trabalhou (rampa do começo ao fim), não num salto no fim: uma rodada de 3 h não
  // aparece como 3 h paradas e um degrau (27/11/2026).
  const brutos = [{ t: inicio, v: 0 }]
  for (const c of turnos) {
    const ultimo = brutos[brutos.length - 1]
    const comeco = Math.max(ultimo.t, c.t - Math.max(0, c.d))
    if (comeco > ultimo.t && comeco < c.t) brutos.push({ t: comeco, v: soma })
    soma += c.v
    brutos.push({ t: Math.max(c.t, ultimo.t), v: soma })
  }
  if (brutos[brutos.length - 1].t < agora) brutos.push({ t: agora, v: realizado }) // segue reta até agora: sem gasto, sem subir
  const realizadoSerie = reduzir(brutos).map((p) => ({ t: iso(p.t), v: pct(p.v) }))
  const fisicoPct = (pesoFeito / pesoTotal) * 100

  return {
    orcamento: r2(orcamento),
    fixarOrcamento: fixar ? r2(fixar) : null,
    estimativaInicial,
    realizadoPct: pct(realizado),
    previstoAgoraPct: r2(suave((agora - inicio) / (previstoFim - inicio)) * 100),
    fisicoPct: r2(fisicoPct),
    ritmo: !estimativaInicial && pesoMedido > 0 && realizado > 0 ? r2(realizado / (orcamento * (pesoMedido / escopoMedido)) - 1) : null,
    plano,
    cota: cota === null ? null : r2(cota),
    cotaAprendida,
    terminoProjetado: iso(t),
    previstoFim: iso(previstoFim),
    pausasPrevistas,
    semTrabalho,
    projetadoFimPct: pct(acum),
    serie: { previsto: previstoSerie, realizado: realizadoSerie, projetado: projetado.map((p) => ({ t: iso(p.t), v: pct(p.v) })) },
  }
}

module.exports = { calcularDesempenho, PADRAO }
