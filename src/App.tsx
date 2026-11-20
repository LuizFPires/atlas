import { lazy, Suspense, useState } from 'react'
import { Shell, type IdTela } from './shell/Shell'
import { ImagemAssinatura } from './marca/Marca'
import { Vendas } from './web/Vendas'
import { ModalCompra } from './web/ModalCompra'
import { BannerCookies } from './web/Cookies'
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
import { criarAdminApi } from './web/admin-api'
import { PaginaLegal } from './web/Legal'
import { idLegalDoCaminho } from './web/textos-legais'
import { AppDesktop, noAppDesktop } from './app/AppDesktop'
// App-modelo carregado sob demanda: não pesa no bundle principal.
const AppBarbearia = lazy(() => import('./modelos/barbearia/AppBarbearia').then((m) => ({ default: m.AppBarbearia })))
const AppRestaurante = lazy(() => import('./modelos/restaurante/AppRestaurante').then((m) => ({ default: m.AppRestaurante })))
const AppMercearia = lazy(() => import('./modelos/mercearia/AppMercearia').then((m) => ({ default: m.AppMercearia })))
const AppAcademia = lazy(() => import('./modelos/academia/AppAcademia').then((m) => ({ default: m.AppAcademia })))

const portalApi = criarPortalApi()
const adminApi = criarAdminApi()
// Personalização do app pronto (M32 b): em produção grava pela rota /portal/personalizacao (escopada pelo login).
const personalizacao = modoFixture() ? criarPersonalizacaoFixture() : criarPersonalizacaoPortal(portalApi)
// Status das obras no celular (M30 relay): em produção lê o resumo que o computador publicou, pela rota /portal/obras
// (escopada pelo login). Enquanto o computador não publicou, a lista vem vazia e a seção explica isso com jeito.
const statusObras = modoFixture() ? criarStatusObrasFixture() : criarStatusObrasPortal(portalApi)

/** O aplicativo (PWA) fica em "/app". */
function Aplicativo() {
  const [ativo, setAtivo] = useState<IdTela>('obras')
  return (
    <Shell ativo={ativo} onNavegar={setAtivo} onFalar={() => {}}>
      <p className="rotulo">Minhas obras</p>
      <h1>Bem-vindo ao Atlas</h1>
      <ImagemAssinatura />
    </Shell>
  )
}

function PaginaVendas() {
  const [comprando, setComprando] = useState(false)
  const [segmento, setSegmento] = useState<string | undefined>()
  return (
    <>
      <Vendas onComprar={() => { setSegmento(undefined); setComprando(true) }} onComprarPronto={(s) => { setSegmento(s); setComprando(true) }} />
      <ModalCompra aberto={comprando} segmento={segmento} onFechar={() => setComprando(false)} />
      <BannerCookies />
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
  // Depois da compra de um app pronto: cadastro -> /personalizar (login, configurador, entrega). A implantação do zero não passa por aqui.
  if (caminho === '/personalizar') return <PassoApp api={portalApi} porta={personalizacao} />
  // Portal do cliente: login próprio do Atlas, separado do login do Claude.
  if (caminho === '/conta') return <Portal api={portalApi} obras={statusObras} />
  // Link de confirmação do teste grátis (vem no e-mail).
  if (caminho === '/degustacao') return <ConfirmarDegustacao />
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
  return <PaginaVendas />
}
