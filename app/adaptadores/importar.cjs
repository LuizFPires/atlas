// Adaptador real do PonteImportar (src/app/ponte-importar.ts) — processo principal do Electron (só Windows).
//
// O .ZIP VEM DE OUTRA IA E É NÃO CONFIÁVEL. Este arquivo aplica as defesas obrigatórias do topo de ponte-importar.ts; o leitor
// de zip (zip-leitor.cjs) e as regras puras (importar-puro.cjs, espelho de validarPacote) ficam em arquivos separados para auditar.
//
// O QUE FAZ
//  escolherZip(): diálogo do Windows filtrado por .zip; confere extensão, que é arquivo comum (lstat, sem link) e até 50 MB. O renderer só
//    recebe nome limpo, tamanho e um TOKEN de uso único (o caminho de origem fica aqui no main).
//  validar(token): abre o .zip, confere a estrutura (zip-leitor.listar) e as regras (validarPacote) SEM gravar nada e sem gastar o token.
//  receber(pasta, token): (1) token consumido; (2) refaz TODA a validação (o arquivo pode ter mudado desde a escolha); (3) só então cria
//    <Obras>\<obra>\prototipo (mkdir exclusivo: já existe = 'ja-recebido'); (4) grava arquivo a arquivo, em streaming, contando os bytes
//    REAIS; (5) qualquer falha apaga SÓ o que esta tentativa criou (arquivos, pastas e a pasta prototipo) e recusa o pacote inteiro.
//
// DEFESAS (cada uma tem teste com .zip malicioso em importar.teste.cjs)
//  1 Zip-slip: o nome da entrada NUNCA vira caminho. Destino = nomeArquivoSeguro por parte (a-z0-9-), calculado por validarPacote;
//    recusa "..", absoluto, "\\", ":" (ADS), nome terminado em ponto/espaço, controle. Depois: cada parte confere o padrão, nomes
//    reservados do Windows (con, nul, aux, com1...) e path.resolve(alvo) tem de começar com path.resolve(<obra>\prototipo)+sep.
//  2 Link: entrada com modo Unix de link / reparse point / fifo = recusa o pacote; caminhoSeguro (lstat de cada pedaço) antes de cada
//    escrita; arquivos abertos com flag 'wx' (O_EXCL: nunca sobrescreve nem segue link existente); nunca sobrescreve.
//  3 Zip-bomb: limites de LIMITES (50 MB, 300 entradas, 100 MB total, 20 MB/arquivo, razão 100:1 a partir de 1 MB, 3 níveis); confere o
//    cabeçalho E conta os bytes reais do deflate durante a gravação; estourou = interrompe, apaga o que gravou e recusa. Zip dentro de
//    zip (.zip/.rar/.7z...) = 'arquivo-nao-aceito'. Overlap bomb (bytes compartilhados) e nomes repetidos = recusa.
//  4 Tipos: só html, css, js, md, png, jpg, jpeg, webp, svg, json. .exe recusa o pacote mesmo com extensão dupla (a.png.exe). Além da
//    extensão: PNG/JPG/WebP precisam TER a assinatura de imagem; começo "MZ" com byte NUL (programa do Windows) ou ELF = recusa.
//    ZIP CRIPTOGRAFADO (senha/AES) e zip64 = recusa. Nada recebido é aberto nem executado.
//  5 Nomes: destino sempre calculado pelo app; "CLAUDE.md" vira claude-recebido.md (o nome exato faria o kit tratar a obra como
//    tendo config suspeita e, pior, o Claude leria como instrução; ver DECISÕES no PENDENTE-ENTREGAR.md).
//  6 Conteúdo é DADO: este adaptador só devolve ao front o texto de design-system.md, telas.md e regras.md (20 mil letras no máximo)
//    como string; quem monta pedido ao Claude usa montarPedidoCompletar (comoDado/blocoDoCliente). O HTML nunca é lido aqui nem vai no pedido.
//  7 Link do protótipo: este adaptador NÃO recebe nem abre link nenhum (a tela só mostra o link, após normalizarLinkPrototipo: http/https,
//    sem IP/localhost). Nenhuma URL vinda do .zip vira abertura de navegador.
//
// COMO TESTAR (Windows): trazer um prototipo-atlas.zip de verdade na tela "Já tenho um protótipo": aparece Atlas\Obras\<obra>\prototipo\
// com telas\*.html e *.md em minúsculas. Um .zip com .exe dentro é recusado e NENHUMA pasta nova fica. `node --test app/adaptadores/*.teste.cjs`.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { caminhoSeguro } = require('../seguro.cjs')
const { pastaDaObra } = require('./obra-fs.cjs')
const { nomeArquivoSeguro } = require('./arquivos.cjs')
const { LIMITES, extensaoDe, nomeLivre, validarPacote } = require('./importar-puro.cjs')
const { listar, extrairEntrada, ErroZip } = require('./zip-leitor.cjs')

