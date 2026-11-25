import { textoAvanco } from './avanco'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Botao, Icone } from '../ui'
import { Canteiro3D } from './Canteiro3D'
import { MODO_RECOMENDADO, MODOS_OBRA, PARADAS_REAIS, TEXTO_MODO, type ModoObra, type PonteModoObra } from './ponte-construcao'
import { situacaoDaObra, type EstadoObra, type LinhaDiario, type PontePainel, type Situacao } from './ponte-painel'
import { momentoDaObra, type AcaoObra, type MomentoObra } from './momento-obra'
import { Pausa } from './Pausa'
import { Ocorrencia } from './Ocorrencia'
import type { PonteOcorrencias } from './ponte-ocorrencia'
import type { PonteCota } from './ponte-cota'
import type { ObraDoEstilo } from './Estilo'
import { FichaTrava } from './FichaTrava'
import type { PonteTravas } from './ponte-travas'
import type { PonteNavegador } from './ponte-navegador'
import './painel.css'

interface Props {
  obra: ObraDoEstilo
  /** M50 (PalcoObra): as abas da obra entram na MESMA linha do título, como no protótipo (sobra altura para o prédio). */
  abas?: ReactNode
  /** M50: "← Canteiro de obras" acima do título (no lugar da linha separada das abas). */
  onCanteiro?: () => void
  painel: PontePainel
  /** O mesmo armazém do modo que a tela de aprovar (F08) grava: `<obra>\.atlas\modo.json`. */
  modos: PonteModoObra
  /** "Publicar o sistema" (F13a, do M20). */
  onPublicar?: () => void
  /** Cota do plano (F10): quando a cota acaba, a tela de pausa calma aparece e a obra volta sozinha ao renovar. */
  cota?: PonteCota
  /** Ocorrências (F11): a única parada que exige o cliente; vale nos dois modos. */
  ocorrencias?: PonteOcorrencias
  /** Abre a Ajuda do Atlas (F11). */
  onPedirAjuda?: () => void
  /** Abre o site do Claude nos planos (F10). */
  onVerMax?: () => void
  /** De quanto em quanto tempo relê o andamento (ms); 0 desliga (testes). */
  sondagemMs?: number
  /** Fichas de trava (T1Travas): site da trava, "deixar público". */
  travas?: PonteTravas
  navegador?: PonteNavegador
  /** Conta desligada: abre a tela das contas. */
  onLigarContas?: () => void
  /** M43: "Ver no cronograma" na gaveta dos andares leva à aba Cronograma. */
  onVerCronograma?: () => void
}

/** "10:05" no horário de Brasília. */

export const recadoDoErroPainel = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'Quem acompanha a obra ainda não está ligado neste computador. Quando estiver, esta tela passa a mostrar a obra de verdade; você não precisa refazer nada.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

/** Como a obra aparece no selo do topo. */


