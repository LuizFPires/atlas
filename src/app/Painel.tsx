import { textoAvanco } from './avanco'
import { useCallback, useEffect, useRef, useState } from 'react'
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
export function Painel({ obra, painel, modos, cota, ocorrencias, onPublicar, onVerMax, onPedirAjuda, sondagemMs = 5000, travas, navegador, onLigarContas }: Props) {
  const [estado, setEstado] = useState<EstadoObra | null>(null)
  const [modo, setModo] = useState<ModoObra | null>(null)
  const [modoLido, setModoLido] = useState(false)
  const [explicando, setExplicando] = useState(false) // gaveta (i) com a diferença dos modos
  const [detalhes, setDetalhes] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [dispensada, setDispensada] = useState<Situacao | null>(null)
  const [diarioAberto, setDiarioAberto] = useState(false)
  const liberada = useRef<number | null>(null)

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
          <span className="at-pn__rotulo">OBRA 1 DE 1</span>
          <h1>{obra.nome}</h1>
        </div>
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

      {momento && momento.nivel !== 'pronta' && <FaixaDoMomento m={momento} fazer={fazer} pode={{ planos: !!onVerMax, ajuda: !!onPedirAjuda, contas: !!onLigarContas }} />}

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

      <div className="at-pn__grade">
        <div className="at-pn__col">
          <section className="at-pn__card" aria-label="Avanço da obra">
            <span className="at-pn__rotulo">AVANÇO DA OBRA</span>
            <div className="at-pn__pct"><span className="at-pn__pct-n">{pctTxt}%</span><span className="at-pn__texto">{estado ? `${concluida ? estado.tarefas : estado.feitas} de ${estado.tarefas} tarefas` : ''}</span></div>
            <div className="at-pn__barra" role="progressbar" aria-label="Avanço da obra" aria-valuemin={0} aria-valuemax={100} aria-valuenow={concluida ? 100 : pct}><div style={{ width: `${concluida ? 100 : pct}%` }} /></div>
            <div className="at-pn__tres">
              <div><span className="at-pn__mini">ETAPA</span><b>{estado?.etapa ? `M${estado.etapa.n} · ${estado.etapa.nome}` : concluida ? 'Todas prontas' : '—'}</b></div>
              <div><span className="at-pn__mini">FALTA</span><b>{estado?.restante ?? (concluida ? 'Nada' : '—')}</b></div>
              <div><span className="at-pn__mini">PREVISÃO</span><b>{estado?.previsao ?? (concluida ? 'Pronta' : '—')}</b></div>
            </div>
          </section>
          <section className="at-pn__card at-pn__agora" aria-label="Agora na obra">
            <span className="at-pn__rotulo">AGORA NA OBRA</span>
            {(estado?.agora ?? []).map((a) => (
              <div key={a.sigla} className="at-pn__quem">
                <span className={`at-pn__sigla at-pn__sigla--${a.tom}`}>{a.sigla}</span>
                <div><b>{a.quem}</b><span className="at-pn__texto">{a.oque}</span></div>
              </div>
            ))}
            {estado && estado.agora.length === 0 && <span className="at-pn__texto">{concluida ? 'Ninguém trabalhando: a obra está pronta.' : sit === 'pausada' ? 'Ninguém trabalhando: você pausou a obra.' : 'Ninguém trabalhando agora.'}</span>}
            <div className="at-pn__detalhes">
              <button type="button" className="at-pn__link" aria-expanded={detalhes} onClick={() => setDetalhes(!detalhes)}>{detalhes ? 'Esconder detalhes' : 'Ver detalhes'}</button>
              {detalhes && estado && (
                <ul className="at-pn__etapas" aria-label="Detalhes das etapas">
                  {estado.etapas.map((e) => (
                    <li key={e.n}><span>M{e.n}</span><b>{e.nome}</b><span className="at-pn__texto">{e.feitas} de {e.total} tarefas · {e.pct}%</span></li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
        <div className="at-pn__col">
          <Canteiro3D endereco={painel.enderecoCanteiro(obra.pasta)} pct={pct} balao={momento && momento.nivel !== 'pronta' ? { quem: BALAO_QUEM[momento.nivel], texto: momento.nivel === 'trabalhando' ? momento.titulo : momento.titulo.split('. ')[0] + '.', nivel: momento.nivel } : null} />
          <DiarioCurto linhas={estado?.diario ?? []} onVerTudo={() => setDiarioAberto(true)} />
        </div>
      </div>
      {diarioAberto && <DiarioCompleto pasta={obra.pasta} painel={painel} recentes={estado?.diario ?? []} onFechar={() => setDiarioAberto(false)} />}

      <div className="at-pn__rodape"><span className="at-pn__ponto" />Salvo a cada passo · pode desligar o computador quando quiser · {pendencia}</div>
    </div>
  )
}

const BALAO_QUEM: Record<string, string> = { trabalhando: 'Mestre de obras', esperando: 'Equipe em pausa', precisa: 'Mestre de obras', defeito: 'Mestre de obras', pausada: 'Equipe em pausa' }
const NOME_ACAO: Record<AcaoObra, string> = { tentar: 'Tentar agora', continuar: 'Continuar obra', planos: 'Ver planos do Claude', esperar: 'Esperar, volta sozinha', ajuda: 'Falar com o Atlas', contas: 'Ligar a conta', diario: 'Ver o diário completo', ok: 'Pode seguir', teste: 'Ver versão de teste' }

/** M41: a faixa do momento. Sempre uma frase do que está acontecendo e pelo menos uma ação (a obra nunca fica no escuro). */
function FaixaDoMomento({ m, fazer, pode }: { m: MomentoObra; fazer: (a: AcaoObra) => void; pode: { planos: boolean; ajuda: boolean; contas: boolean } }) {
  const alerta = m.nivel === 'precisa' || m.nivel === 'defeito'
  const acoes = m.acoes.filter((a) => (a === 'planos' ? pode.planos : a === 'ajuda' ? pode.ajuda : a === 'contas' ? pode.contas : true))
  const nome = (a: AcaoObra) => (a === 'contas' && m.conta ? `Ligar o ${m.conta}` : a === 'ajuda' && m.nivel === 'defeito' ? 'Corrigir com a Ajuda do Atlas' : NOME_ACAO[a])
  return (
    <section className={`at-pn__faixa at-pn__faixa--${m.nivel}`} role={alerta ? 'alert' : 'status'} aria-label="O que está acontecendo agora">
      <span className="at-pn__faixa-bola" aria-hidden="true">{m.nivel === 'trabalhando' ? <span className="at-pn__faixa-pulso" /> : <Icone nome={m.nivel === 'esperando' || m.nivel === 'pausada' ? 'relogio' : 'alerta'} tamanho={22} />}</span>
      <div className="at-pn__faixa-txt">
        <span className="at-pn__faixa-rot">{m.rotulo}</span>
        <b>{m.titulo}</b>
        <span>{m.texto}</span>
        {m.fala && <span className="at-pn__vigia-fala">“{m.fala}”</span>}
        {acoes.length > 0 && (
          <div className="at-pn__faixa-acoes">
            {acoes.map((a, i) => <Botao key={a} variante={i === 0 && a !== 'diario' && a !== 'esperar' ? undefined : 'secundario'} className="at-pn__btn" onClick={() => fazer(a)}>{nome(a)}</Botao>)}
          </div>
        )}
      </div>
      {m.sinal && <span className="at-pn__faixa-sinal">{m.sinal}</span>}
    </section>
  )
}

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaEHora = (iso: string) => { const d = new Date(iso); const hoje = new Date().toDateString() === d.toDateString(); return hoje ? `hoje ${horaDe(iso)}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${horaDe(iso)}` }

/** M41: as últimas linhas do diário, sempre à vista na obra. */
function DiarioCurto({ linhas, onVerTudo }: { linhas: LinhaDiario[]; onVerTudo: () => void }) {
  return (
    <section className="at-pn__card at-pn__diario" aria-label="Diário da obra">
      <span className="at-pn__rotulo">DIÁRIO DA OBRA</span>
      {linhas.length === 0
        ? <span className="at-pn__texto">Assim que a obra começar, cada passo aparece aqui, com a hora.</span>
        : <ol className="at-pn__diario-lista">{linhas.slice(-6).map((l, i) => <li key={`${l.em}-${i}`} className={`at-pn__diario-item at-pn__diario-item--${l.tipo}`}><span className="at-pn__diario-hora">{horaDe(l.em)}</span><span className="at-pn__diario-bola" aria-hidden="true" /><span>{l.texto}</span></li>)}</ol>}
      <button type="button" className="at-pn__link" onClick={onVerTudo}>Ver o diário completo</button>
    </section>
  )
}

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
