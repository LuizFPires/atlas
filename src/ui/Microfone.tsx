import { Icone } from './Icone'
import './ui.css'

/** Botão de microfone: vermelho e pulsando enquanto grava. A transcrição editável fica no campo que o usa. */
export function Microfone({ gravando, onAlternar, className = '', en = false }: { gravando: boolean; onAlternar: () => void; className?: string; en?: boolean }) {
  return (
    <button type="button" className={`at-mic ${gravando ? 'at-mic--gravando' : ''} ${className}`} aria-pressed={gravando} aria-label={en ? (gravando ? 'Stop recording' : 'Speak') : gravando ? 'Parar de gravar' : 'Falar'} onClick={onAlternar}>
      <Icone nome="microfone" />
    </button>
  )
}
