// O quadro negro do protótipo (P4, aprovado pelo Luiz em 24/11/2026: "dashboard gigante, como se fosse um grande quadro negro").
// Todas as telas lado a lado, em tamanho real reduzido, numeradas. Tocar no número marca a tela para o pedido ("TELA 2");
// tocar na tela abre o sistema em tela cheia a partir dela (o Play). O HTML de cada tela só vive em iframe com sandbox vazio.
import { useState } from 'react'
import { Icone } from '../ui'
import { aparelhoDaTela, montarSrcDoc, SANDBOX_PREVIEW, type TelaDesenhada } from './ponte-prototipo'
import { ALTURA_CELULAR, ALTURA_COMPUTADOR, LARGURA_CELULAR, LARGURA_COMPUTADOR } from './tamanhos-tela'

export const ZOOMS = [0.3, 0.4, 0.55, 0.75, 1] as const

interface Props {
  telas: TelaDesenhada[]
  /** Tela marcada para o pedido (o número aceso). */
  marcada: string | null
  onMarcar: (id: string | null) => void
  onUsar: (id: string) => void
}

export function QuadroDeTelas({ telas, marcada, onMarcar, onUsar }: Props) {
  const [z, setZ] = useState(1) // índice em ZOOMS: começa em 40%
  const zoom = ZOOMS[z]
  return (
    <section className="at-quadro" aria-label="Quadro de telas">
      <div className="at-quadro__zoom" role="group" aria-label="Tamanho das telas">
        <button type="button" aria-label="Diminuir" disabled={z === 0} onClick={() => setZ((v) => Math.max(0, v - 1))}><Icone nome="zoom-menos" tamanho={16} /></button>
        <span role="status" aria-label="Zoom do quadro">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Aumentar" disabled={z === ZOOMS.length - 1} onClick={() => setZ((v) => Math.min(ZOOMS.length - 1, v + 1))}><Icone nome="zoom-mais" tamanho={16} /></button>
      </div>
      <ol className="at-quadro__palco">
        {telas.map((t, i) => {
          const pc = aparelhoDaTela(t) === 'computador'
          const w = pc ? LARGURA_COMPUTADOR : LARGURA_CELULAR
          const h = pc ? ALTURA_COMPUTADOR : ALTURA_CELULAR
          const doc = montarSrcDoc(t.html)
          const on = marcada === t.id
          return (
            <li key={t.id} className="at-quadro__item">
              <button type="button" className={`at-quadro__num${on ? ' at-quadro__num--on' : ''}`} aria-label={`Tela ${i + 1} · ${t.nome}`} aria-pressed={on}
                onClick={() => onMarcar(on ? null : t.id)} title="Marcar esta tela para pedir uma mudança">
                <b>{i + 1}</b><span>{t.nome}</span>
              </button>
              <div className={`at-quadro__moldura${pc ? ' at-quadro__moldura--pc' : ''}${on ? ' at-quadro__moldura--on' : ''}`} style={{ width: w * zoom, height: h * zoom }}>
                {doc === null
                  ? <div className="at-proto__seguro" role="img" aria-label="Tela grande demais para mostrar">Tela grande demais para mostrar aqui.</div>
                  : <iframe title={`Tela ${i + 1}: ${t.nome}`} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer" tabIndex={-1}
                      style={{ width: w, height: h, transform: `scale(${zoom})` }} />}
                <button type="button" className="at-quadro__abrir" aria-label={`Usar o sistema a partir da tela ${i + 1}`} onClick={() => onUsar(t.id)} />
              </div>
              {t.origem && <em className="at-proto__origem">VEIO DA ABA {t.origem.toLocaleUpperCase('pt-BR')}</em>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
