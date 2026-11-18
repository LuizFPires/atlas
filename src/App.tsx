import { useState } from 'react'
import { Shell, type IdTela } from './shell/Shell'
import { ImagemAssinatura } from './marca/Marca'
import { Vendas } from './web/Vendas'
import { ModalCompra } from './web/ModalCompra'
import { BannerCookies } from './web/Cookies'
import { Cadastro } from './web/Cadastro'
import { enviarCadastro } from './web/cadastro-api'
import { Portal } from './web/Portal'
import { criarPortalApi } from './web/portal-api'

const portalApi = criarPortalApi()

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
  return (
    <>
      <Vendas onComprar={() => setComprando(true)} />
      <ModalCompra aberto={comprando} onFechar={() => setComprando(false)} />
      <BannerCookies />
    </>
  )
}

/** Rotas por endereço: "/" é a página de vendas. */
export default function App() {
  const caminho = window.location.pathname.replace(/\/+$/, '') || '/'
  if (caminho.startsWith('/app')) return <Aplicativo />
  // A Stripe devolve o comprador em /compra/sucesso; /comecar é o endereço público do cadastro.
  if (caminho === '/comecar' || caminho === '/compra/sucesso') return <Cadastro onEnviar={enviarCadastro} />
  // Portal do cliente: login próprio do Atlas, separado do login do Claude.
  if (caminho === '/conta') return <Portal api={portalApi} />
  return <PaginaVendas />
}
