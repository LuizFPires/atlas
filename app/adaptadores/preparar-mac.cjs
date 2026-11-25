// Primeiro uso no Mac (M47, tela M5Preparando aprovada pelo Luiz em 24/11/2026). No Windows o instalador faz isto (winget); no Mac
// não há winget, então o próprio Atlas prepara o computador, SEM senha de administrador e sem `curl | sh`:
//  1. Node portátil (a última LTS oficial de nodejs.org), conferido pela impressão digital oficial (SHASUMS256.txt), na pasta do Atlas;
//  2. Git: as ferramentas da Apple (xcode-select --install abre o pedido da Apple; o cliente clica em "Instalar") — a tela explica;
//  3. GitHub CLI: o .zip oficial do GitHub para Mac, conferido pelo checksums oficial, na pasta do Atlas;
//  4. Claude Code: pelo npm do Node portátil (como no Windows), na pasta do Atlas;
//  5. a pasta das obras: ~/Atlas/Obras.
// O que já existe no Mac é aproveitado (não instala de novo). Pastas: <userData>/ferramentas/{node,bin} (plataforma.cjs já as põe no PATH).
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { acharPrograma } = require('../plataforma.cjs')

const PASSOS = [
  { id: 'node', nome: 'Motor do Atlas (Node)', txt: 'Fica dentro da pasta do Atlas. Não mexe no resto do Mac.' },
  { id: 'git', nome: 'Ferramentas da Apple (Git)', txt: 'São as ferramentas oficiais da Apple.' },
  { id: 'gh', nome: 'GitHub', txt: 'Guarda o código do seu sistema na sua conta.' },
  { id: 'claude', nome: 'Claude Code (oficial)', txt: 'O construtor. O login é o seu, do seu plano do Claude.' },
  { id: 'obras', nome: 'Pasta das obras', txt: 'Atlas › Obras, na sua pasta pessoal (fora do iCloud, para nada sumir).' },
]
const TXT_GIT_ESPERA = 'A Apple está pedindo permissão: clique em Instalar e depois em Concordar. Leva uns 5 minutos.'
const DICA_REDE = 'Não consegui baixar agora. Confira a internet e toque em "Tentar de novo".'

/** A versão LTS mais nova da lista oficial do Node (index.json vem da mais nova para a mais antiga). */
function ultimaLts(lista) {
  const v = Array.isArray(lista) ? lista.find((x) => x && x.lts && /^v\d+\.\d+\.\d+$/.test(String(x.version))) : null
  return v ? v.version : null
}
const shaDe = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
/** Linha "<sha256>  <arquivo>" de um arquivo de impressões digitais oficial. */
function shaOficial(texto, arquivo) {
  for (const l of String(texto).split(/\r?\n/)) { const m = /^([0-9a-f]{64})\s+\*?(\S+)$/.exec(l.trim()); if (m && m[2] === arquivo) return m[1] }
  return null
}

