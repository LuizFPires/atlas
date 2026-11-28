// Entrevistas na gaveta lateral (TI1TestarIdeia, Luiz em 28/11/2026): uma etiqueta para cada conversa aberta, a conversa
// do agente escolhido com o histórico salvo no teste, e a lista para procurar outro agente (prós e contras) sem perder nada.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Botao, Microfone, useVoz } from '../ui'
import { textoDaTrava } from './explicar-trava'
import type { AgenteNaCena, MensagemEntrevista, PonteTestar } from './ponte-testar'

type Filtro = 'todos' | 'usaria' | 'nao' | 'duvida' | 'mudou'
const FILTROS: { id: Filtro; nome: string }[] = [{ id: 'todos', nome: 'Todos' }, { id: 'usaria', nome: 'A favor' }, { id: 'nao', nome: 'Contra' }, { id: 'duvida', nome: 'Em dúvida' }, { id: 'mudou', nome: 'Mudou de ideia' }]
const SUGESTOES: Record<'usaria' | 'nao' | 'duvida', string[]> = {
  usaria: ['O que mais te agradou?', 'Quanto pagaria, de verdade?', 'O que faria você desistir?'],
  nao: ['Por que você não usaria?', 'O que faria você mudar de ideia?', 'Quanto pagaria, de verdade?'],
  duvida: ['O que falta para você decidir?', 'O que mais te incomodou?', 'Quanto pagaria, de verdade?'],
}
const rotulo = (a: AgenteNaCena) => (a.mudou ? 'MUDOU DE IDEIA' : a.r === 'usaria' ? 'FÃ' : a.r === 'nao' ? 'CONTRA' : 'EM DÚVIDA')
const classe = (a: AgenteNaCena) => (a.r === 'usaria' ? 'az' : a.r === 'nao' ? 'vm' : 'dv')
const quem = (a: AgenteNaCena) => `${a.nome}, ${a.idade}`
const sobre = (a: AgenteNaCena) => Object.values(a.tracos).slice(0, 2).join(' · ')

interface Props { pasta: string; n: number; ponte: PonteTestar; agentes: AgenteNaCena[]; aberto: string | 'lista'; onFechar: () => void }

