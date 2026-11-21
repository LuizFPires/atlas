import { useEffect, useRef, useState } from 'react'
import { Icone } from '../ui'
// Aba "Mapa" do painel do administrador: onde os clientes estão, por estado. Só números agregados por UF (nunca dado de pessoa).
import { CENTRO_UF, ESTADOS, MAPA_ALTURA, MAPA_LARGURA, NOME_REGIAO, type Regiao } from './mapa-brasil'
import type { LinhaUf } from './admin-api'

export const nomeUf = (uf: string) => ESTADOS.find((e) => e.uf === uf)?.nome ?? uf
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
export const textoUf = (l: Pick<LinhaUf, 'uf' | 'clientes' | 'compras'>) => `${l.uf}: ${plural(l.clientes, 'cliente', 'clientes')} (${plural(l.compras, 'compra', 'compras')})`

export interface ResumoMapa {
  ranking: LinhaUf[]; regioes: { regiao: Regiao; clientes: number; compras: number }[]
  lider: LinhaUf | null; regiaoLider: { regiao: Regiao; clientes: number } | null; maximo: number; semCliente: number
}
/** Ordena do maior pro menor (empate: mais compras, depois sigla) e soma por região. Estados com 0 cliente ficam fora do ranking. */
export function resumirMapa(por_uf: LinhaUf[]): ResumoMapa {
  const ranking = por_uf.filter((l) => l.clientes > 0).sort((a, b) => b.clientes - a.clientes || b.compras - a.compras || a.uf.localeCompare(b.uf))
  const regioes = (Object.keys(NOME_REGIAO) as Regiao[]).map((regiao) => ({
    regiao, clientes: por_uf.filter((l) => l.regiao === regiao).reduce((s, l) => s + l.clientes, 0), compras: por_uf.filter((l) => l.regiao === regiao).reduce((s, l) => s + l.compras, 0),
  })).sort((a, b) => b.clientes - a.clientes)
  return { ranking, regioes, lider: ranking[0] ?? null, regiaoLider: regioes[0]?.clientes ? regioes[0] : null, maximo: ranking[0]?.clientes ?? 0, semCliente: por_uf.length - ranking.length }
}

/** Fundo do estado: neutro e uniforme (a cor agora é da bolha). */
const FUNDO_UF = 'var(--card-b)'

/** Raio da bolha (em unidades do mapa): área proporcional ao nº de clientes, com mínimo e máximo. */
export const RAIO_MIN = 6
export const RAIO_MAX = 34
export function raioBolha(clientes: number, maximo: number) {
  if (clientes <= 0 || maximo <= 0) return 0
  return Math.round((RAIO_MIN + (RAIO_MAX - RAIO_MIN) * Math.sqrt(clientes / maximo)) * 10) / 10
}

// Pendência: "bolha por cidade" exige capturar a cidade do comprador (hoje só a UF — ver app/PENDENTE-ENTREGAR.md).
// Por isso a bolha fica no centro do estado; nenhuma cidade é inventada.
export const ZOOM_MIN = 1
export const ZOOM_MAX = 8
/** A partir deste zoom, mostra a sigla e o nº de clientes junto de cada bolha. */
export const ZOOM_ROTULOS = 2
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export interface Vista { k: number; cx: number; cy: number }
export const VISTA_INICIAL: Vista = { k: 1, cx: MAPA_LARGURA / 2, cy: MAPA_ALTURA / 2 }
/** Mantém o centro de modo que a janela nunca saia do mapa. */
function centrar(v: Vista): Vista {
  const mw = MAPA_LARGURA / v.k / 2, mh = MAPA_ALTURA / v.k / 2
  return { k: v.k, cx: limitar(v.cx, mw, MAPA_LARGURA - mw), cy: limitar(v.cy, mh, MAPA_ALTURA - mh) }
}
/** Dá zoom (fator f), opcionalmente mantendo o ponto `foco` parado na tela. */
export function zoomar(v: Vista, f: number, foco?: { x: number; y: number }): Vista {
  const k = limitar(v.k * f, ZOOM_MIN, ZOOM_MAX)
  if (k === ZOOM_MIN) return VISTA_INICIAL
  const fx = foco?.x ?? v.cx, fy = foco?.y ?? v.cy
  return centrar({ k, cx: fx - (fx - v.cx) * (v.k / k), cy: fy - (fy - v.cy) * (v.k / k) })
}

