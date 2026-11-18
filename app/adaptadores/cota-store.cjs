// Registro das paradas por cota que o APP viu — guardado FORA da obra (userData\cota\paradas.json).
//
// Por quê: a pasta da obra é escrita pelo Claude da obra (linha.json, ocorrencias.json). Se a retomada AUTOMÁTICA confiasse nela,
// uma obra poderia forjar "parou por cota" e fazer o app religar a linha sozinho (auto-execução + gasto de cota). Este arquivo só
// é escrito pelo processo principal, no fim de uma linha que o PRÓPRIO app iniciou (construcao.cjs). A permissão de religar
// automaticamente vem SÓ daqui. LIMITE: sem sandbox do SO, o Claude ainda poderia escrever em userData; isto move a confiança da
// obra para o app e fecha o caso comum (app/PENDENTE-ENTREGAR.md).
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')
const { gravarAtomico, lerJson } = require('./obra-fs.cjs')

function criarLojaDeParadas({ raiz, dadosApp }) {
  const arquivo = path.join(dadosApp, 'cota', 'paradas.json')
  /** sha256 do CAMINHO REAL da obra (resolve links/maiúsculas do disco). */
  const chaveDe = (pasta) => {
    let real
    try { real = fs.realpathSync.native(caminhoSeguro(raiz, pasta)) } catch { real = path.resolve(caminhoSeguro(raiz, pasta)) }
    return crypto.createHash('sha256').update(process.platform === 'win32' ? real.toLowerCase() : real).digest('hex')
  }
  const lerTudo = () => {
    const d = lerJson(arquivo)
    return d && typeof d === 'object' && d.paradas && typeof d.paradas === 'object' && !Array.isArray(d.paradas) ? d.paradas : {}
  }
  const gravarTudo = (paradas) => {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    gravarAtomico(arquivo, JSON.stringify({ versao: 1, paradas }) + '\n')
  }
  return {
    /** Registra que o app viu esta obra parar por cota. */
    marcar(pasta, { voltaEm = null, em }) {
      const p = lerTudo()
      p[chaveDe(pasta)] = { voltaEm: typeof voltaEm === 'string' ? voltaEm : null, em }
      gravarTudo(p)
    },
    /** { voltaEm, em } ou null. */
    obter(pasta) {
      const r = lerTudo()[chaveDe(pasta)]
      return r && typeof r === 'object' ? { voltaEm: typeof r.voltaEm === 'string' ? r.voltaEm : null, em: r.em } : null
    },
    apagar(pasta) {
      try {
        const p = lerTudo()
        const k = chaveDe(pasta)
        if (k in p) { delete p[k]; gravarTudo(p) }
      } catch { /* sem registro a apagar */ }
    },
  }
}

module.exports = { criarLojaDeParadas }
