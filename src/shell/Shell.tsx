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

/** Cartão da licença na lateral. 'ativa' = a linha de sempre; 'contando'/'vencida' = teste grátis ou cortesia com prazo. */
export type LicencaNoMenu =
  | { estado: 'ativa'; entrega?: string }
  | { estado: 'contando' | 'vencida'; rotulo: string; titulo: string; sub: string | null }

type Props = {
  ativo: IdTela
  onNavegar: (id: IdTela) => void
  onFalar: () => void
  /** Sem este dado (ou com licença paga) a lateral mostra "Licença ativa". Nunca inventar prazo aqui. */
  licenca?: LicencaNoMenu
  /** O que o app leu do Claude do cliente (assinatura). Sem leitura, o cartão não aparece. */
  plano?: { valor: string; sub: string } | null
  /** Com teste/cortesia: abre a compra de dentro do Atlas. Sem ele o botão não aparece. */
  onComprar?: () => void
  children?: ReactNode
}

/** Menu lateral sempre escuro, com "Falar com o Atlas" e "Ajuda do Atlas" fixos (prototipo/Shell.dc.html). */
export function Shell({ ativo, onNavegar, onFalar, licenca, plano, onComprar, children }: Props) {
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
          {plano && (
            <div className="at-plano">
              <span className="rotulo at-plano__rotulo">Plano Claude</span>
              <span className="at-plano__valor">{plano.valor}</span>
              <span className="at-plano__sub">{plano.sub}</span>
            </div>
          )}
          {licenca && licenca.estado !== 'ativa' ? (
            <div className={`at-teste ${licenca.estado === 'vencida' ? 'at-teste--vencido' : ''}`} role="status" aria-label="Seu acesso ao Atlas">
              <span className="rotulo at-teste__rotulo">{licenca.rotulo}</span>
              <span className="at-teste__titulo">{licenca.titulo}</span>
              {licenca.sub && <span className="at-teste__sub">{licenca.sub}</span>}
              {onComprar && <button type="button" className="at-teste__comprar" onClick={onComprar}>Quero o Atlas</button>}
            </div>
          ) : (
            <div className="at-licenca">
              <span className="at-licenca__linha"><span className="at-licenca__ponto" />Licença ativa · este computador</span>
              {licenca?.estado === 'ativa' && licenca.entrega && <span className="at-licenca__entrega">{licenca.entrega}</span>}
            </div>
          )}
        </div>
      </aside>
      <main className="at-conteudo">{children}</main>
    </div>
  )
}
