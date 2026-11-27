// Liga as contas do cliente (GitHub, Vercel, Supabase) a ESTE computador, para a linha de produção conseguir guardar e publicar.
// Tela: prototipo/caminho-novo/C1Contas (aprovada pelo Luiz em 24/11/2026). Antes, a pessoa só entrava nos sites e a obra parava
// quando o agente pedia `! gh auth login` num terminal que o leigo nunca vê.
//
// COMO CADA CONTA LIGA (a pessoa nunca digita comando nem senha no Atlas)
//  - GitHub: `gh auth login --web` (fluxo de código do próprio GitHub). O Atlas lê o código da saída, mostra grande na tela e abre
//    github.com/login/device ao lado; a pessoa cola e clica em Continue. O login fica no cofre do Windows, guardado pelo gh.
//  - Vercel: `vercel login` (mesmo fluxo de código). CI=1 impede a CLI de abrir o navegador do computador: o Atlas abre o site ao lado.
//  - Supabase: a chave é conferida pela API HTTPS do Supabase (sem CLI). A CLI dele NÃO faz login sem terminal ("Cannot use automatic login flow inside non-TTY environments"). A pessoa cria
//    uma chave no site e cola aqui; o Atlas testa com o próprio Supabase e só então guarda no COFRE (DPAPI). Nunca vai a arquivo,
//    log nem linha de comando: chega à linha de produção pelo ambiente (SUPABASE_ACCESS_TOKEN).
//
// FERRAMENTAS: o gh vem do instalador. Vercel, Supabase e a EAS da Expo (lojas, M59) são instaladas pelo Atlas na pasta dele (<userData>\ferramentas), com
// versão fixa, sem `-g`; a linha as recebe no PATH (o `npx` continua proibido para o Claude).
//
// COMO TESTAR: `node --test app/adaptadores/contas-cli.teste.cjs`. No Windows: Obra nova → … → As contas → Ligar: o código aparece,
// o site abre ao lado; depois de confirmar, a linha fica "Ligado como <usuário>".
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const { spawn } = require('node:child_process')

const CHAVE_SUPABASE = 'contas/supabase'
// Saída de ferramenta que é internet ou serviço instável (vale tentar de novo) x erro de montagem do sistema (não adianta repetir).
const RE_INSTAVEL = /\b(429|5\d\d)\b|rate limit|ECONN\w*|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network|timed? ?out|service unavailable|bad gateway/i
const RE_BUILD = /error TS\d+|Command ".*build.*" exited|Build failed|Module not found|SyntaxError|Failed to compile/i
const MAX_SAIDA = 200_000

/** Roda e espera (sem shell, a não ser .cmd do npm com argumentos FIXOS). Saída = stdout+stderr, com teto. */
function rodarProcesso(cmd, args, { env, cwd, timeoutMs = 20_000, entrada = null } = {}) {
  return new Promise((resolve) => {
    let saida = ''
    let p
    try { p = spawn(cmd, args, { env, cwd, windowsHide: true, shell: /\.cmd$/i.test(cmd), stdio: [entrada === null ? 'ignore' : 'pipe', 'pipe', 'pipe'] }) } catch { resolve({ codigo: 1, saida: '' }); return }
    if (entrada !== null) { try { p.stdin.end(String(entrada)) } catch { /* fechou */ } } // valor de segredo vai pela entrada, nunca nos argumentos
    const junta = (b) => { if (saida.length < MAX_SAIDA) saida += String(b) }
    p.stdout.on('data', junta)
    p.stderr.on('data', junta)
    const t = setTimeout(() => { try { p.kill() } catch { /* já saiu */ } }, timeoutMs)
    p.on('error', () => { clearTimeout(t); resolve({ codigo: 1, saida }) })
    p.on('close', (c) => { clearTimeout(t); resolve({ codigo: c ?? 1, saida }) })
  })
}

