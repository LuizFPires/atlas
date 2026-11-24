// Adaptador real do PonteArquivos (src/app/ponte-arquivos.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ: "escolher" abre o diálogo do Windows já filtrado pelo tipo e guarda o arquivo escolhido sob um TOKEN opaco
// (o renderer nunca vê nem informa o caminho de origem). "guardar" revalida tudo (extensão do tipo em que foi escolhido, 20 MB,
// destino) e copia com COPYFILE_EXCL para <raiz>\<obra>\<destino>\<nome seguro>, dentro de Atlas\Obras, sem seguir link e sem sobrescrever.
// SVG nunca é aceito como logo (pode carregar script); destino 'raiz' só aceita .md. Mesmo contrato do fixture.
//
// COMO TESTAR (Windows): no app, subir um print/logo na criação da obra: o arquivo aparece em
// Atlas\Obras\<obra>\estilo\referencias (ou marca etc.) com nome limpo; subir o mesmo de novo gera nome-2; um .svg como logo é recusado.
'use strict'
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
const { caminhoSeguro, copiarExclusivo, criarArquivoExclusivo } = require('../seguro.cjs')

// Espelham src/app/ponte-arquivos.ts (manter em sincronia).
const EXTENSOES = {
  imagem: ['png', 'jpg', 'jpeg', 'webp'],
  logo: ['png', 'pdf', 'jpg', 'jpeg', 'webp'],
  cores: ['png', 'jpg', 'jpeg', 'webp', 'txt', 'pdf'],
  manual: ['pdf', 'md', 'txt', 'png', 'jpg', 'jpeg', 'webp'],
  'design-system': ['md'],
  planilha: ['xlsx', 'xlsm', 'xls', 'csv'],
}
const DESTINOS = ['estilo/referencias', 'estilo/identidade', 'marca', 'posobra/prints', 'raiz', 'planilha']
const TAMANHO_MAXIMO = 20 * 1024 * 1024
// Planilha (começar por uma planilha, X1): até 50 MB; o raio-X tem limites próprios (planilha.cjs).
const TAMANHO_POR_TIPO = { planilha: 50 * 1024 * 1024 }
const maximoDe = (tipo) => TAMANHO_POR_TIPO[tipo] ?? TAMANHO_MAXIMO
const PASTA_OK = /^[a-z0-9][a-z0-9-]*$/

const extensaoDe = (nome) => (nome.includes('.') ? nome.slice(nome.lastIndexOf('.') + 1).toLowerCase() : '')
const extensaoPermitida = (tipo, nome) => EXTENSOES[tipo].includes(extensaoDe(nome))

function nomeArquivoSeguro(nome) {
  const base = nome.split(/[\\/]/).pop() ?? ''
  const ext = extensaoDe(base).replace(/[^a-z0-9]/g, '')
  const miolo = (extensaoDe(base) ? base.slice(0, base.lastIndexOf('.')) : base)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  const m = miolo || 'arquivo'
  const seguro = /^(con|prn|aux|nul|com\d|lpt\d)$/.test(m) ? `${m}-arquivo` : m
  return ext ? `${seguro}.${ext}` : seguro
}

/** Lê o arquivo de origem SEM seguir link e confere que é arquivo comum. */
function infoDaOrigem(origem) {
  const st = fs.lstatSync(origem)
  if (st.isSymbolicLink() || !st.isFile()) throw new Error('tipo-nao-aceito')
  return st
}

