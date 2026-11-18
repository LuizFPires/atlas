import { useState } from 'react'
import { Shell, type IdTela } from './shell/Shell'
import { ImagemAssinatura } from './marca/Marca'
import { Vendas } from './web/Vendas'

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

/** Rotas por endereço: "/" é a página de vendas. */
export default function App() {
  const caminho = window.location.pathname.replace(/\/+$/, '') || '/'
  if (caminho.startsWith('/app')) return <Aplicativo />
  return <Vendas onComprar={() => document.getElementById('preco')?.scrollIntoView({ behavior: 'smooth' })} />
}