/** F09: painel da obra. O prédio, o %, o prazo e o "agora na obra"; detalhes técnicos só em "ver detalhes". */
export function Painel({ obra, abas, onCanteiro, painel, modos, cota, ocorrencias, onPublicar, onVerMax, onPedirAjuda, sondagemMs = 5000, travas, navegador, onLigarContas, onVerCronograma }: Props) {
  const [estado, setEstado] = useState<EstadoObra | null>(null)
  const [modo, setModo] = useState<ModoObra | null>(null)
  const [modoLido, setModoLido] = useState(false)
  const [explicando, setExplicando] = useState(false) // gaveta (i) com a diferença dos modos
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [dispensada, setDispensada] = useState<Situacao | null>(null)
  const [diarioAberto, setDiarioAberto] = useState(false)
  const [andares, setAndares] = useState(false)
  const liberada = useRef<number | null>(null)
  const palcoRef = useRef<HTMLElement | null>(null)
  // M50: o protótipo foi desenhado num palco de ~1136 × 794. Em telas menores (notebook com zoom do Windows) os cartões encolhem na
  // mesma proporção, para o prédio continuar sendo o centro da tela.
  useEffect(() => {
    const el = palcoRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return; el.style.setProperty('--k', String(Math.max(0.6, Math.min(1, r.width / 1136, r.height / 794)).toFixed(3))) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const atualizar = useCallback(async () => {
    try { setEstado(await painel.ler(obra.pasta)) } catch (x) { setErro(recadoDoErroPainel(x)) }
  }, [painel, obra.pasta])

  useEffect(() => {
    let vivo = true
    painel.ler(obra.pasta).then((e) => { if (vivo) setEstado(e) }, (x) => { if (vivo) setErro(recadoDoErroPainel(x)) })
    modos.ler(obra.pasta).then((m) => { if (vivo) { setModo(m); setModoLido(true) } }, () => { if (vivo) setModoLido(true) })
    if (!sondagemMs) return () => { vivo = false }
    const id = setInterval(() => { void atualizar() }, sondagemMs)
    return () => { vivo = false; clearInterval(id) }
  }, [painel, modos, obra.pasta, sondagemMs, atualizar])

  // Sem modo guardado o painel não adivinha: trata como passo a passo (nada segue sem o OK) e pede a escolha.
  const modoEfetivo: ModoObra = modo ?? 'passo-a-passo'
  const sit: Situacao | null = estado ? situacaoDaObra(modoEfetivo, estado) : null

  // AUTOMÁTICO: o fim de etapa não pede nada. O painel libera a próxima sozinho (as únicas paradas são as reais).
  const etapaPronta = estado?.etapaPronta ?? null
  useEffect(() => {
    if (!modoLido || modo !== 'automatico' || !etapaPronta || liberada.current === etapaPronta.n) return
    liberada.current = etapaPronta.n
    painel.aprovarEtapa(obra.pasta).then(atualizar, (x) => setErro(recadoDoErroPainel(x)))
  }, [modoLido, modo, etapaPronta, painel, obra.pasta, atualizar])

  const agir = async (fn: () => Promise<void>) => {
    setErro('')
    try { await fn(); await atualizar() } catch (x) { setErro(recadoDoErroPainel(x)) }
  }

  const trocarModo = async (novo: ModoObra) => {
    if (novo === modo) return
    setErro('')
    setAviso('')
    try {
      await modos.gravar(obra.pasta, novo)
      await painel.aplicarModo(obra.pasta, novo)
      setModo(novo)
      setAviso(novo === 'automatico' ? 'Pronto: a obra segue sozinha daqui para frente.' : 'Pronto: ao fim de cada etapa o Atlas para e espera o seu OK.')
    } catch (x) { setErro(recadoDoErroPainel(x)) }
  }

  // O cliente só "volta ao painel" enquanto a parada dura; mudou a situação, a tela dedicada vale de novo.
  if (dispensada && sit !== dispensada) setDispensada(null)

  if (sit === 'cota' && cota && dispensada !== 'cota') {
    return <Pausa pasta={obra.pasta} cota={cota} onVoltar={() => setDispensada('cota')} onRetomou={() => { void atualizar() }} onVerMax={onVerMax} sondagemMs={sondagemMs} />
  }

  if (sit === 'precisa-de-voce' && ocorrencias && dispensada !== 'precisa-de-voce') {
    return <Ocorrencia pasta={obra.pasta} ocorrencias={ocorrencias} onResolvida={() => { void atualizar() }} onAdiada={() => { setDispensada('precisa-de-voce'); void atualizar() }} onPedirAjuda={onPedirAjuda} />
  }

  const concluida = sit === 'concluida'
  const pct = estado?.pct ?? 0
  const pctTxt = textoAvanco(concluida ? 100 : pct)
  const momento: MomentoObra | null = estado && sit ? momentoDaObra(estado, sit) : null
  const fazer = (a: AcaoObra) => {
    switch (a) {
      case 'tentar': return agir(() => painel.continuar(obra.pasta))
      case 'continuar': return agir(() => painel.continuar(obra.pasta))
      case 'planos': return onVerMax?.()
      case 'esperar': return setAviso('Combinado: a obra volta sozinha. O Atlas avisa quando voltar.')
      case 'ajuda': return onPedirAjuda?.()
      case 'contas': return onLigarContas?.()
      case 'diario': return setDiarioAberto(true)
      case 'ok': return agir(() => painel.aprovarEtapa(obra.pasta))
      case 'teste': return agir(() => painel.abrirTeste(obra.pasta))
    }
  }
  const pendencia = sit === 'precisa-de-voce' || sit === 'billing' ? 'tem uma pendência sua' : sit === 'espera-ok' ? 'esperando o seu OK' : 'nenhuma pendência sua'

  return (
    <div className="at-pn">
      <div className="at-pn__topo">
        <div className="at-pn__titulo">
          {onCanteiro
            ? <button type="button" className="at-pn__voltar" onClick={onCanteiro}><Icone nome="seta-esquerda" tamanho={12} />Canteiro de obras</button>
            : <span className="at-pn__rotulo">OBRA 1 DE 1</span>}
          <h1>{obra.nome}</h1>
        </div>
        {abas}
        {momento && <span className={`at-pn__selo at-pn__selo--${momento.nivel}`} role="status" aria-label={`Situação da obra: ${momento.selo}`}>● {momento.selo}{momento.nivel !== 'pronta' ? ` · ${pctTxt}%` : ''}</span>}
        <div className="at-pn__acoes">
          {onLigarContas && !concluida && <Botao variante="secundario" className="at-pn__btn" onClick={onLigarContas}>Contas ligadas</Botao>}
          {(sit === 'andando' || sit === 'espera-ok') && <Botao variante="secundario" className="at-pn__btn" onClick={() => agir(() => painel.pausar(obra.pasta))}>Pausar obra</Botao>}
          {concluida && <Botao variante="secundario" className="at-pn__btn" onClick={() => agir(() => painel.abrirTeste(obra.pasta))}>Ver como ficou</Botao>}
          {estado?.temTeste && !concluida && <Botao className="at-pn__btn" onClick={() => agir(() => painel.abrirTeste(obra.pasta))}>Ver versão de teste</Botao>}
        </div>
      </div>

      {erro && <p className="at-pn__erro" role="alert">{erro}</p>}
      {!estado && !erro && <p role="status">O Atlas está olhando a obra…</p>}

      {estado?.trava && travas && !concluida && <FichaTrava key={`${estado.trava.tipo}-${estado.trava.id}`} pasta={obra.pasta} trava={estado.trava} ponte={travas} navegador={navegador} onLigarContas={onLigarContas} />}

      {concluida && (
        <div className="at-pn__pronta" role="status">
          <span className="at-pn__pronta-bola"><Icone nome="check" tamanho={24} /></span>
          <div className="at-pn__pronta-txt"><b>Obra pronta! Falta só escolher onde o seu sistema vai morar.</b><span>Endereço grátis, domínio próprio, app no celular ou nas lojas. Você escolhe no próximo passo.</span></div>
          <Botao className="at-pn__publicar" onClick={onPublicar}>Publicar o sistema →</Botao>
        </div>
      )}

      {/* M43 (PalcoObra aprovado em 24/11/2026): o prédio é o palco; os números e a frase do momento flutuam por cima dele. */}
      <section className="at-pn__palco" aria-label="Palco da obra" ref={palcoRef}>
        <Canteiro3D endereco={painel.enderecoCanteiro(obra.pasta)} pct={pct} balao={momento && momento.nivel === 'trabalhando' ? { quem: 'Mestre de obras', texto: momento.titulo, nivel: momento.nivel } : null} />
        <section className="at-pn__hud at-pn__hud--esq" aria-label="Avanço da obra">
          {momento && <span className={`at-pn__hud-rot at-pn__hud-rot--${momento.nivel}`}>{momento.nivel === 'trabalhando' && <span className="at-pn__faixa-pulso" aria-hidden="true" />}{momento.selo.toLocaleUpperCase('pt-BR')}{momento.sinal ? ` · ${momento.sinal.toLocaleUpperCase('pt-BR')}` : ''}</span>}
          <span className="at-pn__hud-pct">{pctTxt}%</span>
          {/* M50: como no protótipo, só a etapa (sem a contagem de tarefas e sem barra: o % já diz o avanço). */}
          <span className="at-pn__hud-sub" title={estado ? `${concluida ? estado.tarefas : estado.feitas} de ${estado.tarefas} tarefas` : undefined}>{estado?.etapa ? `Etapa M${estado.etapa.n} de ${estado.etapas.length} · ${estado.etapa.nome}` : concluida ? 'Todas as etapas prontas' : ''}</span>
          {estado && estado.etapas.length > 0 && (
            <button type="button" className="at-pn__chip-andares" aria-haspopup="dialog" onClick={() => setAndares(true)}>
              <Icone nome="obra" tamanho={16} />Andares · {estado.etapas.filter((e) => e.total > 0 && e.feitas === e.total).length} de {estado.etapas.length} prontos
            </button>
          )}
        </section>
        <section className="at-pn__hud at-pn__hud--dir" aria-label="Prazo da obra">
          <span className="at-pn__mini">TÉRMINO ESPERADO</span>
          <b>{estado?.previsao ?? (concluida ? 'Pronta' : 'Calculando…')}</b>
          <span className="at-pn__hud-sub">{estado?.restante ? `faltam ${estado.restante} de trabalho` : concluida ? 'Nada falta' : 'aparece depois do 1º avanço medido'}</span>
        </section>
        {momento && momento.nivel !== 'pronta' && (
          <div className="at-pn__palco-base">
            <FaixaDoMomento m={momento} fazer={fazer} pode={{ planos: !!onVerMax, ajuda: !!onPedirAjuda, contas: !!onLigarContas }} recentes={(estado?.diario ?? []).slice(-2).reverse()} escolher={painel.decidir ? (r) => { void agir(() => painel.decidir!(obra.pasta, r)) } : undefined} />
          </div>
        )}
      </section>

      <section className="at-pn__modo" aria-label="Modo da obra">
        <span className="at-pn__rotulo">MODO DA OBRA</span>
        <div role="radiogroup" aria-label="Modo da obra" className="at-pn__modo-seg">
          {MODOS_OBRA.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modoLido && modo === m} className={`at-pn__seg ${modoLido && modo === m ? 'at-pn__seg--on' : ''}`} onClick={() => void trocarModo(m)}>
              {m === 'automatico' ? 'Automático' : 'Passo a passo'}
            </button>
          ))}
        </div>
        <button type="button" className="at-pn__info" aria-label="Entender os modos" aria-expanded={explicando} onClick={() => setExplicando(true)}>i</button>
        <span className="at-pn__modo-sub">
          {modoLido && modo === 'automatico' && 'Segue etapa após etapa, sem pedir seu OK.'}
          {modoLido && modo === 'passo-a-passo' && 'Para ao fim de cada etapa e pede o seu OK.'}
          {modoLido && !modo && <><b>Você ainda não escolheu.</b> Por segurança, a obra espera o seu OK a cada etapa até você escolher.</>}
        </span>
        {aviso && <span className="at-pn__modo-aviso" role="status">{aviso}</span>}
      </section>

      {explicando && (
        <div className="at-pn__gaveta-fundo" onClick={() => setExplicando(false)}>
          <aside className="at-pn__gaveta" role="dialog" aria-modal="true" aria-label="Os dois modos da obra" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setExplicando(false) }}>
            <div className="at-pn__gaveta-cab">
              <span className="at-pn__rotulo">OS DOIS MODOS DA OBRA</span>
              <button type="button" className="at-pn__gaveta-x" aria-label="Fechar a explicação" autoFocus onClick={() => setExplicando(false)}><Icone nome="x" tamanho={18} /></button>
            </div>
            {MODOS_OBRA.map((m) => (
              <div key={m} className={`at-pn__gaveta-modo ${modo === m ? 'at-pn__gaveta-modo--on' : ''}`}>
                <span className="at-pn__opcao-cab"><b>{TEXTO_MODO[m].titulo}</b>{m === MODO_RECOMENDADO && <span className="at-pn__recomendado">RECOMENDADO</span>}</span>
                <span className="at-pn__texto">{TEXTO_MODO[m].explica}</span>
              </div>
            ))}
            <div className="at-pn__paradas">
              <b>No automático o Atlas só para nas paradas de verdade:</b>
              {PARADAS_REAIS.map((t) => <span key={t} className="at-pn__item"><Icone nome="check" tamanho={16} />{t}</span>)}
            </div>
            <span className="at-pn__texto">Pode trocar de modo a qualquer hora, sem perder nada.</span>
          </aside>
        </div>
      )}

      {andares && estado && <GavetaAndares etapas={estado.etapas} onFechar={() => setAndares(false)} onVerCronograma={onVerCronograma ? () => { setAndares(false); onVerCronograma() } : undefined} />}
      {diarioAberto && <DiarioCompleto pasta={obra.pasta} painel={painel} recentes={estado?.diario ?? []} onFechar={() => setDiarioAberto(false)} />}

      <div className="at-pn__rodape"><span className="at-pn__ponto" />Salvo a cada passo · pode desligar o computador quando quiser · {pendencia}</div>
    </div>
  )
}

