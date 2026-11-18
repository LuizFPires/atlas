import type { ReactNode } from 'react'
import { Icone } from '../ui'
import { useTema } from '../tema/tema'
import { Monograma, NomeAtlas } from '../marca/Marca'
import './shell.css'

export type IdTela = 'obras' | 'prototipo' | 'obra' | 'posobra' | 'retomar' | 'ajuda'

export const ITENS_MENU: { id: Exclude<IdTela, 'ajuda'>; nome: string }[] = [
  { id: 'obras', nome: 'Minhas obras' },
  { id: 'prototipo', nome: 'Protótipo' },
  { id: 'obra', nome: 'Obra' },
  { id: 'posobra', nome: 'Pós-obra' },
  { id: 'retomar', nome: 'Como retomar' },
]

type Props = {
  ativo: IdTela
  onNavegar: (id: IdTela) => void
  onFalar: () => void
  children?: ReactNode
}

/** Menu lateral sempre escuro, com "Falar com o Atlas" e "Ajuda do Atlas" fixos (prototipo/Shell.dc.html). */
export function Shell({ ativo, onNavegar, onFalar, children }: Props) {
  const { tema } = useTema()
  return (
    <div className="at-shell">
      <aside className="at-lateral">
        <div className="at-lateral__marca">
          <Monograma fundo={tema === 'claro' ? 'claro' : 'escuro'} />
          <NomeAtlas fundo="escuro" />
        </div>
        <nav className="at-lateral__nav" aria-label="Menu principal">
          {ITENS_MENU.map((i) => (
            <a key={i.id} href={`#/${i.id}`} className={`at-item ${ativo === i.id ? 'at-item--ativo' : ''}`} aria-current={ativo === i.id ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); onNavegar(i.id) }}>
              <span className="at-item__marca" />
              {i.nome}
            </a>
          ))}
        </nav>
        <div className="at-lateral__fixo">
          <button type="button" className="at-falar" onClick={onFalar}>
            <Icone nome="microfone" />
            Falar com o Atlas
          </button>
          <a href="#/ajuda" className={`at-ajuda ${ativo === 'ajuda' ? 'at-ajuda--ativo' : ''}`} aria-current={ativo === 'ajuda' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); onNavegar('ajuda') }}>
            <Icone nome="ajuda" tamanho={18} />
            Ajuda do Atlas
          </a>
          <div className="at-plano">
            <span className="rotulo at-plano__rotulo">Plano Claude</span>
            <span className="at-plano__valor">Pro · 64% da cota</span>
            <span className="at-plano__sub">Renova hoje, 14h.</span>
          </div>
          <div className="at-licenca"><span className="at-licenca__ponto" />Licença ativa · este computador</div>
        </div>
      </aside>
      <main className="at-conteudo">{children}</main>
    </div>
  )
}
