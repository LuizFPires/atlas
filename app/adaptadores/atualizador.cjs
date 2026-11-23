// Atualização automática do Atlas (Windows). Decisão do Luiz (22/11/2026): toda licença ativada recebe; baixa em silêncio e
// instala quando o Atlas FECHA (nunca interrompe uma obra).
//
// 1) POST {api}/atualizacao com e-mail, hash do computador e versão atual; a credencial do dispositivo (do COFRE) vai só no
//    cabeçalho X-Atlas-Dispositivo. O servidor confere a licença e devolve {atualizar, versao, sha512, tamanho, url}.
// 2) Baixa o .exe (url https temporária) para <pasta>\Atlas-<versao>.exe.part, conferindo tamanho e sha512 (base64) enquanto
//    baixa. Só depois de conferido vira .exe e o pronta.json é gravado. Arquivo diferente = jogado fora.
// 3) Ao fechar: roda o instalador com /S (silencioso, por usuário, sem pedir administrador). Uma vez só.
// Qualquer dúvida (sem rede, sem ativação, resposta estranha) = não atualiza e tenta de novo mais tarde. Nunca trava o app.
//
// COMO TESTAR: `node --test app/adaptadores/atualizador.teste.cjs`. No Windows: instalar uma versão antiga, abrir o Atlas,
// esperar o download (pasta %APPDATA%\Atlas\atualizacao), fechar o Atlas e abrir de novo: a versão nova está instalada.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { CHAVE_COFRE, enderecoDaApi } = require('./licenca.cjs')

const VERSAO_RE = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/
const SHA512_B64_RE = /^[A-Za-z0-9+/]{86}==$/
const MAX_TAMANHO = 600 * 1024 * 1024
/** Quando procurar versão nova: 1 min depois de abrir e, com o Atlas aberto, a cada 20 min (era de 6 em 6 h: quem abriu de manhã
 *  só recebia a versão da tarde à noite; caso do Guilherme, 23/11/2026). A conferência é um pedido pequeno; o download é uma vez só. */
const PRIMEIRA_CONFERENCIA_MS = 60_000
const INTERVALO_CONFERENCIA_MS = 20 * 60_000

