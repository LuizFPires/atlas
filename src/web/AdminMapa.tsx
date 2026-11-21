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
export function MapaBrasil({ por_uf, maximo, ativo, onAtivo, onEscolher }: { por_uf: LinhaUf[]; maximo: number; ativo: string | null; onAtivo: (uf: string | null) => void; onEscolher: (uf: string) => void }) {
  const dados = new Map(por_uf.map((l) => [l.uf, l]))
  return (
    <svg className="ad-mapa" viewBox={`0 0 ${MAPA_LARGURA} ${MAPA_ALTURA}`} role="group" aria-label="Mapa do Brasil com os clientes por estado" onMouseLeave={() => onAtivo(null)}>
      {ESTADOS.map((e) => {
        const l = dados.get(e.uf) ?? { uf: e.uf, regiao: e.regiao, clientes: 0, compras: 0 }
        const rotulo = `${e.nome} — ${textoUf(l)}`
        return (
          <path key={e.uf} d={e.d} data-uf={e.uf} className={`ad-uf ${ativo === e.uf ? 'ad-uf--ativo' : ''}`} fill={FUNDO_UF} tabIndex={0} role="button" aria-label={rotulo} aria-pressed={ativo === e.uf}
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
          return <circle key={e.uf} className={`ad-bolha ${ativo === e.uf ? 'ad-bolha--ativa' : ''}`} data-bolha={e.uf} cx={c[0]} cy={c[1]} r={raioBolha(l.clientes, maximo)} />
        })}
      </g>
    </svg>
  )
}

/** Legenda da escala: do "nenhum" ao estado mais forte. */
export function LegendaMapa({ maximo }: { maximo: number }) {
  return (
    <div className="ad-legenda" aria-label="Legenda do mapa">
      <span className="ad-mute2">Tamanho da bolha:</span>
      {[1, 0.4, 0.1].map((f) => <svg key={f} width="44" height="44" viewBox="-22 -22 44 44" aria-hidden="true"><circle className="ad-bolha" r={Math.min(21, raioBolha(Math.max(1, Math.round((maximo || 1) * f)), maximo || 1) * 0.6)} /></svg>)}
      <span className="ad-mute2">de poucos a até {maximo || 1} {maximo === 1 ? 'cliente' : 'clientes'}</span>
    </div>
  )
}
