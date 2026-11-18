import { Monograma, NomeAtlas } from '../marca/Marca'
import { DOCS_LEGAIS, type IdLegal } from './textos-legais'
import { Markdown } from './Markdown'
import './web.css'

/** Links para os textos legais (rodapé, compra e cadastro). Em formulários abrem em outra aba para não perder o que foi digitado. */
export function LinksLegais({ novaAba = false }: { novaAba?: boolean }) {
  const alvo = novaAba ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <>
      <a href={DOCS_LEGAIS.termos.caminho} {...alvo}>Termos de uso</a>
      <a href={DOCS_LEGAIS.licenca.caminho} {...alvo}>Licença do software</a>
      <a href={DOCS_LEGAIS.privacidade.caminho} {...alvo}>Privacidade</a>
    </>
  )
}

/** Página pública de um texto legal (/privacidade, /termos, /licenca). */
export function PaginaLegal({ id }: { id: IdLegal }) {
  const doc = DOCS_LEGAIS[id]
  return (
    <div className="c">
      <header className="c-topo">
        <a href="/" aria-label="Voltar para o início" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        </a>
        <span>atlas-ia.app.br{doc.caminho}</span>
      </header>
      <main className="lg-main" aria-label={doc.titulo}>
        <article className="lg-texto"><Markdown texto={doc.md} /></article>
        <footer className="lg-rodape"><a href="/">Voltar ao início</a><span className="v-rodape-links"><LinksLegais /></span></footer>
      </main>
    </div>
  )
}