const NOME_ACAO: Record<AcaoObra, string> = { tentar: 'Tentar agora', continuar: 'Continuar obra', planos: 'Ver planos do Claude', esperar: 'Esperar, volta sozinha', ajuda: 'Falar com o Atlas', contas: 'Ligar a conta', diario: 'Ver o diário completo', ok: 'Pode seguir', teste: 'Ver versão de teste' }

/** M41: a faixa do momento. Sempre uma frase do que está acontecendo e pelo menos uma ação (a obra nunca fica no escuro). */
function FaixaDoMomento({ m, fazer, pode, recentes = [], escolher }: { m: MomentoObra; fazer: (a: AcaoObra) => void; pode: { planos: boolean; ajuda: boolean; contas: boolean }; recentes?: LinhaDiario[]; escolher?: (rotulo: string) => void }) {
  const alerta = m.nivel === 'precisa' || m.nivel === 'defeito'
  const acoes = [...m.acoes, ...(m.acoes.includes('diario') ? [] : ['diario' as AcaoObra])].filter((a) => (a === 'planos' ? pode.planos : a === 'ajuda' ? pode.ajuda : a === 'contas' ? pode.contas : true))
  const nome = (a: AcaoObra) => (a === 'contas' && m.conta ? `Ligar o ${m.conta}` : a === 'ajuda' && m.nivel === 'defeito' ? 'Corrigir com a Ajuda do Atlas' : NOME_ACAO[a])
  // M50 (PalcoObra): sem opções nem conferências, a faixa é UMA linha — a frase à esquerda e os botões à direita.
  const compacta = !(m.opcoes && escolher) && !m.checagens && !m.fala
  const botoes = acoes.length > 0 && (
    <div className="at-pn__faixa-acoes">
      {acoes.map((a, i) => <Botao key={a} variante={i === 0 && a !== 'diario' && a !== 'esperar' ? undefined : 'secundario'} className="at-pn__btn" onClick={() => fazer(a)}>{nome(a)}</Botao>)}
    </div>
  )
  return (
    <section className={`at-pn__faixa at-pn__faixa--${m.nivel}${compacta ? ' at-pn__faixa--compacta' : ''}`} role={alerta ? 'alert' : 'status'} aria-label="O que está acontecendo agora">
      <span className="at-pn__faixa-bola" aria-hidden="true">{m.nivel === 'trabalhando' ? <span className="at-pn__faixa-pulso" /> : <Icone nome={m.nivel === 'esperando' || m.nivel === 'pausada' ? 'relogio' : 'alerta'} tamanho={22} />}</span>
      <div className="at-pn__faixa-txt">
        <span className="at-pn__faixa-rot">{m.rotulo}</span>
        <b>{m.titulo}</b>
        <span>{m.texto}</span>
        {recentes.length > 0 && <span className="at-pn__faixa-recentes">{recentes.map((l) => `${horaDe(l.em)} ${l.texto}`).join(' · ')}</span>}
        {m.fala && <span className="at-pn__vigia-fala">“{m.fala}”</span>}
        {m.opcoes && escolher && (
          <div className="at-pn__opcoes" role="group" aria-label="Escolha como seguir">
            {m.opcoes.map((o) => (
              <button key={o.rotulo} type="button" className={`at-pn__opcao${o.recomendada ? ' at-pn__opcao--rec' : ''}`} onClick={() => escolher(o.rotulo)}>
                <span className="at-pn__opcao-topo"><b>{o.rotulo}</b>{o.recomendada && <span className="at-pn__opcao-selo">Recomendado</span>}</span>
                {o.explica && <span className="at-pn__opcao-exp">{o.explica}</span>}
                <span className="at-pn__opcao-ir">Seguir com esta <Icone nome="seta" tamanho={14} /></span>
              </button>
            ))}
          </div>
        )}
        {m.checagens && (
          <ul className="at-pn__checagens" aria-label="O que o Atlas conferiu">
            {m.checagens.map((c) => (
              <li key={c.nome} data-ok={c.ok ? 'sim' : 'nao'} className={`at-pn__checagem${c.ok ? '' : ' at-pn__checagem--ruim'}`}>
                <Icone nome={c.ok ? 'check' : 'x'} tamanho={14} /><span><b>{c.nome}</b>{!c.ok && c.dica && <em>{c.dica}</em>}</span>
              </li>
            ))}
          </ul>
        )}
        {!compacta && botoes}
      </div>
      {compacta && botoes}
      {m.sinal && <span className="at-pn__faixa-sinal">{m.sinal}</span>}
    </section>
  )
}

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaEHora = (iso: string) => { const d = new Date(iso); const hoje = new Date().toDateString() === d.toDateString(); return hoje ? `hoje ${horaDe(iso)}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${horaDe(iso)}` }

