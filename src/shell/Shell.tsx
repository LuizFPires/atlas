import { useState, type ReactNode } from 'react'
import { Icone, type NomeIcone } from '../ui'
import { useTema } from '../tema/tema'
import { Monograma, NomeAtlas } from '../marca/Marca'
import './shell.css'

export type IdTela = 'obras' | 'canteiro' | 'concluidas' | 'prototipo' | 'obra' | 'cronograma' | 'posobra' | 'retomar' | 'ajuda'

/** Menu (Milestone 37, aprovado pelo Luiz em 23/11/2026): tudo de uma obra mora dentro dela. Protótipo, Obra, Pós-obra e Como
 *  retomar saíram do menu: são telas DENTRO da obra (o menu acende "Canteiro de obras" enquanto elas estão abertas). */
export const ITENS_MENU: { id: Exclude<IdTela, 'ajuda'>; nome: string; icone: NomeIcone }[] = [
  { id: 'obras', nome: 'Nova obra', icone: 'mais' },
  { id: 'canteiro', nome: 'Canteiro de obras', icone: 'obra' },
  { id: 'concluidas', nome: 'Obras concluídas', icone: 'check' },
]

/** Menu recolhido por padrão (Luiz, 24/11/2026); a escolha da pessoa fica guardada neste computador. */
const CHAVE_MENU = 'atlas:menu:aberto'
const lerAberto = () => { try { return localStorage.getItem(CHAVE_MENU) === '1' } catch { return false } }
/** "Faltam 5 dias" → "5d" (o prazo continua à vista com o menu recolhido). */
const diasCurto = (titulo: string) => { const m = /(\d+)\s*dia/.exec(titulo); return m ? `${m[1]}d` : '!' }

/** Qual item do menu acende: as telas de dentro da obra acendem o Canteiro. */
export const itemDoMenu = (t: IdTela): IdTela => (t === 'prototipo' || t === 'obra' || t === 'cronograma' || t === 'posobra' || t === 'retomar' ? 'canteiro' : t)

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
  /** Claude não conectado: o cartão do plano ganha o botão "Conectar o Claude". */
  onConectarClaude?: () => void
  /** Modelo do Claude (um só para todo o Atlas). Sem ele, o seletor não aparece. */
  modelo?: { atual: string; lista: { id: string; nome: string; explica: string; recomendado: boolean }[]; escolher(id: string): void } | null
  /** Com teste/cortesia: abre a compra de dentro do Atlas. Sem ele o botão não aparece. */
  onComprar?: () => void
  /** Faixa no topo do conteúdo (ex.: "Nova versão do Atlas pronta"). */
  topo?: ReactNode
  children?: ReactNode
}

/** Menu lateral sempre escuro, com um botão fixo só: "Falar com o Atlas" (abre a Ajuda já ouvindo; decisão no PLAN, M13). */
export function Shell({ ativo, onNavegar, onFalar, licenca, plano, modelo, onComprar, onConectarClaude, topo, children }: Props) {
  const { tema } = useTema()
  const [aberto, setAberto] = useState(lerAberto)
  const alternar = () => setAberto((a) => { try { localStorage.setItem(CHAVE_MENU, a ? '0' : '1') } catch { /* sem armazenamento */ } return !a })
  return (
    <div className={`at-shell${aberto ? '' : ' at-shell--recolhida'}`}>
      <aside className={`at-lateral${aberto ? '' : ' at-lateral--recolhida'}`}>
        <div className="at-lateral__marca">
          <Monograma fundo={tema === 'claro' ? 'claro' : 'escuro'} />
          <span className="at-lateral__texto"><NomeAtlas fundo="escuro" /></span>
        </div>
        <button type="button" className="at-lateral__alternar" onClick={alternar} aria-expanded={aberto} aria-label={aberto ? 'Recolher o menu' : 'Abrir o menu'} title={aberto ? 'Recolher o menu' : 'Abrir o menu'}>
          <Icone nome="chevron" tamanho={18} />
        </button>
        <nav className="at-lateral__nav" aria-label="Menu principal">
          {ITENS_MENU.map((i) => (
            <a key={i.id} href={`#/${i.id}`} className={`at-item ${itemDoMenu(ativo) === i.id ? 'at-item--ativo' : ''}`} aria-current={itemDoMenu(ativo) === i.id ? 'page' : undefined}
              title={i.nome} onClick={(e) => { e.preventDefault(); onNavegar(i.id) }}>
              <Icone nome={i.icone} tamanho={20} />
              <span className="at-lateral__texto">{i.nome}</span>
            </a>
          ))}
        </nav>
        <div className="at-lateral__fixo">
          <button type="button" className="at-falar" onClick={onFalar} title="Falar com o Atlas">
            <Icone nome="microfone" />
            <span className="at-lateral__texto">Falar com o Atlas</span>
          </button>
          {plano && (
            <div className="at-plano">
              <span className="rotulo at-plano__rotulo">Plano Claude</span>
              <span className="at-plano__valor">{plano.valor}</span>
              <span className="at-plano__sub">{plano.sub}</span>
              {plano.valor === 'Não conectado' && onConectarClaude && <button type="button" className="at-plano__conectar" onClick={onConectarClaude}>Conectar o Claude</button>}
              {modelo && (
                <label className="at-plano__modelo">
                  <span className="at-plano__modelo-rot">Modelo</span>
                  <select aria-label="Modelo do Claude" value={modelo.atual} title={modelo.lista.find((m) => m.id === modelo.atual)?.explica} onChange={(e) => modelo.escolher(e.target.value)}>
                    {modelo.lista.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.recomendado ? ' (recomendado)' : ''}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {licenca && licenca.estado !== 'ativa' ? (
            <div className={`at-teste ${licenca.estado === 'vencida' ? 'at-teste--vencido' : ''}`} role="status" aria-label="Seu acesso ao Atlas" title={`${licenca.rotulo}: ${licenca.titulo}`}>
              <span className="at-teste__curto" aria-hidden="true">{diasCurto(licenca.titulo)}</span>
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
      <main className="at-conteudo">{topo}{children}</main>
    </div>
  )
}
