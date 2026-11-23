// Navegador de verdade dentro do Atlas, na tela das contas (pedido do Luiz, 23/11/2026: "abrir o browser de verdade nessa tela
// lateral do Atlas, para o usuário fazer tudo sem sair do Atlas"). O guia fica à esquerda; o site real (GitHub, Supabase, Vercel,
// Stripe) à direita. O Claude NÃO entra aqui: o login dele continua no Chrome do cliente (já costuma estar logado lá).
//
// SEGURANÇA
//  - Um navegador só, isolado (main.cjs cria com partition própria 'persist:atlas-contas', sandbox, sem preload, sem Node, sem
//    permissões de câmera/microfone/arquivo). O Atlas não injeta script nem lê o que a pessoa digita: a senha vai direto ao site.
//  - Só abre os sites das contas (urlPermitida: https e domínio exato ou subdomínio da lista). Qualquer outro endereço (ex.:
//    "entrar com o Google", que o Google bloqueia dentro de apps) vai para o navegador do computador (abrirFora).
//  - O endereço inicial de cada conta é fixo aqui (SITES); a tela só diz QUAL conta.
//
// DETECÇÃO (contaPronta): Supabase e Vercel quando a pessoa chega no painel; GitHub quando o login está feito (cookie logged_in
// do próprio navegador embutido, lido em main.cjs). A tela recebe { conta, url, pronta } a cada página e avança o passo sozinha.
//
// COMO TESTAR: `node --test app/adaptadores/navegador.teste.cjs`. No Windows: Obra nova → … → As contas: o site abre na metade
// direita; criar a conta do GitHub; ao entrar, o passo fica verde sozinho.
'use strict'

const SITES = {
  github: 'https://github.com/signup',
  supabase: 'https://supabase.com/dashboard/sign-in',
  hosp: 'https://vercel.com/signup',
  pag: 'https://dashboard.stripe.com/register',
}
const DOMINIOS = ['github.com', 'supabase.com', 'vercel.com', 'stripe.com']

function urlPermitida(url) {
  let u
  try { u = new URL(String(url)) } catch { return false }
  if (u.protocol !== 'https:') return false
  return DOMINIOS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
}

function contaPronta(conta, url, logadoGithub) {
  let u
  try { u = new URL(String(url)) } catch { return false }
  const p = u.pathname
  if (conta === 'supabase') return u.hostname === 'supabase.com' && p.startsWith('/dashboard') && !/^\/dashboard\/(sign-in|sign-up|forgot-password)/.test(p)
  if (conta === 'hosp') return u.hostname === 'vercel.com' && (p.startsWith('/new') || p.startsWith('/dashboard') || /^\/[a-z0-9-]+-projects(\/|$)/.test(p))
  if (conta === 'github') return u.hostname === 'github.com' && logadoGithub === true && !/^\/(signup|login|session|sessions)/.test(p)
  if (conta === 'pag') return u.hostname === 'dashboard.stripe.com' && !/^\/(register|login)/.test(p)
  return false
}

const posicaoValida = (b) => b && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(b[k]) && b[k] >= 0 && b[k] <= 20000)

/**
 * deps: { criarView() → view (loadURL, setBounds, setVisible, destruir, on(evento), voltar, recarregar, url),
 *         avisar({conta, url, pronta}), abrirFora(url), logadoNoGithub() → Promise<boolean> }
 */
function criarNavegador({ criarView, avisar, abrirFora, logadoNoGithub }) {
  let view = null
  let contaAtual = null
  const prontas = new Set()

  const pagina = async (url) => {
    if (!contaAtual) return
    const conta = contaAtual
    const logado = conta === 'github' ? await logadoNoGithub().catch(() => false) : false
    const pronta = contaPronta(conta, url, logado)
    if (pronta) prontas.add(conta)
    avisar({ conta, url: String(url).slice(0, 300), pronta })
  }

  function garantir() {
    if (view) return view
    view = criarView()
    const bloquearFora = (e, url) => { if (!urlPermitida(url)) { e.preventDefault(); if (/^https:\/\//.test(String(url))) abrirFora(String(url)) } }
    view.on('will-navigate', bloquearFora)
    view.on('will-redirect', bloquearFora)
    view.on('did-navigate', (_e, url) => { void pagina(url) })
    view.on('did-navigate-in-page', (_e, url) => { void pagina(url) })
    return view
  }

  return {
    SITES,
    async abrir(conta, bounds) {
      if (!Object.prototype.hasOwnProperty.call(SITES, conta)) throw new Error('conta-invalida')
      if (!posicaoValida(bounds)) throw new Error('posicao-invalida')
      const v = garantir()
      contaAtual = conta
      v.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) })
      v.setVisible(true)
      v.loadURL(SITES[conta])
    },
    posicionar(bounds) {
      if (!view || !posicaoValida(bounds)) return
      view.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) })
    },
    mostrar(sim) { if (view) view.setVisible(!!sim) },
    voltar() { if (view) view.voltar() },
    recarregar() { if (view) view.recarregar() },
    /** Abre o site da conta no navegador do computador (botão "abrir no meu navegador"). */
    abrirNoComputador(conta) { if (Object.prototype.hasOwnProperty.call(SITES, conta)) abrirFora(SITES[conta]) },
    async pronta(conta) { return prontas.has(conta) },
    fechar() { if (view) { view.destruir(); view = null; contaAtual = null } },
  }
}

module.exports = { criarNavegador, SITES, urlPermitida, contaPronta }
