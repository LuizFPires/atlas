// Cronograma da obra (M41, O6 aprovado pelo Luiz em 24/11/2026): "os prazos por milestone previsto e realizado e a expectativa de
// data e horário de término". Previsto guardado no início da construção; realizado por etapa; pausas de cota; linha do AGORA; e o
// término esperado com dia e hora, refeito pelo ritmo real da obra.
import { useEffect, useState } from 'react'
import type { Cronograma, PontePainel } from './ponte-painel'
import './cronograma.css'

interface Props { obra: { nome: string; pasta: string }; painel: PontePainel; agora?: () => Date; sondagemMs?: number }

const dataHora = (iso: string) => {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
  const [sem, resto] = dia.split(', ')
  return `${sem.charAt(0).toLocaleUpperCase('pt-BR')}${sem.slice(1)}, ${resto} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
const curta = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` }
const horas = (ms: number) => { const h = Math.round(Math.abs(ms) / 3600_000); return h >= 48 ? `${Math.round(h / 24)} dias` : `${h} h` }
function falta(ms: number) {
  if (ms <= 0) return 'agora'
  const h = Math.floor(ms / 3600_000), d = Math.floor(h / 24)
  return d >= 1 ? `daqui a ${d} ${d === 1 ? 'dia' : 'dias'} e ${h % 24} h` : `daqui a ${h} h ${Math.round((ms % 3600_000) / 60_000)} min`
}

