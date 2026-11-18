import { Botao } from '../ui'
import './obras.css'

/** Ponto de encaminhamento do "Já tenho um protótipo". O fluxo de verdade (F06c: recado para outra IA, receber o prototipo-atlas.zip e conferir) é do milestone 15. */
export function TrazerPrototipo({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="at-obras">
      <header className="at-obras__cab">
        <span className="at-obras__rotulo">TRAZER UM PROTÓTIPO</span>
        <h1>Que bom que você já começou.</h1>
      </header>
      <p className="at-nova__dica">Esta parte ainda está sendo preparada. Em breve você vai poder trazer o protótipo que fez em outra ferramenta e o Claude continua de onde você parou.</p>
      <div><Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao></div>
    </div>
  )
}