/** Processo longo (login): entrega o texto aos poucos e avisa no fim. */
function iniciarProcesso(cmd, args, { env, onTexto, onFim }) {
  let p
  try { p = spawn(cmd, args, { env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }) } catch { setTimeout(() => onFim(1), 0); return { escrever() {}, parar() {} } }
  p.stdout.on('data', (b) => onTexto(String(b)))
  p.stderr.on('data', (b) => onTexto(String(b)))
  let fim = false
  const acabar = (c) => { if (!fim) { fim = true; onFim(c) } }
  p.on('error', () => acabar(1))
  p.on('close', (c) => acabar(c ?? 1))
  return {
    escrever: (t) => { try { p.stdin.write(t) } catch { /* fechado */ } },
    parar: () => { try { p.kill() } catch { /* já saiu */ } },
  }
}
const VERSOES = { vercel: '66', supabase: '3', eas: '27' }
const PACOTES = {
  vercel: { pacote: 'vercel', script: ['vercel', 'dist', 'vc.js'] },
  supabase: { pacote: 'supabase', script: ['supabase', 'dist', 'supabase.js'] },
  eas: { pacote: 'eas-cli', script: ['eas-cli', 'bin', 'run'] },
}
const RE_CODIGO = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/
const ENDERECO_FIXO = { github: 'https://github.com/login/device', hosp: 'https://vercel.com/device' }
const ENDERECO_OK = {
  github: (u) => u.hostname === 'github.com' && u.pathname === '/login/device',
  hosp: (u) => u.hostname === 'vercel.com' && /^\/(oauth\/)?device$/.test(u.pathname),
}

