import { VerPrototipo } from './web/VerPrototipo'
import { ConviteTeste } from './web/ConviteTeste'
import { lazy, Suspense, useEffect, useState } from 'react'
import { guardarIdioma, idiomaDaPagina, lerCookieIdioma, type Idioma } from './i18n/idioma'
import { Vendas } from './web/Vendas'
import { ModalCompra } from './web/ModalCompra'
import { Cadastro } from './web/Cadastro'
import { PassoApp } from './web/PassoApp'
import { criarPersonalizacaoFixture, criarPersonalizacaoPortal } from './web/personalizacao'
import { enviarCadastro } from './web/cadastro-api'
import { Portal } from './web/Portal'
import { criarPortalApi } from './web/portal-api'
import { criarStatusObrasFixture, criarStatusObrasPortal } from './web/obras-status'
import { modoFixture } from './app/ativacao-api'
import { Admin } from './web/Admin'
import { ConfirmarDegustacao } from './web/Degustacao'
import { Instalar } from './web/Instalar'
import { CompraPeloApp } from './web/CompraPeloApp'
import { criarAdminApi } from './web/admin-api'
import { criarAdminFixture } from './web/admin-fixture'
import { PaginaLegal } from './web/Legal'
import { idLegalDoCaminho } from './web/textos-legais'
import { criarFaceIdNavegador } from './celular/faceid'
import { AppDesktop, noAppDesktop } from './app/AppDesktop'
import { AppCelular } from './celular/AppCelular'
import { criarApiCelularFixture, criarApiCelularPortal } from './celular/api'
// App-modelo carregado sob demanda: não pesa no bundle principal.
const AppBarbearia = lazy(() => import('./modelos/barbearia/AppBarbearia').then((m) => ({ default: m.AppBarbearia })))
const AppRestaurante = lazy(() => import('./modelos/restaurante/AppRestaurante').then((m) => ({ default: m.AppRestaurante })))
const AppMercearia = lazy(() => import('./modelos/mercearia/AppMercearia').then((m) => ({ default: m.AppMercearia })))
const AppAcademia = lazy(() => import('./modelos/academia/AppAcademia').then((m) => ({ default: m.AppAcademia })))

// M52: no app do celular (/app) o login fica guardado no aparelho e se renova sozinho; no Portal web, só enquanto a aba está aberta.
// M52: Face ID para abrir o app do celular (chave do próprio aparelho; o rosto nunca sai do iPhone).
const faceIdCelular = criarFaceIdNavegador()
const portalApi = criarPortalApi(undefined, undefined, { lembrar: typeof window !== 'undefined' && window.location.pathname.startsWith('/app') })
const adminApi = modoFixture() ? criarAdminFixture() : criarAdminApi()
// Personalização do app pronto (M32 b): em produção grava pela rota /portal/personalizacao (escopada pelo login).
const personalizacao = modoFixture() ? criarPersonalizacaoFixture() : criarPersonalizacaoPortal(portalApi)
// Status das obras no celular (M30 relay): em produção lê o resumo que o computador publicou, pela rota /portal/obras
// (escopada pelo login). Enquanto o computador não publicou, a lista vem vazia e a seção explica isso com jeito.
const statusObras = modoFixture() ? criarStatusObrasFixture() : criarStatusObrasPortal(portalApi)

// M33: o aplicativo do dono no celular (PWA) fica em "/app": o projeto e a obra, com o notebook do escritório trabalhando.
const apiCelular = modoFixture() ? criarApiCelularFixture() : criarApiCelularPortal(portalApi)
function Aplicativo() {
  return <AppCelular api={apiCelular} faceId={modoFixture() ? undefined : faceIdCelular} />
}

function PaginaVendas({ idioma = 'pt' }: { idioma?: Idioma }) {
  const [comprando, setComprando] = useState(false)
  const [segmento, setSegmento] = useState<string | undefined>()
  // M31: a página em inglês (/en ou o domínio de fora) declara o idioma para o navegador e para o Google.
  useEffect(() => { document.documentElement.lang = idioma === 'en' ? 'en-US' : 'pt-BR' }, [idioma])
  return (
    <>
      <Vendas idioma={idioma} onComprar={() => { setSegmento(undefined); setComprando(true) }} onComprarPronto={(s) => { setSegmento(s); setComprando(true) }} />
      <ModalCompra idioma={idioma} aberto={comprando} segmento={segmento} onFechar={() => setComprando(false)} />
    </>
  )
}

