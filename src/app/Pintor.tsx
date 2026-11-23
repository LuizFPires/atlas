import { useCallback, useEffect, useRef, useState } from 'react'
import './pintor.css'

const FALAS = ['Misturando as cores…', 'Escolhendo as letras…', 'Desenhando os botões…', 'Testando no celular…', 'Dando o acabamento…']

/** WebGL disponível? (sem ele, ou no teste, o pintor é o desenho em SVG). */
export function temWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

/** O pintor em 3D (Three.js carregado só aqui). Se a cena não montar, avisa para cair no SVG. */
function Pintor3D({ onFalhou }: { onFalhou: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let parar: (() => void) | null = null
    let vivo = true
    const parado = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    import('./cena-pintor').then(({ montarCenaPintor }) => {
      if (!vivo || !ref.current) return
      try { parar = montarCenaPintor(ref.current, { parado }).parar } catch { onFalhou() }
    }, onFalhou)
    return () => { vivo = false; parar?.() }
  }, [onFalhou])
  return <canvas ref={ref} className="at-pintor__cena3d" role="img" aria-label="Um pincel pinta, em 3D, a tela do celular do seu sistema" />
}

/**
 * Enquanto o Claude monta os 3 estilos: um pincel pinta a tela de um celular, parte por parte (sem personagem; pedido do
 * Luiz em 22/11/2026). Em 3D (cena-pintor.ts) quando há WebGL; senão, SVG de traço + CSS. Com "reduzir movimento", fica parado.
 */
export function Pintor() {
  const [i, setI] = useState(0)
  const [em3d, setEm3d] = useState(temWebGL)
  const cair = useCallback(() => setEm3d(false), [])
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % FALAS.length), 2400)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="at-pintor">
      {em3d ? <Pintor3D onFalhou={cair} /> : (
        <svg className="at-pintor__cena" viewBox="0 0 420 300" role="img" aria-label="Um pincel pinta a tela do celular do seu sistema">
          <ellipse cx="210" cy="286" rx="120" ry="7" className="at-pintor__chao" />
          <rect x="150" y="18" width="120" height="262" rx="18" className="at-pintor__corpo-cel" />
          <rect x="158" y="26" width="104" height="246" rx="12" className="at-pintor__tela" />
          <g className="at-pintor__arte">
            <rect x="166" y="38" width="88" height="20" rx="5" className="at-pintor__f at-pintor__f--topo" />
            <rect x="166" y="66" width="24" height="10" rx="5" className="at-pintor__f at-pintor__f--a" />
            <rect x="196" y="66" width="24" height="10" rx="5" className="at-pintor__f at-pintor__f--b" />
            <rect x="226" y="66" width="24" height="10" rx="5" className="at-pintor__f at-pintor__f--b" />
            <rect x="166" y="88" width="80" height="6" rx="3" className="at-pintor__f at-pintor__f--c" />
            <rect x="166" y="100" width="56" height="6" rx="3" className="at-pintor__f at-pintor__f--c" />
            <rect x="166" y="118" width="40" height="40" rx="8" className="at-pintor__f at-pintor__f--d" />
            <rect x="214" y="118" width="40" height="40" rx="8" className="at-pintor__f at-pintor__f--e" />
            <rect x="166" y="236" width="88" height="22" rx="11" className="at-pintor__f at-pintor__f--botao" />
          </g>
          <g className="at-pintor__pincel2">
            <line x1="0" y1="0" x2="70" y2="-62" className="at-pintor__cabo" />
            <line x1="0" y1="0" x2="12" y2="-11" className="at-pintor__virola" />
            <circle cx="0" cy="0" r="5" className="at-pintor__ponta" />
          </g>
        </svg>
      )}
      <p className="at-pintor__fala" role="status" aria-label="O que o pintor está fazendo">{FALAS[i]}</p>
      <span className="at-pintor__sub">O Atlas está pintando 3 estilos para o seu sistema. Leva um minutinho.</span>
    </div>
  )
}
