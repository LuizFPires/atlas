import { useState } from 'react'
import { Icone } from '../ui'
import './paleta.css'

/** Até 3 cores da marca. */
export const MAX_CORES = 3

/** Sugestões para quem não sabe o código: tons comuns de marcas de pequeno negócio. */
export const SUGESTOES = [
  '#1D3557', '#2563EB', '#0EA5E9', '#14B8A6', '#16A34A', '#84CC16',
  '#EAB308', '#D8B45A', '#F97316', '#DC2626', '#DB2777', '#7C3AED',
  '#5B3A29', '#8B5E3C', '#111827', '#6B7280', '#F5F0E6', '#FFFFFF',
]

/** "1d3557", "#abc" → "#1D3557"/"#AABBCC"; qualquer outra coisa → null. */
export function normalizarHex(t: string): string | null {
  const s = t.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split('').map((c) => c + c).join('')}`.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`.toUpperCase()
  return null
}

interface Props {
  cores: string[]
  onChange: (cores: string[]) => void
}

/** Escolher as cores vendo: 3 vagas (cada uma com o seletor do sistema e o código), mais uma paleta para tocar. */
export function PaletaCores({ cores, onChange }: Props) {
  const [digitado, setDigitado] = useState<Record<number, string>>({})
  const [recado, setRecado] = useState('')
  const cheia = cores.length >= MAX_CORES

  const por = (i: number, cor: string) => {
    const nova = [...cores]
    if (i < nova.length) nova[i] = cor
    else nova.push(cor)
    onChange(nova.slice(0, MAX_CORES))
  }
  const confirmar = (i: number) => {
    const t = digitado[i] ?? ''
    if (!t.trim()) return
    const hex = normalizarHex(t)
    if (!hex) { setRecado('Esse código não parece uma cor. Use 6 letras e números, assim: #1D3557.'); return }
    setRecado('')
    setDigitado((d) => ({ ...d, [i]: '' }))
    por(i, hex)
  }
  const tirar = (i: number) => onChange(cores.filter((_, k) => k !== i))

  return (
    <div className="at-paleta">
      <div className="at-paleta__vagas">
        {Array.from({ length: MAX_CORES }, (_, i) => {
          const cor = cores[i]
          const livre = !cor && i === cores.length
          return (
            <div key={i} className={`at-paleta__vaga ${cor ? 'at-paleta__vaga--on' : ''}`}>
              <label className="at-paleta__amostra" style={{ background: cor ?? 'transparent' }} aria-label={`Escolher a cor ${i + 1} no seletor`}>
                {!cor && <Icone nome="paleta" tamanho={18} />}
                <input type="color" value={cor ?? '#C6F135'} disabled={!cor && !livre} onChange={(e) => por(Math.min(i, cores.length), e.target.value.toUpperCase())} />
              </label>
              <input className="at-paleta__codigo" aria-label={`Código da cor ${i + 1}`} placeholder={cor ?? '#000000'} disabled={!cor && !livre}
                value={digitado[i] ?? ''} onChange={(e) => setDigitado((d) => ({ ...d, [i]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(i) } }} onBlur={() => confirmar(i)} />
              {cor && <button type="button" className="at-paleta__tirar" aria-label={`Tirar a cor ${cor}`} onClick={() => tirar(i)}><Icone nome="x" tamanho={14} /></button>}
            </div>
          )
        })}
      </div>
      <span className="at-paleta__dica">Toque numa cor para usar, ou cole o código de cada uma. Até 3.</span>
      <div className="at-paleta__sugestoes" role="group" aria-label="Cores para escolher">
        {SUGESTOES.map((c) => (
          <button key={c} type="button" className="at-paleta__sug" style={{ background: c }} aria-label={`Usar a cor ${c}`} disabled={cheia || cores.includes(c)} onClick={() => por(cores.length, c)} />
        ))}
      </div>
      {recado && <p className="at-paleta__recado" role="status">{recado}</p>}
      {!recado && cores.length > 0 && <p className="at-paleta__resumo" role="status">Escolhidas: {cores.join(', ')}</p>}
    </div>
  )
}
