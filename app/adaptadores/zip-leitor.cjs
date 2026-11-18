// Leitor de .zip NÃO CONFIÁVEL, só com o Node (fs + zlib). Sem dependência externa: o formato aceito é de propósito pequeno e estrito,
// assim dá para auditar tudo aqui. O que NÃO está no formato aceito é RECUSADO (nunca "consertado").
//
// O QUE FAZ
//  listar(fd, tamanho): lê SÓ o índice (central directory) e confere o arquivo todo SEM gravar nada. Devolve as entradas no formato
//    de validarPacote ({nome, tipo, tamanho, comprimido}) + o necessário para extrair. Recusa (ErroZip, com .detalhe):
//    - arquivo que não é .zip (sem fim-de-índice válido, lixo depois do fim) .............. 'tipo-nao-aceito'
//    - zip64 (tamanhos/offsets 0xFFFFFFFF, localizador zip64) e vários discos .............. 'caminho-inseguro' / zip64
//    - CRIPTOGRAFADO (flag bit 0, criptografia forte bit 6, extra AES 0x9901) .............. 'caminho-inseguro' / criptografado
//    - método que não seja 0 (guardado) ou 8 (deflate) ..................................... 'caminho-inseguro' / metodo
//    - link simbólico (modo Unix 0o120000), reparse point do Windows (0x400), fifo/dispositivo -> tipo 'link-simbolico'/'outro'
//    - extra field mal formado (tamanhos que não fecham) ................................... 'caminho-inseguro' / extra
//    - nomes repetidos (sem diferenciar maiúsculas) e arquivo x pasta de mesmo nome ........ 'caminho-inseguro' / duplicado
//    - cabeçalho LOCAL que discorda do índice (nome, método, tamanhos, crc) ................ 'caminho-inseguro' / cabecalho-diverge
//    - entradas cujos bytes SE SOBREPÕEM ou invadem o índice (overlap bomb) ................ 'caminho-inseguro' / sobreposicao
//    Só o índice (central directory) manda; o "Unicode path extra field" é ignorado, o nome vem do índice.
//  extrairEntrada(fd, entrada, escrever, contador): descompacta em STREAMING (nunca o arquivo inteiro na memória) contando os bytes
//    REAIS que saem do deflate (o cabeçalho pode mentir). Estourou o tamanho declarado, o limite do arquivo, o total ou a razão de
//    compressão: interrompe na hora ('zip-bomba' / 'compressao-suspeita'). No fim confere tamanho exato e CRC-32.
//
// COMO TESTAR: `node --test app/adaptadores/importar.teste.cjs` (monta .zip malicioso byte a byte para cada ataque).
'use strict'
const fs = require('node:fs')
const zlib = require('node:zlib')

const SIG_EOCD = 0x06054b50
const SIG_CD = 0x02014b50
const SIG_LOCAL = 0x04034b50
const SIG_ZIP64_LOCALIZADOR = 0x07064b50
const MAX_ENTRADAS_BRUTAS = 1000
const MAX_INDICE = 2 * 1024 * 1024
const CHUNK_ENTRADA = 16 * 1024

class ErroZip extends Error {
  constructor(mensagem, detalhe) { super(mensagem); this.detalhe = detalhe }
}
const recusa = (mensagem, detalhe) => new ErroZip(mensagem, detalhe)
const inseguro = (detalhe) => recusa('caminho-inseguro', detalhe)

function lerExato(fd, posicao, tamanho) {
  if (tamanho < 0 || posicao < 0) throw inseguro('leitura')
  const buf = Buffer.alloc(tamanho)
  let lidos = 0
  while (lidos < tamanho) {
    const n = fs.readSync(fd, buf, lidos, tamanho - lidos, posicao + lidos)
    if (n <= 0) throw inseguro('truncado')
    lidos += n
  }
  return buf
}

// CRC-32 (zip): tabela clássica.
const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(atual, buf) {
  let c = atual
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return c >>> 0
}

