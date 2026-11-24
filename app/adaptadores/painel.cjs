// Adaptador real do PontePainel (src/app/ponte-painel.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ
//  ler(pasta): lê o PLAN.md da obra e calcula o % PONDERADO pelo `peso:` com a mesma conta do painel do canteiro
//    (.claude/hooks/plano.cjs, carregado de `kitHooks`; se o kit não estiver à mão usa a porta fiel local — o teste de paridade
//    do M19 cobre a conta). Prazo = prazo.cjs do kit (ritmo real da obra; null enquanto não dá para estimar). "Agora na obra" =
//    o que a linha de produção está fazendo (resumo curto do stream do Claude); nada é inventado: sem linha rodando, lista vazia.
//    Parada real: fim da linha por cota (<obra>\.atlas\linha.json) e ocorrências abertas (docs\ocorrencias.json: cota, cobrança,
//    ou algo que só o cliente resolve). Pausa do cliente e OK da etapa ficam em <obra>\.atlas\estado.json.
//  pausar / continuar / aprovarEtapa: pausar derruba a linha (árvore de processos) e marca a pausa; continuar religa a linha
//    (a skill /construir retoma do ponto em que o PLAN parou) e reafirma o recomendado.json do modo da obra; aprovarEtapa registra
//    o OK (passo a passo) e religa a linha se ela tinha parado esperando.
//  aplicarModo: regrava <obra>\.atlas\modo.json e o ~/.claude/recomendado.json GLOBAL (uma obra por vez no computador).
//  enderecoCanteiro: sobe o canteiro do kit (.claude/canteiro/server.cjs) em 127.0.0.1:<porta LIVRE ALEATÓRIA>, registra a obra e
//    devolve SÓ http://127.0.0.1:<porta>/?obra=<id> (null enquanto não subiu → a tela mostra a imagem 3D de apoio). Contra
//    "port squatting": o filho recebe um NONCE (env CANTEIRO_NONCE) e prova que o conhece respondendo a um desafio aleatório
//    em /obras?desafio=...; só então o endereço é publicado. Filho que sai cedo ou porta ocupada = sem canteiro (imagem de apoio).
//  abrirTeste: abre a versão de teste: <obra>\.atlas\teste.json {url:"http://127.0.0.1:<porta>"} (loopback, allowlist) ou, na falta,
//    <obra>\dist\index.html; sem nenhum dos dois: erro 'sem-teste' (não finge). Quem escreve teste.json é a linha do kit (pendência).
//
// COMO TESTAR (Windows): com uma obra rodando, abrir o painel: % igual a `node .claude/hooks/progresso.cjs --curto` na pasta da obra;
// "Pausar" some o processo claude no Gerenciador de Tarefas; "Continuar" o traz de volta; o canteiro 3D abre em http://127.0.0.1:<porta aleatória>.
// Sem Claude/kit: `node --test app/adaptadores/*.teste.cjs`.
'use strict'
const { tipoDaTrava, travaDaObra } = require('./travas.cjs')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const net = require('node:net')
const { caminhoSeguro, envMinimo } = require('../seguro.cjs')
const { pastaDaObra, pastaAtlas, gravarAtomico, lerJson, lerTexto } = require('./obra-fs.cjs')
const { comoDado } = require('./plan-md.cjs')
const { ehModoObra, gravarRecomendadoGlobal } = require('./modo.cjs')

const RE_MS = /^##\s+(?:Milestone\s+|M)(\d+)\s*[—–:-]\s*(.+?)\s*$/i
const RE_ENDERECO = /^http:\/\/127\.0\.0\.1:\d{2,5}(\/[A-Za-z0-9._~\-/?=&%]*)?$/ // igual a enderecoCanteiroSeguro (ponte-painel.ts)

