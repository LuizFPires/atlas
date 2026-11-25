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
// M58: guias clique por clique com o site de verdade ao lado. Google (bloqueia login dentro de apps) e Apple (é no iPhone) não abrem aqui.
const GUIAS_SITE = {
  registro: 'https://registro.br/painel/',
  stripe: 'https://dashboard.stripe.com/register',
  asaas: 'https://www.asaas.com/onboarding/createAccount',
}
const DOMINIOS = ['github.com', 'supabase.com', 'vercel.com', 'stripe.com', 'registro.br', 'asaas.com']

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
  let guiaAtual = null
  let visivel = false
  const prontas = new Set()

  const pagina = async (url) => {
    if (guiaAtual) { avisar({ guia: guiaAtual, url: String(url).slice(0, 300), pronta: false }); return }
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
      guiaAtual = null
      v.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) })
      v.setVisible(true); visivel = true
      v.loadURL(SITES[conta])
    },
    /** M58: o site do guia (endereço fixo aqui). A cada página a tela recebe { guia, url } e decide se o passo andou. */
    async abrirGuia(guia, bounds) {
      if (!Object.prototype.hasOwnProperty.call(GUIAS_SITE, guia)) throw new Error('guia-invalido')
      if (!posicaoValida(bounds)) throw new Error('posicao-invalida')
      const v = garantir()
      contaAtual = null
      guiaAtual = guia
      v.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) })
      v.setVisible(true); visivel = true
      v.loadURL(GUIAS_SITE[guia])
    },
    abrirGuiaNoComputador(guia) { if (Object.prototype.hasOwnProperty.call(GUIAS_SITE, guia)) abrirFora(GUIAS_SITE[guia]) },
    /** "Falar com o Atlas" num passo: o print é do site que o cliente está vendo (só se estiver à mostra). */
    async capturar() {
      if (!view || !visivel || typeof view.capturar !== 'function') return null
      try { return await view.capturar() } catch { return null }
    },
    /** Ligar as contas (contas-cli.cjs): abre o endereço que o PROCESSO PRINCIPAL recebeu da CLI (nunca da tela), só de site das contas. */
    async abrirEndereco(url, bounds) {
      if (!urlPermitida(url)) throw new Error('endereco-invalido')
      if (!posicaoValida(bounds)) throw new Error('posicao-invalida')
      const v = garantir()
      contaAtual = null // aqui não há "conta pronta" a detectar: quem diz se ligou é a própria CLI
      guiaAtual = null
      v.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) })
      v.setVisible(true); visivel = true
      v.loadURL(String(url))
    },
    posicionar(bounds) {
      if (!view || !posicaoValida(bounds)) return
      view.setBounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) })
    },
    mostrar(sim) { if (view) { view.setVisible(!!sim); visivel = !!sim } },
    voltar() { if (view) view.voltar() },
    recarregar() { if (view) view.recarregar() },
    /** Abre o site da conta no navegador do computador (botão "abrir no meu navegador"). */
    abrirNoComputador(conta) { if (Object.prototype.hasOwnProperty.call(SITES, conta)) abrirFora(SITES[conta]) },
    async pronta(conta) { return prontas.has(conta) },
    fechar() { if (view) { view.destruir(); view = null; contaAtual = null; guiaAtual = null; visivel = false } },
  }
}

module.exports = { criarNavegador, SITES, GUIAS_SITE, urlPermitida, contaPronta }