/** Confere a estrutura dos extra fields (id,tam,dados...) e recusa zip64 e AES. */
function conferirExtra(extra) {
  let i = 0
  while (i < extra.length) {
    if (i + 4 > extra.length) throw inseguro('extra')
    const id = extra.readUInt16LE(i)
    const tam = extra.readUInt16LE(i + 2)
    if (i + 4 + tam > extra.length) throw inseguro('extra')
    if (id === 0x0001) throw inseguro('zip64')
    if (id === 0x9901) throw inseguro('criptografado')
    i += 4 + tam
  }
}

function tipoDaEntrada(nome, versaoFeitaPor, atributoExterno) {
  const hospedeiro = versaoFeitaPor >> 8
  const ehPasta = nome.endsWith('/')
  if (hospedeiro === 3) { // Unix: o modo está nos 16 bits altos
    const modo = (atributoExterno >>> 16) & 0xFFFF
    const formato = modo & 0o170000
    if (formato === 0o120000) return 'link-simbolico'
    if (formato === 0o040000 || ehPasta) return 'pasta'
    if (formato === 0o100000 || formato === 0) return 'arquivo'
    return 'outro' // fifo, dispositivo, socket...
  }
  if (hospedeiro === 0 || hospedeiro === 10) { // DOS / NTFS: atributos nos 16 bits baixos
    const attr = atributoExterno & 0xFFFF
    if (attr & 0x400) return 'link-simbolico' // FILE_ATTRIBUTE_REPARSE_POINT (junção/link)
    if (attr & 0x10 || ehPasta) return 'pasta'
    return 'arquivo'
  }
  return ehPasta ? 'pasta' : 'arquivo'
}

