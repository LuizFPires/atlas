import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../ui'
import canteiroImagem from '../assets/canteiro-3d.jpg'
import type { PonteObras } from './ponte-obras'
import { faseDaObra, nomeDaPasta, type EtapaObra, type FaseObra } from './fase-obra'
import type { ObraParaContinuar } from './Obras'
import './canteiro.css'

// Canteiro de obras e Obras concluídas (Milestone 37; protótipo prototipo/caminho-novo/K1Canteiro e K2Concluidas, aprovado pelo
// Luiz em 23/11/2026). O Canteiro mostra só as obras vivas (inacabadas primeiro, depois em construção); as prontas ficam em
// Obras concluídas. Cada cartão abre a obra na etapa em que ela está.

/** Número da etapa no caminho de 6 (ideia, visual, nome, protótipo, contas, começar) e o próximo passo, para obra inacabada. */
const PASSO: Record<Exclude<EtapaObra, 'obra'>, { n: number; proximo: string }> = {
  estilo: { n: 2, proximo: 'escolher o visual' },
  batismo: { n: 3, proximo: 'escolher o nome' },
  telas: { n: 4, proximo: 'conferir o protótipo' },
  aprovar: { n: 5, proximo: 'abrir as contas' },
}

type Lida = { pasta: string; nome: string; fase: FaseObra }
type Filtro = 'todas' | 'falta' | 'construcao'

interface Props {
  modo: 'canteiro' | 'concluidas'
  obras: PonteObras
  /** O % das obras em construção (painel da obra). */
  painel?: { ler(pasta: string): Promise<{ pct: number }> }
  onAbrir: (o: ObraParaContinuar) => void
  onNova: () => void
}

export function Canteiro({ modo, obras, painel, onAbrir, onNova }: Props) {
  const [lidas, setLidas] = useState<Lida[] | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let vivo = true
    void (async () => {
      const l = await obras.listar().catch(() => [] as string[])
      const out: Lida[] = []
      for (const pasta of l.slice(0, 200)) {
        const s = obras.situacao ? await obras.situacao(pasta).catch(() => null) : null
        if (!s) continue
        const pct = s.plano && painel ? await painel.ler(pasta).then((e) => e.pct, () => null) : null
        out.push({ pasta, nome: nomeDaPasta(pasta), fase: faseDaObra(s, pct) })
      }
      if (vivo) setLidas(out)
    })()
    return () => { vivo = false }
  }, [obras, painel])

  const daqui = useMemo(() => {
    const todas = (lidas ?? []).filter((o) => (modo === 'concluidas' ? o.fase.concluida : !o.fase.concluida))
    // Inacabadas primeiro (estão esperando a pessoa), depois as em construção.
    return [...todas.filter((o) => o.fase.etapa !== 'obra'), ...todas.filter((o) => o.fase.etapa === 'obra')]
  }, [lidas, modo])
  const nFalta = daqui.filter((o) => o.fase.etapa !== 'obra').length
  const nConstrucao = daqui.length - nFalta
  const termo = busca.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '')
  const mostradas = daqui
    .filter((o) => modo === 'concluidas' || filtro === 'todas' || (filtro === 'falta') === (o.fase.etapa !== 'obra'))
    .filter((o) => !termo || o.nome.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').includes(termo))

  const abrir = (o: Lida) => onAbrir({ pasta: o.pasta, nome: o.nome, etapa: o.fase.etapa })

  return (
    <div className="at-ct">
      <header className="at-ct__cab">
        <div className="at-ct__titulo">
          <span className="at-ct__rotulo">{modo === 'canteiro' ? 'CANTEIRO DE OBRAS' : `OBRAS CONCLUÍDAS · ${daqui.length}`}</span>
          <h1>{modo === 'canteiro' ? 'Suas obras em andamento' : 'Prontas e no ar'}</h1>
        </div>
        <label className="at-ct__busca">
          <Icone nome="lupa" tamanho={18} />
          <input type="search" aria-label="Buscar obra pelo nome" placeholder="Buscar obra pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        {modo === 'canteiro' && <button type="button" className="at-ct__nova" onClick={onNova}><Icone nome="mais" tamanho={18} />Nova obra</button>}
      </header>

      {modo === 'canteiro' && daqui.length > 0 && (
        <div className="at-ct__filtros" role="group" aria-label="Filtrar obras">
          {([['todas', 'Todas', daqui.length], ['falta', 'Falta terminar', nFalta], ['construcao', 'Em construção', nConstrucao]] as const).map(([id, nome, n]) => (
            <button key={id} type="button" aria-pressed={filtro === id} className={`at-ct__filtro at-ct__filtro--${id}`} onClick={() => setFiltro(id)}>
              <span className="at-ct__ponto" aria-hidden="true" />{nome} <span className="at-ct__n">{n}</span>
            </button>
          ))}
        </div>
      )}
      {modo === 'concluidas' && daqui.length > 0 && (
        <p className="at-ct__nota">Quer mudar alguma coisa numa obra pronta? Abra e converse com o Atlas. Enquanto ele constrói a mudança, a obra volta para o Canteiro; quando termina, volta para cá.</p>
      )}

      {lidas === null && <p className="at-ct__vazio" role="status">Abrindo as suas obras…</p>}
      {lidas !== null && daqui.length === 0 && (
        <div className="at-ct__vazio">
          {modo === 'canteiro'
            ? <><b>Nenhuma obra no canteiro ainda.</b><span>Comece uma obra nova: você conta a ideia e o Atlas desenha as telas junto com você.</span><button type="button" className="at-ct__nova" onClick={onNova}>Começar uma obra</button></>
            : <><b>Nenhuma obra pronta ainda.</b><span>Quando a primeira ficar pronta, ela aparece aqui, já no ar.</span></>}
        </div>
      )}
      {lidas !== null && daqui.length > 0 && mostradas.length === 0 && <p className="at-ct__vazio">Nenhuma obra com esse nome.</p>}

      <div className="at-ct__cartoes">
        {mostradas.map((o) => <Cartao key={o.pasta} o={o} onAbrir={() => abrir(o)} />)}
      </div>
    </div>
  )
}

