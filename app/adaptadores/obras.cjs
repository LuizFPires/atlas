// Adaptador real do PonteObras (src/app/ponte-obras.ts) — roda no processo principal do Electron (só Windows).
//
// O QUE FAZ: a pasta das obras é <home do usuário>\Atlas\Obras (nunca Desktop/Documentos por causa do OneDrive).
// listar = subpastas reais (sem links); criarSubpasta = mkdir SEM recursive, EEXIST => próximo nome livre (obra, obra-2...);
// situacao = onde a obra parou (estilo, protótipo, marca, PLAN); abrirPasta = abre SÓ a raiz no Explorador. O nome da pasta vem de nomeParaPasta (mesma regra do front).
//
// COMO TESTAR (Windows): no app, criar uma obra nova: deve aparecer C:\Users\<você>\Atlas\Obras\<nome>; criar outra
// com o mesmo nome gera <nome>-2; "Abrir pasta" abre o Explorador na raiz.
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { caminhoSeguro } = require('../seguro.cjs')

/** Igual a nomeParaPasta de src/app/ponte-obras.ts (manter em sincronia). */
function nomeParaPasta(nome) {
  const s = String(nome)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  const base = s || 'obra'
  return /^(con|prn|aux|nul|com\d|lpt\d)$/.test(base) ? `${base}-obra` : base
}

const raizPadrao = () => path.join(os.homedir(), 'Atlas', 'Obras')

/** `deps`: { raiz, shell } (shell só para abrirPasta). Garante a raiz (único mkdir recursivo, fixo e sem dado do cliente). */
function criarObras({ raiz = raizPadrao(), shell } = {}) {
  const garantirRaiz = () => { fs.mkdirSync(raiz, { recursive: true }) }
  return {
    raiz: () => raiz,
    async listar() {
      garantirRaiz()
      return fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.isSymbolicLink()).map((d) => d.name)
    },
    async criarSubpasta(nome) {
      garantirRaiz()
      const base = nomeParaPasta(nome)
      for (let i = 1; i < 1000; i++) {
        const pasta = i === 1 ? base : `${base}-${i}`
        const caminho = caminhoSeguro(raiz, pasta)
        try { fs.mkdirSync(caminho) } catch (e) { if (e.code === 'EEXIST') continue; throw e }
        return { pasta, caminho }
      }
      throw new Error('sem-nome-livre')
    },
    /** Onde a obra parou (Minhas obras → "Continuar"): só confere o que cada etapa deixou na pasta. Nada é lido para a tela.
     *  estilo = design-system*.md na raiz; prototipo = ao menos uma versão em prototipo/versoes; marca = marca/marca*.md; plano = PLAN.md. */
    async situacao(pasta) {
      const dir = caminhoSeguro(raiz, String(pasta))
      if (!fs.lstatSync(dir).isDirectory()) throw new Error('obra-inexistente')
      const nomes = (...p) => { try { return fs.readdirSync(caminhoSeguro(raiz, String(pasta), ...p)) } catch { return [] } }
      const existe = (...p) => { try { return fs.lstatSync(caminhoSeguro(raiz, String(pasta), ...p)).isFile() } catch { return false } }
      return {
        estilo: nomes().some((n) => /^design-system(-\d+)?\.md$/i.test(n)),
        prototipo: nomes('prototipo', 'versoes').length > 0,
        marca: nomes('marca').some((n) => /^marca(-\d+)?\.md$/i.test(n)),
        plano: existe('PLAN.md'),
      }
    },
    async abrirPasta() {
      garantirRaiz()
      const erro = await shell.openPath(raiz) // string vazia = ok
      if (erro) throw new Error('nao-abriu')
    },
  }
}

module.exports = { criarObras, nomeParaPasta, raizPadrao }
