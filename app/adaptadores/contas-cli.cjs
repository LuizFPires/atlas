// Liga as contas do cliente (GitHub, Vercel, Supabase) a ESTE computador, para a linha de produção conseguir guardar e publicar.
// Tela: prototipo/caminho-novo/C1Contas (aprovada pelo Luiz em 24/11/2026). Antes, a pessoa só entrava nos sites e a obra parava
// quando o agente pedia `! gh auth login` num terminal que o leigo nunca vê.
//
// COMO CADA CONTA LIGA (a pessoa nunca digita comando nem senha no Atlas)
//  - GitHub: `gh auth login --web` (fluxo de código do próprio GitHub). O Atlas lê o código da saída, mostra grande na tela e abre
//    github.com/login/device ao lado; a pessoa cola e clica em Continue. O login fica no cofre do Windows, guardado pelo gh.
//  - Vercel: `vercel login` (mesmo fluxo de código). CI=1 impede a CLI de abrir o navegador do computador: o Atlas abre o site ao lado.
//  - Supabase: a CLI dele NÃO faz login sem terminal ("Cannot use automatic login flow inside non-TTY environments"). A pessoa cria
//    uma chave no site e cola aqui; o Atlas testa com o próprio Supabase e só então guarda no COFRE (DPAPI). Nunca vai a arquivo,
//    log nem linha de comando: chega à linha de produção pelo ambiente (SUPABASE_ACCESS_TOKEN).
//
// FERRAMENTAS: o gh vem do instalador. Vercel e Supabase são instaladas pelo Atlas na pasta dele (<userData>\ferramentas), com
// versão fixa, sem `-g`; a linha as recebe no PATH (o `npx` continua proibido para o Claude).
//
// COMO TESTAR: `node --test app/adaptadores/contas-cli.teste.cjs`. No Windows: Obra nova → … → As contas → Ligar: o código aparece,
// o site abre ao lado; depois de confirmar, a linha fica "Ligado como <usuário>".
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const { spawn } = require('node:child_process')

const CHAVE_SUPABASE = 'contas/supabase'
const MAX_SAIDA = 200_000

/** Roda e espera (sem shell, a não ser .cmd do npm com argumentos FIXOS). Saída = stdout+stderr, com teto. */
function rodarProcesso(cmd, args, { env, timeoutMs = 20_000 } = {}) {
  return new Promise((resolve) => {
    let saida = ''
    let p
    try { p = spawn(cmd, args, { env, windowsHide: true, shell: /\.cmd$/i.test(cmd), stdio: ['ignore', 'pipe', 'pipe'] }) } catch { resolve({ codigo: 1, saida: '' }); return }
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
const VERSOES = { vercel: '66', supabase: '3' }
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

/**
 * deps: { dadosApp, cofre, rodar(cmd, args, {env, timeoutMs}) → {codigo, saida}, iniciar(cmd, args, {env, onTexto, onFim}) →
 *         {escrever, parar}, plataforma?, env? (base, já mínimo), existe?, execPath? }
 */
function criarContasCli({ dadosApp, cofre, rodar = rodarProcesso, iniciar = iniciarProcesso, plataforma = process.platform, env = process.env, existe = fs.existsSync, execPath = process.execPath }) {
  const pastaFerr = path.join(dadosApp, 'ferramentas')
  const binFerr = path.join(pastaFerr, 'node_modules', '.bin')
  const estados = {}
  const logins = {}
  // A linha de produção é ligada de forma síncrona: a chave fica em memória (lida do cofre ao abrir e ao guardar), nunca em arquivo.
  let chaveCache = null
  const recarregar = async () => { try { const c = await cofre.ler(CHAVE_SUPABASE); chaveCache = chaveSupabaseValida(c) ? c : null } catch { chaveCache = null } }

  const gh = () => {
    if (plataforma === 'win32') {
      const exe = path.win32.join(env.ProgramFiles || env.PROGRAMFILES || 'C:\\Program Files', 'GitHub CLI', 'gh.exe')
      if (existe(exe)) return { cmd: exe, pre: [], env: {} }
    }
    return { cmd: 'gh', pre: [], env: {} }
  }
  // Vercel e Supabase: o script da CLI rodado pelo próprio Node do Electron (sem shell, sem .cmd).
  const viaNode = (script) => ({ cmd: execPath, pre: [path.join(pastaFerr, 'node_modules', ...script)], env: { ELECTRON_RUN_AS_NODE: '1' } })
  const vercel = () => viaNode(['vercel', 'dist', 'vc.js'])
  const supabase = () => viaNode(['supabase', 'dist', 'supabase.js'])
  const ferramentaDe = (conta) => (conta === 'github' ? gh() : vercel())

  const rodarCom = async (f, args, extra = {}, timeoutMs = 20_000) => {
    try { return await rodar(f.cmd, [...f.pre, ...args], { env: { ...env, ...f.env, ...extra }, timeoutMs }) } catch { return { codigo: 1, saida: '' } }
  }

  const self = {
    CHAVE_SUPABASE,

    /** Instala Vercel e Supabase na pasta do Atlas (versões fixas). true = pronto. */
    async instalarFerramentas() {
      fs.mkdirSync(pastaFerr, { recursive: true })
      const npm = plataforma === 'win32' ? 'npm.cmd' : 'npm'
      const r = await rodarCom({ cmd: npm, pre: [], env: {} }, ['install', '--prefix', pastaFerr, '--no-audit', '--no-fund', `vercel@${VERSOES.vercel}`, `supabase@${VERSOES.supabase}`], {}, 300_000)
      return r.codigo === 0
    },
    ferramentasProntas: () => existe(path.join(pastaFerr, 'node_modules', 'vercel', 'dist', 'vc.js')) && existe(path.join(pastaFerr, 'node_modules', 'supabase', 'dist', 'supabase.js')),

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

    /** Testa a chave com o próprio Supabase e só então guarda no cofre. A chave nunca vai à linha de comando. */
    async guardarChaveSupabase(bruta) {
      const chave = String(bruta ?? '').trim()
      if (!chaveSupabaseValida(chave)) return { ok: false, motivo: 'formato' }
      const r = await rodarCom(supabase(), ['projects', 'list', '-o', 'json'], { SUPABASE_ACCESS_TOKEN: chave }, 30_000)
      if (r.codigo !== 0) return { ok: false, motivo: 'recusada' }
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

module.exports = { criarContasCli, codigoEEndereco, chaveSupabaseValida, CHAVE_SUPABASE }
