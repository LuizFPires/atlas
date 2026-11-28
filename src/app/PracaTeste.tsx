// A Praça do "Testar a ideia" (TI1TestarIdeia, visual padrão aprovado pelo Luiz em 28/11/2026): a ideia no centro como sombra
// do prédio (ainda não construído) com cometas girando; os agentes de IA ao redor, azuis (usaria), vermelhos (não usaria) ou
// cinza (pensando); raios da ideia até quem está olhando as telas; na conversa, arcos de um agente para o outro com a mensagem
// andando, e balões com o que eles disseram. O desenho vem dos dados de verdade (cena do motor), não de sorteio.
import { useEffect, useMemo, useRef, useState } from 'react'
import './praca-teste.css'
import type { AgenteNaCena, EventoConversa, Opiniao } from './ponte-testar'
import { posicoes, type Pos } from './praca-posicoes'

export type FasePraca = 'criando' | 'olhando' | 'conversa' | 'relatorio' | 'pronto'
interface Props {
  agentes: AgenteNaCena[]
  eventos: EventoConversa[]
  fase: FasePraca
  nome: string
  /** Agrupar o mapa de calor por este traço (padrão: Profissão). */
  grupo?: string
}

const COR: Record<Opiniao | 'pensando', string> = { usaria: '#4C8DFF', nao: '#FF5A4E', duvida: '#7E857C', pensando: '#7E857C' }
const corDe = (r: Opiniao | null) => (r === 'usaria' ? COR.usaria : r === 'nao' ? COR.nao : COR.pensando)
const proj = (W: number, H: number, s: number, x: number, y: number, z: number): [number, number] => [W / 2 + (x - y) * 0.866 * s, H * 0.56 + (x + y) * 0.5 * s - z * s]

interface Arco { de: Pos; para: Pos; cor: string; t: number }
interface Balao { id: number; x: number; y: number; texto: string; cor: string }

