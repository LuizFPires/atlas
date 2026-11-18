import { Icone, type NomeIcone } from './Icone'
import './ui.css'

export function Bolinha({ icone, tamanho = 44 }: { icone: NomeIcone; tamanho?: number }) {
  return (
    <span className="at-bolinha" style={{ width: tamanho, height: tamanho }}>
      <Icone nome={icone} tamanho={Math.round(tamanho * 0.5)} />
    </span>
  )
}