function Cartao({ o, onAbrir }: { o: Lida; onAbrir: () => void }) {
  const { fase } = o
  const inacabada = fase.etapa !== 'obra'
  const passo = inacabada ? PASSO[fase.etapa as Exclude<EtapaObra, 'obra'>] : null
  const selo = fase.concluida ? 'NO AR' : passo ? `FALTA TERMINAR · ETAPA ${passo.n} DE 6` : 'EM CONSTRUÇÃO'
  const linha = fase.concluida ? 'Pronta. Abra para ver o endereço ou pedir uma mudança.' : passo ? 'O canteiro ainda não começou. Termine as etapas e o Atlas constrói sozinho.' : fase.rotulo
  const acao = passo ? `Próximo: ${passo.proximo}` : 'Abrir a obra'
  return (
    <article className={`at-ct__cartao${inacabada ? ' at-ct__cartao--falta' : ''}${fase.concluida ? ' at-ct__cartao--pronta' : ''}`} aria-label={`${o.nome}: ${fase.concluida ? 'no ar' : passo ? `falta terminar, etapa ${passo.n} de 6` : `em construção${fase.pct !== undefined ? `, ${fase.pct}%` : ''}`}`}>
      <button type="button" className="at-ct__abrir" onClick={onAbrir}>
        <span className="at-ct__cena">
          {inacabada
            ? <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path className="at-ct__terra" d="M0 112 L120 82 L400 104 L400 150 L0 150 Z" /><path className="at-ct__terra-linha" d="M120 82 L400 104" /><g className="at-ct__estacas"><path d="M160 96v-22M250 102v-24M205 80v-20M300 106v-22" /><path className="at-ct__fio" d="M160 74 L205 60 L250 78 L300 84" /></g></svg>
            : <img src={canteiroImagem} alt="" />}
          <span className="at-ct__selo"><span className="at-ct__ponto" aria-hidden="true" />{selo}</span>
        </span>
        <span className="at-ct__corpo">
          <span className="at-ct__nome-linha"><b className="at-ct__nome" title={o.pasta}>{o.nome}</b>{!inacabada && !fase.concluida && fase.pct !== undefined && <span className="at-ct__pct">{fase.pct}%</span>}</span>
          {!fase.concluida && <span className="at-ct__barra" aria-hidden="true"><i style={{ width: `${inacabada ? ((passo!.n - 1) / 6) * 100 : (fase.pct ?? 0)}%` }} /></span>}
          <span className="at-ct__linha">{linha}</span>
          <span className="at-ct__acao">{acao}<Icone nome="seta" tamanho={16} /></span>
        </span>
      </button>
    </article>
  )
}
