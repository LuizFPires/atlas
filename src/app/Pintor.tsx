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
  return <canvas ref={ref} className="at-pintor__cena3d" role="img" aria-label="Um pintor em 3D pinta no cavalete a arte do seu sistema" />
}

/**
 * Enquanto o Claude monta os 3 estilos: um pintor no cavalete pinta a "arte" do sistema (a tela de um celular).
 * Só SVG de traço e CSS (sem emoji, sem imagem). Com "reduzir movimento", fica parado e só a frase muda.
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
      {em3d ? <Pintor3D onFalhou={cair} /> : <svg className="at-pintor__cena" viewBox="0 0 420 300" role="img" aria-label="Um pintor pinta no cavalete a arte do seu sistema">
        {/* chão */}
        <ellipse cx="210" cy="282" rx="190" ry="10" className="at-pintor__chao" />
        {/* cavalete */}
        <g className="at-pintor__cavalete">
          <line x1="232" y1="40" x2="200" y2="280" />
          <line x1="308" y1="40" x2="340" y2="280" />
          <line x1="270" y1="30" x2="270" y2="270" />
          <line x1="196" y1="232" x2="344" y2="232" />
        </g>
        {/* tela (o celular que está sendo pintado) */}
        <rect x="210" y="46" width="120" height="180" rx="6" className="at-pintor__tela" />
        <g className="at-pintor__arte">
          <rect x="238" y="60" width="64" height="152" rx="10" className="at-pintor__p at-pintor__p--1" />
          <rect x="242" y="66" width="56" height="20" rx="4" className="at-pintor__f at-pintor__f--topo" />
          <rect x="246" y="94" width="14" height="10" rx="5" className="at-pintor__f at-pintor__f--a" />
          <rect x="263" y="94" width="14" height="10" rx="5" className="at-pintor__f at-pintor__f--b" />
          <rect x="280" y="94" width="14" height="10" rx="5" className="at-pintor__f at-pintor__f--b" />
          <rect x="246" y="110" width="48" height="6" rx="3" className="at-pintor__f at-pintor__f--c" />
          <rect x="246" y="121" width="36" height="6" rx="3" className="at-pintor__f at-pintor__f--c" />
          <rect x="246" y="136" width="21" height="21" rx="5" className="at-pintor__f at-pintor__f--d" />
          <rect x="273" y="136" width="21" height="21" rx="5" className="at-pintor__f at-pintor__f--e" />
          <rect x="246" y="186" width="48" height="14" rx="7" className="at-pintor__f at-pintor__f--botao" />
        </g>
        {/* pincelada que corre na tela */}
        <path d="M244 170 q14 -8 26 0 t26 0" className="at-pintor__pincelada" />
        {/* pintor */}
        <g className="at-pintor__pessoa">
          <path d="M96 280 L104 214 M128 280 L120 214" className="at-pintor__traco" />
          <path d="M88 216 Q90 150 112 146 Q134 150 136 216 Z" className="at-pintor__corpo" />
          <path d="M100 168 L124 168 L128 216 L96 216 Z" className="at-pintor__avental" />
          <circle cx="112" cy="124" r="17" className="at-pintor__cabeca" />
          <circle cx="118" cy="122" r="2" className="at-pintor__olho" />
          <path d="M114 131 q5 3 9 -1" className="at-pintor__sorriso" />
          <ellipse cx="110" cy="108" rx="20" ry="7" transform="rotate(-10 110 108)" className="at-pintor__boina" />
          <circle cx="110" cy="100" r="3" className="at-pintor__boina" />
          {/* braço com a paleta */}
          <path d="M100 160 Q80 176 70 182" className="at-pintor__traco" />
          <ellipse cx="62" cy="186" rx="20" ry="12" className="at-pintor__paleta" />
          <circle cx="54" cy="182" r="3.5" className="at-pintor__tinta at-pintor__tinta--1" />
          <circle cx="64" cy="180" r="3.5" className="at-pintor__tinta at-pintor__tinta--2" />
          <circle cx="72" cy="188" r="3.5" className="at-pintor__tinta at-pintor__tinta--3" />
          {/* braço do pincel (gira no ombro) */}
          <g className="at-pintor__braco">
            <path d="M122 158 Q160 150 192 140" className="at-pintor__traco" />
            <line x1="192" y1="140" x2="236" y2="124" className="at-pintor__pincel" />
            <circle cx="238" cy="123" r="4" className="at-pintor__ponta" />
          </g>
        </g>
      </svg>}
      <p className="at-pintor__fala" role="status" aria-label="O que o pintor está fazendo">{FALAS[i]}</p>
      <span className="at-pintor__sub">O Atlas está pintando 3 estilos para o seu sistema. Leva um minutinho.</span>
    </div>
  )
}
