import { BandeiraBR, BandeiraUS } from './Bandeiras'
import { DOMINIO_FORA, guardarIdioma, type Idioma } from '../i18n/idioma'

// Bandeirinhas do idioma na página de vendas (M31, protótipo F00/F00VendasEN aprovado pelo Luiz em 26/11/2026).
// A escolha fica guardada e vale mais que a localização; depois da compra o idioma não muda mais.

const noDominioDeFora = (host: string) => host === DOMINIO_FORA || host === `www.${DOMINIO_FORA}`

export function enderecoDoIdioma(i: Idioma, host: string): string {
  if (noDominioDeFora(host.toLowerCase())) return i === 'en' ? '/' : 'https://atlas-ia.app.br/?idioma=pt'
  return i === 'en' ? '/en' : '/'
}

export function BandeiraIdioma({ idioma }: { idioma: Idioma }) {
  const host = typeof window === 'undefined' ? '' : window.location.hostname
  const item = (i: Idioma, rotulo: string, curto: string) => (
    <a href={enderecoDoIdioma(i, host)} lang={i === 'en' ? 'en-US' : 'pt-BR'} aria-label={rotulo} aria-current={idioma === i ? 'true' : 'false'}
      className={`v-bandeira ${idioma === i ? 'v-bandeira--ativa' : ''}`} onClick={() => guardarIdioma(i)}>
      {i === 'en' ? <BandeiraUS /> : <BandeiraBR />}{curto}
    </a>
  )
  return (
    <div className="v-bandeiras" role="group" aria-label="Idioma / Language">
      {item('pt', 'Português (Brasil)', 'PT')}
      {item('en', 'English (US)', 'EN')}
    </div>
  )
}
