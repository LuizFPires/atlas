import { useId } from 'react'
import { Microfone } from './Microfone'
import { useVoz } from './voz'
import './ui.css'

interface Props {
  rotulo: string
  obs?: string
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  ajuda?: string
  type?: 'text' | 'email'
  autoComplete?: string
  /** Como juntar o que foi falado ao que já está escrito (padrão: separa com espaço). */
  juntar?: (atual: string, falado: string) => string
  /** M31: campo da página em inglês (voz em inglês e avisos em inglês). */
  en?: boolean
}

/** Campo de texto com microfone: "tudo pode ser falado". A transcrição cai no campo e continua editável. */
export function CampoFalado({ rotulo, obs, valor, onChange, placeholder, ajuda, type = 'text', autoComplete, juntar, en = false }: Props) {
  const id = useId()
  const { gravando, alternar, suportado } = useVoz((falado) => onChange(juntar ? juntar(valor, falado) : [valor, falado].filter(Boolean).join(' ')), en ? 'en-US' : 'pt-BR')
  return (
    <div className="at-campo">
      <label htmlFor={id} className="at-campo-rotulo">{rotulo} {obs && <span>{obs}</span>}</label>
      <div className="at-campo-linha">
        <input id={id} type={type} value={valor} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
        <Microfone gravando={gravando} onAlternar={alternar} className="at-mic--campo" en={en} />
      </div>
      {!suportado && <span className="at-campo-ajuda">{en ? 'This browser can’t hear your voice. Just type instead.' : 'Este navegador não escuta a sua voz. Pode digitar normalmente.'}</span>}
      {ajuda && <span className="at-campo-ajuda">{ajuda}</span>}
    </div>
  )
}
