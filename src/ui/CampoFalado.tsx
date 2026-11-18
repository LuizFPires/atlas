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
}

/** Campo de texto com microfone: "tudo pode ser falado". A transcrição cai no campo e continua editável. */
export function CampoFalado({ rotulo, obs, valor, onChange, placeholder, ajuda, type = 'text', autoComplete, juntar }: Props) {
  const id = useId()
  const { gravando, alternar, suportado } = useVoz((falado) => onChange(juntar ? juntar(valor, falado) : [valor, falado].filter(Boolean).join(' ')))
  return (
    <div className="at-campo">
      <label htmlFor={id} className="at-campo-rotulo">{rotulo} {obs && <span>{obs}</span>}</label>
      <div className="at-campo-linha">
        <input id={id} type={type} value={valor} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
        <Microfone gravando={gravando} onAlternar={alternar} className="at-mic--campo" />
      </div>
      {!suportado && <span className="at-campo-ajuda">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
      {ajuda && <span className="at-campo-ajuda">{ajuda}</span>}
    </div>
  )
}
