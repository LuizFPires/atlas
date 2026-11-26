// Bandeirinhas coloridas do Brasil e dos EUA (M31, pedido do Luiz em 26/11/2026: "quero um negócio mais bonito").
// SVG desenhado aqui (nunca emoji); as bandeiras nacionais são de domínio público.

export function BandeiraBR({ largura = 22 }: { largura?: number }) {
  return (
    <svg width={largura} height={Math.round(largura * 0.7)} viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 3, flex: 'none' }}>
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M10 1.6 18 7 10 12.4 2 7Z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
      <path d="M7 6.4c2-.6 4.2-.4 6 .6" stroke="#fff" strokeWidth=".6" fill="none" />
    </svg>
  )
}

export function BandeiraUS({ largura = 22 }: { largura?: number }) {
  const listras = Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 2} width="20" height="1" fill="#B22234" />)
  return (
    <svg width={largura} height={Math.round(largura * 0.7)} viewBox="0 0 20 14" aria-hidden="true" style={{ borderRadius: 3, flex: 'none' }}>
      <rect width="20" height="14" fill="#fff" />
      {listras}
      <rect width="9" height="7" fill="#3C3B6E" />
      {[1.5, 3.5, 5.5].flatMap((y) => [1.8, 4.5, 7.2].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".55" fill="#fff" />))}
    </svg>
  )
}
