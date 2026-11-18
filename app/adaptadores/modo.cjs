// Adaptador real do PonteModoObra (src/app/ponte-construcao.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ: guarda o modo da obra (automatico | passo-a-passo) em <obra>\.atlas\modo.json = {versao:1, modo, escolhidoEm}.
// Gravação atômica (tmp + rename), caminho por caminhoSeguro, sem seguir link. É a FONTE do modo: o painel lê daqui.
// Também expõe `gravarRecomendadoGlobal`: as skills do kit leem ~/.claude/recomendado.json (GLOBAL, não por obra). Como o cliente
// roda UMA obra por vez no computador, ao iniciar/trocar o modo da obra o Atlas regrava esse arquivo global
// ({ativo:true} no automático, {ativo:false} no passo a passo); o modo.json por obra é a memória local de cada obra.
// Nunca guarda segredo.
//
// COMO TESTAR (Windows): `node --test app/adaptadores/*.teste.cjs`; no app, escolher o modo na aprovação e abrir
// C:\Users\<você>\Atlas\Obras\<obra>\.atlas\modo.json (e C:\Users\<você>\.claude\recomendado.json).
'use strict'
const os = require('node:os')
const path = require('node:path')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaAtlas, pastaDaObra, gravarAtomico, lerJson } = require('./obra-fs.cjs')

const MODOS = Object.freeze(['automatico', 'passo-a-passo'])
const ehModoObra = (m) => typeof m === 'string' && MODOS.includes(m)

/** Igual a paraRecomendado de src/app/ponte-construcao.ts (manter em sincronia). */
const paraRecomendado = (modo) => ({ ativo: modo === 'automatico' })

/** Igual a serializarModo de ponte-construcao.ts. */
function serializarModo(modo, agora = new Date()) {
  return JSON.stringify({ versao: 1, modo, escolhidoEm: agora.toISOString() }, null, 2) + '\n'
}

/** Mesma regra de lerModoDoTexto: formato fora do esperado => null (o painel pergunta, não adivinha). */
function lerModoDoObjeto(o) {
  return o && typeof o === 'object' && o.versao === 1 && ehModoObra(o.modo) ? o.modo : null
}

/**
 * Regrava ~/.claude/recomendado.json (global). Preserva "desde"/"ate"/"checkpoint" existentes; só troca "ativo".
 * `home` é a pasta do usuário (injetável em teste). Fora de Atlas\Obras de propósito: é onde as skills do kit leem.
 */
function gravarRecomendadoGlobal(modo, { home = os.homedir(), agora = new Date() } = {}) {
  const pasta = caminhoSeguro(home, '.claude')
  try { require('node:fs').mkdirSync(pasta) } catch (e) { if (e.code !== 'EEXIST') throw e }
  const destino = caminhoSeguro(home, '.claude', 'recomendado.json')
  const atual = lerJson(destino) || {}
  const novo = {
    ativo: paraRecomendado(modo).ativo,
    desde: typeof atual.desde === 'string' && atual.ativo === paraRecomendado(modo).ativo ? atual.desde : agora.toISOString(),
    ate: atual.ate ?? null,
    checkpoint: Number.isInteger(atual.checkpoint) ? atual.checkpoint : 3,
  }
  gravarAtomico(destino, JSON.stringify(novo) + '\n')
  return novo
}

/** `deps`: { raiz, agora } */
function criarModo({ raiz, agora = () => new Date() }) {
  return {
    async ler(pasta) {
      pastaDaObra(raiz, pasta)
      return lerModoDoObjeto(lerJson(caminhoSeguro(raiz, pasta, '.atlas', 'modo.json')))
    },
    async gravar(pasta, modo) {
      if (!ehModoObra(modo)) throw new Error('modo-invalido')
      const dir = pastaAtlas(raiz, pasta)
      gravarAtomico(path.join(dir, 'modo.json'), serializarModo(modo, agora()))
    },
  }
}

module.exports = { criarModo, gravarRecomendadoGlobal, serializarModo, lerModoDoObjeto, paraRecomendado, ehModoObra, MODOS }
