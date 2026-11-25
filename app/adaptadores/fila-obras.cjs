// Fila das obras (M51, Luiz em 25/11/2026: "podíamos deixar o usuário decidir se entra em fila, obra por obra, se faz simultâneo
// e etc e o Atlas avisa das consequências"). Telas: prototipo/caminho-novo/Q1Escolher … Q4Canteiro.
//
// Antes o Atlas rodava UMA obra por vez no computador e recusava a segunda ('ja-rodando'). Agora quem decide é o cliente:
//  - fila:     a obra nova espera; começa sozinha quando a obra da frente ficar pronta (o vigia confere a cada minuto);
//  - juntas:   as obras marcadas como "juntas" podem trabalhar ao mesmo tempo (a cota do Claude acaba mais rápido);
//  - primeiro: a obra que estava trabalhando pausa e entra na fila atrás da nova; volta sozinha quando a nova ficar pronta.
// Guardado em <Obras>\.atlas-fila.json (só nomes de pasta; sem segredo nenhum). Arquivo ilegível = fila vazia (nunca trava a obra).
'use strict'
const path = require('node:path')
const { gravarAtomico, lerJson } = require('./obra-fs.cjs')

const COMO = ['fila', 'juntas', 'primeiro']
const ehComo = (c) => COMO.includes(c)
const PASTA_OK = /^[^\\/:*?"<>|\r\n]{1,120}$/

function criarFila({ raiz }) {
  const arquivo = path.join(raiz, '.atlas-fila.json')
  const ler = () => {
    const j = lerJson(arquivo)
    const fila = Array.isArray(j && j.fila) ? j.fila.filter((x) => x && PASTA_OK.test(String(x.pasta)) && PASTA_OK.test(String(x.depoisDe))).map((x) => ({ pasta: String(x.pasta), depoisDe: String(x.depoisDe) })) : []
    const juntas = Array.isArray(j && j.juntas) ? j.juntas.map(String).filter((p) => PASTA_OK.test(p)) : []
    return { fila, juntas }
  }
  const gravar = (e) => gravarAtomico(arquivo, JSON.stringify({ versao: 1, fila: e.fila, juntas: [...new Set(e.juntas)] }) + '\n')
  const semPasta = (e, pasta) => ({ fila: e.fila.filter((x) => x.pasta !== pasta), juntas: e.juntas })

  return {
    ler,
    /** Pode trabalhar junto com outras obras? (o cliente escolheu "ao mesmo tempo" para ela). */
    junta: (pasta) => ler().juntas.includes(pasta),
    /** Está esperando a vez? */
    naFila: (pasta) => ler().fila.some((x) => x.pasta === pasta),
    /** Põe na fila atrás de `depoisDe` (se já estava, troca a posição). Sai do grupo "juntas". */
    entrar(pasta, depoisDe) {
      const e = semPasta(ler(), pasta)
      gravar({ fila: [...e.fila, { pasta, depoisDe }], juntas: e.juntas.filter((p) => p !== pasta) })
    },
    /** Marca as obras para trabalharem ao mesmo tempo (e tira da fila as que estavam nela). */
    juntar(pastas) {
      let e = ler()
      for (const p of pastas) e = semPasta(e, p)
      gravar({ fila: e.fila, juntas: [...e.juntas, ...pastas] })
    },
    /** A obra saiu da fila (começou, foi excluída ou ficou pronta). Quem esperava por ela passa a esperar por quem ela esperava. */
    sair(pasta) {
      const e = ler()
      const eu = e.fila.find((x) => x.pasta === pasta)
      const fila = e.fila.filter((x) => x.pasta !== pasta).map((x) => (x.depoisDe === pasta && eu ? { ...x, depoisDe: eu.depoisDe } : x))
      gravar({ fila, juntas: e.juntas })
    },
    /** Obra pronta: deixa de contar no grupo "juntas". */
    terminou(pasta) { const e = ler(); gravar({ fila: e.fila, juntas: e.juntas.filter((p) => p !== pasta) }) },
  }
}

/** Fila só na memória (testes e quando não há pasta de obras). */
function criarFilaMemoria() {
  let e = { fila: [], juntas: [] }
  const f = {
    ler: () => ({ fila: e.fila.map((x) => ({ ...x })), juntas: [...e.juntas] }),
    junta: (p) => e.juntas.includes(p),
    naFila: (p) => e.fila.some((x) => x.pasta === p),
    entrar(p, d) { e = { fila: [...e.fila.filter((x) => x.pasta !== p), { pasta: p, depoisDe: d }], juntas: e.juntas.filter((x) => x !== p) } },
    juntar(ps) { e = { fila: e.fila.filter((x) => !ps.includes(x.pasta)), juntas: [...new Set([...e.juntas, ...ps])] } },
    sair(p) { const eu = e.fila.find((x) => x.pasta === p); e = { fila: e.fila.filter((x) => x.pasta !== p).map((x) => (x.depoisDe === p && eu ? { ...x, depoisDe: eu.depoisDe } : x)), juntas: e.juntas } },
    terminou(p) { e = { ...e, juntas: e.juntas.filter((x) => x !== p) } },
  }
  return f
}

module.exports = { criarFila, criarFilaMemoria, ehComo, COMO }
