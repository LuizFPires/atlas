// Aba "Mapa" do painel do administrador: onde os clientes estão, por estado. Só números agregados por UF (nunca dado de pessoa).
import { ESTADOS, MAPA_ALTURA, MAPA_LARGURA, NOME_REGIAO, type Regiao } from './mapa-brasil'
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

/** Cor do estado: zero = neutro; de 1 até o máximo, do verde-suave até o lime (tokens do tema). */
const corEstado = (clientes: number, maximo: number) =>
  clientes <= 0 || maximo <= 0 ? 'var(--card-b)' : `color-mix(in srgb, var(--lime) ${Math.round(30 + 70 * (clientes / maximo))}%, var(--soft))`

export function MapaBrasil({ por_uf, maximo, ativo, onAtivo, onEscolher }: { por_uf: LinhaUf[]; maximo: number; ativo: string | null; onAtivo: (uf: string | null) => void; onEscolher: (uf: string) => void }) {
  const dados = new Map(por_uf.map((l) => [l.uf, l]))
  return (
    <svg className="ad-mapa" viewBox={`0 0 ${MAPA_LARGURA} ${MAPA_ALTURA}`} role="group" aria-label="Mapa do Brasil com os clientes por estado" onMouseLeave={() => onAtivo(null)}>
      {ESTADOS.map((e) => {
        const l = dados.get(e.uf) ?? { uf: e.uf, regiao: e.regiao, clientes: 0, compras: 0 }
        const rotulo = `${e.nome} — ${textoUf(l)}`
        return (
          <path key={e.uf} d={e.d} data-uf={e.uf} className={`ad-uf ${ativo === e.uf ? 'ad-uf--ativo' : ''}`} fill={corEstado(l.clientes, maximo)} tabIndex={0} role="button" aria-label={rotulo} aria-pressed={ativo === e.uf}
            onMouseEnter={() => onAtivo(e.uf)} onFocus={() => onAtivo(e.uf)} onBlur={() => onAtivo(null)} onClick={() => onEscolher(e.uf)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onEscolher(e.uf) } }}>
            <title>{rotulo}</title>
          </path>
        )
      })}
    </svg>
  )
}

/** Legenda da escala: do "nenhum" ao estado mais forte. */
export function LegendaMapa({ maximo }: { maximo: number }) {
  return (
    <div className="ad-legenda" aria-label="Legenda do mapa">
      <span className="ad-legenda-cor" style={{ background: corEstado(0, 1) }} aria-hidden="true" /><span className="ad-mute2">nenhum</span>
      <span className="ad-legenda-grad" aria-hidden="true" />
      <span className="ad-mute2">até {maximo || 1} {maximo === 1 ? 'cliente' : 'clientes'}</span>
    </div>
  )
}
