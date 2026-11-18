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
}

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
export function Painel({ obra, painel, modos, cota, ocorrencias, onPublicar, onVerMax, onPedirAjuda, sondagemMs = 5000 }: Props) {
  const [estado, setEstado] = useState<EstadoObra | null>(null)
  const [modo, setModo] = useState<ModoObra | null>(null)
  const [modoLido, setModoLido] = useState(false)
  const [trocando, setTrocando] = useState(false)
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
    if (novo === modo) { setTrocando(false); return }
    setErro('')
    setAviso('')
    try {
      await modos.gravar(obra.pasta, novo)
      await painel.aplicarModo(obra.pasta, novo)
      setModo(novo)
      setTrocando(false)
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
  const pctTxt = (concluida ? 100 : pct).toLocaleString('pt-BR')
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

      <section className="at-pn__modo" aria-label="Modo da obra">
        <div className="at-pn__modo-cab">
          <span className="at-pn__rotulo">MODO DA OBRA</span>
          {modoLido && modo && (
            <span className="at-pn__modo-ativo" data-modo={modo}>
              <b>{modo === 'automatico' ? 'Automático' : 'Passo a passo'}</b>
              <span>{modo === 'automatico' ? 'segue etapa após etapa, sem pedir seu OK' : 'para ao fim de cada etapa e pede o seu OK'}</span>
            </span>
          )}
          {modoLido && !modo && <span className="at-pn__modo-ativo"><b>Você ainda não escolheu.</b><span>Por segurança, a obra espera o seu OK a cada etapa até você escolher.</span></span>}
          <button type="button" className="at-pn__link" aria-expanded={trocando} onClick={() => setTrocando(!trocando)}>{trocando ? 'Fechar' : 'Trocar o modo'}</button>
        </div>
        {trocando && (
          <div className="at-pn__modo-troca">
            <div role="radiogroup" aria-label="Trocar o modo da obra" className="at-pn__opcoes">
              {MODOS_OBRA.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={modo === m} className={`at-pn__opcao ${modo === m ? 'at-pn__opcao--on' : ''}`} onClick={() => void trocarModo(m)}>
                  <span className="at-pn__opcao-cab"><b>{TEXTO_MODO[m].titulo}</b>{m === MODO_RECOMENDADO && <span className="at-pn__recomendado">RECOMENDADO</span>}</span>
                  <span className="at-pn__texto">{TEXTO_MODO[m].explica}</span>
                </button>
              ))}
            </div>
            <div className="at-pn__paradas">
              <b>No automático o Atlas só para nas paradas de verdade:</b>
              {PARADAS_REAIS.map((t) => <span key={t} className="at-pn__item"><Icone nome="check" tamanho={16} />{t}</span>)}
            </div>
          </div>
        )}
        {aviso && <span className="at-pn__texto" role="status">{aviso}</span>}
      </section>

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
            {estado && estado.agora.length === 0 && <span className="at-pn__texto">Ninguém trabalhando: a obra está pronta.</span>}
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
