// O quadro negro do protótipo (P4, aprovado pelo Luiz em 24/11/2026: "dashboard gigante, como se fosse um grande quadro negro").
// Todas as telas lado a lado, em tamanho real reduzido, numeradas. Tocar no número marca a tela para o pedido ("TELA 2");
// tocar na tela abre o sistema em tela cheia a partir dela (o Play). O HTML de cada tela só vive em iframe com sandbox vazio.
import { useEffect, useRef, useState } from 'react'
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

/** Quais telas estão perto da área visível (Luiz, 24/11/2026: o protótipo cresce além de 40 telas e "não pode travar").
 *  Só essas viram iframe; as outras ficam como um aparelho vazio com o nome. Sem IntersectionObserver: todas. */
function useTelasVisiveis(ids: string[]) {
  const temIO = typeof IntersectionObserver !== 'undefined'
  const [visiveis, setVisiveis] = useState<Set<string>>(() => new Set())
  const io = useRef<IntersectionObserver | null>(null)
  const els = useRef(new Map<string, Element>())
  useEffect(() => {
    if (!temIO) return
    const o = new IntersectionObserver((entradas) => {
      setVisiveis((antes) => {
        const prox = new Set(antes)
        for (const e of entradas) { const id = (e.target as HTMLElement).dataset.tela; if (!id) continue; if (e.isIntersecting) prox.add(id); else prox.delete(id) }
        return prox
      })
    }, { rootMargin: '1200px' })
    io.current = o
    for (const el of els.current.values()) o.observe(el)
    return () => { o.disconnect(); io.current = null }
  }, [temIO])
  const guardar = (id: string) => (el: HTMLDivElement | null) => {
    const antigo = els.current.get(id)
    if (antigo && antigo !== el) io.current?.unobserve(antigo)
    if (el) { els.current.set(id, el); io.current?.observe(el) } else els.current.delete(id)
  }
  return { visivel: (id: string) => !temIO || visiveis.has(id), guardar, total: ids.length }
}

export function QuadroDeTelas({ telas, marcada, onMarcar, onUsar }: Props) {
  const [z, setZ] = useState(1) // índice em ZOOMS: começa em 40%
  const zoom = ZOOMS[z]
  const { visivel, guardar } = useTelasVisiveis(telas.map((t) => t.id))
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
          const perto = visivel(t.id)
          const doc = perto ? montarSrcDoc(t.html) : null
          const on = marcada === t.id
          return (
            <li key={t.id} className="at-quadro__item">
              <button type="button" className={`at-quadro__num${on ? ' at-quadro__num--on' : ''}`} aria-label={`Tela ${i + 1} · ${t.nome}`} aria-pressed={on}
                onClick={() => onMarcar(on ? null : t.id)} title="Marcar esta tela para pedir uma mudança">
                <b>{i + 1}</b><span>{t.nome}</span>
              </button>
              <div ref={guardar(t.id)} data-tela={t.id} className={`at-quadro__moldura${pc ? ' at-quadro__moldura--pc' : ''}${on ? ' at-quadro__moldura--on' : ''}`} style={{ width: w * zoom, height: h * zoom }}>
                {!perto
                  ? <div className="at-quadro__longe" aria-hidden="true"><span>{i + 1}</span></div>
                  : doc === null
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