/** Porta fiel de lerPlano (plano.cjs) a partir do texto: usada só se o kit não estiver disponível. */
function lerPlanoDoTexto(texto) {
  const ms = []
  let atual = null
  for (const l of texto.split(/\r?\n/)) {
    const m = l.match(RE_MS)
    if (m) { atual = { n: Number(m[1]), titulo: m[2], peso: 1, total: 0, feitas: 0 }; ms.push(atual); continue }
    if (/^##\s/.test(l)) { atual = null; continue }
    if (!atual) continue
    const p = l.match(/^peso:\s*(\d+(?:[.,]\d+)?)/i)
    if (p) atual.peso = Number(p[1].replace(',', '.'))
    const t = l.match(/^\s*[-*]\s+\[( |x|X)\]/)
    if (t) { atual.total++; if (t[1] !== ' ') atual.feitas++ }
  }
  let pesoTotal = 0, pesoFeito = 0, tarefas = 0, feitas = 0
  for (const m of ms) {
    const frac = m.total ? m.feitas / m.total : 0
    m.pct = Math.round(frac * 100)
    m.status = m.total && m.feitas === m.total ? 'concluido' : m.feitas > 0 ? 'andamento' : 'pendente'
    pesoTotal += m.peso; pesoFeito += m.peso * frac; tarefas += m.total; feitas += m.feitas
  }
  const prox = ms.find((m) => m.status !== 'concluido')
  return { milestones: ms, tarefas, feitas, pct: pesoTotal ? Math.round((pesoFeito / pesoTotal) * 1000) / 10 : 0, proximo: prox ? prox.n : null }
}

/** Igual a textoRestante / textoPrevisao de ponte-painel.ts. */
/** Avanço fino (pedido do Luiz, 24/11/2026: "o 0% pregado na tela" dá a sensação de obra parada). Uma tarefa só vira [x] depois
 *  de revisada, então a etapa em andamento ganha crédito parcial pelo roteiro da /construir, SEM chegar ao valor dela inteira
 *  (só a medição completa a etapa): começou 3%, planejada 15%, cada commit do item até 60%, PR aberto 60%, revisada 85%.
 *  Duas casas, sempre arredondando para baixo (nunca promete mais do que foi feito). */
function parcialDaEtapa(etapa, commits, total) {
  const e = Number(etapa) || 0
  if (e >= 3) return 0.85
  if (e === 2) return 0.6
  if (e === 1) return 0.15 + 0.45 * Math.min(1, total ? commits / total : 0)
  return 0.03 + 0.12 * Math.min(1, total ? commits / total : 0)
}
function avancoFino(p, roteiro, contarCommits) {
  const nRot = roteiro && typeof roteiro.milestone === 'string' ? Number((roteiro.milestone.match(/\d+/) || [])[0]) : NaN
  let pesoTotal = 0, pesoFeito = 0
  for (const m of p.milestones) {
    let frac = m.total ? m.feitas / m.total : 0
    if (m.n === nRot && m.total && m.feitas < m.total) {
      let commits = 0
      try { commits = Number(contarCommits(roteiro.branch)) || 0 } catch { commits = 0 }
      frac = Math.max(frac, m.feitas / m.total + (1 - m.feitas / m.total) * parcialDaEtapa(roteiro.etapa_concluida, commits, m.total - m.feitas))
    }
    pesoTotal += m.peso; pesoFeito += m.peso * frac
  }
  if (!pesoTotal) return 0
  return Math.min(100, Math.floor((pesoFeito / pesoTotal) * 10000 + 1e-6) / 100)
}

/** Quantos commits a branch da etapa tem a mais que a main (cada item da /construir é um commit). Qualquer falha: 0. */
function commitsDaBranch(cwd, branch) {
  if (typeof branch !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(branch) || branch.includes('..')) return 0
  for (const base of ['main', 'master']) {
    const r = spawnSync('git', ['rev-list', '--count', `${base}..${branch}`], { cwd, env: envMinimo(), timeout: 3000, windowsHide: true, encoding: 'utf8' })
    if (r.status === 0) return Number(String(r.stdout).trim()) || 0
  }
  return 0
}

function textoRestante(minutos) {
  if (minutos <= 0) return 'nada'
  if (minutos < 60) return `≈ ${Math.max(1, Math.round(minutos))} min`
  const h = Math.floor(minutos / 60), m = Math.round(minutos % 60)
  return m ? `≈ ${h} h ${String(m).padStart(2, '0')}` : `≈ ${h} h`
}
function textoPrevisao(agora, minutos) {
  if (minutos <= 0) return 'Agora'
  const fim = new Date(agora.getTime() + minutos * 60000)
  const dia = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const amanha = new Date(agora.getTime() + 86400000)
  const hora = fim.getMinutes() >= 30 ? fim.getHours() + 1 : fim.getHours()
  const h = `~${hora % 24}h`
  if (dia(fim) === dia(agora) && hora < 24) return `Hoje, ${h}`
  if (dia(fim) === dia(amanha)) return `Amanhã, ${h}`
  return `${fim.getDate()}/${String(fim.getMonth() + 1).padStart(2, '0')}, ${h}`
}

const nomeCurto = (t) => comoDado(t, 80).join(' ').slice(0, 60).trim() || 'Etapa'

/** Carrega um módulo do kit (hooks/canteiro) se existir; null se não (o painel degrada sem inventar). */
function carregarDoKit(dir, arquivo) {
  try { return dir ? require(path.join(dir, arquivo)) : null } catch { return null }
}

/** Classifica ocorrências abertas (docs/ocorrencias.json) em parada real; null se nenhuma. */
function paradaDeOcorrencias(obj) {
  const abertas = obj && Array.isArray(obj.ocorrencias) ? obj.ocorrencias.filter((o) => o && o.status === 'aberta') : []
  let achada = null
  for (const o of abertas) {
    if (tipoDaTrava(o)) continue // trava conhecida (travas.cjs): a obra segue; a ficha explica
    const t = `${o.servico ?? ''} ${o.motivo ?? ''}`
    if (/(?<!\p{L})(?:cota|limite de uso|usage limit|rate.?limit)(?!\p{L})/iu.test(t)) return 'cota'
    if (/billing|cobran|pagamento|fatura|cart[aã]o/i.test(t)) achada = achada ?? 'billing'
    else if (/credencial|senha|login|autoriz|token|conta/i.test(t)) achada = achada ?? 'voce'
  }
  return achada
}

/** Onde ficam canteiro/ e hooks/: no app instalado, em resources/kit (fora do asar, o servidor roda como processo à parte);
 *  em desenvolvimento, no .claude do repositório. */
function kitDirDoApp({ empacotado, recursos }) {
  return empacotado ? path.join(recursos, 'kit') : path.join(__dirname, '..', '..', '.claude')
}

/**
 * `deps`: { raiz, modos, construcao (com .linha), shell, kitDir?, porta?, home?, agora?, subir? }
 * `porta` (teste): fixa a porta; padrão = porta livre aleatória a cada subida. `subir` (teste): substitui o spawn do canteiro
 * (sem nonce: o servidor falso do teste não o conhece). Padrão de kitDir (hooks/ e canteiro/): a pasta .claude do app (ATLAS_KIT_DIR).
 */
function criarPainel({ raiz, modos, construcao, shell, kitDir = process.env.ATLAS_KIT_DIR || path.join(__dirname, '..', '..', '.claude'), porta = null, home, agora = () => new Date(), subir, contarCommits, vigia = null }) {
  const hooks = path.join(kitDir, 'hooks')
  const canteiroDir = path.join(kitDir, 'canteiro')
  const linha = construcao.linha
  const filhos = []
  const prontos = new Map() // pasta -> endereço
  const subindo = new Map()

  const arquivoEstado = (pasta) => caminhoSeguro(raiz, pasta, '.atlas', 'estado.json')
  const lerEstadoLocal = (pasta) => {
    const e = lerJson(arquivoEstado(pasta)) || {}
    return { pausada: e.pausada === true, aprovadaAte: Number.isInteger(e.aprovadaAte) ? e.aprovadaAte : 0 }
  }
  const gravarEstadoLocal = (pasta, e) => {
    const dir = pastaAtlas(raiz, pasta)
    gravarAtomico(path.join(dir, 'estado.json'), JSON.stringify({ versao: 1, ...e }) + '\n')
  }

  function planoDa(cwd) {
    const kit = carregarDoKit(hooks, 'plano.cjs')
    if (kit && typeof kit.lerPlano === 'function') { try { const p = kit.lerPlano(cwd); if (p) return p } catch { /* cai na porta local */ } }
    const t = lerTexto(path.join(cwd, 'PLAN.md'))
    return t === null ? null : lerPlanoDoTexto(t)
  }

  /** roteiro.json da /construir (.codex primeiro, como o kit). Quebrado ou ausente: null. */
  function lerRoteiroDa(cwd) {
    for (const r of ['.codex/roteiro.json', '.claude/roteiro.json']) { const j = lerJson(path.join(cwd, r)); if (j && typeof j === 'object') return j }
    return null
  }

  function prazoDa(cwd, p) {
    const kit = carregarDoKit(hooks, 'prazo.cjs')
    if (!kit || p.pct >= 100) return { restante: null, previsao: null }
    try {
      const r = kit.calcularPrazo(cwd)
      if (r && r.status === 'estimado' && Number.isFinite(r.restanteMs)) {
        const min = r.restanteMs / 60000
        return { restante: textoRestante(min), previsao: textoPrevisao(agora(), min) }
      }
    } catch { /* sem estimativa */ }
    return { restante: null, previsao: null }
  }

  function enderecoPronto(pasta) {
    const url = prontos.get(pasta)
    return url && RE_ENDERECO.test(url) ? url : null
  }

  /** Sobe o canteiro do kit (127.0.0.1) e registra a obra. Fire-and-forget; o endereço só aparece depois de responder. */
  function garantirCanteiro(pasta, cwd) {
    if (prontos.has(pasta) || subindo.has(pasta)) return
    const servidor = path.join(canteiroDir, 'server.cjs')
    if (!subir && !fs.existsSync(servidor)) return
    const id = crypto.createHash('sha1').update(path.resolve(cwd).toLowerCase()).digest('hex').slice(0, 10) // = idDe (obras.cjs)
    const p = (async () => {
      try {
        const portaUsada = porta || await portaLivre()
        const url = `http://127.0.0.1:${portaUsada}/?obra=${id}`
        let nonce = null
        let saiu = false
        if (subir) await subir({ servidor, cwd, porta: portaUsada })
        else {
          nonce = crypto.randomBytes(24).toString('hex')
          // process.execPath no Electron = o próprio app; ELECTRON_RUN_AS_NODE faz ele rodar o script como Node puro.
          const f = spawn(process.execPath, [servidor, String(portaUsada)], { cwd, windowsHide: true, shell: false, stdio: 'ignore', env: envMinimo({ ELECTRON_RUN_AS_NODE: '1', CLAUDE_PROJECT_DIR: cwd, CANTEIRO_NONCE: nonce }) })
          f.on('error', () => { saiu = true })
          f.on('exit', () => { saiu = true })
          filhos.push(f)
        }
        for (let i = 0; i < 15 && !saiu; i++) {
          if (await responde(portaUsada, nonce)) { if (!saiu) prontos.set(pasta, url); return }
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch { /* sem canteiro vivo: a tela usa a imagem 3D de apoio */ } finally { subindo.delete(pasta) }
    })()
    subindo.set(pasta, p)
  }

  const painel = {
    async ler(pasta) {
      const cwd = pastaDaObra(raiz, pasta)
      const p = planoDa(cwd)
      if (!p) throw new Error('sem-plano')
      garantirCanteiro(pasta, cwd)
      const modo = await modos.ler(pasta)
      const local = lerEstadoLocal(pasta)
      const rodando = linha.rodando(pasta)
      const fim = linha.ultimoFim(pasta)
      const acabou = p.pct >= 100
      const prox = p.milestones.find((m) => m.n === p.proximo)
      let parada = null
      let trava = null
      if (!acabou) {
        const livro = lerJson(caminhoSeguro(raiz, pasta, 'docs', 'ocorrencias.json'))
        trava = travaDaObra(livro)
        parada = paradaDeOcorrencias(livro)
        if (!parada && !rodando && fim && fim.estado === 'parou' && fim.motivo === 'cota') parada = 'cota'
      }
      let etapaPronta = null
      if (modo === 'passo-a-passo' && !acabou) {
        const prontas = p.milestones.filter((m) => m.status === 'concluido' && m.n > local.aprovadaAte)
        const ultima = prontas[prontas.length - 1]
        if (ultima) etapaPronta = { n: ultima.n, nome: nomeCurto(ultima.titulo) }
      }
      const { restante, previsao } = prazoDa(cwd, p)
      const feito = linha.recentes(pasta).slice(-1)[0]
      return {
        pct: acabou ? 100 : avancoFino(p, lerRoteiroDa(cwd), (branch) => (contarCommits ? contarCommits(cwd, branch) : commitsDaBranch(cwd, branch))), tarefas: p.tarefas, feitas: p.feitas,
        etapa: prox ? { n: prox.n, nome: nomeCurto(prox.titulo) } : null,
        etapas: p.milestones.map((m) => ({ n: m.n, nome: nomeCurto(m.titulo), feitas: m.feitas, total: m.total, pct: m.pct })),
        restante, previsao,
        agora: rodando && !acabou ? [{ sigla: 'IM', quem: 'Equipe de execução', oque: feito || (prox ? `Construindo a etapa ${nomeCurto(prox.titulo)}` : 'Construindo'), tom: 'ativo' }] : [],
        pausadaPorVoce: local.pausada,
        parada,
        trava,
        etapaPronta,
        temTeste: p.feitas > 0,
        // Vigia (24/11/2026): linha que parou sem avançar. O Atlas tenta de novo sozinho e, se não der, pede o cliente com o motivo.
        vigia: acabou || !vigia ? null : (() => { try { return vigia.estado(pasta) } catch { return null } })(),
      }
    },

    async pausar(pasta) {
      pastaDaObra(raiz, pasta)
      gravarEstadoLocal(pasta, { ...lerEstadoLocal(pasta), pausada: true })
      linha.parar(pasta)
    },

    async continuar(pasta) {
      pastaDaObra(raiz, pasta)
      gravarEstadoLocal(pasta, { ...lerEstadoLocal(pasta), pausada: false })
      // O recomendado.json é global: reafirma o modo DESTA obra antes de religar (o computador pode ter reiniciado).
      const modo = await modos.ler(pasta)
      if (modo) gravarRecomendadoGlobal(modo, { home, agora: agora() })
      if (!linha.rodando(pasta)) linha.religar(pasta)
    },

    async aprovarEtapa(pasta) {
      const cwd = pastaDaObra(raiz, pasta)
      const p = planoDa(cwd)
      if (!p) throw new Error('sem-plano')
      const local = lerEstadoLocal(pasta)
      const concluidas = p.milestones.filter((m) => m.status === 'concluido').map((m) => m.n)
      gravarEstadoLocal(pasta, { ...local, aprovadaAte: Math.max(local.aprovadaAte, ...concluidas, 0) })
      if (p.pct < 100 && !local.pausada && !linha.rodando(pasta)) linha.religar(pasta)
    },

    async aplicarModo(pasta, modo) {
      if (!ehModoObra(modo)) throw new Error('modo-invalido')
      pastaDaObra(raiz, pasta)
      await modos.gravar(pasta, modo)
      gravarRecomendadoGlobal(modo, { home, agora: agora() })
    },

    enderecoCanteiro(pasta) {
      try { pastaDaObra(raiz, pasta) } catch { return null }
      return enderecoPronto(pasta)
    },

    async abrirTeste(pasta) {
      pastaDaObra(raiz, pasta)
      const t = lerJson(caminhoSeguro(raiz, pasta, '.atlas', 'teste.json'))
      if (t && typeof t.url === 'string' && RE_ENDERECO.test(t.url)) { await shell.openExternal(t.url); return }
      const html = caminhoSeguro(raiz, pasta, 'dist', 'index.html')
      if (fs.existsSync(html) && !fs.lstatSync(html).isSymbolicLink()) {
        const erro = await shell.openPath(html)
        if (erro) throw new Error('nao-abriu')
        return
      }
      throw new Error('sem-teste')
    },

    /** Chamado ao fechar o app: para a linha e o canteiro que o Atlas subiu. */
    encerrar() {
      for (const f of filhos) { try { f.kill() } catch { /* já saiu */ } }
    },
  }
  return painel
}

/** Pede ao SO uma porta livre em 127.0.0.1 (abre na 0, lê a porta, fecha). */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
  })
}

