// Adaptador real do PonteClaude (src/app/ponte-claude.ts) — processo principal do Electron (só Windows).
//
// O QUE FAZ: o Atlas NUNCA faz o login do Claude (regra da Anthropic: sem OAuth de assinatura em app de terceiros) — só abre e detecta.
//  - abrirLogin (23/11/2026, conectar com um clique): roda o login OFICIAL do Claude Code, `claude auth login --claudeai`
//    (args fixos, sem shell). Quem abre o navegador na página de autorização do Claude e guarda a credencial é o próprio Claude
//    Code; o Atlas não vê nada disso. Não espera terminar: a tela confere o estado sozinha. Ao conectar, `aoConectar` traz o Atlas
//    para a frente. Um login por vez.
//  - abrirSite: shell.openExternal com URLs FIXAS do claude.ai (allowlist em seguro.cjs); nada vindo do renderer vira URL.
//  - estado: roda `claude auth status` (args fixos, sem shell, timeout) e lê loggedIn / email / subscriptionType (pro|max).
//    Não lê nem guarda senha, código ou token; o CLI guarda a credencial dele.
//  - renovarConexao: o Atlas não reentra por ele; só lê o estado de novo (o cliente reentra no navegador e o CLI passa a enxergar o plano novo).
//
// COMO TESTAR (Windows, com o Claude Code instalado): `claude auth status` no terminal mostra JSON; no app, a tela do Claude
// mostra "conectado" + plano igual ao do JSON. Sem o CLI instalado ou deslogado: estado = { conectado: false } (sem erro na tela).
'use strict'
const { abrirExterno, executarClaude } = require('../seguro.cjs')

const SITES = Object.freeze({
  login: 'https://claude.ai/login',
  'criar-conta': 'https://claude.ai/login',
  planos: 'https://claude.ai/upgrade',
})

/** Converte a saída do `claude auth status` no EstadoClaude do front. Qualquer coisa estranha = não conectado. */
function lerEstado(saida) {
  let j
  try { j = JSON.parse(saida) } catch { return { conectado: false } }
  if (!j || j.loggedIn !== true) return { conectado: false }
  const estado = { conectado: true }
  if (typeof j.email === 'string' && j.email.length <= 200) estado.conta = j.email
  const t = typeof j.subscriptionType === 'string' ? j.subscriptionType.toLowerCase() : ''
  if (t === 'pro' || t === 'max') estado.plano = t
  // Assinatura como o Claude informa (ex.: ultra): só para mostrar no menu. Só letras, curta; o resto é ignorado.
  if (/^[a-z]{2,20}$/.test(t)) estado.assinatura = t
  return estado
}

const LOGIN_MS = 10 * 60_000

/** `deps`: { shell, executar, aoConectar } — `executar` existe para teste (padrão: executarClaude). */
function criarClaude({ shell, executar = executarClaude, aoConectar = () => {} }) {
  let login = null
  const estado = async () => {
    try {
      const r = await executar(['auth', 'status'], { timeoutMs: 15_000, maxSaida: 100_000 })
      return r.codigo === 0 ? lerEstado(r.saida) : { conectado: false }
    } catch { return { conectado: false } } // CLI ausente/lento: a tela mostra "ainda não conectado"
  }
  return {
    async abrirLogin() {
      if (login) return // já tem uma janela de autorização aberta: o cliente só precisa clicar em Autorizar
      const p = executar(['auth', 'login', '--claudeai'], { timeoutMs: LOGIN_MS, maxSaida: 100_000 })
      login = p
      p.then((r) => { if (r && r.codigo === 0) aoConectar() }, () => {}).finally(() => { login = null })
      // Falha logo de cara (Claude Code não instalado): a tela avisa. Senão, segue esperando o clique em Autorizar.
      const erroCedo = await Promise.race([p.then(() => null, (e) => e), new Promise((r) => setTimeout(() => r(null), 300))])
      if (erroCedo) throw erroCedo
    },
    abrirSite: (alvo) => {
      if (alvo !== 'criar-conta' && alvo !== 'planos') return Promise.reject(new Error('site-invalido'))
      return abrirExterno(shell, SITES[alvo])
    },
    estado,
    renovarConexao: estado,
  }
}

module.exports = { criarClaude, lerEstado, SITES }
