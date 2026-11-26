// M60 — Lançamento (prototipo/caminho-novo/LC1Lancamento: comecar, recebimento, lista). Decisões do Luiz (25/11/2026): é OPCIONAL
// (sem começar, nada muda), fica no menu "Lançamentos" e começa de dentro de cada obra no ar; o cliente escolhe Stripe ou Asaas e o
// dinheiro cai SEMPRE na conta dele. Aqui só fica o que ele decidiu (.atlas/lancamento.json, sem chave nenhuma): as chaves do
// gateway vão para as variáveis do servidor do PRÓPRIO sistema do cliente, pelo Incorporador (M61/M62).
'use strict'
const fs = require('node:fs')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaAtlas, pastaDaObra, gravarAtomico, lerJson } = require('./obra-fs.cjs')

const PLANOS_SUGERIDOS = Object.freeze([
  Object.freeze({ nome: 'Grátis', limite: 'até 3 funcionários', preco: 'R$ 0' }),
  Object.freeze({ nome: 'Mensal', limite: 'sem limite', preco: 'R$ 49/mês' }),
  Object.freeze({ nome: 'Anual', limite: 'sem limite', preco: 'R$ 470/ano' }),
])
const GATEWAYS = ['stripe', 'asaas']

function criarLancamento({ raiz }) {
  const arquivo = (pasta) => caminhoSeguro(raiz, String(pasta), '.atlas', 'lancamento.json')
  const ler = (pasta) => {
    let j = null
    try { j = lerJson(arquivo(pasta)) } catch { j = null }
    const o = j && typeof j === 'object' ? j : {}
    return { comecado: o.comecado === true, gateway: GATEWAYS.includes(o.gateway) ? o.gateway : null, contaPronta: o.contaPronta === true, desde: typeof o.desde === 'string' ? o.desde.slice(0, 40) : null }
  }
  const gravar = (pasta, r) => { pastaAtlas(raiz, String(pasta)); gravarAtomico(arquivo(pasta), JSON.stringify({ versao: 1, ...r }) + '\n') }
  const noAr = (pasta) => {
    let j = null
    try { j = lerJson(caminhoSeguro(raiz, String(pasta), '.atlas', 'no-ar.json')) } catch { j = null }
    let dom = null
    try { const d = lerJson(caminhoSeguro(raiz, String(pasta), '.atlas', 'dominio.json')); if (d && d.fase === 'noar' && typeof d.dominio === 'string' && /^[a-z0-9.-]{3,80}$/.test(d.dominio)) dom = d.dominio } catch { dom = null }
    if (!j || typeof j.endereco !== 'string' || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(j.endereco)) return null
    return dom || j.endereco.replace(/^https:\/\//, '')
  }
  const fase = (r) => (!r.gateway || !r.contaPronta ? 'recebimento' : 'pagina')
  const publico = (pasta, r) => ({ ...r, planos: PLANOS_SUGERIDOS.map((p) => ({ ...p })), fase: r.comecado ? fase(r) : 'comecar', endereco: noAr(pasta) })

  return {
    async estado(pasta) { pastaDaObra(raiz, String(pasta)); return publico(pasta, ler(pasta)) },
    async comecar(pasta) {
      pastaDaObra(raiz, String(pasta))
      if (!noAr(pasta)) throw new Error('obra-fora-do-ar')
      const r = ler(pasta)
      if (!r.comecado) gravar(pasta, { ...r, comecado: true, desde: new Date().toISOString() })
      return publico(pasta, ler(pasta))
    },
    async escolherGateway(pasta, g) {
      pastaDaObra(raiz, String(pasta))
      if (!GATEWAYS.includes(g)) throw new Error('gateway-invalido')
      const r = ler(pasta)
      if (!r.comecado) throw new Error('nao-comecado')
      gravar(pasta, { ...r, gateway: g, contaPronta: r.gateway === g ? r.contaPronta : false })
      return publico(pasta, ler(pasta))
    },
    async contaPronta(pasta) {
      pastaDaObra(raiz, String(pasta))
      const r = ler(pasta)
      if (!r.comecado || !r.gateway) throw new Error('sem-gateway')
      gravar(pasta, { ...r, contaPronta: true })
      return publico(pasta, ler(pasta))
    },
    /** Só as obras que o cliente decidiu vender. */
    async listar() {
      let nomes = []
      try { nomes = fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.isSymbolicLink()).map((d) => d.name) } catch { nomes = [] }
      const out = []
      for (const pasta of nomes) {
        let r
        try { r = ler(pasta) } catch { continue }
        if (r.comecado) out.push({ pasta, endereco: noAr(pasta), fase: fase(r), gateway: r.gateway })
      }
      return out
    },
  }
}

module.exports = { criarLancamento, PLANOS_SUGERIDOS }
