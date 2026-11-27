// Revisões do pós-obra na aba Desempenho (aprovado pelo Luiz em 27/11/2026, protótipo caminho-novo/O8Revisoes, ideia 2B):
// - lateral à direita da curva S, RECOLHIDA por padrão: uma coluna fina com uma barrinha por revisão mostrando só o % feito
//   (cheia = entregue; a que está andando em âmbar) e o botão discreto "Revisões →";
// - aberta (‹): até 5 cartões, a mais recente no topo, e "Ver todas as revisões →";
// - os dois botões abrem a gaveta com TODAS as revisões: média, mais rápida e mais lenta, filtros e a lista por dia, com o tempo
//   que cada uma levou contra o que o Atlas tinha estimado. O tempo só aparece na gaveta (Luiz: "no menu colapsado só o percentual").
import { useEffect, useRef, useState } from 'react'
import type { Revisao, StatusPedido } from './ponte-posobra'

export const tempo = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`)
const dois = (n: number) => String(n).padStart(2, '0')
const SITUACAO: Record<StatusPedido, string> = { 'no-ar': 'NO AR', 'para-conferir': 'CONFERIR', 'em-andamento': '' }
const situacao = (r: Revisao) => (r.status === 'em-andamento' ? `${r.pct}%` : SITUACAO[r.status])
const dataCurta = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}` }
const horaCurta = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${dois(d.getHours())}h${dois(d.getMinutes())}` }

/** Números das revisões prontas: média do tempo que levaram, diferença média contra o estimado, a mais rápida e a mais lenta. */
export function resumoRevisoes(revs: Revisao[]) {
  const prontas = revs.filter((r) => r.status !== 'em-andamento' && r.minutosReais !== null) as (Revisao & { minutosReais: number })[]
  if (!prontas.length) return null
  const media = Math.round(prontas.reduce((s, r) => s + r.minutosReais, 0) / prontas.length)
  const diferenca = Math.round(prontas.reduce((s, r) => s + r.minutosReais - r.minutosEstimados, 0) / prontas.length)
  const rapida = prontas.reduce((a, b) => (b.minutosReais < a.minutosReais ? b : a))
  const lenta = prontas.reduce((a, b) => (b.minutosReais > a.minutosReais ? b : a))
  return { media, diferenca, rapida, lenta }
}

const diferencaTxt = (d: number) => (d === 0 ? 'igual' : `${d > 0 ? '+' : '−'}${tempo(Math.abs(d))}`)

function notaDoCartao(r: Revisao, agora: Date) {
  const hoje = r.pedidaEm && new Date(r.pedidaEm).toDateString() === agora.toDateString()
  const pedida = `pedida ${hoje ? `hoje ${horaCurta(r.pedidaEm)}` : dataCurta(r.pedidaEm)}`
  if (r.status !== 'em-andamento') return `${pedida} · levou ${r.minutosReais !== null ? tempo(r.minutosReais) : '—'} (est. ${tempo(r.minutosEstimados)})`
  const falta = r.minutosEstimados - (r.minutosAteAgora ?? 0)
  return `${pedida} · ${falta > 0 ? `~${tempo(falta)} para terminar` : 'passou do estimado, terminando'}`
}

interface LateralProps { revisoes: Revisao[]; aberta: boolean; onAbrir: () => void; onRecolher: () => void; onVerTodas: () => void; agora: Date }

export function RevisoesLateral({ revisoes, aberta, onAbrir, onRecolher, onVerTodas, agora }: LateralProps) {
  if (!aberta) {
    return (
      <aside className="at-rv-mini" aria-label="Revisões (recolhida)">
        <button type="button" className="at-rv-mini__abrir" onClick={onAbrir} aria-label="Abrir a lateral das revisões" aria-expanded="false">‹</button>
        <span className="at-rv__rot at-rv-mini__tit">REVISÕES</span>
        <span className="at-rv-mini__sub">quanto já foi feito</span>
        <ul className="at-rv-mini__lista">
          {revisoes.slice(0, 16).map((r) => (
            <li key={r.id} className={`at-rv-mini__item${r.status === 'em-andamento' ? ' at-rv-mini__item--agora' : ''}`} title={`Rev ${dois(r.numero)} · ${r.nome} · ${r.pct}%`}>
              <span><span>R{dois(r.numero)}</span><span>{r.pct}%</span></span>
              <i aria-hidden="true"><b style={{ width: `${r.pct}%` }} /></i>
            </li>
          ))}
          {revisoes.length === 0 && <li className="at-rv-mini__vazio">nenhuma ainda</li>}
        </ul>
        <button type="button" className="at-rv-mini__todas" onClick={onVerTodas}>Revisões →</button>
      </aside>
    )
  }
  const res = resumoRevisoes(revisoes)
  return (
    <aside className="at-rv-lado" aria-label="Revisões">
      <div className="at-rv-lado__cab">
        <h2>Revisões <span>{revisoes.length}</span></h2>
        <button type="button" className="at-rv-lado__recolher" onClick={onRecolher} aria-expanded="true">Recolher ›</button>
      </div>
      {res && (
        <div className="at-rv-lado__nums">
          <div><span className="at-rv__rot">VELOCIDADE</span><b>~{tempo(res.media)}</b><small>por revisão, na média</small></div>
          <div><span className="at-rv__rot">PREVISTO × REAL</span><b>{diferencaTxt(res.diferenca)}</b><small>{res.diferenca > 0 ? 'a mais que o estimado' : res.diferenca < 0 ? 'a menos que o estimado' : 'que o estimado'}</small></div>
        </div>
      )}
      <ul className="at-rv-lado__pilha">
        {revisoes.slice(0, 5).map((r) => {
          const ag = r.status === 'em-andamento'
          return (
            <li key={r.id} className={`at-rv-card${ag ? ' at-rv-card--agora' : ''}`}>
              <span className="at-rv-card__topo"><span className="at-rv__rot">REV {dois(r.numero)}{ag ? ' · AGORA' : ''}</span><span className="at-rv__sit">{situacao(r)}</span></span>
              <b>{r.nome}</b>
              <i className="at-rv__barra" aria-hidden="true"><b style={{ width: `${r.pct}%` }} /></i>
              <span>{notaDoCartao(r, agora)}</span>
            </li>
          )
        })}
        {revisoes.length === 0 && <li className="at-rv-lado__vazio">Nenhuma revisão ainda. Quando você pedir uma mudança (em “Pedir mudança”), ela aparece aqui.</li>}
      </ul>
      <button type="button" className="at-rv-lado__todas" onClick={onVerTodas}>Ver todas as revisões →</button>
    </aside>
  )
}

type Filtro = 'todas' | StatusPedido
const FILTROS: { id: Filtro; nome: string }[] = [
  { id: 'todas', nome: 'Todas' }, { id: 'no-ar', nome: 'No ar' }, { id: 'para-conferir', nome: 'Para conferir' }, { id: 'em-andamento', nome: 'Em andamento' },
]

export function GavetaRevisoes({ revisoes, obra, onFechar, agora }: { revisoes: Revisao[]; obra: string; onFechar: () => void; agora: Date }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const fechar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    fechar.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])
  const res = resumoRevisoes(revisoes)
  const max = Math.max(1, ...revisoes.map((r) => Math.max(r.minutosReais ?? r.minutosAteAgora ?? 0, r.minutosEstimados)))
  const lista = revisoes.filter((r) => filtro === 'todas' || r.status === filtro)
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1)
  const nomeDia = (iso: string | null) => {
    if (!iso) return 'SEM DATA'
    const d = new Date(iso)
    return `${d.toDateString() === agora.toDateString() ? 'HOJE · ' : d.toDateString() === ontem.toDateString() ? 'ONTEM · ' : ''}${dataCurta(iso)}`
  }
  return (
    <>
      <div className="at-rv-fundo" onClick={onFechar} aria-hidden="true" />
      <aside className="at-rv-gaveta" role="dialog" aria-modal="true" aria-label="Todas as revisões">
        <div className="at-rv-gaveta__cab">
          <div><span className="at-rv__rot">TODAS AS REVISÕES</span><h2>{revisoes.length} {revisoes.length === 1 ? 'revisão' : 'revisões'} {obra ? `de ${obra}` : ''}</h2></div>
          <button type="button" ref={fechar} className="at-rv-gaveta__fechar" onClick={onFechar}>Fechar ✕</button>
        </div>
        {res && (
          <div className="at-rv-gaveta__resumo">
            <div><small>Média</small><b>{tempo(res.media)}</b><small>por revisão</small></div>
            <div><small>Mais rápida</small><b>{tempo(res.rapida.minutosReais)}</b><small>Rev {dois(res.rapida.numero)} · {res.rapida.nome}</small></div>
            <div><small>Mais lenta</small><b className="at-rv__ambar">{tempo(res.lenta.minutosReais)}</b><small>Rev {dois(res.lenta.numero)} · {res.lenta.nome}</small></div>
          </div>
        )}
        <div className="at-rv-gaveta__chips" role="group" aria-label="Filtrar revisões">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
              {f.nome} ({f.id === 'todas' ? revisoes.length : revisoes.filter((r) => r.status === f.id).length})
            </button>
          ))}
        </div>
        <div className="at-rv-gaveta__thead" aria-hidden="true"><span>REV</span><span>O QUE MUDOU</span><span>TEMPO QUE LEVOU</span><span /><span>SITUAÇÃO</span></div>
        <div className="at-rv-gaveta__lista">
          {lista.length === 0 && <p className="at-rv-gaveta__vazio">{revisoes.length ? 'Nenhuma revisão nesta situação.' : 'Nenhuma revisão ainda. Quando você pedir uma mudança (em “Pedir mudança”), ela aparece aqui com o tempo que levou.'}</p>}
          {lista.map((r, i) => {
            const dia = nomeDia(r.pedidaEm)
            const cabDia = i === 0 || nomeDia(lista[i - 1].pedidaEm) !== dia
            const ag = r.status === 'em-andamento'
            const min = r.minutosReais ?? r.minutosAteAgora ?? 0
            return (
              <div key={r.id} className="at-rv-gaveta__grupo">
                {cabDia && <div className="at-rv-gaveta__dia">{dia}</div>}
                <div className={`at-rv-linha${ag ? ' at-rv-linha--agora' : ''}`} data-revisao={r.numero}>
                  <span className={`at-rv-linha__n${res && r.id === res.lenta.id && revisoes.length > 1 ? ' at-rv__ambar' : ''}`}>REV {dois(r.numero)}</span>
                  <span className="at-rv-linha__nome" title={r.nome}>{r.nome}</span>
                  <span className="at-rv-linha__barra" aria-hidden="true">
                    <b style={{ width: `${Math.min(100, (min / max) * 100)}%` }} />
                    <i className="at-rv-linha__est" style={{ left: `${(r.minutosEstimados / max) * 100}%` }} />
                    {res && <i className="at-rv-linha__med" style={{ left: `${(res.media / max) * 100}%` }} />}
                  </span>
                  <span className="at-rv-linha__t">{ag ? `${tempo(min)} até agora` : `${tempo(min)} · est. ${tempo(r.minutosEstimados)}`}</span>
                  <span className="at-rv__sit">{ag ? `${r.pct}%` : r.status === 'para-conferir' ? 'CONFERIR' : `NO AR`}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="at-rv-gaveta__pe"><span><i className="at-rv-gaveta__tk" />risquinho = o que o Atlas tinha estimado</span>{res && <span><i className="at-rv-gaveta__md" />linha = média de todas</span>}</div>
      </aside>
    </>
  )
}