const FILTROS: { id: string; nome: string; tipos: LinhaDiario['tipo'][] | null }[] = [
  { id: 'tudo', nome: 'Tudo', tipos: null },
  { id: 'paradas', nome: 'Paradas', tipos: ['parada', 'defeito', 'retomada'] },
  { id: 'pedidos', nome: 'Pedidos a você', tipos: ['pedido'] },
  { id: 'entregas', nome: 'Entregas', tipos: ['entrega'] },
]

/** M41: gaveta com o diário completo e filtros. */
function DiarioCompleto({ pasta, painel, recentes, onFechar }: { pasta: string; painel: PontePainel; recentes: LinhaDiario[]; onFechar: () => void }) {
  const [linhas, setLinhas] = useState<LinhaDiario[]>(recentes)
  const [filtro, setFiltro] = useState('tudo')
  useEffect(() => {
    let vivo = true
    if (painel.diario) painel.diario(pasta).then((l) => { if (vivo) setLinhas(l) }, () => {})
    return () => { vivo = false }
  }, [painel, pasta])
  const f = FILTROS.find((x) => x.id === filtro)!
  const vistas = linhas.filter((l) => !f.tipos || f.tipos.includes(l.tipo)).slice().reverse()
  return (
    <div className="at-pn__gaveta-fundo" onClick={onFechar}>
      <aside className="at-pn__gaveta at-pn__gaveta--diario" role="dialog" aria-modal="true" aria-label="Diário completo da obra" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onFechar() }}>
        <div className="at-pn__gaveta-cab">
          <span className="at-pn__rotulo">DIÁRIO DA OBRA</span>
          <button type="button" className="at-pn__gaveta-x" aria-label="Fechar o diário" autoFocus onClick={onFechar}><Icone nome="x" tamanho={18} /></button>
        </div>
        <span className="at-pn__texto">Tudo o que aconteceu na obra, em português simples. Senhas e chaves nunca aparecem aqui.</span>
        <div className="at-pn__filtros" role="group" aria-label="Filtrar o diário">
          {FILTROS.map((x) => <button key={x.id} type="button" aria-pressed={filtro === x.id} className={`at-pn__filtro${filtro === x.id ? ' at-pn__filtro--on' : ''}`} onClick={() => setFiltro(x.id)}>{x.nome}</button>)}
        </div>
        {vistas.length === 0
          ? <span className="at-pn__texto">Nada por aqui ainda.</span>
          : <ol className="at-pn__diario-lista at-pn__diario-lista--longa">{vistas.map((l, i) => <li key={`${l.em}-${i}`} className={`at-pn__diario-item at-pn__diario-item--${l.tipo}`}><span className="at-pn__diario-hora">{diaEHora(l.em)}</span><span className="at-pn__diario-bola" aria-hidden="true" /><span>{l.texto}{l.detalhe && <em className="at-pn__diario-detalhe">{l.detalhe}</em>}</span></li>)}</ol>}
      </aside>
    </div>
  )
}

