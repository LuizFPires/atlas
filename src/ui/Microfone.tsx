import { Icone } from './Icone'
import './ui.css'

/** Botão de microfone: vermelho e pulsando enquanto grava. A transcrição editável fica no campo que o usa. */
export function Microfone({ gravando, onAlternar }: { gravando: boolean; onAlternar: () => void }) {
  return (
    <button type="button" className={`at-mic ${gravando ? 'at-mic--gravando' : ''}`} aria-pressed={gravando} aria-label={gravando ? 'Parar de gravar' : 'Falar'} onClick={onAlternar}>
      <Icone nome="microfone" />
    </button>
  )
}
