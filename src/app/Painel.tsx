import { textoAvanco } from './avanco'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import { Canteiro3D } from './Canteiro3D'
import { MODO_RECOMENDADO, MODOS_OBRA, PARADAS_REAIS, TEXTO_MODO, type ModoObra, type PonteModoObra } from './ponte-construcao'
import { situacaoDaObra, type EstadoObra, type PontePainel, type Situacao } from './ponte-painel'
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
const horaCurta = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '' }

export const recadoDoErroPainel = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'Quem acompanha a obra ainda não está ligado neste computador. Quando estiver, esta tela passa a mostrar a obra de verdade; você não precisa refazer nada.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

/** Como a obra aparece no selo do topo. */
export const SELO: Record<Situacao, string> = {
  'andando': 'Obra em andamento',
  'pausada': 'Pausada por você',
  'espera-ok': 'Esperando o seu OK',
  'cota': 'Pausada: a cota do plano acabou',
  'precisa-de-voce': 'Precisa de você',
  'billing': 'Pausada: falta resolver uma cobrança',
  'concluida': 'Obra concluída',
}

const AVISO_PARADA: Partial<Record<Situacao, string>> = {
  'cota': 'Isto não é erro. A cota do seu plano do Claude acabou, e a obra espera sozinha. Quando a cota renovar, ela volta sozinha. Você não precisa fazer nada.',
  'precisa-de-voce': 'Esta é uma das paradas de verdade: só você pode resolver (como entrar numa conta ou autorizar algo). O Atlas explica o passo a passo.',
  'billing': 'Uma cobrança ou um acesso de uma conta sua precisa de atenção. É na sua conta, com você. Resolvendo, a obra continua.',
}

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
  const pendencia = sit === 'precisa-de-voce' || sit === 'billing' ? 'tem uma pendência sua' : sit === 'espera-ok' ? 'esperando o seu OK' : 'nenhuma pendência sua'

  return (
    <div className="at-pn">
      <div className="at-pn__topo">
        <div className="at-pn__titulo">
          <span className="at-pn__rotulo">OBRA 1 DE 1</span>
          <h1>{obra.nome}</h1>
        </div>
        {sit && <span className={`at-pn__selo at-pn__selo--${sit}`}>● {SELO[sit]}</span>}
        <div className="at-pn__acoes">
          {(sit === 'andando' || sit === 'espera-ok') && <Botao variante="secundario" className="at-pn__btn" onClick={() => agir(() => painel.pausar(obra.pasta))}>Pausar obra</Botao>}
          {sit === 'pausada' && <Botao variante="secundario" className="at-pn__btn" onClick={() => agir(() => painel.continuar(obra.pasta))}>Continuar obra</Botao>}
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

      {sit === 'espera-ok' && estado?.etapaPronta && (
        <div className="at-pn__ok" role="status">
          <div className="at-pn__pronta-txt">
            <b>Ficou pronta a etapa M{estado.etapaPronta.n} · {estado.etapaPronta.nome}.</b>
            <span>Você escolheu aprovar cada etapa. Dê uma olhada na versão de teste e diga quando posso seguir para a próxima.</span>
          </div>
          <Botao variante="secundario" className="at-pn__btn" onClick={() => agir(() => painel.abrirTeste(obra.pasta))}>Ver versão de teste</Botao>
          <Botao className="at-pn__btn" onClick={() => agir(() => painel.aprovarEtapa(obra.pasta))}>Pode seguir</Botao>
        </div>
      )}

      {sit && AVISO_PARADA[sit] && <p className="at-pn__parada" role="status">{AVISO_PARADA[sit]}</p>}

      {/* Vigia (24/11/2026): a obra nunca fica parada em silêncio. Tentando = o Atlas já religa sozinho; precisa-voce = alerta. */}
      {!concluida && sit !== 'pausada' && estado?.vigia && (estado.vigia.situacao === 'tentando'
        ? (
          <div className="at-pn__vigia" role="status" aria-label="A obra parou">
            <span className="at-pn__vigia-giro" aria-hidden="true" />
            <div className="at-pn__pronta-txt">
              <b>A obra parou sozinha. O Atlas já está cuidando disso.</b>
              <span>{estado.vigia.motivo} Vou religar sozinho{estado.vigia.proximaEm ? ` às ${horaCurta(estado.vigia.proximaEm)}` : ''} (tentativa {Math.min(estado.vigia.tentativa + 1, estado.vigia.de)} de {estado.vigia.de}).</span>
            </div>
            <Botao className="at-pn__btn" onClick={() => agir(() => painel.continuar(obra.pasta))}>Tentar agora</Botao>
          </div>
        )
        : (
          <div className="at-pn__vigia at-pn__vigia--alerta" role="alert" aria-label="A obra parou">
            <span className="at-pn__vigia-bola" aria-hidden="true"><Icone nome="alerta" tamanho={22} /></span>
            <div className="at-pn__pronta-txt">
              <b>A obra está parada e precisa de você.</b>
              <span>{estado.vigia.motivo} O Atlas tentou {estado.vigia.tentativa} {estado.vigia.tentativa === 1 ? 'vez' : 'vezes'} sozinho e não conseguiu.</span>
            </div>
            {onPedirAjuda && <Botao variante="secundario" className="at-pn__btn" onClick={onPedirAjuda}>Falar com o Atlas</Botao>}
            <Botao className="at-pn__btn" onClick={() => agir(() => painel.continuar(obra.pasta))}>Tentar agora</Botao>
          </div>
        ))}

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
        <Canteiro3D endereco={painel.enderecoCanteiro(obra.pasta)} pct={pct} />
      </div>

      <div className="at-pn__rodape"><span className="at-pn__ponto" />Salvo a cada passo · pode desligar o computador quando quiser · {pendencia}</div>
    </div>
  )
}