/** Lê e confere o índice e os cabeçalhos locais. NÃO grava nada. `tamanho` = tamanho do arquivo (fstat). */
function listar(fd, tamanho) {
  if (tamanho < 22) throw recusa('tipo-nao-aceito', 'curto')
  const cauda = lerExato(fd, Math.max(0, tamanho - (22 + 65535)), Math.min(tamanho, 22 + 65535))
  const inicioCauda = tamanho - cauda.length
  let eocd = -1
  for (let i = cauda.length - 22; i >= 0; i--) {
    if (cauda.readUInt32LE(i) === SIG_EOCD && i + 22 + cauda.readUInt16LE(i + 20) === cauda.length) { eocd = i; break } // o comentário tem de ir EXATO até o fim
  }
  if (eocd < 0) throw recusa('tipo-nao-aceito', 'sem-fim-de-indice')
  const posEocd = inicioCauda + eocd
  const disco = cauda.readUInt16LE(eocd + 4)
  const discoIndice = cauda.readUInt16LE(eocd + 6)
  const noDisco = cauda.readUInt16LE(eocd + 8)
  const total = cauda.readUInt16LE(eocd + 10)
  const tamIndice = cauda.readUInt32LE(eocd + 12)
  const offIndice = cauda.readUInt32LE(eocd + 16)
  if (disco !== 0 || discoIndice !== 0 || noDisco !== total) throw inseguro('varios-discos')
  if (total === 0xFFFF || tamIndice === 0xFFFFFFFF || offIndice === 0xFFFFFFFF) throw inseguro('zip64')
  if (posEocd >= 20 && lerExato(fd, posEocd - 20, 4).readUInt32LE(0) === SIG_ZIP64_LOCALIZADOR) throw inseguro('zip64')
  if (total > MAX_ENTRADAS_BRUTAS) throw recusa('muitas-entradas', 'indice')
  if (tamIndice > MAX_INDICE || offIndice + tamIndice !== posEocd) throw inseguro('indice-fora-de-lugar') // o índice tem de colar no fim-de-índice
  if (total === 0) return { entradas: [], tamanho }

  const indice = lerExato(fd, offIndice, tamIndice)
  const lista = []
  let p = 0
  for (let n = 0; n < total; n++) {
    if (p + 46 > indice.length || indice.readUInt32LE(p) !== SIG_CD) throw inseguro('indice')
    const versaoFeitaPor = indice.readUInt16LE(p + 4)
    const flags = indice.readUInt16LE(p + 8)
    const metodo = indice.readUInt16LE(p + 10)
    const crc = indice.readUInt32LE(p + 16)
    const comprimido = indice.readUInt32LE(p + 20)
    const descomprimido = indice.readUInt32LE(p + 24)
    const nNome = indice.readUInt16LE(p + 28)
    const nExtra = indice.readUInt16LE(p + 30)
    const nComent = indice.readUInt16LE(p + 32)
    const discoInicial = indice.readUInt16LE(p + 34)
    const atributoExterno = indice.readUInt32LE(p + 38)
    const offLocal = indice.readUInt32LE(p + 42)
    const fim = p + 46 + nNome + nExtra + nComent
    if (fim > indice.length) throw inseguro('indice')
    if (discoInicial !== 0) throw inseguro('varios-discos')
    if (comprimido === 0xFFFFFFFF || descomprimido === 0xFFFFFFFF || offLocal === 0xFFFFFFFF) throw inseguro('zip64')
    if (flags & 0x0001 || flags & 0x0040 || flags & 0x2000) throw inseguro('criptografado') // senha, criptografia forte, cabeçalhos mascarados
    const nomeBruto = indice.subarray(p + 46, p + 46 + nNome)
    conferirExtra(indice.subarray(p + 46 + nNome, p + 46 + nNome + nExtra))
    const nome = (flags & 0x0800) ? nomeBruto.toString('utf8') : nomeBruto.toString('latin1')
    const tipo = tipoDaEntrada(nome, versaoFeitaPor, atributoExterno)
    if (tipo === 'arquivo' || tipo === 'pasta') {
      if (metodo !== 0 && metodo !== 8) throw inseguro('metodo')
      if (metodo === 0 && comprimido !== descomprimido) throw inseguro('tamanho-diverge')
    }
    lista.push({ nome, tipo, tamanho: descomprimido, comprimido, _: { flags, metodo, crc, offLocal, nomeBruto } })
    p = fim
  }
  if (p !== indice.length) throw inseguro('indice') // sobra no índice

  // Nomes repetidos (Windows não diferencia maiúsculas) e arquivo x pasta de mesmo nome.
  const chave = (nome) => nome.replace(/\/+$/, '').normalize('NFC').toLowerCase()
  const vistos = new Set()
  const arquivos = new Set()
  for (const e of lista) {
    const k = chave(e.nome)
    if (vistos.has(k)) throw inseguro('duplicado')
    vistos.add(k)
    if (e.tipo !== 'pasta') arquivos.add(k)
  }
  for (const e of lista) {
    const partes = chave(e.nome).split('/')
    for (let i = 1; i < partes.length; i++) if (arquivos.has(partes.slice(0, i).join('/'))) throw inseguro('duplicado') // "x.html" e "x.html/y"
  }

  // Cabeçalho local de cada arquivo: tem de concordar com o índice; os bytes de dados não podem se sobrepor nem invadir o índice.
  const faixas = []
  for (const e of lista) {
    if (e.tipo !== 'arquivo') continue
    const { flags, metodo, crc, offLocal, nomeBruto } = e._
    if (offLocal + 30 > offIndice) throw inseguro('cabecalho-diverge')
    const h = lerExato(fd, offLocal, 30)
    if (h.readUInt32LE(0) !== SIG_LOCAL) throw inseguro('cabecalho-diverge')
    const flagsLocal = h.readUInt16LE(6)
    const nNomeLocal = h.readUInt16LE(26)
    const nExtraLocal = h.readUInt16LE(28)
    if (flagsLocal & 0x0001 || flagsLocal & 0x0040) throw inseguro('criptografado')
    if (h.readUInt16LE(8) !== metodo || nNomeLocal !== nomeBruto.length) throw inseguro('cabecalho-diverge')
    if (!(flagsLocal & 0x0008) && (h.readUInt32LE(14) !== crc || h.readUInt32LE(18) !== e.comprimido || h.readUInt32LE(22) !== e.tamanho)) throw inseguro('cabecalho-diverge')
    if (offLocal + 30 + nNomeLocal + nExtraLocal > offIndice) throw inseguro('cabecalho-diverge')
    if (!lerExato(fd, offLocal + 30, nNomeLocal).equals(nomeBruto)) throw inseguro('cabecalho-diverge')
    conferirExtra(lerExato(fd, offLocal + 30 + nNomeLocal, nExtraLocal))
    const inicio = offLocal + 30 + nNomeLocal + nExtraLocal
    e._.inicioDados = inicio
    faixas.push({ ini: offLocal, fim: inicio + e.comprimido })
    if (inicio + e.comprimido > offIndice) throw inseguro('sobreposicao')
  }
  faixas.sort((a, b) => a.ini - b.ini)
  for (let i = 1; i < faixas.length; i++) if (faixas[i].ini < faixas[i - 1].fim) throw inseguro('sobreposicao')

  return { entradas: lista, tamanho }
}