export function MapaBrasil({ por_uf, maximo, ativo, onAtivo, onEscolher }: { por_uf: LinhaUf[]; maximo: number; ativo: string | null; onAtivo: (uf: string | null) => void; onEscolher: (uf: string) => void }) {
  const dados = new Map(por_uf.map((l) => [l.uf, l]))
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)
  const svg = useRef<SVGSVGElement>(null)
  const arrasto = useRef<{ x: number; y: number; cx: number; cy: number; moveu: boolean } | null>(null)
  const w = MAPA_LARGURA / vista.k, h = MAPA_ALTURA / vista.k

  // A roda do mouse precisa de ouvinte "não passivo" para não rolar a página junto.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const roda = (ev: WheelEvent) => {
      ev.preventDefault()
      const r = el.getBoundingClientRect()
      setVista((v) => {
        const vw = MAPA_LARGURA / v.k, vh = MAPA_ALTURA / v.k
        const foco = { x: v.cx - vw / 2 + ((ev.clientX - r.left) / r.width) * vw, y: v.cy - vh / 2 + ((ev.clientY - r.top) / r.height) * vh }
        return zoomar(v, ev.deltaY < 0 ? 1.25 : 0.8, foco)
      })
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [])

  const mostrarRotulos = vista.k >= ZOOM_ROTULOS
  return (
    <div className="ad-mapa-caixa">
      <div className="ad-mapa-zoom" role="group" aria-label="Controles de zoom do mapa">
        <button type="button" className="ad-zoom-btn" aria-label="Aproximar o mapa" title="Aproximar" disabled={vista.k >= ZOOM_MAX} onClick={() => setVista((v) => zoomar(v, 1.5))}><Icone nome="zoom-mais" tamanho={18} /></button>
        <button type="button" className="ad-zoom-btn" aria-label="Afastar o mapa" title="Afastar" disabled={vista.k <= ZOOM_MIN} onClick={() => setVista((v) => zoomar(v, 1 / 1.5))}><Icone nome="zoom-menos" tamanho={18} /></button>
        <button type="button" className="ad-zoom-btn" aria-label="Centralizar o mapa" title="Centralizar" disabled={vista.k === 1} onClick={() => setVista(VISTA_INICIAL)}><Icone nome="alvo" tamanho={18} /></button>
      </div>
      <svg ref={svg} className={`ad-mapa ${vista.k > 1 ? 'ad-mapa--zoom' : ''}`} viewBox={`${vista.cx - w / 2} ${vista.cy - h / 2} ${w} ${h}`} role="group" aria-label="Mapa do Brasil com os clientes por estado" onMouseLeave={() => onAtivo(null)}
        onPointerDown={(ev) => { arrasto.current = { x: ev.clientX, y: ev.clientY, cx: vista.cx, cy: vista.cy, moveu: false } }}
        onPointerMove={(ev) => {
          const a = arrasto.current
          if (!a || !(ev.buttons & 1) || vista.k === 1) return
          const dx = ev.clientX - a.x, dy = ev.clientY - a.y
          if (!a.moveu && Math.hypot(dx, dy) < 5) return
          if (!a.moveu) { try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* sem captura: segue normal */ } }
          a.moveu = true
          const r = ev.currentTarget.getBoundingClientRect()
          setVista(centrar({ k: vista.k, cx: a.cx - (dx / r.width) * w, cy: a.cy - (dy / r.height) * h }))
        }}
        onPointerCancel={() => { arrasto.current = null }}
        onPointerUp={(ev) => { try { ev.currentTarget.releasePointerCapture(ev.pointerId) } catch { /* já solto */ } setTimeout(() => { arrasto.current = null }, 0) }}
        onClickCapture={(ev) => { if (arrasto.current?.moveu) { ev.stopPropagation(); ev.preventDefault() } }}>
        {ESTADOS.map((e) => {
          const l = dados.get(e.uf) ?? { uf: e.uf, regiao: e.regiao, clientes: 0, compras: 0 }
          const rotulo = `${e.nome} — ${textoUf(l)}`
          return (
            <path key={e.uf} d={e.d} data-uf={e.uf} className={`ad-uf ${ativo === e.uf ? 'ad-uf--ativo' : ''}`} fill={FUNDO_UF} tabIndex={0} role="button" aria-label={rotulo} aria-pressed={ativo === e.uf} vectorEffect="non-scaling-stroke"
              onMouseEnter={() => onAtivo(e.uf)} onFocus={() => onAtivo(e.uf)} onBlur={() => onAtivo(null)} onClick={() => onEscolher(e.uf)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onEscolher(e.uf) } }}>
              <title>{rotulo}</title>
            </path>
          )
        })}
        <g className="ad-bolhas" aria-hidden="true">
          {ESTADOS.map((e) => {
            const l = dados.get(e.uf)
            const c = CENTRO_UF[e.uf]
            if (!l || l.clientes <= 0 || !c) return null
            return (
              <g key={e.uf}>
                <circle className={`ad-bolha ${ativo === e.uf ? 'ad-bolha--ativa' : ''}`} data-bolha={e.uf} cx={c[0]} cy={c[1]} r={raioBolha(l.clientes, maximo) / vista.k} vectorEffect="non-scaling-stroke" />
                {mostrarRotulos && <text className="ad-bolha-txt" x={c[0]} y={c[1]} fontSize={12 / vista.k} textAnchor="middle" dominantBaseline="central">{e.uf} · {l.clientes}</text>}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

/** Legenda da escala: do "nenhum" ao estado mais forte. */
export function LegendaMapa({ maximo }: { maximo: number }) {
  const m = maximo || 1
  const niveis = [{ nome: 'poucos', f: 0.05 }, { nome: 'médio', f: 0.35 }, { nome: 'muitos', f: 1 }]
  return (
    <div className="ad-legenda" aria-label="Legenda do mapa">
      <span className="ad-mute2">Quanto maior a bolha, mais clientes no estado:</span>
      {niveis.map((n) => (
        <span key={n.nome} className="ad-legenda-nivel">
          <svg width="72" height="72" viewBox="-36 -36 72 72" aria-hidden="true"><circle className="ad-bolha" r={raioBolha(Math.max(1, Math.round(m * n.f)), m)} /></svg>
          <span className="ad-mute2">{n.nome}</span>
        </span>
      ))}
      <span className="ad-mute2">(a maior tem {m} {m === 1 ? 'cliente' : 'clientes'})</span>
    </div>
  )
}
