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
function quandoCurto(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const mesmoDia = d.toDateString() === hoje.toDateString()
  return mesmoDia ? hhmm(d) : `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${hhmm(d)}`
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
  const ritmoNota = ritmo === null ? 'aparece depois do 1º avanço' : Math.abs(ritmo) < 0.02 ? 'gastando o previsto para o que já foi feito' : ritmo > 0 ? `para o que já foi feito, gastou ${Math.round(ritmo * 100)}% a mais do plano que o previsto: por isso o término vai mais longe` : `para o que já foi feito, gastou ${Math.round(-ritmo * 100)}% a menos que o previsto: o término vem mais cedo`
  const estimativa = d.estimativaInicial || (d.plano !== 'ultra' && !d.cotaAprendida)
  const paradaAgora = (d.semTrabalho ?? []).find((p) => p.ate_agora) ?? null
  const paradasAntes = (d.semTrabalho ?? []).filter((p) => !p.ate_agora)
  const fimPct = d.projetadoFimPct ?? null

  return (
    <div className="at-de">
      {paradaAgora && (
        <p className="at-de__alerta" role="status"><b>A obra não está trabalhando agora</b> desde {quandoCurto(paradaAgora.inicio)}. Ela só trabalha com o computador ligado e o Atlas aberto. Se ele estiver aberto e a obra parada, confira em Construção se ela foi pausada.</p>
      )}
      <section className="at-de__resumo" aria-label="Resumo do desempenho">
        <div className="at-de__card at-de__card--destaque">
          <span className="at-de__rot">TÉRMINO PROJETADO</span>
          <b className="at-de__grande">{quando(d.terminoProjetado)}</b>
          <span className="at-de__nota">
            {fim <= t ? 'A obra está terminando.' : `≈ ${duracao(trabalhoMs)} de trabalho${n ? ` + ${n} ${n === 1 ? 'pausa' : 'pausas'} da cota do plano ${plano} (≈ ${duracao(esperaMs)} esperando)` : ''}. Vale se o computador ficar ligado, com o Atlas aberto, direto até lá.`}
          </span>
        </div>
        <div className="at-de__card"><span className="at-de__rot">CONSUMO</span><b className="at-de__num">{pct(d.realizadoPct)}</b><span className="at-de__nota">{`do orçamento da obra · o previsto para agora era ${pct(d.previstoAgoraPct)}`}{fimPct !== null && fimPct > 100.5 ? ` · no fim deve usar ~${Math.round(fimPct)}%` : ''}</span></div>
        <div className={`at-de__card${ritmo !== null && ritmo >= 0.02 ? ' at-de__card--ambar' : ''}`}><span className="at-de__rot">RITMO DE GASTO</span><b className={`at-de__num${ritmo !== null && ritmo >= 0.02 ? ' at-de__num--ambar' : ritmo !== null && ritmo <= -0.02 ? ' at-de__num--lime' : ''}`}>{ritmoTxt}</b><span className="at-de__nota">{ritmoNota}</span></div>
        <div className="at-de__card"><span className="at-de__rot">PAUSAS PREVISTAS</span><b className="at-de__num">{n}</b><span className="at-de__nota">{n === 0 ? 'sem pausas previstas' : `${proxima ? (Date.parse(proxima.inicio) <= t ? `parada agora, volta ~${hhmm(new Date(proxima.fim))}` : `a próxima ~${hhmm(new Date(proxima.inicio))}`) : ''} · o Atlas espera a cota renovar e volta sozinho, sem você fazer nada`}</span></div>
        <div className="at-de__card"><span className="at-de__rot">PLANO</span><b className="at-de__num">{plano}</b><span className="at-de__nota">{SOBRE_PLANO[d.plano]}</span></div>
      </section>

      <section className="at-de__grafico" aria-label="Curva S do consumo">
        <div className="at-de__legenda">
          <b>Curva S do consumo</b>
          <span><i className="at-de__lg at-de__lg--previsto" />Previsto</span>
          <span><i className="at-de__lg at-de__lg--real" />Realizado</span>
          <span><i className="at-de__lg at-de__lg--proj" />Projetado</span>
          <span><i className="at-de__lg at-de__lg--pausa" />Pausa da cota</span>
          {(d.semTrabalho?.length ?? 0) > 0 && <span><i className="at-de__lg at-de__lg--parada" />Sem trabalhar</span>}
        </div>
        <Curva d={d} agora={t} />
        {estimativa && <p className="at-de__aviso">{d.estimativaInicial ? 'O orçamento' : 'O tamanho da cota'} ainda é uma estimativa: fica mais certo depois da 1ª etapa entregue e da 1ª pausa da cota (a Anthropic não publica quanto cabe em cada janela de 5 h).</p>}
        {paradasAntes.length > 0 && <p className="at-de__nota">{`A linha reta${paradasAntes.length > 1 ? ' nos trechos cinza' : ' no trecho cinza'} é tempo em que a obra não trabalhou (${paradasAntes.map((p) => `${quandoCurto(p.inicio)} até ${quandoCurto(p.fim)}`).join('; ')}): computador desligado, Atlas fechado ou obra pausada.`}</p>}
        <div className="at-de__comoler" aria-label="Como ler esta projeção">
          <b>Como ler esta projeção</b>
          <ul>
            <li><b>A obra trabalha sozinha</b>, mas só com o computador ligado e o Atlas aberto (pode minimizar e usar o computador para outras coisas). Fechou o Atlas ou desligou, ela para; ao abrir de novo, continua de onde parou.</li>
            <li><b>O término projetado já conta isso:</b> ele considera o computador ligado direto daqui até o fim. Cada hora desligado empurra o término mais ou menos uma hora.</li>
            <li><b>As pausas da cota não dependem de você:</b> o plano {plano} libera uso a cada 5 h. Quando acaba, a obra espera e volta sozinha.</li>
            <li><b>Refeito a cada 5 min</b> pelo ritmo real. Outra obra trabalhando junto divide a cota e afasta o término. O plano também tem um limite por semana, que pode dar uma pausa mais longa.</li>
          </ul>
        </div>
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
      {Array.from({ length: Math.ceil(vMax / 25) + 1 }, (_, k) => k * 25).filter((v) => v <= vMax + 0.01).map((v) => <g key={v}><line className={`at-de__grade${v === 100 ? ' at-de__grade--orc' : ''}`} x1={E} x2={W - 8} y1={y(v)} y2={y(v)} /><text className="at-de__eixo" x={E - 8} y={y(v) + 4} textAnchor="end">{v}%</text>{v === 100 && vMax > 100 && <text className="at-de__eixo at-de__eixo--orc" x={E + 6} y={y(v) - 5}>orçamento previsto</text>}</g>)}
      {(d.semTrabalho ?? []).map((p) => <rect key={`p-${p.inicio}`} data-parada className="at-de__parada" x={x(Math.max(t0, Date.parse(p.inicio)))} y={T} width={Math.max(2, x(Math.min(t1, Date.parse(p.fim))) - x(Math.max(t0, Date.parse(p.inicio))))} height={B - T} />)}
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