/**
 * Descompacta UMA entrada em streaming, entregando cada pedaço a `escrever(buf)` (o chamador grava com flag 'wx').
 * `contador`: { total (bytes reais já gravados no pacote, mutável), limites: {arquivo,total,razao,pisoRazao} }.
 * Lança ErroZip. Confere tamanho exato e CRC-32 no fim.
 */
async function extrairEntrada(fd, e, escrever, contador) {
  const { metodo, crc, inicioDados } = e._
  const L = contador.limites
  let lidos = 0 // bytes comprimidos já entregues ao descompactador
  let saida = 0
  let c = 0xFFFFFFFF
  const contar = (buf) => {
    saida += buf.length
    contador.total += buf.length
    if (saida > e.tamanho || saida > L.arquivo || contador.total > L.total) throw recusa('zip-bomba', 'bytes-reais')
    if (saida > L.pisoRazao && saida > Math.max(lidos, 1) * L.razao) throw recusa('compressao-suspeita', 'razao-real')
    c = crc32(c, buf)
    escrever(buf)
  }
  if (metodo === 0) {
    for (let pos = 0; pos < e.comprimido; pos += CHUNK_ENTRADA) {
      const buf = lerExato(fd, inicioDados + pos, Math.min(CHUNK_ENTRADA, e.comprimido - pos))
      lidos += buf.length
      contar(buf)
    }
  } else {
    const inf = zlib.createInflateRaw({ chunkSize: CHUNK_ENTRADA })
    let falha = null
    inf.on('data', (b) => { if (falha) return; try { contar(b) } catch (x) { falha = x; inf.destroy() } })
    const terminou = new Promise((resolve, reject) => { inf.on('end', resolve); inf.on('error', reject); inf.on('close', resolve) })
    terminou.catch(() => {})
    try {
      for (let pos = 0; pos < e.comprimido && !falha; pos += CHUNK_ENTRADA) {
        const buf = lerExato(fd, inicioDados + pos, Math.min(CHUNK_ENTRADA, e.comprimido - pos))
        lidos += buf.length
        await new Promise((resolve, reject) => inf.write(buf, (err) => (err ? reject(err) : resolve())))
      }
      if (!falha) { inf.end(); await terminou }
    } catch (x) {
      if (!falha) falha = x instanceof ErroZip ? x : inseguro('deflate-invalido')
    }
    if (falha) throw falha instanceof ErroZip ? falha : inseguro('deflate-invalido')
  }
  if (saida !== e.tamanho) throw inseguro('tamanho-diverge')
  if (((c ^ 0xFFFFFFFF) >>> 0) !== crc) throw inseguro('crc')
  return saida
}

module.exports = { listar, extrairEntrada, ErroZip, crc32, LIMITE_ENTRADAS_BRUTAS: MAX_ENTRADAS_BRUTAS }