export function GavetaEntrevistas({ pasta, n, ponte, agentes, aberto, onFechar }: Props) {
  const [conversas, setConversas] = useState<Record<string, MensagemEntrevista[]>>({})
  const [abertos, setAbertos] = useState<string[]>(aberto === 'lista' ? [] : [aberto])
  const [atual, setAtual] = useState<string | 'lista'>(aberto)
  const [campo, setCampo] = useState('')
  const [esperando, setEsperando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const fim = useRef<HTMLDivElement>(null)
  const porId = useMemo(() => new Map(agentes.map((a) => [a.id, a])), [agentes])
  const { gravando, alternar, suportado } = useVoz((falado) => setCampo((c) => [c, falado].filter(Boolean).join(' ')))

  // conversas já salvas neste teste viram etiquetas
  useEffect(() => {
    let vivo = true
    ponte.entrevistas(pasta, n).then((c) => {
      if (!vivo) return
      setConversas(c)
      setAbertos((ab) => [...ab, ...Object.keys(c).filter((id) => !ab.includes(id) && c[id]?.length)])
    }, () => {})
    return () => { vivo = false }
  }, [ponte, pasta, n])
  useEffect(() => { fim.current?.scrollIntoView?.({ block: 'end' }) }, [conversas, atual, esperando])
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [onFechar])

  const abrir = (id: string) => { setAbertos((ab) => (ab.includes(id) ? ab : [...ab, id])); setAtual(id); setErro(null) }
  const perguntar = (texto: string) => {
    if (atual === 'lista' || esperando) return
    const id = atual
    const t = texto.trim()
    if (!t) return
    setEsperando(id); setErro(null); setCampo('')
    ponte.entrevistar(pasta, n, id, t).then(
      ({ resposta }) => { const em = new Date().toISOString(); setConversas((c) => ({ ...c, [id]: [...(c[id] ?? []), { de: 'voce', texto: t, em }, { de: 'agente', texto: resposta, em }] })); setEsperando(null) },
      (e) => { setCampo(t); setErro(textoDaTrava(e, 'A entrevista')); setEsperando(null) },
    )
  }
  const a = atual === 'lista' ? null : porId.get(atual) ?? null
  const msgs = a ? conversas[a.id] ?? [] : []
  const lista = agentes.filter((x) => (filtro === 'todos' || (filtro === 'mudou' ? x.mudou : x.r === filtro)) && (!q.trim() || `${x.nome} ${x.idade} ${Object.values(x.tracos).join(' ')} ${x.fala ?? ''}`.toLocaleLowerCase('pt-BR').includes(q.trim().toLocaleLowerCase('pt-BR'))))

  return (
    <>
      <div className="at-gaveta__sombra" onClick={onFechar} />
      <aside className="at-gaveta" role="dialog" aria-label="Entrevistas com os agentes">
        <div className="at-gaveta__topo"><span className="at-testar__r">ENTREVISTAS · TESTE {n}</span><Botao variante="secundario" onClick={onFechar}>Fechar ✕</Botao></div>
        <div className="at-gaveta__tips" role="tablist">
          {abertos.map((id) => { const x = porId.get(id); return x ? <button key={id} type="button" role="tab" aria-selected={atual === id} className={`at-gaveta__tip ${classe(x)}`} onClick={() => setAtual(id)}><i />{quem(x)}</button> : null })}
          <button type="button" role="tab" aria-selected={atual === 'lista'} className="at-gaveta__tip at-gaveta__tip--mais" onClick={() => setAtual('lista')}>+ agente</button>
        </div>
        {atual === 'lista' ? (
          <div className="at-gaveta__lista">
            <input className="at-gaveta__busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome, profissão, cidade ou o que disse…" aria-label="Procurar agente" />
            <div className="at-gaveta__filtros">{FILTROS.map((f) => <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.nome}</button>)}</div>
            <div className="at-gaveta__itens">
              {lista.slice(0, 80).map((x) => (
                <button key={x.id} type="button" className="at-gaveta__ag" onClick={() => abrir(x.id)}>
                  <span className={`at-gaveta__av ${classe(x)}`}>{x.nome.charAt(0)}</span>
                  <span><b>{quem(x)}</b>{sobre(x)}{x.fala && <q>“{x.fala}”</q>}</span>
                  <span className={`at-gaveta__selo ${classe(x)}`}>{rotulo(x)}</span>
                </button>
              ))}
              {lista.length === 0 && <span className="at-testar__nota">Nenhum agente com esse filtro.</span>}
              {lista.length > 80 && <span className="at-testar__nota">Mostrando 80 de {lista.length}. Procure pelo nome para achar outro.</span>}
            </div>
          </div>
        ) : a && (
          <>
            <div className="at-gaveta__quem"><span className={`at-gaveta__av ${classe(a)}`}>{a.nome.charAt(0)}</span><div><b>{quem(a)}</b><span>{Object.values(a.tracos).join(' · ')}</span></div><span className={`at-gaveta__selo ${classe(a)}`}>{rotulo(a)}</span></div>
            <div className="at-gaveta__chat" aria-live="polite">
              {a.fala && <div className="at-gaveta__msg at-gaveta__msg--ag"><small>Ao olhar as telas</small>{a.fala}</div>}
              {msgs.map((m, i) => <div key={i} className={`at-gaveta__msg${m.de === 'voce' ? ' at-gaveta__msg--voce' : ' at-gaveta__msg--ag'}`}>{m.texto}</div>)}
              {esperando === a.id && <div className="at-gaveta__msg at-gaveta__msg--ag at-gaveta__msg--esp">{a.nome} está pensando…</div>}
              <div ref={fim} />
            </div>
            {erro && <p className="at-testar__erro" role="alert">{erro}</p>}
            <div className="at-gaveta__sug">{SUGESTOES[a.r ?? 'duvida'].map((s) => <button key={s} type="button" disabled={!!esperando} onClick={() => perguntar(s)}>{s}</button>)}</div>
            <form className="at-gaveta__in" onSubmit={(e) => { e.preventDefault(); perguntar(campo) }}>
              <textarea value={campo} onChange={(e) => setCampo(e.target.value)} rows={2} placeholder="Pergunte ou fale pelo microfone…" aria-label="Sua pergunta" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); perguntar(campo) } }} />
              {suportado && <Microfone gravando={gravando} onAlternar={alternar} />}
              <Botao type="submit" disabled={!!esperando || !campo.trim()}>Perguntar</Botao>
            </form>
          </>
        )}
        <span className="at-testar__nota">É um agente de IA fazendo um papel, não uma pessoa real. As conversas ficam salvas neste teste.</span>
      </aside>
    </>
  )
}
