// "O notebook é o canteiro" (prototipo/caminho-novo/TP1Tampa, aprovada pelo Luiz em 24/11/2026). Com a tampa fechada o Windows
// dorme e a obra para; o Atlas só segura o sono por inatividade (powerSaveBlocker). Aqui, com o clique da pessoa, a ação de fechar a
// tampa NA TOMADA vira "não fazer nada" (na bateria continua dormindo, para não esquentar dentro da mochila). O valor de antes fica
// em <userData>\tampa.json e volta sozinho quando não houver obra em construção (main.cjs). Só o powercfg do próprio Windows, sem
// administrador, sempre com argumentos fixos.
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const ARGS_LER = ['/q', 'SCHEME_CURRENT', 'SUB_BUTTONS', 'LIDACTION']

/** Saída do `powercfg /q`: os dois últimos "0x..." são o valor na tomada (CA/AC) e na bateria (CC/DC), em qualquer idioma. */
function valorAtualCa(saida) {
  const v = [...String(saida).matchAll(/:\s*0x([0-9a-f]+)/gi)].map((m) => parseInt(m[1], 16))
  return v.length >= 2 ? v[v.length - 2] : null
}

/** deps: { dadosApp, rodar(args) → {codigo, saida}, plataforma? } */
function criarTampa({ dadosApp, rodar, plataforma = process.platform }) {
  const arquivo = path.join(dadosApp, 'tampa.json')
  const lido = () => { try { const j = JSON.parse(fs.readFileSync(arquivo, 'utf8')); return Number.isInteger(j.antes) ? j : null } catch { return null } }
  const definir = async (valor) => {
    const a = await rodar(['/setacvalueindex', 'SCHEME_CURRENT', 'SUB_BUTTONS', 'LIDACTION', String(valor)])
    if (a.codigo !== 0) return false
    return (await rodar(['/setactive', 'SCHEME_CURRENT'])).codigo === 0
  }
  return {
    ajustada: () => lido() !== null,
    async ajustar() {
      if (plataforma !== 'win32') return { ok: false, motivo: 'so-windows' }
      try {
        if (!lido()) {
          const q = await rodar(ARGS_LER)
          const antes = q.codigo === 0 ? valorAtualCa(q.saida) : null
          if (antes === null) return { ok: false, motivo: 'nao-deu' }
          fs.mkdirSync(dadosApp, { recursive: true })
          fs.writeFileSync(arquivo, JSON.stringify({ versao: 1, antes }) + '\n')
        }
        if (!(await definir(0))) { try { fs.unlinkSync(arquivo) } catch { /* nada */ } return { ok: false, motivo: 'nao-deu' } }
        return { ok: true }
      } catch { return { ok: false, motivo: 'nao-deu' } }
    },
    async restaurar() {
      const j = lido()
      if (!j || plataforma !== 'win32') return
      if (await definir(j.antes)) { try { fs.unlinkSync(arquivo) } catch { /* nada */ } }
    },
  }
}

module.exports = { criarTampa, valorAtualCa }
