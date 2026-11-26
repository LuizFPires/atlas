import { Monograma, NomeAtlas } from '../marca/Marca'
import { docsLegais, type IdLegal } from './textos-legais'
import { Markdown } from './Markdown'
import './web.css'

/** Links para os textos legais (rodapé, compra e cadastro). Em formulários abrem em outra aba para não perder o que foi digitado. */
export function LinksLegais({ novaAba = false, idioma = 'pt' }: { novaAba?: boolean; idioma?: 'pt' | 'en' }) {
  const alvo = novaAba ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  // M31: em inglês, os textos em inglês (tradução em revisão jurídica; o próprio texto avisa que o original prevalece).
  const en = idioma === 'en'
  const d = docsLegais(idioma)
  return (
    <>
      <a href={d.termos.caminho} {...alvo}>{en ? 'Terms of use' : 'Termos de uso'}</a>
      <a href={d.licenca.caminho} {...alvo}>{en ? 'Software license' : 'Licença do software'}</a>
      <a href={d.privacidade.caminho} {...alvo}>{en ? 'Privacy' : 'Privacidade'}</a>
    </>
  )
}

/** Página pública de um texto legal (/privacidade, /termos, /licenca e, em inglês, /en/privacy, /en/terms, /en/license). */
export function PaginaLegal({ id, idioma = 'pt' }: { id: IdLegal; idioma?: 'pt' | 'en' }) {
  const doc = docsLegais(idioma)[id]
  const en = idioma === 'en'
  return (
    <div className="c" lang={en ? 'en-US' : undefined}>
      <header className="c-topo">
        <a href={en ? '/en' : '/'} aria-label={en ? 'Back to the home page' : 'Voltar para o início'} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        </a>
        <span>{en ? 'use-atlas-ai.com' : 'atlas-ia.app.br'}{doc.caminho.replace(/^\/en/, '')}</span>
      </header>
      <main className="lg-main" aria-label={doc.titulo}>
        <article className="lg-texto"><Markdown texto={doc.md} /></article>
        <footer className="lg-rodape"><a href={en ? '/en' : '/'}>{en ? 'Back to home' : 'Voltar ao início'}</a><span className="v-rodape-links"><LinksLegais idioma={idioma} /></span></footer>
      </main>
    </div>
  )
}
