import { Icone } from '../ui'
import { ROTULO_QUEM, type ItemSite, type PassoConta } from './contas-passos'
import './claude.css'
import './contas.css'

function ItemDoSite({ i }: { i: ItemSite }) {
  return (
    <div className="at-claude__item">
      <div className={`at-claude__${i.tipo} ${i.destaque ? 'at-claude__hl' : ''}`}>{i.txt}</div>
      {i.destaque && <span className="at-claude__dica-hl"><Icone nome="seta" tamanho={14} /> {i.dica}</span>}
    </div>
  )
}

/** Cartão do passo: barra de progresso, o que fazer, selo de quem faz (VOCÊ ou O ATLAS), palavra em inglês traduzida e o tom calmo. */
export function CartaoPasso({ passo, n, total }: { passo: PassoConta; n: number; total: number }) {
  const pct = Math.round((n / total) * 100)
  return (
    <div className="at-claude__passo" aria-live="polite">
      <div className="at-claude__prog">
        <span className="at-claude__prog-n">PASSO {n} DE {total}</span>
        <div className="at-ativ__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <span className={`at-contas__selo at-contas__selo--${passo.quem}`} aria-label={`Quem faz este passo: ${ROTULO_QUEM[passo.quem]}`}>{ROTULO_QUEM[passo.quem]}</span>
      </div>
      <span className="at-claude__faca">{passo.faca}</span>
      {passo.en && (
        <span className="at-claude__palavra"><Icone nome="ajuda" tamanho={16} /> <b>{passo.en}</b> quer dizer <b>&quot;{passo.pt}&quot;</b></span>
      )}
      <span className="at-ativ__txt">{passo.calma}</span>
    </div>
  )
}

/** Imagem do site com o botão certo piscando (é a imagem que o cliente vai ver no navegador dele). */
export function PreviaSite({ site }: { site: PassoConta['site'] }) {
  return (
    <div className="at-claude__previa">
      <span className="at-claude__previa-rotulo">É assim que vai aparecer na sua tela:</span>
      <div className="at-claude__janela" role="img" aria-label={`Imagem do site ${site.url}: ${site.titulo}`}>
        <div className="at-claude__barra-topo"><i /><i /><i /><span className="at-claude__url">{site.url}</span></div>
        <div className="at-claude__site">
          <b>{site.titulo}</b>
          {site.itens.map((i) => <ItemDoSite key={i.txt} i={i} />)}
        </div>
      </div>
    </div>
  )
}
