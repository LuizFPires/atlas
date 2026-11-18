import { useState } from 'react'
import { Botao, Icone } from '../ui'
import { RECADO } from './trazer-dados'
import './trazer.css'

interface Props {
  onVoltar: () => void
}

/** F06c: trazer um protótipo feito em outra IA. Passo 1: o recado pronto para copiar e mandar na outra conversa. */
export function TrazerPrototipo({ onVoltar }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [aviso, setAviso] = useState('')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(RECADO)
      setCopiado(true)
      setAviso('')
    } catch {
      setCopiado(false)
      setAviso('Não consegui copiar sozinho. Selecione o texto do recado, copie e cole na outra conversa.')
    }
  }

  return (
    <div className="at-trazer">
      <div className="at-trazer__col">
        <header className="at-trazer__cab">
          <span className="at-trazer__rotulo">NOVA OBRA · JÁ TENHO UM PROTÓTIPO</span>
          <h1>Fez o protótipo em outra IA? Traga para cá.</h1>
          <span>Vale protótipo feito no Claude, no ChatGPT, no Codex, no Lovable ou em qualquer outra. São 3 passos.</span>
        </header>

        <section className="at-trazer__card" aria-label="Passo 1: o recado">
          <div className="at-trazer__passo"><span className="at-trazer__bola">1</span><b>Copie este recado e mande na conversa onde você fez o protótipo</b></div>
          <pre className="at-trazer__recado" tabIndex={0} aria-label="Recado para a outra IA">{RECADO}</pre>
          <div className="at-trazer__linha">
            <button type="button" className="at-trazer__copiar" onClick={copiar}>
              {copiado && <Icone nome="check" tamanho={16} />}{copiado ? 'Copiado' : 'Copiar recado'}
            </button>
            <span>A IA vai te devolver um arquivo .zip e um link do protótipo no ar.</span>
          </div>
          {aviso && <p className="at-nova__erro" role="alert">{aviso}</p>}
        </section>

        <div className="at-trazer__rodape">
          <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
        </div>
      </div>
    </div>
  )
}
