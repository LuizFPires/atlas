// M08b (protótipo aprovado pelo Luiz em 25/11/2026): o prédio da obra desenhado com os números dela — um andar por etapa;
// os prontos com as janelas acesas, o atual contornado em verde e os que faltam tracejados. SVG leve, sem foto e sem 3D.
// Mesmo desenho do protótipo (prototipo/celular/ObraPredio.dc.html).
export function predioSvg({ andares = 8, prontos = 3, largura = 360, altura = 420 }: { andares?: number; prontos?: number; largura?: number; altura?: number } = {}): string {
  const n = Math.max(1, Math.min(20, andares)), p = Math.max(0, Math.min(n, prontos))
  const cx = largura / 2, base = altura - 70
  const dx = 92, dy = 53
  const fh = Math.min(30, (altura - 150) / n)
  const pt = (a: number[][]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const out: string[] = []
  // lote
  out.push(`<polygon points="${pt([[cx, base + 38], [cx - dx - 46, base - dy + 12], [cx, base - 2 * dy - 14], [cx + dx + 46, base - dy + 12]])}" fill="#2B2118" stroke="#3A2E22"/>`)
  out.push(`<polygon points="${pt([[cx, base + 38], [cx - dx - 46, base - dy + 12], [cx, base - 2 * dy - 14], [cx + dx + 46, base - dy + 12]])}" fill="none" stroke="#C9B9A0" stroke-opacity=".35" stroke-width="2"/>`)
  // grua (só enquanto a obra sobe; pronta, ganha a bandeira no topo)
  const gx = cx + dx + 22, gy = base - dy + 6, topo = base - n * fh - 70
  if (p < n) out.push(`<line x1="${gx}" y1="${gy}" x2="${gx}" y2="${topo}" stroke="#E0B83C" stroke-width="4"/>`)
  if (p < n) out.push(`<line x1="${gx - 90}" y1="${topo + 4}" x2="${gx + 40}" y2="${topo + 4}" stroke="#E0B83C" stroke-width="4"/>`)
  if (p < n) out.push(`<line x1="${gx - 70}" y1="${topo + 6}" x2="${gx - 70}" y2="${topo + 46}" stroke="#8E968C" stroke-width="1.5"/>`)
  if (p < n) out.push(`<rect x="${gx - 78}" y="${topo + 46}" width="16" height="10" fill="#C6F135"/>`)
  for (let i = 0; i < n; i++) {
    const y = base - i * fh
    const L = [[cx, y], [cx - dx, y - dy], [cx - dx, y - dy - fh], [cx, y - fh]]
    const R = [[cx, y], [cx + dx, y - dy], [cx + dx, y - dy - fh], [cx, y - fh]]
    if (i < p) {
      out.push(`<polygon points="${pt(L)}" fill="#2F343A"/><polygon points="${pt(R)}" fill="#24282D"/>`)
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const t0 = 0.1 + k * 0.215, t1 = t0 + 0.13
        const acesa = ((i * 7 + k * 3 + (s > 0 ? 1 : 0)) % 5) !== 0
        const x0 = cx + s * dx * t0, x1 = cx + s * dx * t1
        const yb0 = y - dy * t0 - fh * 0.22, yb1 = y - dy * t1 - fh * 0.22
        const h = fh * 0.52
        out.push(`<polygon points="${pt([[x0, yb0], [x1, yb1], [x1, yb1 - h], [x0, yb0 - h]])}" fill="${acesa ? '#F2D27A' : '#3A3F45'}"/>`)
      }
      out.push(`<line x1="${cx - dx}" y1="${y - dy - fh}" x2="${cx}" y2="${y - fh}" stroke="#141619" stroke-opacity=".5"/><line x1="${cx}" y1="${y - fh}" x2="${cx + dx}" y2="${y - dy - fh}" stroke="#141619" stroke-opacity=".5"/>`)
      if (i === p - 1) {
        const yt = y - fh
        out.push(`<polygon points="${pt([[cx, yt], [cx - dx, yt - dy], [cx, yt - 2 * dy], [cx + dx, yt - dy]])}" fill="#3A3F45" stroke="#141619" stroke-opacity=".4"/>`)
        if (p === n) out.push(`<line x1="${cx}" y1="${yt - dy}" x2="${cx}" y2="${yt - dy - 44}" stroke="#EDEFEA" stroke-width="2"/><polygon points="${pt([[cx, yt - dy - 44], [cx + 26, yt - dy - 36], [cx, yt - dy - 28]])}" fill="#C6F135"/>`)
      }
    } else if (i === p) {
      out.push(`<polygon points="${pt(L)}" fill="#C6F135" fill-opacity=".14" stroke="#C6F135" stroke-width="1.5"/><polygon points="${pt(R)}" fill="#C6F135" fill-opacity=".08" stroke="#C6F135" stroke-width="1.5"/>`)
      const yt = y - fh; out.push(`<polygon points="${pt([[cx, yt], [cx - dx, yt - dy], [cx, yt - 2 * dy], [cx + dx, yt - dy]])}" fill="none" stroke="#C6F135" stroke-opacity=".7"/>`)
      for (let k = 1; k < 4; k++) { const t = k / 4; out.push(`<line x1="${cx - dx * t}" y1="${y - dy * t}" x2="${cx - dx * t}" y2="${y - dy * t - fh}" stroke="#C6F135" stroke-opacity=".6"/><line x1="${cx + dx * t}" y1="${y - dy * t}" x2="${cx + dx * t}" y2="${y - dy * t - fh}" stroke="#C6F135" stroke-opacity=".6"/>`) }
    } else {
      out.push(`<polygon points="${pt(L)}" fill="none" stroke="#5A6168" stroke-dasharray="4 4" stroke-opacity=".7"/><polygon points="${pt(R)}" fill="none" stroke="#5A6168" stroke-dasharray="4 4" stroke-opacity=".7"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}">${out.join('')}</svg>`
}