const MAX_TEXTO = 20_000
const TEXTOS_LIDOS = ['design-system.md', 'telas.md', 'regras.md']
const MAX_TOKENS = 20
const SEGMENTO = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/
const RESERVADO = /^(con|prn|aux|nul|com\d|lpt\d)$/i
const ERROS_DA_PORTA = new Set(['token-invalido', 'tipo-nao-aceito', 'grande-demais', 'caminho-inseguro', 'link-nao-aceito', 'muitas-entradas', 'zip-bomba', 'compressao-suspeita', 'arquivo-nao-aceito', 'ja-recebido', 'zip-vazio', 'obra-invalida', 'obra-inexistente'])

const erro = (mensagem, detalhe) => new ErroZip(mensagem, detalhe)

/** Assinatura mínima de cada imagem aceita (a extensão sozinha não prova nada). */
function imagemCombina(ext, cabeca) {
  const inicia = (...b) => cabeca.length >= b.length && b.every((v, i) => cabeca[i] === v)
  if (ext === 'png') return inicia(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  if (ext === 'jpg' || ext === 'jpeg') return inicia(0xFF, 0xD8, 0xFF)
  if (ext === 'webp') return inicia(0x52, 0x49, 0x46, 0x46) && cabeca.length >= 12 && cabeca.subarray(8, 12).toString('latin1') === 'WEBP'
  return true
}
/** Programa disfarçado de qualquer extensão: PE do Windows ("MZ" + bytes binários no começo) ou ELF. */
function pareceProgramaBinario(cabeca) {
  if (cabeca.length >= 4 && cabeca[0] === 0x7F && cabeca[1] === 0x45 && cabeca[2] === 0x4C && cabeca[3] === 0x46) return true
  return cabeca.length >= 2 && cabeca[0] === 0x4D && cabeca[1] === 0x5A && cabeca.subarray(0, 64).includes(0)
}

/** Caminho absoluto do destino calculado pelo app, com TODAS as conferências; lança 'caminho-inseguro'. */
function caminhoDoDestino(base, destino) {
  const partes = String(destino).split('/')
  if (partes.length > LIMITES.profundidade + 1) throw erro('caminho-inseguro', 'profundidade')
  for (const p of partes) {
    if (!SEGMENTO.test(p) || p.includes('..') || RESERVADO.test(p.split('.')[0])) throw erro('caminho-inseguro', 'segmento')
  }
  const raizBase = path.resolve(base)
  const alvo = path.resolve(raizBase, ...partes)
  const prefixo = (raizBase.endsWith(path.sep) ? raizBase : raizBase + path.sep).toLowerCase()
  if (!alvo.toLowerCase().startsWith(prefixo)) throw erro('caminho-inseguro', 'fora-do-prototipo')
  return { alvo, partes }
}

/** "CLAUDE.md" (qualquer caixa) vira claude-recebido.md; evita colisão com os vizinhos. */
function evitarNomeDeConfig(aceitas) {
  for (const a of aceitas) {
    const partes = a.destino.split('/')
    if (partes[partes.length - 1].toLowerCase() !== 'claude.md') continue
    const prefixo = partes.slice(0, -1).map((p) => `${p}/`).join('')
    const vizinhos = aceitas.filter((o) => o !== a && o.destino.startsWith(prefixo) && !o.destino.slice(prefixo.length).includes('/')).map((o) => o.destino.slice(prefixo.length))
    a.destino = prefixo + nomeLivre('claude-recebido.md', vizinhos)
  }
}

/** `deps`: { raiz, dialog, janela: () => BrowserWindow|null }. Os tokens ficam só na memória do processo principal. */
function criarImportar({ raiz, dialog, janela = () => null }) {
  const emAberto = new Map() // token -> { origem, nome, tamanho }

  /** Abre o .zip SEM seguir link e devolve { fd, tamanho }. */
  function abrirZip(origem) {
    let st
    try { st = fs.lstatSync(origem) } catch { throw erro('tipo-nao-aceito', 'sumiu') }
    if (st.isSymbolicLink() || !st.isFile()) throw erro('tipo-nao-aceito', 'nao-e-arquivo')
    if (st.size > LIMITES.zip) throw erro('grande-demais')
    const fd = fs.openSync(origem, 'r')
    try {
      const f = fs.fstatSync(fd)
      if (!f.isFile() || f.size > LIMITES.zip) throw erro(f.size > LIMITES.zip ? 'grande-demais' : 'tipo-nao-aceito')
      return { fd, tamanho: f.size }
    } catch (e) { fs.closeSync(fd); throw e }
  }

  /** Estrutura + regras. Nada é gravado. Devolve { fd, tamanho, aceitas, porNome } (quem chama fecha o fd). */
  function conferir(origem) {
    const { fd, tamanho } = abrirZip(origem)
    try {
      const { entradas } = listar(fd, tamanho)
      const aceitas = validarPacote(entradas.map(({ nome, tipo, tamanho: t, comprimido }) => ({ nome, tipo, tamanho: t, comprimido })), tamanho)
      evitarNomeDeConfig(aceitas)
      const porNome = new Map(entradas.map((e) => [e.nome, e]))
      return { fd, tamanho, aceitas, porNome }
    } catch (e) { fs.closeSync(fd); throw e }
  }

  const emTokens = (token) => {
    const a = emAberto.get(String(token))
    if (!a) throw erro('token-invalido')
    return a
  }

  return {
    async escolherZip() {
      const opcoes = { properties: ['openFile'], filters: [{ name: 'Protótipo (.zip)', extensions: ['zip'] }] }
      const j = janela()
      const r = j ? await dialog.showOpenDialog(j, opcoes) : await dialog.showOpenDialog(opcoes)
      if (r.canceled || !r.filePaths[0]) return null
      const origem = r.filePaths[0]
      const nome = path.basename(origem)
      if (extensaoDe(nome) !== 'zip') throw erro('tipo-nao-aceito', 'extensao')
      const st = fs.lstatSync(origem)
      if (st.isSymbolicLink() || !st.isFile()) throw erro('tipo-nao-aceito', 'nao-e-arquivo')
      if (st.size > LIMITES.zip) throw erro('grande-demais')
      const token = crypto.randomBytes(16).toString('hex')
      if (emAberto.size >= MAX_TOKENS) emAberto.delete(emAberto.keys().next().value)
      emAberto.set(token, { origem, nome, tamanho: st.size })
      return { nome: nomeArquivoSeguro(nome), tamanho: st.size, token }
    },

    async validar(token) {
      const a = emTokens(token)
      try {
        const { fd } = conferir(a.origem)
        fs.closeSync(fd)
      } catch (e) {
        if (e && ERROS_DA_PORTA.has(e.message)) throw e
        throw new Error('nao-validou') // erro de fs ou desconhecido: código estável, nunca texto cru para a tela
      }
    },

    async receber(pasta, token) {
      const a = emTokens(token)
      emAberto.delete(String(token)) // uso único (sucesso ou falha)
      pastaDaObra(raiz, pasta)
      const { fd, aceitas, porNome } = conferir(a.origem) // refaz TUDO: o arquivo pode ter mudado desde a escolha
      const criadosArquivos = []
      const criadasPastas = []
      let fdSaida = null
      try {
        const pastaProto = caminhoSeguro(raiz, pasta, 'prototipo')
        try { fs.mkdirSync(pastaProto) } catch (e) { throw e && e.code === 'EEXIST' ? erro('ja-recebido') : e }
        criadasPastas.push(pastaProto)
        const contador = { total: 0, limites: LIMITES }
        const arquivos = []
        for (const ac of aceitas) {
          const { alvo, partes } = caminhoDoDestino(pastaProto, ac.destino)
          // pastas do caminho: uma a uma, sem recursive, conferindo link a cada passo
          let dir = pastaProto
          for (const parte of partes.slice(0, -1)) {
            dir = path.join(dir, parte)
            caminhoSeguro(raiz, pasta, 'prototipo', path.relative(pastaProto, dir))
            try { fs.mkdirSync(dir); criadasPastas.push(dir) } catch (e) { if (e.code !== 'EEXIST') throw e }
            const st = fs.lstatSync(dir)
            if (!st.isDirectory() || st.isSymbolicLink()) throw erro('caminho-inseguro', 'pasta-invalida')
          }
          caminhoSeguro(raiz, pasta, 'prototipo', ...partes)
          const ext = extensaoDe(partes[partes.length - 1])
          fdSaida = fs.openSync(alvo, 'wx') // O_EXCL: nunca sobrescreve, nunca segue link existente
          criadosArquivos.push(alvo)
          let cabeca = Buffer.alloc(0)
          const escrever = (buf) => {
            if (cabeca.length < 64) cabeca = Buffer.concat([cabeca, buf.subarray(0, 64 - cabeca.length)])
            let off = 0
            while (off < buf.length) off += fs.writeSync(fdSaida, buf, off, buf.length - off)
          }
          const bytes = await extrairEntrada(fd, porNome.get(ac.origem), escrever, contador)
          if (bytes > 0 && (pareceProgramaBinario(cabeca) || !imagemCombina(ext, cabeca))) throw erro('arquivo-nao-aceito', 'conteudo-nao-combina')
          if (bytes === 0 && ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) throw erro('arquivo-nao-aceito', 'imagem-vazia')
          fs.closeSync(fdSaida); fdSaida = null
          arquivos.push({ destino: ac.destino, tamanho: bytes })
        }
        const textos = {}
        for (const nome of TEXTOS_LIDOS) {
          if (!arquivos.some((x) => x.destino === nome)) continue
          const f = fs.openSync(caminhoSeguro(raiz, pasta, 'prototipo', nome), 'r')
          try {
            const buf = Buffer.alloc(Math.min(MAX_TEXTO * 4, 200_000))
            const n = fs.readSync(f, buf, 0, buf.length, 0)
            textos[nome] = buf.subarray(0, n).toString('utf8').slice(0, MAX_TEXTO)
          } finally { fs.closeSync(f) }
        }
        return { pasta, caminho: pastaProto, arquivos, textos }
      } catch (e) {
        if (fdSaida !== null) { try { fs.closeSync(fdSaida) } catch { /* já fechado */ } }
        for (const f of criadosArquivos.reverse()) { try { fs.unlinkSync(f) } catch { /* não existe mais */ } }
        // só remove pasta que ESTA tentativa criou (e que ficou vazia); 'ja-recebido' não criou nada, então não toca na existente
        for (const d of criadasPastas.reverse()) { try { fs.rmdirSync(d) } catch { /* não vazia ou já foi */ } }
        if (e instanceof ErroZip && ERROS_DA_PORTA.has(e.message)) throw e
        if (e && (e.code === 'EEXIST' || e.code === 'ENOTDIR' || e.code === 'EISDIR')) throw erro('caminho-inseguro', e.code)
        if (e && ERROS_DA_PORTA.has(e.message)) throw e
        throw new Error('nao-gravou')
      } finally {
        fs.closeSync(fd)
      }
    },
  }
}

module.exports = { criarImportar, caminhoDoDestino, imagemCombina, pareceProgramaBinario, evitarNomeDeConfig }