export function PracaTeste({ agentes, eventos, fase, nome, grupo = 'Profissão' }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const [calor, setCalor] = useState(false)
  const [baloes, setBaloes] = useState<Balao[]>([])
  const relogios = useRef(new Set<ReturnType<typeof setTimeout>>())
  const { pos, grupos } = useMemo(() => posicoes(agentes, grupo), [agentes.length, grupo]) // eslint-disable-line react-hooks/exhaustive-deps
  const estado = useRef({ agentes, fase, calor, arcos: [] as Arco[], baloes: [] as Balao[], vistos: 0, cometas: Array.from({ length: 16 }, (_, i) => ({ r: 1.5 + ((i * 37) % 14) / 10, v: 0.6 + ((i * 53) % 9) / 10, f: i * 0.7, h: 0.4 + ((i * 29) % 24) / 10 })) })
  useEffect(() => {
    estado.current.agentes = agentes
    estado.current.fase = fase
    estado.current.calor = calor
    estado.current.baloes = baloes
  }, [agentes, fase, calor, baloes])

  // eventos novos: viram arcos (agente → agente) e balões
  useEffect(() => {
    const st = estado.current
    const novos = eventos.slice(Math.min(st.vistos, eventos.length))
    st.vistos = eventos.length
    const W = cv.current?.width ?? 0
    const H = cv.current?.height ?? 0
    const s = Math.min(W, H) / 24
    const bs: Balao[] = []
    for (const e of novos.slice(-40)) {
      const de = pos.get(e.de)
      const para = e.para ? pos.get(e.para) : null
      if (de && para) st.arcos.push({ de, para, cor: e.r === 'usaria' ? 'rgb(76,141,255)' : e.r === 'nao' ? 'rgb(255,90,78)' : 'rgb(170,176,168)', t: -Math.random() * 1.5 })
      if (de && bs.length < 3 && W) {
        const q = proj(W, H, s, de.x, de.y, 0)
        const x = (q[0] / W) * 100, y = ((q[1] - s * 0.22 * 3.4) / H) * 100
        // não deixa um balão em cima do outro (os que estão na tela e os deste lote)
        if ([...bs, ...st.baloes].some((b) => Math.abs(b.x - x) < 18 && Math.abs(b.y - y) < 7)) continue
        const pal = e.texto.split(' ')
        bs.push({ id: Math.random(), x, y, texto: pal.slice(0, 6).join(' ') + (pal.length > 6 ? '…' : ''), cor: corDe(e.r) })
      }
    }
    if (!bs.length) return
    const ids = new Set(bs.map((b) => b.id))
    const tm = relogios.current
    const t1 = setTimeout(() => { tm.delete(t1); setBaloes((b) => [...b.slice(-6), ...bs]) }, 0)
    const t2 = setTimeout(() => { tm.delete(t2); setBaloes((b) => b.filter((x) => !ids.has(x.id))) }, 3000)
    tm.add(t1); tm.add(t2)
  }, [eventos, pos])
  useEffect(() => { const tm = relogios.current; return () => tm.forEach(clearTimeout) }, [])

  // desenho contínuo
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const quieto = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const redim = () => { const r = c.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round(r.width * d); c.height = Math.round(r.height * d) }
    redim()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redim) : null
    ro?.observe(c)
    const t0 = performance.now()
    const desenhar = (agoraMs: number) => {
      const ctx = c.getContext('2d')
      if (!ctx) return
      const st = estado.current
      const tempo = quieto ? 0 : (agoraMs - t0) / 1000
      const W = c.width, H = c.height, s = Math.min(W, H) / 24
      ctx.clearRect(0, 0, W, H)
      // lote da ideia
      const c0 = proj(W, H, s, 0, 0, 0)
      ctx.save(); ctx.translate(c0[0], c0[1]); ctx.scale(1, 0.577)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3); g.addColorStop(0, 'rgba(198,241,53,.28)'); g.addColorStop(1, 'rgba(198,241,53,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 3.2, 0, 6.29); ctx.fill()
      ctx.strokeStyle = 'rgba(198,241,53,.55)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(0, 0, s * 2.3, 0, 6.29); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
      // mapa de calor por grupo
      if (st.calor) {
        grupos.forEach((_, gi) => {
          const doGrupo = st.agentes.filter((a) => pos.get(a.id)?.grupo === gi && a.r)
          if (!doGrupo.length) return
          const f = doGrupo.filter((a) => a.r === 'usaria').length / doGrupo.length
          const con = doGrupo.filter((a) => a.r === 'nao').length / doGrupo.length
          const a0 = (gi / grupos.length) * Math.PI * 2 - Math.PI, a1 = ((gi + 1) / grupos.length) * Math.PI * 2 - Math.PI
          ctx.beginPath()
          for (let t = 0; t <= 24; t++) { const a = a0 + ((a1 - a0) * t) / 24; const q = proj(W, H, s, Math.cos(a) * 12.2, Math.sin(a) * 12.2, 0); if (t) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]) }
          for (let t = 24; t >= 0; t--) { const a = a0 + ((a1 - a0) * t) / 24; const q = proj(W, H, s, Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0); ctx.lineTo(q[0], q[1]) }
          ctx.closePath(); ctx.fillStyle = `rgba(${f >= con ? '76,141,255' : '255,90,78'},${Math.min(1, Math.abs(f - con) * 1.1) * 0.5 + 0.12})`; ctx.fill()
          ctx.strokeStyle = 'rgba(20,22,25,.9)'; ctx.lineWidth = 3; ctx.stroke()
        })
      }
      // cometas e prédio fantasma
      const rastros: [number, number, boolean][] = st.cometas.map((k) => { const a = k.f + tempo * k.v; const x = Math.cos(a) * k.r, y = Math.sin(a) * k.r; const q = proj(W, H, s, x, y, k.h + Math.sin(a) * 0.4); return [q[0], q[1], x + y > 0] })
      const cometa = ([x, y]: [number, number, boolean]) => { ctx.fillStyle = '#F4FFD6'; ctx.shadowColor = '#C6F135'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 2.3, 0, 6.29); ctx.fill(); ctx.shadowBlur = 0 }
      rastros.filter((r) => !r[2]).forEach(cometa)
      const pul = 0.5 + 0.5 * Math.sin(tempo * 2)
      const cubo = (cx: number, cy: number, w: number, d: number, h: number, alfa: number) => {
        const p = (x: number, y: number, z: number) => proj(W, H, s, x, y, z)
        const b = [p(cx - w, cy - d, 0), p(cx + w, cy - d, 0), p(cx + w, cy + d, 0), p(cx - w, cy + d, 0)], tp = [p(cx - w, cy - d, h), p(cx + w, cy - d, h), p(cx + w, cy + d, h), p(cx - w, cy + d, h)]
        const face = (pts: [number, number][], f: string) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); ctx.setLineDash([5, 5]); ctx.strokeStyle = `rgba(198,241,53,${alfa})`; ctx.lineWidth = 1.2; ctx.stroke() }
        face([b[1], b[2], tp[2], tp[1]], 'rgba(198,241,53,.07)'); face([b[2], b[3], tp[3], tp[2]], 'rgba(198,241,53,.04)'); face(tp, `rgba(198,241,53,${0.09 + pul * 0.05})`); ctx.setLineDash([])
      }
      cubo(0, 0, 1.15, 1.15, 2.6, 0.45 + pul * 0.25)
      cubo(0.55, -0.4, 0.45, 0.5, 3.6, 0.35)
      // agentes (ordem de profundidade)
      const vis = st.fase === 'criando' ? Math.min(1, tempo / 4) : 1
      const lista = st.agentes.map((a) => [a, pos.get(a.id)] as const).filter(([, p]) => p).sort((x, y) => (x[1]!.x + x[1]!.y) - (y[1]!.x + y[1]!.y))
      lista.forEach(([a, p], i) => {
        if (st.fase === 'criando' && i / lista.length > vis) return
        const q = proj(W, H, s, p!.x, p!.y, 0)
        const k = s * 0.22 * p!.alt
        ctx.globalAlpha = st.calor ? 0.3 : 1
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(q[0], q[1], k * 0.9, k * 0.4, 0, 0, 6.29); ctx.fill()
        ctx.fillStyle = corDe(st.fase === 'criando' ? null : a.r)
        ctx.beginPath(); ctx.roundRect(q[0] - k * 0.55, q[1] - k * 2.1, k * 1.1, k * 2, k * 0.5); ctx.fill()
        ctx.beginPath(); ctx.arc(q[0], q[1] - k * 2.55, k * 0.5, 0, 6.29); ctx.fill()
        ctx.globalAlpha = 1
      })
      // raios da ideia até quem está olhando as telas
      if (st.fase === 'olhando' && !st.calor) {
        const topo = proj(W, H, s, 0, 0, 2.6)
        ctx.lineWidth = 1
        lista.forEach(([a, p], i) => {
          if (a.r || (i + Math.floor(tempo * 3)) % 9) return
          const q = proj(W, H, s, p!.x, p!.y, 0.4)
          ctx.strokeStyle = 'rgba(198,241,53,.3)'; ctx.beginPath(); ctx.moveTo(topo[0], topo[1]); ctx.lineTo(q[0], q[1]); ctx.stroke()
        })
      }
      // arcos da conversa, com a mensagem andando
      if (!st.calor) {
        for (const u of st.arcos) {
          u.t += quieto ? 1 : 0.012
          if (u.t < 0 || u.t > 1) continue
          const pa = proj(W, H, s, u.de.x, u.de.y, 0.7), pb = proj(W, H, s, u.para.x, u.para.y, 0.7)
          const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2 - d * 0.35
          const al = Math.sin(u.t * Math.PI)
          ctx.strokeStyle = u.cor.replace('rgb', 'rgba').replace(')', `,${0.55 * al})`); ctx.lineWidth = 1.4
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.quadraticCurveTo(mx, my, pb[0], pb[1]); ctx.stroke()
          const t = u.t, x = (1 - t) * (1 - t) * pa[0] + 2 * (1 - t) * t * mx + t * t * pb[0], y = (1 - t) * (1 - t) * pa[1] + 2 * (1 - t) * t * my + t * t * pb[1]
          ctx.fillStyle = '#fff'; ctx.shadowColor = u.cor; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.29); ctx.fill(); ctx.shadowBlur = 0
        }
        st.arcos = st.arcos.filter((u) => u.t <= 1)
      }
      rastros.filter((r) => r[2]).forEach(cometa)
      // placa e rótulos do mapa de calor
      const pl = proj(W, H, s, 1.2, 1.25, 1.2)
      ctx.font = `600 ${Math.max(10, s * 0.42)}px "Geist Mono", monospace`; ctx.fillStyle = 'rgba(198,241,53,.9)'; ctx.textAlign = 'center'
      ctx.fillText(`${nome.toUpperCase()} · IDEIA`, pl[0], pl[1]); ctx.textAlign = 'start'
      if (st.calor) {
        grupos.forEach((gn, gi) => {
          const doGrupo = st.agentes.filter((a) => pos.get(a.id)?.grupo === gi && a.r)
          if (!doGrupo.length) return
          const f = Math.round((doGrupo.filter((a) => a.r === 'usaria').length / doGrupo.length) * 100)
          const con = Math.round((doGrupo.filter((a) => a.r === 'nao').length / doGrupo.length) * 100)
          const a = ((gi + 0.5) / grupos.length) * Math.PI * 2 - Math.PI
          const q = proj(W, H, s, Math.cos(a) * 7.6, Math.sin(a) * 7.6, 0)
          const fs = Math.max(11, s * 0.5)
          ctx.font = `600 ${fs}px Geist, sans-serif`
          const t2 = `${f}% a favor · ${con}% contra`
          const w = Math.max(ctx.measureText(gn).width, ctx.measureText(t2).width) + fs * 1.4
          ctx.fillStyle = 'rgba(14,16,18,.92)'; ctx.strokeStyle = f >= con ? '#4C8DFF' : '#FF5A4E'; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.roundRect(q[0] - w / 2, q[1] - fs * 1.6, w, fs * 3.2, fs * 0.6); ctx.fill(); ctx.stroke()
          ctx.textAlign = 'center'; ctx.fillStyle = '#EDEFEA'; ctx.fillText(gn, q[0], q[1] - fs * 0.2)
          ctx.fillStyle = f >= con ? '#8DB5FF' : '#FF8D85'; ctx.font = `500 ${fs * 0.88}px Geist, sans-serif`; ctx.fillText(t2, q[0], q[1] + fs * 1.05); ctx.textAlign = 'start'
        })
      }
      if (!quieto) raf = requestAnimationFrame(desenhar)
    }
    raf = requestAnimationFrame(desenhar)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [pos, grupos, nome])

  const total = agentes.length || 1
  const usaria = agentes.filter((a) => a.r === 'usaria').length
  const nao = agentes.filter((a) => a.r === 'nao').length
  return (
    <div className="at-praca" ref={caixa}>
      <canvas ref={cv} className="at-praca__cv" role="img" aria-label={`Praça: ${agentes.length} agentes de IA olhando ${nome}. ${usaria} usariam, ${nao} não usariam.`} />
      {!calor && baloes.map((b) => (
        <span key={b.id} className="at-praca__bal" style={{ left: `${b.x}%`, top: `${b.y}%`, ['--c' as string]: b.cor }}>{b.texto}</span>
      ))}
      <div className="at-praca__ctl">
        <button type="button" aria-pressed={calor} onClick={() => setCalor((x) => !x)}>Mapa de calor por grupo</button>
      </div>
      <div className="at-praca__fas" aria-label="Fãs e contra">
        <span>FÃS</span>
        <div><i style={{ width: `${(usaria / total) * 100}%`, background: COR.usaria }} /><i style={{ width: `${(nao / total) * 100}%`, background: COR.nao, marginLeft: 'auto' }} /></div>
        <span>CONTRA</span>
      </div>
      <div className="at-praca__leg"><span><i style={{ background: COR.usaria }} />usaria</span><span><i style={{ background: COR.nao }} />não usaria</span><span><i style={{ background: COR.pensando }} />pensando</span><span><i style={{ background: '#C6F135' }} />ideia · ainda não construída</span></div>
    </div>
  )
}