/** M43: a gaveta dos andares. Cada etapa é um andar, de baixo (térreo) para cima: pronto verde, atual piscando, os que faltam apagados. */
function GavetaAndares({ etapas, onFechar, onVerCronograma }: { etapas: EstadoObra['etapas']; onFechar: () => void; onVerCronograma?: () => void }) {
  const atual = etapas.find((e) => !(e.total > 0 && e.feitas === e.total))
  const andares = etapas.map((e) => {
    const pronta = e.total > 0 && e.feitas === e.total
    const st = pronta ? 'feito' : atual && e.n === atual.n ? 'agora' : 'falta'
    return { ...e, st, sub: st === 'feito' ? 'Entregue e revisada' : st === 'agora' ? `Em obra agora · ${e.pct}%` : 'Ainda não começou' }
  }).reverse()
  return (
    <div className="at-pn__gaveta-fundo" onClick={onFechar}>
      <aside className="at-pn__gaveta at-pn__gaveta--andares" role="dialog" aria-modal="true" aria-label="Os andares da obra" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onFechar() }}>
        <div className="at-pn__gaveta-cab">
          <div><span className="at-pn__rotulo">OS ANDARES DA OBRA</span><b className="at-pn__gaveta-tit">Cada etapa é um andar</b></div>
          <button type="button" className="at-pn__gaveta-x" aria-label="Fechar os andares" autoFocus onClick={onFechar}><Icone nome="x" tamanho={18} /></button>
        </div>
        <span className="at-pn__texto">O prédio sobe de baixo para cima: cada andar fica verde quando a etapa é entregue e revisada. O que pisca é o andar em obra agora.</span>
        <ol className="at-pn__andares">
          {andares.map((a) => (
            <li key={a.n} className={`at-pn__andar at-pn__andar--${a.st}`}>
              <b className="at-pn__andar-n">M{a.n}</b>
              <span className="at-pn__andar-txt"><span>{a.nome}</span><em>{a.sub}</em></span>
              <span className="at-pn__andar-tarefas">{a.feitas}/{a.total}</span>
            </li>
          ))}
        </ol>
        <div className="at-pn__andares-pe">
          <span className="at-pn__mini">▲ TÉRREO EMBAIXO, COBERTURA NO TOPO</span>
          {onVerCronograma && <button type="button" className="at-pn__link" onClick={onVerCronograma}>Ver no cronograma</button>}
        </div>
      </aside>
    </div>
  )
}