/**
 * Confere que a porta é MESMO o nosso canteiro. Com `nonce`: manda um desafio aleatório e exige a prova
 * HMAC-SHA256(nonce, desafio) (o nonce nunca trafega, então quem ocupou a porta antes não consegue responder). Sem nonce (teste): só 200.
 */
function responde(porta, nonce = null) {
  return new Promise((resolve) => {
    const desafio = nonce ? crypto.randomBytes(16).toString('hex') : ''
    const caminho = nonce ? `/obras?desafio=${desafio}` : '/obras'
    const r = http.get({ host: '127.0.0.1', port: porta, path: caminho, timeout: 1000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(false) }
      if (!nonce) { res.resume(); return resolve(true) }
      let corpo = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { corpo += c; if (corpo.length > 2_000_000) res.destroy() })
      res.on('end', () => {
        try {
          const esperado = crypto.createHmac('sha256', nonce).update(desafio).digest('hex')
          const prova = String(JSON.parse(corpo).prova || '')
          resolve(prova.length === esperado.length && crypto.timingSafeEqual(Buffer.from(prova), Buffer.from(esperado)))
        } catch { resolve(false) }
      })
      res.on('error', () => resolve(false))
    })
    r.on('error', () => resolve(false))
    r.on('timeout', () => { r.destroy(); resolve(false) })
  })
}

module.exports = { avancoFino, parcialDaEtapa, kitDirDoApp, criarPainel, portaLivre, responde, lerPlanoDoTexto, paradaDeOcorrencias, textoRestante, textoPrevisao, RE_ENDERECO }
