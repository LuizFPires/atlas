import { Botao } from '../ui'

/** Tela calma para itens do menu que dependem de uma obra (ou de uma obra parada) quando não há nenhuma. Nunca cai no "Bem-vindo". */
export function SemObra({ rotulo, titulo, texto, onIrObras }: { rotulo: string; titulo: string; texto: string; onIrObras: () => void }) {
  return (
    <section className="at-sem-obra" aria-label={titulo}>
      <p className="rotulo">{rotulo}</p>
      <h1>{titulo}</h1>
      <p className="c-mute" style={{ maxWidth: 620, lineHeight: 1.6 }}>{texto}</p>
      <Botao onClick={onIrObras}>Ir para Minhas obras →</Botao>
    </section>
  )
}