function compararVersoes(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

/** deps: { versaoAtual, cofre, hashComputador, api, buscar (fetch), pasta (userData\atualizacao), executar(cmd, args) }. */
function criarAtualizador({ versaoAtual, cofre, hashComputador, api, buscar = globalThis.fetch, pasta, executar }) {
  const arqPronta = path.join(pasta, 'pronta.json')
  let instalou = false
  let ocupado = false
  /** Última conferência (23/11/2026, caso do Guilherme): sem isso, "não atualizou" não tinha explicação nenhuma. */
  let ultima = null

  const limpar = () => { try { for (const n of fs.readdirSync(pasta)) fs.rmSync(path.join(pasta, n), { force: true }) } catch { /* nada */ } }

  function pronta() {
    try {
      const p = JSON.parse(fs.readFileSync(arqPronta, 'utf8'))
      if (!p || !VERSAO_RE.test(p.versao) || compararVersoes(p.versao, versaoAtual) <= 0) { limpar(); return null }
      const caminho = path.join(pasta, `Atlas-${p.versao}.exe`)
      return fs.existsSync(caminho) ? { versao: p.versao, caminho } : null
    } catch { return null }
  }

  async function baixar(info) {
    fs.mkdirSync(pasta, { recursive: true })
    const destino = path.join(pasta, `Atlas-${info.versao}.exe`)
    const parcial = `${destino}.part`
    try {
      const r = await buscar(info.url, { signal: AbortSignal.timeout(30 * 60_000) })
      if (!r.ok || !r.body) throw new Error('download')
      const hash = crypto.createHash('sha512')
      let total = 0
      const saida = fs.createWriteStream(parcial)
      const leitor = r.body.getReader()
      for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        total += value.length
        if (total > info.tamanho) throw new Error('grande-demais')
        hash.update(value)
        if (!saida.write(value)) await new Promise((ok) => saida.once('drain', ok))
      }
      await new Promise((ok, erro) => saida.end((e) => (e ? erro(e) : ok())))
      if (total !== info.tamanho || hash.digest('base64') !== info.sha512) throw new Error('impressao-diferente')
      fs.renameSync(parcial, destino)
      fs.writeFileSync(arqPronta, JSON.stringify({ versao: info.versao }))
      return { estado: 'baixada', versao: info.versao }
    } catch {
      fs.rmSync(parcial, { force: true })
      fs.rmSync(destino, { force: true })
      return { estado: 'erro' }
    }
  }

  async function conferir() {
        const ja = pronta()
        if (ja) return { estado: 'baixada', versao: ja.versao }
        const base = enderecoDaApi(api)
        if (!base || typeof buscar !== 'function' || !VERSAO_RE.test(versaoAtual)) return { estado: 'sem-servidor' }
        let ativ = null
        try {
          const g = JSON.parse((await cofre.ler(CHAVE_COFRE)) || 'null')
          if (g && typeof g.token === 'string' && g.token) ativ = { token: g.token, email: typeof g.email === 'string' ? g.email : '' }
        } catch { /* cofre indisponível */ }
        if (!ativ) return { estado: 'nao-ativado' } // ainda instalando: não é problema, não avisa
        let info = null
        try {
          const r = await buscar(`${base}/atualizacao`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
            headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': ativ.token },
            body: JSON.stringify({ email: ativ.email, computador_hash: await hashComputador(), versao: versaoAtual }),
          })
          const texto = await r.text()
          if (r.status === 404) return { estado: 'servidor-sem-rota' }
          if (r.status === 401 || r.status === 403) return { estado: 'sem-licenca' }
          if (!r.ok || texto.length > 4096) return { estado: 'erro-servidor' }
          info = JSON.parse(texto)
        } catch (e) { return { estado: e instanceof TypeError || e?.name === 'TimeoutError' ? 'sem-rede' : 'erro-servidor' } }
        if (info && info.atualizar === false && ['sem-configuracao', 'sem-manifesto', 'sem-link'].includes(info.motivo)) return { estado: 'servidor-sem-versao', motivo: info.motivo }
        if (!info || info.atualizar !== true) return { estado: 'atual' }
        const ok = typeof info.url === 'string' && /^https:\/\//.test(info.url)
          && VERSAO_RE.test(info.versao) && compararVersoes(info.versao, versaoAtual) > 0
          && SHA512_B64_RE.test(info.sha512) && Number.isInteger(info.tamanho) && info.tamanho > 0 && info.tamanho <= MAX_TAMANHO
        if (!ok) return { estado: 'erro' }
        return await baixar(info)
  }

  return {
    pronta,

    ultima: () => ultima,

    async verificarEBaixar() {
      if (ocupado) return { estado: 'ocupado' }
      ocupado = true
      const r = await conferir().finally(() => { ocupado = false })
      ultima = { ...r, versaoAtual, quando: Date.now() }
      return r
    },


    /** Botão "Atualizar agora" (23/11/2026): com versão pronta, fecha o Atlas (sair = app.quit); a instalação roda ao sair e o
     *  instalador reabre o Atlas. Sem versão pronta não fecha nada. */
    instalarAgora(sair) {
      if (instalou || !pronta()) return false
      sair()
      return true
    },

    /** Chamar quando o Atlas fecha. true = o instalador silencioso foi disparado. */
    instalarAoSair() {
      if (instalou) return false
      const p = pronta()
      if (!p) return false
      instalou = true
      try { executar(p.caminho, ['/S']); return true } catch { return false }
    },
  }
}

module.exports = { criarAtualizador, compararVersoes, PRIMEIRA_CONFERENCIA_MS, INTERVALO_CONFERENCIA_MS }
