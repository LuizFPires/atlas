import { useState } from 'react'
import { Shell, type IdTela } from './shell/Shell'
import { ImagemAssinatura } from './marca/Marca'

export default function App() {
  const [ativo, setAtivo] = useState<IdTela>('obras')
  return (
    <Shell ativo={ativo} onNavegar={setAtivo} onFalar={() => {}}>
      <p className="rotulo">Minhas obras</p>
      <h1>Bem-vindo ao Atlas</h1>
      <ImagemAssinatura />
    </Shell>
  )
}