/** `deps`: { raiz, dialog, janela: () => BrowserWindow|null }. Os tokens ficam só na memória do processo principal. */
function criarArquivos({ raiz, dialog, janela = () => null }) {
  const emAberto = new Map()
  return {
    async escolher(tipo) {
      if (!Object.hasOwn(EXTENSOES, tipo)) throw new Error('tipo-nao-aceito')
      const opcoes = { properties: ['openFile'], filters: [{ name: 'Arquivos aceitos', extensions: EXTENSOES[tipo] }] }
      const j = janela()
      const r = j ? await dialog.showOpenDialog(j, opcoes) : await dialog.showOpenDialog(opcoes)
      if (r.canceled || !r.filePaths[0]) return null
      const origem = r.filePaths[0]
      const nome = path.basename(origem)
      if (!extensaoPermitida(tipo, nome)) throw new Error('tipo-nao-aceito')
      const st = infoDaOrigem(origem)
      if (st.size > maximoDe(tipo)) throw new Error('grande-demais')
      const token = crypto.randomBytes(16).toString('hex')
      emAberto.set(token, { tipo, origem, nome, tamanho: st.size })
      return { nome, tamanho: st.size, token }
    },
    async guardar(pasta, destino, token) {
      pasta = String(pasta); destino = String(destino); token = String(token)
      const a = emAberto.get(token)
      if (!a) throw new Error('token-invalido')
      if (!PASTA_OK.test(pasta)) throw new Error('pasta-invalida')
      if (!DESTINOS.includes(destino)) throw new Error('nome-invalido')
      // Revalida: vale o que o processo principal guardou ao escolher e o que está no disco agora.
      if (!extensaoPermitida(a.tipo, a.nome)) throw new Error('tipo-nao-aceito')
      if (destino === 'raiz' && extensaoDe(a.nome) !== 'md') throw new Error('tipo-nao-aceito')
      if (destino === 'planilha' && a.tipo !== 'planilha') throw new Error('tipo-nao-aceito')
      const st = infoDaOrigem(a.origem)
      if (st.size > maximoDe(a.tipo)) throw new Error('grande-demais')
      // A obra precisa existir (criada por PonteObras); as subpastas internas são criadas uma a uma, sem recursive.
      const pastaObra = caminhoSeguro(raiz, pasta)
      if (!fs.existsSync(pastaObra)) throw new Error('pasta-invalida')
      let dir = pastaObra
      for (const parte of destino === 'raiz' ? [] : destino.split('/')) {
        dir = caminhoSeguro(raiz, path.relative(raiz, path.join(dir, parte)))
        try { fs.mkdirSync(dir) } catch (e) { if (e.code !== 'EEXIST') throw e }
      }
      const seguro = nomeArquivoSeguro(a.nome)
      const ext = extensaoDe(seguro)
      const miolo = ext ? seguro.slice(0, seguro.lastIndexOf('.')) : seguro
      for (let i = 1; i < 1000; i++) {
        const nome = i === 1 ? seguro : (ext ? `${miolo}-${i}.${ext}` : `${miolo}-${i}`)
        const caminho = caminhoSeguro(raiz, path.relative(raiz, path.join(dir, nome)))
        try { copiarExclusivo(a.origem, caminho) } catch (e) { if (e.code === 'EEXIST') continue; throw e }
        emAberto.delete(token)
        return { nome, caminho }
      }
      throw new Error('sem-nome-livre')
    },
    // M33: foto de referência tirada no CELULAR (o notebook baixou do servidor). Só jpeg/png/webp, até 2 MB, sempre em
    // estilo/referencias da obra, sem sobrescrever. O nome vem do app, mas é saneado do mesmo jeito.
    async guardarImagem(pasta, nome, dataUrl) {
      pasta = String(pasta); nome = String(nome); dataUrl = String(dataUrl)
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
      if (!m) throw new Error('tipo-nao-aceito')
      const bytes = Buffer.from(m[2], 'base64')
      if (bytes.length > 2 * 1024 * 1024) throw new Error('grande-demais')
      if (!PASTA_OK.test(pasta)) throw new Error('pasta-invalida')
      const pastaObra = caminhoSeguro(raiz, pasta)
      if (!fs.existsSync(pastaObra)) throw new Error('pasta-invalida')
      let dir = pastaObra
      for (const parte of ['estilo', 'referencias']) {
        dir = caminhoSeguro(raiz, path.relative(raiz, path.join(dir, parte)))
        try { fs.mkdirSync(dir) } catch (e) { if (e.code !== 'EEXIST') throw e }
      }
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
      const miolo = nomeArquivoSeguro(nome).replace(/\.[a-z0-9]+$/, '') || 'celular'
      for (let i = 1; i < 1000; i++) {
        const final = i === 1 ? `${miolo}.${ext}` : `${miolo}-${i}.${ext}`
        const caminho = caminhoSeguro(raiz, path.relative(raiz, path.join(dir, final)))
        try { criarArquivoExclusivo(caminho, bytes) } catch (e) { if (e.code === 'EEXIST') continue; throw e }
        return { nome: final, caminho }
      }
      throw new Error('sem-nome-livre')
    },
  }
}

module.exports = { criarArquivos, EXTENSOES, nomeArquivoSeguro }
