// Aba Desempenho (aprovada pelo Luiz em 26/11/2026, protótipo O7): "o consumo de tokens manda no tempo". A curva S do consumo do
// plano do Claude (previsto, realizado e projetado), o ritmo de gasto, as pausas previstas pela cota e o término projetado já
// contando essas pausas. Tudo em % do orçamento da obra; o número de tokens nunca aparece (não diz nada para quem não programa).
import { useEffect, useState } from 'react'
import type { Desempenho, PontePainel } from './ponte-painel'
import './desempenho.css'

interface Props { obra: { nome: string; pasta: string }; painel: PontePainel; agora?: () => Date; sondagemMs?: number }

const NOME_PLANO: Record<Desempenho['plano'], string> = { pro: 'Pro', max: 'Max', ultra: 'Ultra' }
const SOBRE_PLANO: Record<Desempenho['plano'], string> = { pro: 'uma janela de uso a cada 5 h', max: '5 vezes o Pro a cada 5 h', ultra: 'sem a janela de 5 h' }
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const hh = (d: Date) => `${String(d.getHours()).padStart(2, '0')}h`
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
function quando(iso: string) {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
  const [sem, resto] = dia.split(', ')
  return `${sem.charAt(0).toLocaleUpperCase('pt-BR')}${sem.slice(1)}, ${resto} · ~${hh(d)}`
}
const duracao = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); const h = Math.floor(m / 60); return h >= 24 ? `${Math.round(h / 24)} dias` : h ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m} min` }

export function DesempenhoDaObra({ obra, painel, agora = () => new Date(), sondagemMs = 5 * 60_000 }: Props) {
  const [d, setD] = useState<Desempenho | null>(null)
  const [sem, setSem] = useState(false)
  useEffect(() => {
    let vivo = true
    const ler = () => { if (!painel.desempenho) { setSem(true); return } painel.desempenho(obra.pasta).then((x) => { if (vivo) { setD(x); setSem(false) } }, () => { if (vivo) setSem(true) }) }
    ler()
    const id = sondagemMs ? setInterval(ler, sondagemMs) : null
    return () => { vivo = false; if (id) clearInterval(id) }
  }, [painel, obra.pasta, sondagemMs])

  if (sem && !d) return <p className="at-de__vazio" role="status">O desempenho aparece quando a construção começar: o Atlas mede quanto do seu plano do Claude a obra gasta e projeta o término, já contando as pausas da cota.</p>
  if (!d) return <p role="status">O Atlas está calculando o desempenho…</p>

  const t = agora().getTime()
  const fim = Date.parse(d.terminoProjetado)
  const esperaMs = d.pausasPrevistas.reduce((s, p) => s + Math.max(0, Date.parse(p.fim) - Math.max(t, Date.parse(p.inicio))), 0)
  const trabalhoMs = Math.max(0, fim - t - esperaMs)
  const n = d.pausasPrevistas.length
  const proxima = d.pausasPrevistas.find((p) => Date.parse(p.fim) > t)
  const plano = NOME_PLANO[d.plano]
  const ritmo = d.ritmo
  const ritmoTxt = ritmo === null ? '—' : Math.abs(ritmo) < 0.02 ? 'no previsto' : `${ritmo > 0 ? '+' : '−'}${Math.round(Math.abs(ritmo) * 100)}%`
  const ritmoNota = ritmo === null ? 'aparece depois do 1º avanço' : Math.abs(ritmo) < 0.02 ? 'gastando o previsto' : ritmo > 0 ? 'gastando mais que o previsto' : 'gastando menos que o previsto'
  const estimativa = d.estimativaInicial || (d.plano !== 'ultra' && !d.cotaAprendida)

  return (
    <div className="at-de">
      <section className="at-de__resumo" aria-label="Resumo do desempenho">
        <div className="at-de__card at-de__card--destaque">
          <span className="at-de__rot">TÉRMINO PROJETADO</span>
          <b className="at-de__grande">{quando(d.terminoProjetado)}</b>
          <span className="at-de__nota">
            {fim <= t ? 'A obra está terminando.' : `≈ ${duracao(trabalhoMs)} de trabalho${n ? ` + ${n} ${n === 1 ? 'pausa' : 'pausas'} da cota do plano ${plano} (≈ ${duracao(esperaMs)} esperando)` : ''}. Conta feita se só esta obra trabalhar.`}
          </span>
        </div>
        <div className="at-de__card"><span className="at-de__rot">CONSUMO</span><b className="at-de__num">{pct(d.realizadoPct)}</b><span className="at-de__nota">{`previsto até agora: ${pct(d.previstoAgoraPct)}`}</span></div>
        <div className={`at-de__card${ritmo !== null && ritmo >= 0.02 ? ' at-de__card--ambar' : ''}`}><span className="at-de__rot">RITMO DE GASTO</span><b className={`at-de__num${ritmo !== null && ritmo >= 0.02 ? ' at-de__num--ambar' : ritmo !== null && ritmo <= -0.02 ? ' at-de__num--lime' : ''}`}>{ritmoTxt}</b><span className="at-de__nota">{ritmoNota}</span></div>
        <div className="at-de__card"><span className="at-de__rot">PAUSAS PREVISTAS</span><b className="at-de__num">{n}</b><span className="at-de__nota">{n === 0 ? 'sem pausas previstas' : proxima ? (Date.parse(proxima.inicio) <= t ? `parada agora, volta ~${hhmm(new Date(proxima.fim))}` : `a próxima ~${hhmm(new Date(proxima.inicio))}`) : 'sem pausas previstas'}</span></div>
        <div className="at-de__card"><span className="at-de__rot">PLANO</span><b className="at-de__num">{plano}</b><span className="at-de__nota">{SOBRE_PLANO[d.plano]}</span></div>
      </section>

      <section className="at-de__grafico" aria-label="Curva S do consumo">
        <div className="at-de__legenda">
          <b>Curva S do consumo</b>
          <span><i className="at-de__lg at-de__lg--previsto" />Previsto</span>
          <span><i className="at-de__lg at-de__lg--real" />Realizado</span>
          <span><i className="at-de__lg at-de__lg--proj" />Projetado</span>
          <span><i className="at-de__lg at-de__lg--pausa" />Pausa da cota</span>
        </div>
        <Curva d={d} agora={t} />
        {estimativa && <p className="at-de__aviso">{d.estimativaInicial ? 'O orçamento' : 'O tamanho da cota'} ainda é uma estimativa: fica mais certo depois da 1ª etapa entregue e da 1ª pausa da cota (a Anthropic não publica quanto cabe em cada janela de 5 h).</p>}
        <p className="at-de__nota">Refeito a cada 5 min pelo ritmo real da obra. Se outra obra trabalhar junto, a cota é dividida e o término vai mais longe. O plano Pro e o Max também têm um limite por semana, que pode causar uma pausa mais longa.</p>
      </section>
    </div>
  )
}

/** O gráfico: eixo do tempo do início até o término mais distante; consumo de 0 a 100% (ou mais, se passar do orçamento). */
function Curva({ d, agora }: { d: Desempenho; agora: number }) {
  const W = 1000, Hh = 300, E = 48, B = 268, T = 16
  const todos = [...d.serie.previsto, ...d.serie.realizado, ...d.serie.projetado]
  const t0 = Math.min(...todos.map((p) => Date.parse(p.t)), agora)
  const t1 = Math.max(...todos.map((p) => Date.parse(p.t)), Date.parse(d.terminoProjetado), agora + 3600_000)
  const vMax = Math.max(100, ...todos.map((p) => p.v))
  const x = (t: number) => E + ((t - t0) / (t1 - t0)) * (W - E - 8)
  const y = (v: number) => B - (v / vMax) * (B - T)
  const linha = (ps: { t: string; v: number }[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${x(Date.parse(p.t)).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const passoH = Math.max(1, Math.ceil((t1 - t0) / 3600_000 / 8))
  const marcas: number[] = []
  for (let h = Math.ceil(t0 / 3600_000) * 3600_000; h <= t1; h += passoH * 3600_000) marcas.push(h)
  const ultimo = d.serie.projetado[d.serie.projetado.length - 1]
  return (
    <svg className="at-de__svg" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={`Curva S do consumo: previsto, realizado até agora (${d.realizadoPct.toLocaleString('pt-BR')}%) e projetado até o término`}>
      {[0, 25, 50, 75, 100].map((v) => <g key={v}><line className="at-de__grade" x1={E} x2={W - 8} y1={y(v)} y2={y(v)} /><text className="at-de__eixo" x={E - 8} y={y(v) + 4} textAnchor="end">{v}%</text></g>)}
      {marcas.map((h) => <text key={h} className="at-de__eixo" x={x(h)} y={Hh - 8} textAnchor={x(h) > W - 40 ? 'end' : 'middle'}>{hh(new Date(h))}</text>)}
      {d.pausasPrevistas.map((p) => <rect key={p.inicio} data-pausa className="at-de__pausa" x={x(Math.max(t0, Date.parse(p.inicio)))} y={T} width={Math.max(2, x(Date.parse(p.fim)) - x(Math.max(t0, Date.parse(p.inicio))))} height={B - T} />)}
      <path data-serie="previsto" className="at-de__previsto" d={linha(d.serie.previsto)} />
      <path data-serie="projetado" className="at-de__proj" d={linha(d.serie.projetado)} />
      <path data-serie="realizado" className="at-de__real" d={linha(d.serie.realizado)} />
      <line className="at-de__agora" x1={x(agora)} x2={x(agora)} y1={T} y2={B} />
      <text className="at-de__agora-txt" x={x(agora) + 6} y={B - 8}>agora</text>
      {ultimo && <circle className="at-de__fim" cx={x(Date.parse(ultimo.t))} cy={y(ultimo.v)} r={6} />}
    </svg>
  )
}
