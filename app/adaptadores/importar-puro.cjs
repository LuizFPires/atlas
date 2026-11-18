// Espelho em CommonJS das regras PURAS do importar (src/app/ponte-importar.ts: LIMITES, partesDoCaminho, ehLixoDoMac, validarPacote)
// e de nomeLivre (src/app/ponte-arquivos.ts). O processo principal do Electron não importa TypeScript; por isso há uma cópia aqui.
//
// PARIDADE: importar.teste.cjs carrega o TypeScript de verdade (typescript.transpileModule, devDependency) e compara as DUAS
// implementações sobre uma bateria de entradas (mesmo resultado ou mesmo erro). Mudou o validarPacote lá? O teste aponta aqui.
// Sem electron, sem fs: só regras. Nunca segredo.
'use strict'
const { nomeArquivoSeguro } = require('./arquivos.cjs')

const MB = 1024 * 1024
const TAMANHO_MAXIMO = 20 * MB
const LIMITES = Object.freeze({
  zip: 50 * MB,
  entradas: 300,
  total: 100 * MB,
  arquivo: TAMANHO_MAXIMO,
  razao: 100,
  pisoRazao: MB,
  profundidade: 3,
  nome: 120,
})
const EXTENSOES_PROTOTIPO = Object.freeze(['html', 'css', 'js', 'md', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'json'])

const extensaoDe = (nome) => (nome.includes('.') ? nome.slice(nome.lastIndexOf('.') + 1).toLowerCase() : '')

// eslint-disable-next-line no-control-regex
const PROIBIDO = /[\u0000-\u001F\u007F<>:"|?*\\]/
const ABSOLUTO = /^([/\\]|[a-zA-Z]:)/
const EXECUTAVEL = /\.(exe|dll|bat|cmd|com|scr|msi|msp|ps1|psm1|vbs|vbe|wsf|wsh|lnk|url|jar|hta|cpl|reg|sh|app|dmg|apk|zip|rar|7z|iso|scf)$/i

/** Quebra o nome da entrada em partes, ou lança 'caminho-inseguro'. */
function partesDoCaminho(nome) {
  if (!nome || nome.length > 400 || ABSOLUTO.test(nome) || PROIBIDO.test(nome)) throw new Error('caminho-inseguro')
  const partes = nome.replace(/\/+$/, '').split('/')
  for (const p of partes) {
    if (!p || p === '.' || p === '..' || p.length > LIMITES.nome || /[. ]$/.test(p)) throw new Error('caminho-inseguro')
  }
  return partes
}

const ehLixoDoMac = (nome) => nome.startsWith('__MACOSX/') || nome.split('/').pop() === '.DS_Store'

/** Escolhe um nome que não colide: logo.png, logo-2.png... */
function nomeLivre(nome, existentes) {
  const usados = new Set(existentes.map((e) => e.toLowerCase()))
  if (!usados.has(nome)) return nome
  const ext = extensaoDe(nome)
  const base = ext ? nome.slice(0, nome.lastIndexOf('.')) : nome
  for (let i = 2; ; i++) {
    const c = ext ? `${base}-${i}.${ext}` : `${base}-${i}`
    if (!usados.has(c)) return c
  }
}

/**
 * Confere TODAS as entradas antes de gravar qualquer coisa; lança na primeira suspeita (o pacote inteiro é recusado).
 * Devolve [{ origem, destino, tamanho }]. `todas`: [{ nome, tipo, tamanho, comprimido }].
 */
function validarPacote(todas, tamanhoZip) {
  const entradas = todas.filter((e) => !ehLixoDoMac(e.nome))
  if (tamanhoZip > LIMITES.zip) throw new Error('grande-demais')
  if (entradas.length > LIMITES.entradas) throw new Error('muitas-entradas')
  let total = 0
  const arquivos = []
  for (const e of entradas) {
    if (e.tipo === 'link-simbolico' || e.tipo === 'link-fisico' || e.tipo === 'outro') throw new Error('link-nao-aceito')
    const partes = partesDoCaminho(e.nome)
    if (e.tipo === 'pasta') continue
    if (!Number.isFinite(e.tamanho) || !Number.isFinite(e.comprimido) || e.tamanho < 0 || e.comprimido < 0) throw new Error('caminho-inseguro')
    if (e.tamanho > LIMITES.arquivo) throw new Error('zip-bomba')
    if (e.tamanho > LIMITES.pisoRazao && e.tamanho > e.comprimido * LIMITES.razao) throw new Error('compressao-suspeita')
    total += e.tamanho
    if (total > LIMITES.total) throw new Error('zip-bomba')
    const nome = partes[partes.length - 1]
    if (EXECUTAVEL.test(nome) || !EXTENSOES_PROTOTIPO.includes(extensaoDe(nome))) throw new Error('arquivo-nao-aceito')
    arquivos.push({ partes, e })
  }
  if (arquivos.length === 0) throw new Error('zip-vazio')
  if (total > LIMITES.pisoRazao && total > Math.max(tamanhoZip, 1) * LIMITES.razao) throw new Error('compressao-suspeita')

  const raizes = new Set(arquivos.map((a) => a.partes[0]))
  const embrulho = raizes.size === 1 && !['telas', 'imagens'].includes([...raizes][0]) && arquivos.every((a) => a.partes.length > 1)
  const aceitas = []
  const usados = []
  for (const { partes, e } of arquivos) {
    const uteis = embrulho ? partes.slice(1) : partes
    if (uteis.length > LIMITES.profundidade + 1) throw new Error('caminho-inseguro')
    const pastas = uteis.slice(0, -1).map((p) => nomeArquivoSeguro(p))
    const prefixo = pastas.length ? `${pastas.join('/')}/` : ''
    const vizinhos = usados.filter((u) => u.startsWith(prefixo) && !u.slice(prefixo.length).includes('/')).map((u) => u.slice(prefixo.length))
    const destino = prefixo + nomeLivre(nomeArquivoSeguro(uteis[uteis.length - 1]), vizinhos)
    usados.push(destino)
    aceitas.push({ origem: e.nome, destino, tamanho: e.tamanho })
  }
  return aceitas
}

module.exports = { LIMITES, EXTENSOES_PROTOTIPO, TAMANHO_MAXIMO, partesDoCaminho, ehLixoDoMac, nomeLivre, validarPacote, extensaoDe }
