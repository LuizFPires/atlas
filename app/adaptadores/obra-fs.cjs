// Auxiliares de disco da obra, compartilhados pelos adaptadores de modo, construção, painel e retomar (processo principal, só Windows).
//
// O QUE FAZ: tudo passa por caminhoSeguro (dentro de Atlas\Obras, sem '..', sem link/junção). `pasta` é SEMPRE o nome de uma
// subpasta da obra (ex.: "agenda-da-barbearia"), nunca um caminho. Gravação atômica (arquivo temporário + rename) e sem seguir link.
//
// COMO TESTAR: `node --test app/adaptadores/*.teste.cjs` (usa pastas temporárias; não precisa de Electron nem do Claude).
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')

/** Nome de subpasta válido: o mesmo alfabeto que nomeParaPasta gera (a-z, 0-9, hífen). Nada de barra, ponto ou dois-pontos. */
const NOME_PASTA = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

/** Caminho absoluto da pasta da obra, validado: dentro da raiz, sem link, e já existente como diretório. */
function pastaDaObra(raiz, pasta) {
  if (typeof pasta !== 'string' || !NOME_PASTA.test(pasta)) throw new Error('obra-invalida')
  const caminho = caminhoSeguro(raiz, pasta)
  let st
  try { st = fs.lstatSync(caminho) } catch { throw new Error('obra-inexistente') }
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('obra-invalida')
  return caminho
}

/**
 * Config de PROJETO não é confiável (a obra pode vir de um repositório de terceiros): se a pasta tem `.claude`, `CLAUDE.md`,
 * `CLAUDE.local.md` ou `.mcp.json` (existindo como arquivo, pasta ou link) na raiz OU em subpastas (varredura rasa: 2 níveis,
 * sem node_modules/.git), NÃO se dispara o Claude. Conferido com lstat antes de CADA disparo. Fail-closed: erro != ENOENT recusa.
 *
 * `.git`: numa obra NOVA (planejar / iniciar) um `.git` que já esteja na pasta veio de fora (ex.: zip importado) e pode trazer
 * hooks/config: recusa ('obra-com-config-suspeita'). Depois que a linha rodou, o `.git` é o que o próprio /construir criou
 * (`permitirGit: true`, usado ao religar/continuar/retomar); mesmo assim os hooks são neutralizados pelo gitconfig do app.
 */
const NOMES_SUSPEITOS = ['.claude', 'CLAUDE.md', 'CLAUDE.local.md', '.mcp.json']
const IGNORAR_NA_VARREDURA = new Set(['node_modules', '.git', '.atlas'])
const MAX_SUBPASTAS_VARRIDAS = 400

function existe(caminho) {
  try { fs.lstatSync(caminho) } catch (e) { if (e.code === 'ENOENT') return false; return true } // erro estranho => trata como suspeito
  return true
}

function subpastas(dir) {
  const ents = fs.readdirSync(dir, { withFileTypes: true }) // erro => propaga (fail-closed)
  return ents.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !IGNORAR_NA_VARREDURA.has(e.name)).map((e) => path.join(dir, e.name))
}

function garantirSemConfigDeProjeto(cwd, { permitirGit = false } = {}) {
  const suspeito = () => new Error('obra-com-config-suspeita')
  const nomes = permitirGit ? NOMES_SUSPEITOS : [...NOMES_SUSPEITOS, '.git']
  for (const nome of nomes) if (existe(path.join(cwd, nome))) throw suspeito()
  let restante = MAX_SUBPASTAS_VARRIDAS
  try {
    for (const n1 of subpastas(cwd)) {
      if (--restante < 0) return
      for (const nome of NOMES_SUSPEITOS) if (existe(path.join(n1, nome))) throw suspeito()
      for (const n2 of subpastas(n1)) {
        if (--restante < 0) return
        for (const nome of NOMES_SUSPEITOS) if (existe(path.join(n2, nome))) throw suspeito()
      }
    }
  } catch (e) {
    throw suspeito()
  }
}

/** `<obra>\.atlas` (cria se faltar; mkdir sem recursive, depois de validar o caminho). */
function pastaAtlas(raiz, pasta) {
  pastaDaObra(raiz, pasta)
  const alvo = caminhoSeguro(raiz, pasta, '.atlas')
  try { fs.mkdirSync(alvo) } catch (e) { if (e.code !== 'EEXIST') throw e }
  return caminhoSeguro(raiz, pasta, '.atlas') // revalida: se já existia, não pode ser link
}

/** Grava texto de forma atômica (tmp único com 'wx' + rename). Recusa destino que seja link. */
function gravarAtomico(destino, texto) {
  try { if (fs.lstatSync(destino).isSymbolicLink()) throw new Error('caminho-com-link') } catch (e) { if (e.code !== 'ENOENT') throw e }
  const tmp = `${destino}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  try {
    fs.writeFileSync(tmp, texto, { flag: 'wx' })
    fs.renameSync(tmp, destino)
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* nada a limpar */ }
    throw e
  }
}

/** Lê texto (até `max` bytes); inexistente/link/grande demais => null. */
function lerTexto(destino, max = 1_000_000) {
  try {
    const st = fs.lstatSync(destino)
    if (st.isSymbolicLink() || !st.isFile() || st.size > max) return null
    return fs.readFileSync(destino, 'utf8')
  } catch { return null }
}

function lerJson(destino) {
  const t = lerTexto(destino, 200_000)
  if (t === null) return null
  try { return JSON.parse(t) } catch { return null }
}

module.exports = { NOME_PASTA, garantirSemConfigDeProjeto, pastaDaObra, pastaAtlas, gravarAtomico, lerTexto, lerJson, path }
