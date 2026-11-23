// Prédio subindo andar por andar, ao lado do "Comece a sua primeira obra" (pedido do Luiz, 22/11/2026): mostra que o prédio
// é o sistema e cada andar é uma etapa. Desenho em SVG com animação CSS (sem GIF nem download); quem pede menos movimento
// no computador vê o prédio pronto, parado.
const ANDARES = 7
const L = { x: 90, larg: 150, alt: 28, chao: 262 }

export function PredioSubindo() {
  return (
    <svg className="at-predio" viewBox="0 0 360 290" role="img" aria-label="Animação: o prédio subindo andar por andar, como o seu sistema sendo construído etapa por etapa.">
      <line x1="20" y1={L.chao} x2="340" y2={L.chao} className="at-predio__chao" />
      {/* grua */}
      <line x1="300" y1={L.chao} x2="300" y2="34" className="at-predio__grua" />
      <line x1="300" y1="34" x2="150" y2="34" className="at-predio__grua" />
      <line x1="300" y1="34" x2="330" y2="34" className="at-predio__grua" />
      <rect x="322" y="34" width="14" height="14" rx="2" className="at-predio__contrapeso" />
      <g className="at-predio__gancho">
        <line x1="190" y1="34" x2="190" y2="74" className="at-predio__cabo" />
        <rect x="178" y="74" width="24" height="10" rx="2" className="at-predio__carga" />
      </g>
      {/* andares */}
      {Array.from({ length: ANDARES }, (_, i) => {
        const y = L.chao - (i + 1) * L.alt
        return (
          <g key={i} className="at-predio__andar" style={{ animationDelay: `${i * 0.9}s` }}>
            <rect x={L.x} y={y} width={L.larg} height={L.alt - 2} rx="3" className="at-predio__laje" />
            {[0, 1, 2, 3].map((j) => <rect key={j} x={L.x + 14 + j * 34} y={y + 8} width="20" height="10" rx="2" className="at-predio__janela" />)}
          </g>
        )
      })}
    </svg>
  )
}