/** Rotas por endereço: "/" é a página de vendas. */
export default function App() {
  // Dentro do app desktop (Electron) o endereço é um arquivo; ?desktop=1 simula isso no navegador (modo fixture).
  if (noAppDesktop() || new URLSearchParams(window.location.search).has('desktop')) return <AppDesktop />
  const caminho = window.location.pathname.replace(/\/+$/, '') || '/'
  if (caminho.startsWith('/app')) return <Aplicativo />
  // A Stripe devolve o comprador em /compra/sucesso; /comecar é o endereço público do cadastro.
  if (caminho === '/comecar' || caminho === '/compra/sucesso') return <Cadastro onEnviar={enviarCadastro} />
  // Compra feita de dentro do Atlas instalado: a Stripe devolve aqui (sem cadastro de novo).
  if (caminho === '/compra/pelo-app') return <CompraPeloApp />
  if (caminho === '/compra/pelo-app/cancelada') return <CompraPeloApp cancelada />
  // Depois da compra de um app pronto: cadastro -> /personalizar (login, configurador, entrega). A implantação do zero não passa por aqui.
  if (caminho === '/personalizar') return <PassoApp api={portalApi} porta={personalizacao} />
  // Portal do cliente: login próprio do Atlas, separado do login do Claude.
  if (caminho === '/conta') return <Portal api={portalApi} obras={statusObras} />
  // Link de confirmação do teste grátis (vem no e-mail).
  if (caminho === '/degustacao') return <ConfirmarDegustacao />
  // Ponte de instalação (link do e-mail de compra/teste): pública, o token é a prova.
  if (caminho === '/instalar') return <Instalar />
  // Link provisório do protótipo para o celular (7 dias): o token é a prova; o HTML só aparece em iframe sandbox.
  const proto = /^\/p\/([A-Za-z0-9_-]{40,64})$/.exec(caminho)
  if (proto) return <VerPrototipo token={proto[1]} />
  // Convite dos testadores do Google (M59): público, o código é a prova; só conta quem tocou "Já instalei".
  const teste = /^\/teste\/([a-z0-9]{10,40})$/.exec(caminho)
  if (teste) return <ConviteTeste codigo={teste[1]} />
  // Painel do administrador: o link existe para todos, mas só o servidor decide quem entra (JWT + allowlist).
  if (caminho === '/admin') return <Admin api={adminApi} />
  // Demonstração do app-modelo da barbearia (M32 d1): só em modo fixture (desenvolvimento ou VITE_FIXTURE=1). Em produção a rota não existe.
  if (caminho === '/modelo/barbearia' && modoFixture()) return <Suspense fallback={null}><AppBarbearia /></Suspense>
  // Demonstração do app-modelo do restaurante (M32 d2): mesma regra, só em modo fixture.
  if (caminho === '/modelo/restaurante' && modoFixture()) return <Suspense fallback={null}><AppRestaurante /></Suspense>
  // Demonstração do app-modelo da mercearia (M32 d3): mesma regra, só em modo fixture.
  if (caminho === '/modelo/mercearia' && modoFixture()) return <Suspense fallback={null}><AppMercearia /></Suspense>
  // Demonstração do app-modelo da academia (M32 d4): mesma regra, só em modo fixture.
  if (caminho === '/modelo/academia' && modoFixture()) return <Suspense fallback={null}><AppAcademia /></Suspense>
  // Textos legais públicos: privacidade, termos e licença do software.
  const legal = idLegalDoCaminho(caminho)
  if (legal) return <PaginaLegal id={legal} />
  // M31: /en, o domínio de fora (use-atlas-ai.com) ou a bandeirinha guardada abrem a página em inglês.
  if (caminho === '/' || caminho === '/en') {
    // Veio pela bandeirinha do outro domínio (?idioma=pt|en): guarda a escolha aqui também.
    const pedido = new URLSearchParams(window.location.search).get('idioma')
    if (pedido === 'pt' || pedido === 'en') guardarIdioma(pedido)
    return <PaginaVendas idioma={idiomaDaPagina({ caminho, host: window.location.hostname, cookie: lerCookieIdioma() })} />
  }
  return <PaginaVendas />
}