export function CronogramaDaObra({ obra, painel, agora = () => new Date(), sondagemMs = 60_000 }: Props) {
  const [c, setC] = useState<Cronograma | null>(null)
  const [sem, setSem] = useState(false)
  useEffect(() => {
    let vivo = true
    const ler = () => { if (!painel.cronograma) { setSem(true); return } painel.cronograma(obra.pasta).then((x) => { if (vivo) { setC(x); setSem(false) } }, () => { if (vivo) setSem(true) }) }
    ler()
    const id = sondagemMs ? setInterval(ler, sondagemMs) : null
    return () => { vivo = false; if (id) clearInterval(id) }
  }, [painel, obra.pasta, sondagemMs])

  if (sem && !c) return <p className="at-cr__vazio" role="status">O cronograma aparece quando a construção começar: o Atlas guarda o previsto de cada etapa e vai anotando o realizado.</p>
  if (!c) return <p role="status">O Atlas está montando o cronograma…</p>

  // Escala do tempo: do início até o maior fim (previsto, real ou esperado), com uma folga.
  const t = agora().getTime()
  const ini = Date.parse(c.inicio)
  const fins = c.etapas.flatMap((e) => [e.previsto?.fim, e.real?.fim, e.esperado?.fim]).filter(Boolean).map((x) => Date.parse(x as string))
  const fim = Math.max(t, ...fins) + 3600_000
  const x = (iso: string | number) => `${(((typeof iso === 'number' ? iso : Date.parse(iso)) - ini) / (fim - ini)) * 100}%`
  const w = (a: string | number, b: string | number) => `${Math.max(0.6, (((typeof b === 'number' ? b : Date.parse(b)) - (typeof a === 'number' ? a : Date.parse(a))) / (fim - ini)) * 100)}%`
  const dias: { nome: string; pos: string }[] = []
  for (let d = new Date(ini); d.getTime() <= fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const meia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    if (meia < ini && dias.length) continue
    const nome = new Date(Math.max(meia, ini)).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '')
    dias.push({ nome: nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1), pos: x(Math.max(meia, ini)) })
  }
  const atrasou = c.diferencaMs > 0

  return (
    <div className="at-cr">
      <section className="at-cr__resumo" aria-label="Resumo do prazo">
        <div className="at-cr__card at-cr__card--destaque">
          <span className="at-cr__rot">TÉRMINO ESPERADO</span>
          <b className="at-cr__grande">{dataHora(c.esperadoFim)}</b>
          <span className="at-cr__nota">{c.entregues === c.total ? 'Todas as etapas entregues.' : `${falta(Date.parse(c.esperadoFim) - t)}, no ritmo real da obra`}</span>
        </div>
        <div className="at-cr__card"><span className="at-cr__rot">PREVISTO NO INÍCIO</span><b className="at-cr__num">{dataHora(c.previstoFim)}</b><span className="at-cr__nota">Calculado em {curta(c.inicio)}</span></div>
        <div className="at-cr__card"><span className="at-cr__rot">DIFERENÇA</span><b className={`at-cr__num${atrasou ? ' at-cr__num--ambar' : ''}`}>{atrasou ? '+' : '−'}{horas(c.diferencaMs)}</b><span className="at-cr__nota">{c.pausaMs >= 3600_000 ? `${horas(c.pausaMs)} foram pausa da cota do Claude` : atrasou ? 'Mais demorado que o previsto' : 'Adiantada em relação ao previsto'}</span></div>
        <div className="at-cr__card"><span className="at-cr__rot">ETAPAS</span><b className="at-cr__num at-cr__num--lime">{c.entregues} de {c.total}</b><span className="at-cr__nota">Entregues{c.entregues < c.total ? ' · 1 em andamento' : ''}</span></div>
      </section>

      <section className="at-cr__gantt" aria-label="Cronograma por etapa">
        <div className="at-cr__legenda">
          <b>Etapas: previsto e realizado</b>
          <span><i className="at-cr__lg at-cr__lg--previsto" />Previsto</span>
          <span><i className="at-cr__lg at-cr__lg--real" />Realizado</span>
          <span><i className="at-cr__lg at-cr__lg--pausa" />Pausa (cota)</span>
          <span><i className="at-cr__lg at-cr__lg--esperado" />Expectativa</span>
        </div>
        <div className="at-cr__linha at-cr__linha--cab">
          <span className="at-cr__rot">ETAPA</span>
          <div className="at-cr__trilho">{dias.map((d) => <span key={d.pos} className="at-cr__dia" style={{ left: d.pos }}>{d.nome}</span>)}</div>
          <span className="at-cr__rot at-cr__direita">PREVISTO → REAL</span>
        </div>
        <ol className="at-cr__etapas" aria-label="Etapas: previsto e realizado">
          {c.etapas.map((e) => (
            <li key={e.n} className={`at-cr__linha at-cr__linha--${e.status}`}>
              <div className="at-cr__nome"><span className="at-cr__bola">{e.n}</span><span><b>{e.nome}</b><em>{e.status === 'entregue' ? 'Entregue' : e.status === 'andamento' ? `Em andamento · ${e.pct}%` : 'Ainda não começou'}</em></span></div>
              <div className="at-cr__trilho">
                {e.previsto && <span className="at-cr__barra at-cr__barra--previsto" style={{ left: x(e.previsto.inicio), width: w(e.previsto.inicio, e.previsto.fim) }} />}
                {c.pausas.filter((p) => e.real && Date.parse(p.inicio) < (e.real.fim ? Date.parse(e.real.fim) : t) && (p.fim ? Date.parse(p.fim) : t) > Date.parse(e.real.inicio)).map((p) => <span key={p.inicio} className="at-cr__barra at-cr__barra--pausa" style={{ left: x(Math.max(Date.parse(p.inicio), Date.parse(e.real!.inicio))), width: w(Math.max(Date.parse(p.inicio), Date.parse(e.real!.inicio)), Math.min(p.fim ? Date.parse(p.fim) : t, e.real!.fim ? Date.parse(e.real!.fim) : t)) }} />)}
                {e.real && <span className="at-cr__barra at-cr__barra--real" style={{ left: x(e.real.inicio), width: w(e.real.inicio, e.real.fim ?? t) }} />}
                {e.esperado && <span className="at-cr__barra at-cr__barra--esperado" style={{ left: x(Math.max(t, Date.parse(e.esperado.inicio))), width: w(Math.max(t, Date.parse(e.esperado.inicio)), e.esperado.fim) }} />}
              </div>
              <span className="at-cr__datas at-cr__direita">{e.previsto ? curta(e.previsto.fim) : '—'}{'\n'}→ {e.real?.fim ? curta(e.real.fim) : e.esperado ? `~${curta(e.esperado.fim)}` : '—'}</span>
            </li>
          ))}
          <li className="at-cr__agora" aria-hidden="true" style={{ ['--f' as string]: String((t - ini) / (fim - ini)) }}><span>AGORA</span></li>
        </ol>
        <p className="at-cr__nota">O previsto foi calculado quando a construção começou, pelo tamanho de cada etapa. O término esperado é refeito pelo ritmo real da obra. Pausas da cota do Claude não são atraso da equipe, mas empurram a data.</p>
      </section>
    </div>
  )
}
