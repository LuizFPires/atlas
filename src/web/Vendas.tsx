import type { ReactNode } from 'react'
import { Bolinha, Icone } from '../ui'
import { ImagemAssinatura, Monograma, NomeAtlas } from '../marca/Marca'
import { useTema } from '../tema/tema'
import { VendasAgentes } from './VendasAgentes'
import { VIDEO_URL, type SegmentoPronto } from './conteudo'
import { TEXTOS_VENDAS } from './textos-vendas'
import { BandeiraIdioma } from './BandeiraIdioma'
import { BandeiraBR, BandeiraUS } from './Bandeiras'
import type { Idioma } from '../i18n/idioma'
import { BlocoDegustacao } from './Degustacao'
import type { DegustacaoApi } from './degustacao-api'
import { LinksLegais } from './Legal'
import './web.css'

function Comprar({ onComprar, className = '', children }: { onComprar: () => void; className?: string; children: ReactNode }) {
  return <button type="button" className={`v-acao ${className}`} onClick={onComprar}>{children}</button>
}

/** Página de vendas (F00 em português, F00VendasEN em inglês — M31). `onComprar` abre a compra no gateway do cliente. */
export function Vendas({ onComprar, onComprarPronto, extra, degustacaoApi, idioma = 'pt' }: { onComprar: () => void; onComprarPronto?: (segmento: SegmentoPronto) => void; extra?: ReactNode; degustacaoApi?: DegustacaoApi; idioma?: Idioma }) {
  const { tema } = useTema()
  const T = TEXTOS_VENDAS[idioma]
  const en = idioma === 'en'
  return (
    <div className="v" lang={en ? 'en-US' : 'pt-BR'}>
      <header className="v-topo">
        <div className="v-logo"><Monograma fundo={tema} largura={46} altura={26} /><NomeAtlas fundo={tema} largura={112} altura={16} /></div>
        <nav aria-label={T.nav.secoes}>
          <a href="#pronto">{T.nav.pronto}</a>
          <a href="#como-funciona">{T.nav.como}</a>
          <a href="#recebe">{T.nav.recebe}</a>
          <a href="#preco">{T.nav.preco}</a>
          <a href="#duvidas">{T.nav.duvidas}</a>
        </nav>
        <BandeiraIdioma idioma={idioma} />
        <Comprar onComprar={onComprar} className="v-acao--pequeno">{T.queroOMeu}</Comprar>
      </header>

      <section className="v-hero">
        <span className="v-selo">{T.selo}</span>
        <h1>{T.titulo}</h1>
        <p>{T.apoio}</p>
        <div className="v-video">
          {VIDEO_URL ? (
            <iframe src={VIDEO_URL} title={T.videoTitulo} allow="fullscreen; picture-in-picture" loading="lazy" />
          ) : (
            <>
              <ImagemAssinatura alt={en ? 'A building going up on the Atlas 3D job site' : undefined} />
              <div className="v-video-meio">
                <span className="v-play"><Icone nome="play" tamanho={40} fill="currentColor" stroke="none" /></span>
                <b>{T.assista}</b>
                <span className="v-reservado">{T.videoReservado}</span>
              </div>
              <span className="v-duracao">2:00</span>
            </>
          )}
        </div>
        <div className="v-botoes">
          <Comprar onComprar={onComprar}>{T.construir} <Icone nome="seta" /></Comprar>
          <a className="v-acao v-acao--contorno" href="#exemplos">{T.verExemplos}</a>
        </div>
        <div className="v-plataformas" aria-label={`${T.plataformas.rotulo} Windows, Mac`}>
          <span className="v-mono">{T.plataformas.rotulo}</span>
          <span className="v-plataforma"><Icone nome="computador" tamanho={18} />Windows</span>
          <span className="v-plataforma"><Icone nome="notebook" tamanho={18} />Mac</span>
          <span className="v-plataformas-idiomas" role="img" aria-label={T.plataformas.extra}><BandeiraBR largura={26} /><BandeiraUS largura={26} /></span>
        </div>
      </section>

      <section className="v-tres">
        <div className="v-tres-cab"><h2>{T.tres.titulo} <span style={{ color: 'var(--lime-txt)' }}>{T.tres.destaque}</span></h2><span>{T.tres.apoio}</span></div>
        <div className="v-tres-grade">
          {T.tresPassos.map((p, i) => (
            <div key={p.nome} className="v-card v-passo">
              <span className="v-passo-disco"><Icone nome={p.icone} tamanho={22} /></span>
              <span className="v-passo-selo">{T.tres.passo(i + 1)}</span>
              <b>{p.nome}</b>
              <span className="v-passo-apoio">{p.apoio}</span>
            </div>
          ))}
          <div className="v-ia">
            <span className="v-ia-bola"><Icone nome="lua" tamanho={26} /></span>
            <div><span className="v-mono">{T.tres.ia}</span><b>{T.tres.iaTitulo}</b><span>{T.tres.iaApoio}</span></div>
          </div>
        </div>
      </section>

      <section id="exemplos" className="v-sec v-band">
        <div className="v-cab"><span className="v-mono">{T.exemplosCab.mono}</span><h2>{T.exemplosCab.titulo}</h2><p>{T.exemplosCab.texto}</p></div>
        <div className="v-grade4">
          {T.exemplos.map((x) => (
            <div key={x.nome} className="v-card"><Bolinha icone={x.icone} tamanho={44} /><b>{x.nome}</b><span>{x.txt}</span></div>
          ))}
        </div>
        <div className="v-formas">
          {T.formas.map((f) => <span key={f.txt} className="v-forma"><Icone nome={f.icone} tamanho={18} />{f.txt}</span>)}
        </div>
      </section>

      <section className="v-duas">
        <div>
          <span className="v-mono">{T.sobe.mono}</span>
          <h2>{T.sobe.titulo}</h2>
          <p>{T.sobe.texto}</p>
        </div>
        <div className="v-canteiro"><ImagemAssinatura alt={en ? 'A building going up on the Atlas 3D job site' : undefined} /></div>
      </section>

      <section id="pronto" className="v-sec">
        <div className="v-cab"><span className="v-mono">{T.pronto.mono}</span><h2>{T.pronto.titulo}</h2><p>{T.pronto.texto}</p></div>
        <div className="v-grade4">
          {T.prateleira.map((x) => (
            <div key={x.segmento} className="v-card v-pronto">
              <Bolinha icone={x.icone} tamanho={44} />
              <b>{x.nome}</b>
              <span>{x.txt}</span>
              <div className="v-pronto-preco"><b>{T.precoPronto.avista}</b><small>+ {T.precoPronto.mensalidade}{T.pronto.mes}</small></div>
              <button type="button" className="v-acao v-acao--pequeno" aria-label={T.pronto.aria(x.nome)} onClick={() => (onComprarPronto ?? onComprar)(x.segmento)}>{T.pronto.comecar} <Icone nome="seta" /></button>
            </div>
          ))}
        </div>
        <p className="v-pronto-aviso"><b>{T.pronto.avisoNegrito}</b> {T.pronto.aviso}</p>
      </section>

      <section id="como-funciona" className="v-sec v-band">
        <div className="v-cab"><span className="v-mono">{T.como.mono}</span><h2>{T.como.titulo}</h2><p>{T.como.texto}</p></div>
        <div className="v-grade5">
          {T.etapas.map((e) => (
            <div key={e.n} className="v-card" style={{ gap: 10 }}><span className="v-num v-num--p">{e.n}</span><b style={{ fontSize: 19 }}>{e.nome}</b><span>{e.txt}</span></div>
          ))}
        </div>
      </section>

      {/* M31: os agentes e o teste grátis ainda só existem em português; ficam fora do inglês até a linha de produção falar inglês. */}
      {!en && <VendasAgentes />}

      <section className="v-duas v-duas--igual">
        <div>
          <span className="v-mono">{T.fala.mono}</span>
          <h2>{T.fala.titulo}</h2>
          <p>{T.fala.texto}</p>
        </div>
        <div className="v-fala">
          <div className="v-fala-topo"><span className="v-fala-mic"><Icone nome="microfone" tamanho={26} /></span><span>{T.fala.ouvindo}</span></div>
          <q>{T.fala.citacao}</q>
          <span className="v-entendeu"><Icone nome="check" tamanho={16} />{T.fala.entendeu}</span>
        </div>
      </section>

      <section id="recebe" className="v-sec v-band v-recebe">
        <div>
          <span className="v-mono">{T.recebeCab.mono}</span>
          <h2>{T.recebeCab.titulo}</h2>
          {T.recebe.map((r) => (
            <div key={r.t} className="v-item"><span className="v-check"><Icone nome="check" tamanho={14} /></span><span><b>{r.t}</b> <span className="v-mute">{r.d}</span></span></div>
          ))}
        </div>
        <div id="preco" className="v-preco">
          <span className="v-mono">{T.preco.mono}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <small>{T.preco.implantacao}</small>
            <span className="v-preco-valor">{T.preco.valorImplantacao}</span>
            <small>{T.preco.formas}</small>
          </div>
          <div className="v-linha" />
          <div className="v-mensal"><span>{T.preco.mensal}</span><b>{T.preco.valorMensal}<small>{T.preco.mes}</small></b></div>
          <small style={{ lineHeight: 1.5, fontSize: 14 }}>{T.preco.inclui}</small>
          <div className="v-aviso" role="note" aria-label={T.avisoClaude.aria}><b>{T.avisoClaude.titulo}.</b> {T.avisoClaude.texto}</div>
          <Comprar onComprar={onComprar}>{T.construir} <Icone nome="seta" /></Comprar>
        </div>
      </section>

      <section className="v-sec">
        <div className="v-cab"><span className="v-mono">{T.quem.mono}</span><h2>{T.quem.titulo}</h2></div>
        <div className="v-quem">
          <div>
            <h3><Icone nome="check" className="v-ic-sim" />{T.quem.sim}</h3>
            {T.ehParaVoce.map((t) => <div key={t} className="v-item"><Icone nome="check" tamanho={18} className="v-ic-sim" /><span>{t}</span></div>)}
          </div>
          <div className="v-nao">
            <h3><Icone nome="x" className="v-ic-nao" />{T.quem.nao}</h3>
            {T.naoEhParaVoce.map((t) => <div key={t} className="v-item"><Icone nome="x" tamanho={18} className="v-ic-nao" /><span>{t}</span></div>)}
          </div>
        </div>
      </section>

      <section id="duvidas" className="v-sec">
        <div className="v-cab"><span className="v-mono">{T.duvidasCab.mono}</span><h2>{T.duvidasCab.titulo}</h2></div>
        <div className="v-faq">
          {T.duvidas.map((q) => <div key={q.p} className="v-card"><b>{q.p}</b><span>{q.r}</span></div>)}
        </div>
        <div className="v-depo">{T.depoimentos}</div>
      </section>

      {!en && <BlocoDegustacao api={degustacaoApi} />}

      <section className="v-final">
        <div><h2>{T.final.titulo}</h2><span>{T.final.apoio}</span></div>
        <Comprar onComprar={onComprar} className="v-acao--escuro">{T.construir} <Icone nome="seta" /></Comprar>
      </section>

      <footer className="v-rodape">
        <Monograma fundo={tema} largura={34} altura={19} />
        <span>{T.rodape.empresa}</span>
        <span className="v-rodape-links"><LinksLegais idioma={idioma} /><a href="mailto:contato@atlas-ia.app.br">{T.rodape.contato}</a>{!en && <a href="/admin">Admin</a>}</span>
      </footer>
      {extra}
    </div>
  )
}