/** Código (XXXX-XXXX) e endereço oficial a partir da saída da CLI; endereço de outro site é trocado pelo fixo. null = ainda não. */
function codigoEEndereco(conta, texto) {
  const m = RE_CODIGO.exec(String(texto))
  if (!m) return null
  let url = ENDERECO_FIXO[conta]
  for (const bruto of String(texto).match(/https:\/\/[^\s"'<>]+/g) || []) {
    try { const u = new URL(bruto); if (u.protocol === 'https:' && ENDERECO_OK[conta](u)) { url = u.toString(); break } } catch { /* ignora */ }
  }
  return { codigo: m[1], url }
}

const chaveSupabaseValida = (c) => typeof c === 'string' && /^sbp_[a-z0-9]{40}$/i.test(c)

/** O gh: a instalação padrão no Windows (o PATH do app pode ser o de antes do instalador) ou o do PATH. */
function comandoGh(env = process.env, existe = fs.existsSync, plataforma = process.platform) {
  if (plataforma === 'win32') {
    const exe = path.win32.join(env.ProgramFiles || env.PROGRAMFILES || 'C:\\Program Files', 'GitHub CLI', 'gh.exe')
    if (existe(exe)) return exe
  }
  if (plataforma !== 'win32') { const achado = require('../plataforma.cjs').acharPrograma('gh', env.PATH, existe); if (achado) return achado } // Mac (M46)
  return 'gh'
}

/**
 * deps: { dadosApp, cofre, rodar(cmd, args, {env, timeoutMs}) → {codigo, saida}, iniciar(cmd, args, {env, onTexto, onFim}) →
 *         {escrever, parar}, plataforma?, env? (base, já mínimo), existe?, execPath? }
 */
function criarContasCli({ dadosApp, cofre, apiSupabase = null, rodar = rodarProcesso, iniciar = iniciarProcesso, plataforma = process.platform, env = process.env, existe = fs.existsSync, execPath = process.execPath }) {
  const pastaFerr = path.join(dadosApp, 'ferramentas')
  const binFerr = path.join(pastaFerr, 'node_modules', '.bin')
  const estados = {}
  const logins = {}
  // A linha de produção é ligada de forma síncrona: a chave fica em memória (lida do cofre ao abrir e ao guardar), nunca em arquivo.
  let chaveCache = null
  const recarregar = async () => { try { const c = await cofre.ler(CHAVE_SUPABASE); chaveCache = chaveSupabaseValida(c) ? c : null } catch { chaveCache = null } }

  const gh = () => ({ cmd: comandoGh(env, existe, plataforma), pre: [], env: {} })
  // Vercel e Supabase: o script da CLI rodado pelo próprio Node do Electron (sem shell, sem .cmd).
  const viaNode = (script) => ({ cmd: execPath, pre: [path.join(pastaFerr, 'node_modules', ...script)], env: { ELECTRON_RUN_AS_NODE: '1' } })
  const vercel = () => viaNode(['vercel', 'dist', 'vc.js'])
  const supabase = () => viaNode(['supabase', 'dist', 'supabase.js'])
  const easCli = () => viaNode(['eas-cli', 'bin', 'run'])
  const ferramentaDe = (conta) => (conta === 'github' ? gh() : vercel())

  const rodarCom = async (f, args, extra = {}, timeoutMs = 20_000, opcoes = {}) => {
    try { return await rodar(f.cmd, [...f.pre, ...args], { env: { ...env, ...f.env, ...extra }, timeoutMs, ...opcoes }) } catch { return { codigo: 1, saida: '' } }
  }

  const self = {
    CHAVE_SUPABASE,

    /**
     * Instala na pasta do Atlas (versões fixas, sem global) SÓ as ferramentas que o passo precisa, cada uma no seu `npm install`:
     * a da Expo (pesada, só para as lojas) nunca mais trava a ligação da Vercel nem o "Colocar no ar" (27/11/2026). Falhou = tenta
     * de novo uma vez (internet que piscou). true = todas as pedidas prontas.
     */
    async instalarFerramentas(nomes = ['vercel']) {
      fs.mkdirSync(pastaFerr, { recursive: true })
      const npm = plataforma === 'win32' ? 'npm.cmd' : 'npm'
      let tudo = true
      for (const nome of nomes) {
        if (!PACOTES[nome]) { tudo = false; continue }
        if (self.ferramentasProntas([nome])) continue
        let ok = false
        for (let i = 0; i < 2 && !ok; i++) {
          const r = await rodarCom({ cmd: npm, pre: [], env: {} }, ['install', '--prefix', pastaFerr, '--no-audit', '--no-fund', `${PACOTES[nome].pacote}@${VERSOES[nome]}`], {}, 600_000)
          ok = r.codigo === 0
        }
        if (!ok) tudo = false
      }
      return tudo
    },
    ferramentasProntas: (nomes = ['vercel']) => nomes.every((n) => PACOTES[n] && existe(path.join(pastaFerr, 'node_modules', ...PACOTES[n].script))),

    estado: (conta) => estados[conta] || 'pendente',

    /** Começa o login de GitHub ('github') ou Vercel ('hosp'). Devolve { codigo, url } assim que a CLI mostra o código. */
    ligar(conta, { esperaMs = 60_000 } = {}) {
      if (conta !== 'github' && conta !== 'hosp') return Promise.reject(new Error('conta-invalida'))
      if (logins[conta]) { logins[conta].parar(); delete logins[conta] }
      const f = ferramentaDe(conta)
      const args = conta === 'github'
        ? ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--scopes', 'workflow']
        : ['login']
      const extra = conta === 'hosp' ? { CI: '1' } : { GH_PROMPT_DISABLED: '1' }
      estados[conta] = 'esperando'
      return new Promise((resolve, reject) => {
        let texto = ''
        let achou = false
        let proc = null
        const timer = setTimeout(() => {
          if (achou) return
          estados[conta] = 'erro'
          if (proc) proc.parar()
          delete logins[conta]
          reject(new Error('sem-codigo'))
        }, esperaMs)
        proc = iniciar(f.cmd, [...f.pre, ...args], {
          env: { ...env, ...f.env, ...extra },
          onTexto: (t) => {
            if (achou) return
            texto = (texto + String(t)).slice(-4000)
            const r = codigoEEndereco(conta, texto)
            if (!r) return
            achou = true
            clearTimeout(timer)
            if (conta === 'github') proc.escrever('\n') // "Press Enter to open github.com in your browser..."
            resolve(r)
          },
          onFim: (codigo) => {
            clearTimeout(timer)
            if (logins[conta] === proc) delete logins[conta]
            estados[conta] = codigo === 0 ? 'ligado' : 'erro'
            if (!achou) { achou = true; reject(new Error('falhou')) }
          },
        })
        logins[conta] = proc
      })
    },

    /** Para o login em andamento (a pessoa saiu da tela). */
    cancelar(conta) { if (logins[conta]) { logins[conta].parar(); delete logins[conta]; if (estados[conta] === 'esperando') estados[conta] = 'pendente' } },

    /**
     * Testa a chave com a API do próprio Supabase (HTTPS, a mesma do "Colocar no ar"; sem CLI, sem instalar nada) e só então guarda
     * no cofre. 401/403 = recusada; sem internet = 'sem-internet' (nunca "recusada" por engano: a pessoa geraria chave à toa).
     */
    async guardarChaveSupabase(bruta) {
      const chave = String(bruta ?? '').trim()
      if (!chaveSupabaseValida(chave)) return { ok: false, motivo: 'formato' }
      try {
        const lista = await apiSupabase('GET', '/v1/projects', null, chave)
        if (!Array.isArray(lista)) return { ok: false, motivo: 'sem-internet' }
      } catch (e) {
        const m = String((e && e.message) || '')
        return { ok: false, motivo: m === 'supabase-401' || m === 'supabase-403' ? 'recusada' : 'sem-internet' }
      }
      await cofre.guardar(CHAVE_SUPABASE, chave)
      chaveCache = chave
      estados.supabase = 'ligado'
      return { ok: true }
    },

    /** Para a tela: cada conta ligada (perguntando à própria CLI) e com qual usuário. */
    async situacao() {
      const g = await rodarCom(gh(), ['auth', 'status', '--hostname', 'github.com'])
      const conta = /account\s+(\S+)/.exec(g.saida || '')
      const ghOk = g.codigo === 0
      const v = await rodarCom(vercel(), ['whoami'], { CI: '1' })
      const linhaV = String(v.saida || '').split(/\r?\n/).map((l) => l.replace(/^>\s*/, '').trim()).filter(Boolean).pop() || null
      let chave = null
      try { chave = await cofre.ler(CHAVE_SUPABASE) } catch { /* cofre indisponível = não ligado */ }
      if (ghOk) estados.github = 'ligado'
      if (v.codigo === 0) estados.hosp = 'ligado'
      return {
        github: { ligado: ghOk, usuario: ghOk && conta ? conta[1] : null },
        hosp: { ligado: v.codigo === 0, usuario: v.codigo === 0 ? linhaV : null },
        supabase: { ligado: !!chave, usuario: null },
      }
    },

    /** "Colocar no ar" (no-ar.cjs): roda a CLI da Vercel ou do Supabase do cliente na pasta da obra. Segredo só por `env`/`entrada`. */
    async rodarFerramenta(nome, args, { cwd, env: extra = {}, entrada = null, timeoutMs = 120_000 } = {}) {
      if (nome !== 'vercel' && nome !== 'supabase' && nome !== 'eas') return { codigo: 1, saida: '' }
      if (!Array.isArray(args) || !args.every((a) => typeof a === 'string')) return { codigo: 1, saida: '' }
      const f = nome === 'vercel' ? vercel() : nome === 'eas' ? easCli() : supabase()
      return rodarCom(f, args, nome === 'vercel' ? { CI: '1', ...extra } : extra, timeoutMs, { cwd, entrada })
    },

    /**
     * Igual a rodarFerramenta, mas quando a saída mostra internet ou serviço instável (não erro do sistema), tenta de novo sozinho
     * (até 3 vezes, 10 s entre elas). Para a página de vendas, o domínio e as lojas (27/11/2026).
     */
    async rodarFerramentaTentando(nome, args, opcoes = {}, { esperar = (ms) => new Promise((r) => setTimeout(r, ms)), esperaMs = 10_000 } = {}) {
      for (let i = 0; ; i++) {
        const r = await self.rodarFerramenta(nome, args, opcoes)
        const saida = String(r.saida || '')
        if (r.codigo === 0 || i >= 2 || RE_BUILD.test(saida) || !RE_INSTAVEL.test(saida)) return r
        await esperar(esperaMs)
      }
    },

    /** Ambiente extra da linha de produção: ferramentas no PATH e a chave do Supabase (só se existir). */
    envDaLinha(pathAtual = env.PATH || env.Path || '') {
      const out = { PATH: [binFerr, pathAtual].filter(Boolean).join(path.delimiter) }
      if (chaveCache) out.SUPABASE_ACCESS_TOKEN = chaveCache
      return out
    },
    /** Relê a chave do cofre (ao abrir o app). */
    recarregar,

    encerrar() { for (const c of Object.keys(logins)) self.cancelar(c) },
  }
  return self
}

module.exports = { RE_INSTAVEL, RE_BUILD, rodarProcesso, comandoGh, criarContasCli, codigoEEndereco, chaveSupabaseValida, CHAVE_SUPABASE }