/** deps: { dadosApp, home, baixar(url) → Buffer, rodar(cmd, args, {timeoutMs}) → {codigo, saida}, arch, PATH() → string, existe? } */
function criarPrepararMac({ dadosApp, home, baixar, rodar, arch = process.arch, PATH = () => process.env.PATH || '', existe = fs.existsSync, esperaGitMs = 10_000, maxEsperaGitMs = 45 * 60_000 }) {
  const ferr = path.join(dadosApp, 'ferramentas')
  let estado = PASSOS.map((p) => ({ ...p, estado: 'fila' }))
  let rodando = null
  const montarEstado = () => {
    const prontos = estado.filter((p) => p.estado === 'pronto').length
    return { passos: estado.map((p) => ({ ...p })), percentual: Math.round((prontos / estado.length) * 100), pronto: prontos === estado.length }
  }
  const marcar = (id, mud, aoMudar) => { estado = estado.map((p) => (p.id === id ? { ...p, ...mud } : p)); try { aoMudar(montarEstado()) } catch { /* tela */ } }
  const achado = (nome) => acharPrograma(nome, PATH(), existe)

  async function baixarConferido(url, urlSomas, arquivo) {
    const [buf, somas] = await Promise.all([baixar(url), baixar(urlSomas)])
    const esperado = shaOficial(somas.toString('utf8'), arquivo)
    if (!esperado || shaDe(buf) !== esperado) throw new Error('impressao-digital')
    return buf
  }

  const etapas = {
    async node() {
      if (existe(path.join(ferr, 'node', 'bin', 'node'))) return
      const v = ultimaLts(JSON.parse((await baixar('https://nodejs.org/dist/index.json')).toString('utf8')))
      if (!v) throw new Error('sem-versao')
      const nome = `node-${v}-darwin-${arch === 'arm64' ? 'arm64' : 'x64'}`
      const buf = await baixarConferido(`https://nodejs.org/dist/${v}/${nome}.tar.gz`, `https://nodejs.org/dist/${v}/SHASUMS256.txt`, `${nome}.tar.gz`)
      fs.mkdirSync(ferr, { recursive: true })
      const tgz = path.join(ferr, `${nome}.tar.gz`)
      fs.writeFileSync(tgz, buf)
      const r = await rodar('/usr/bin/tar', ['-xzf', tgz, '-C', ferr], { timeoutMs: 300_000 })
      fs.rmSync(tgz, { force: true })
      if (r.codigo !== 0 || !existe(path.join(ferr, nome, 'bin', 'node'))) throw new Error('extrair')
      fs.rmSync(path.join(ferr, 'node'), { recursive: true, force: true })
      fs.renameSync(path.join(ferr, nome), path.join(ferr, 'node'))
    },
    async git(aoMudar) {
      const pronto = async () => (await rodar('/usr/bin/xcode-select', ['-p'], { timeoutMs: 15_000 })).codigo === 0
      if (await pronto()) return
      await rodar('/usr/bin/xcode-select', ['--install'], { timeoutMs: 30_000 }) // abre o pedido da Apple
      marcar('git', { estado: 'esperando-voce', txt: TXT_GIT_ESPERA }, aoMudar)
      const limite = Date.now() + maxEsperaGitMs
      while (Date.now() < limite) { await new Promise((r) => setTimeout(r, esperaGitMs)); if (await pronto()) return }
      throw new Error('git-sem-resposta')
    },
    async gh() {
      if (achado('gh')) return
      const rel = JSON.parse((await baixar('https://api.github.com/repos/cli/cli/releases/latest')).toString('utf8'))
      const tag = String(rel && rel.tag_name || '')
      if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('sem-versao')
      const v = tag.slice(1)
      const nome = `gh_${v}_macOS_${arch === 'arm64' ? 'arm64' : 'amd64'}`
      const base = `https://github.com/cli/cli/releases/download/${tag}`
      const buf = await baixarConferido(`${base}/${nome}.zip`, `${base}/gh_${v}_checksums.txt`, `${nome}.zip`)
      const tmp = path.join(ferr, 'gh-tmp')
      fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true })
      const zip = path.join(tmp, `${nome}.zip`)
      fs.writeFileSync(zip, buf)
      const r = await rodar('/usr/bin/ditto', ['-x', '-k', zip, tmp], { timeoutMs: 120_000 })
      const bin = path.join(tmp, nome, 'bin', 'gh')
      if (r.codigo !== 0 || !existe(bin)) throw new Error('extrair')
      fs.mkdirSync(path.join(ferr, 'bin'), { recursive: true })
      fs.copyFileSync(bin, path.join(ferr, 'bin', 'gh'))
      fs.chmodSync(path.join(ferr, 'bin', 'gh'), 0o755)
      fs.rmSync(tmp, { recursive: true, force: true })
    },
    async claude() {
      if (achado('claude')) return
      const npm = path.join(ferr, 'node', 'bin', 'npm')
      const r = await rodar(npm, ['install', '-g', '@anthropic-ai/claude-code', '--prefix', path.join(ferr, 'node'), '--no-audit', '--no-fund'], { timeoutMs: 600_000 })
      if (r.codigo !== 0 || !existe(path.join(ferr, 'node', 'bin', 'claude'))) throw new Error('npm')
    },
    async obras() { fs.mkdirSync(path.join(home, 'Atlas', 'Obras'), { recursive: true }) },
  }

  return {
    estado: montarEstado,
    /** Faz os 5 passos em ordem; para no primeiro erro (dá para tentar de novo: o que ficou pronto não é refeito). Nunca lança. */
    preparar({ aoMudar = () => {} } = {}) {
      if (rodando) return rodando
      rodando = (async () => {
        estado = PASSOS.map((p) => ({ ...p, estado: 'fila' }))
        for (const p of PASSOS) {
          marcar(p.id, { estado: 'agora' }, aoMudar)
          try { await etapas[p.id](aoMudar); marcar(p.id, { estado: 'pronto', txt: p.txt }, aoMudar) } catch (e) {
            const dica = e && e.message === 'git-sem-resposta' ? 'A Apple não terminou de instalar as ferramentas. Toque em "Tentar de novo" e clique em Instalar no pedido da Apple.' : DICA_REDE
            marcar(p.id, { estado: 'erro', dica }, aoMudar)
            break
          }
        }
        return montarEstado()
      })().finally(() => { rodando = null })
      return rodando
    },
  }
}

module.exports = { criarPrepararMac, ultimaLts, shaOficial }
