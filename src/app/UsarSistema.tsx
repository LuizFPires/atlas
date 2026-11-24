// "Usar o sistema" (P5, aprovado pelo Luiz em 24/11/2026): o protótipo em tela cheia, como se fosse de verdade. Setas e números
// passam de tela em tela; "Onde dá para tocar?" acende o que já funciona; "Pedir mudança nesta tela" volta com a tela marcada.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../ui'
import { CelularPreview, ComputadorPreview } from './Prototipo'
import { aparelhoDaTela, type TelaDesenhada } from './ponte-prototipo'

interface Props {
  obraNome: string
  telas: TelaDesenhada[]
  inicial: string
  onFechar: () => void
  onPedirMudanca: (id: string) => void
}

export function UsarSistema({ obraNome, telas, inicial, onFechar, onPedirMudanca }: Props) {
  const [i, setI] = useState(Math.max(0, telas.findIndex((t) => t.id === inicial)))
  const [realce, setRealce] = useState(true)
  const fechar = useRef<HTMLButtonElement>(null)
  const t = telas[Math.min(i, telas.length - 1)]
  const total = telas.length
  useEffect(() => {
    fechar.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
      else if (e.key === 'ArrowRight') setI((v) => (v + 1) % total)
      else if (e.key === 'ArrowLeft') setI((v) => (v + total - 1) % total)
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onFechar, total])
  if (!t) return null
  const doMesmo = telas.filter((x) => aparelhoDaTela(x) === aparelhoDaTela(t))
  return (
    <div className="at-play" role="dialog" aria-modal="true" aria-label="Usando o sistema">
      <div className="at-play__topo">
        <button ref={fechar} type="button" className="at-play__fechar" aria-label="Sair da tela cheia" onClick={onFechar}><Icone nome="x" tamanho={18} /></button>
        <div className="at-play__tit"><span>{obraNome.toLocaleUpperCase('pt-BR')} · USANDO O SISTEMA</span><b>Tela {i + 1} de {total} · {t.nome}</b></div>
      </div>
      <div className="at-play__numeros" role="group" aria-label="Telas">
        {telas.map((x, j) => (
          <button key={x.id} type="button" aria-label={`Ir para a tela ${j + 1}`} aria-current={j === i ? 'true' : undefined} className={j === i ? 'at-play__n--on' : ''} title={x.nome} onClick={() => setI(j)}>{j + 1}</button>
        ))}
      </div>
      <div className="at-play__palco">
        <button type="button" className="at-play__seta" aria-label="Tela anterior" onClick={() => setI((v) => (v + total - 1) % total)}>‹</button>
        <div className="at-play__aparelho">
          {aparelhoDaTela(t) === 'computador'
            ? <ComputadorPreview key={t.id} telas={doMesmo} inicial={t.id} realce={realce} titulo={`Tela ${t.nome} no computador (dá para clicar e navegar)`} />
            : <CelularPreview key={t.id} html={t.html} telas={doMesmo} inicial={t.id} realce={realce} titulo={`Tela ${t.nome} no celular (dá para tocar e navegar)`} />}
        </div>
        <button type="button" className="at-play__seta" aria-label="Próxima tela" onClick={() => setI((v) => (v + 1) % total)}>›</button>
      </div>
      <div className="at-play__rodape">
        <div className="at-play__dica">
          <b>Use como se fosse de verdade</b>
          <span>O que acende é o que já funciona. Quer mudar ou criar alguma coisa nesta tela? Peça ao Atlas.</span>
          <button type="button" className="at-play__realce" aria-pressed={realce} onClick={() => setRealce((r) => !r)}>{realce ? 'Esconder o que dá para tocar' : 'Onde dá para tocar?'}</button>
        </div>
        <button type="button" className="at-play__pedir" onClick={() => onPedirMudanca(t.id)}>
          <span className="at-play__mic" aria-hidden="true"><Icone nome="microfone" tamanho={18} /></span>
          <span className="at-play__chip">TELA {i + 1}</span>
          Pedir mudança nesta tela
        </button>
      </div>
    </div>
  )
}
