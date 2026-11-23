import { useSyncExternalStore } from 'react'
import { Icone } from './Icone'
import { assinarVoz, definirEstadoVoz, estadoVoz } from './voz-motor'
import './status-voz.css'

/** Aviso único da voz, para o app inteiro: ouvindo, preparando (primeira vez, com barra), escrevendo ou erro. */
/** Só o fim do rascunho (cabe numa linha e acompanha a fala). */
const ultimasPalavras = (t: string) => { const p = t.trim().split(/\s+/); return p.length > 14 ? `…${p.slice(-14).join(' ')}` : t.trim() }

export function StatusVoz() {
  const e = useSyncExternalStore(assinarVoz, estadoVoz, estadoVoz)
  if (e.fase === 'livre') return null
  if (e.fase === 'erro') {
    return (
      <div className="at-svoz at-svoz--erro" role="alert">
        <Icone nome="alerta" tamanho={18} />
        <span>{e.recado}</span>
        <button type="button" className="at-svoz__x" aria-label="Fechar o aviso" onClick={() => definirEstadoVoz({ fase: 'livre' })}><Icone nome="x" tamanho={14} /></button>
      </div>
    )
  }
  const pct = e.progresso ?? 0
  return (
    <div className={`at-svoz at-svoz--${e.fase}`} role="status">
      {e.fase === 'ouvindo' && !e.rascunho && <><span className="at-svoz__ponto" aria-hidden="true" /><span><b>Ouvindo…</b> Fale à vontade: o texto vai aparecendo a cada pausa. Quando terminar, aperte o microfone de novo.</span></>}
      {/* Rascunho ao vivo (Luiz, 23/11/2026: "sem delay na fala"): as últimas palavras faladas, já escritas; o campo recebe a versão revisada. */}
      {e.fase === 'ouvindo' && e.rascunho && <><span className="at-svoz__ponto" aria-hidden="true" /><span className="at-svoz__rascunho"><b>Ouvindo…</b> <span>{ultimasPalavras(e.rascunho)}</span></span></>}
      {e.fase === 'escrevendo' && <><span className="at-svoz__giro" aria-hidden="true" /><span><b>Escrevendo o que você falou…</b> Leva só uns segundos.</span></>}
      {e.fase === 'preparando' && (
        <div className="at-svoz__prep">
          <span><b>Preparando a voz do Atlas…</b> Isso acontece só na primeira vez. Depois, funciona até sem internet.</span>
          <div className="at-svoz__barra" role="progressbar" aria-label="Preparando a voz" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}
    </div>
  )
}
