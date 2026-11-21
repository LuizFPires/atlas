import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import { LateralPassos } from './Ativacao'
import { PASSOS_CLAUDE, type ItemSite } from './claude-passos'
import { explicarPlano, mostrarConviteMax, NOME_PLANO, TEXTO_CONVITE_MAX } from './claude-plano'
import type { EstadoClaude, PonteClaude } from './ponte-claude'
import './app.css'
import './claude.css'

interface Props {
  claude: PonteClaude
  /** Segue para F04 (contas). */
  onContinuar: () => void
  /** Abre a Ajuda do Atlas (F17), onde o cliente manda um print. */
  onPedirAjuda?: () => void
  /** De quanto em quanto tempo o Atlas olha o plano sozinho (leve). Padrão: 15 s. */
  sondagemMs?: number
}

function ItemDoSite({ i }: { i: ItemSite }) {
  return (
    <div className="at-claude__item">
      <div className={`at-claude__${i.tipo} ${i.destaque ? 'at-claude__hl' : ''}`}>{i.txt}</div>
      {i.destaque && <span className="at-claude__dica-hl"><Icone nome="seta" tamanho={14} /> {i.dica}</span>}
    </div>
  )
}

/** F03: conectar o Claude. Guia de mão dada do login no claude.ai (prototipo/F03Claude). O login é do próprio cliente. */
export function Claude({ claude, onContinuar, onPedirAjuda, sondagemMs = 15000 }: Props) {
  const [passo, setPasso] = useState(0)
  const [ajuda, setAjuda] = useState(false)
  const [aviso, setAviso] = useState('')
  const [estado, setEstado] = useState<EstadoClaude | null>(null)
  // Ao abrir, confere se o Claude Code deste computador JÁ está conectado (quem já usa o Claude não precisa refazer o login).
  const [conferindoInicio, setConferindoInicio] = useState(true)
  const [jaEstava, setJaEstava] = useState(false)
  // Antes dos passos do login: o cliente precisa saber que o Atlas só funciona com uma conta paga do Claude (à parte do Atlas).
  const [etapaConta, setEtapaConta] = useState<'aviso' | 'criando' | 'feito'>('aviso')

  const [novidade, setNovidade] = useState('')
  const [conferindo, setConferindo] = useState(false)
  const planoVisto = useRef<EstadoClaude['plano']>(undefined)

  // Aplica o que o Claude Code mostra agora; se o plano subiu (Pro -> Max), avisa com alegria.
  const aplicar = (e: EstadoClaude): boolean => {
    const mudou = e.conectado && !!planoVisto.current && !!e.plano && e.plano !== planoVisto.current
    if (e.conectado) planoVisto.current = e.plano
    if (e.conectado) setEstado(e)
    if (mudou) setNovidade(`Percebi a troca! Agora você está no plano ${NOME_PLANO[e.plano!]}. Já ajustei a previsão das suas obras.`)
    return mudou
  }

  useEffect(() => {
    let vivo = true
    void (async () => {
      const e = await claude.estado().catch(() => null)
      if (!vivo) return
      if (e?.conectado) { planoVisto.current = e.plano; setEstado(e); setJaEstava(true) }
      setConferindoInicio(false) // sem resposta ou desconectado: segue pelo guia de passos
    })()
    return () => { vivo = false }
  }, [claude])

  // Polling leve: enquanto o cliente está nesta tela conectado, olha o estado de tempos em tempos.
  const conectado = estado !== null
  useEffect(() => {
    if (!conectado) return
    let vivo = true
    const id = setInterval(() => { void claude.estado().then((e) => { if (vivo) aplicar(e) }).catch(() => {}) }, sondagemMs)
    return () => { vivo = false; clearInterval(id) }
  }, [conectado, claude, sondagemMs])

  const jaFizUpgrade = async () => {
    setConferindo(true); setNovidade('')
    try {
      const e = await claude.renovarConexao()
      if (!aplicar(e)) setNovidade(`Ainda vejo o plano ${e.plano ? NOME_PLANO[e.plano] : 'sem identificação'}. A troca pode levar um minutinho para aparecer. O Atlas continua olhando sozinho.`)
    } catch { setNovidade('Não consegui conferir agora. Tente de novo daqui a pouco.') } finally { setConferindo(false) }
  }

  const ultimo = PASSOS_CLAUDE.length - 1
  const p = PASSOS_CLAUDE[passo]
  const pct = Math.round(((passo + 1) / PASSOS_CLAUDE.length) * 100)

  const avancar = async () => {
    setAviso('')
    if (passo === 0) {
      try { await claude.abrirLogin() } catch { setAviso('Não consegui abrir o site do Claude agora. Abra o claude.ai no seu navegador e siga os passos daqui mesmo.') }
    }
    if (passo < ultimo) { setPasso(passo + 1); setAjuda(false); return }
    const e = await claude.estado()
    if (e.conectado) { planoVisto.current = e.plano; setEstado(e) }
    else setAviso('Ainda não vi a conexão. Termine o passo no site do Claude (botão Authorize) e clique de novo.')
  }
  const aindaNaoTenho = async () => {
    setAviso('')
    setEtapaConta('criando')
    try { await claude.abrirSite('criar-conta') } catch { setAviso('Não consegui abrir o site do Claude agora. Abra o claude.ai no seu navegador.') }
  }
  const voltar = () => {
    setAviso('')
    if (estado) { setEstado(null); setNovidade(''); setJaEstava(false) }
    else if (passo > 0) { setPasso(passo - 1); setAjuda(false) }
  }

  return (
    <div className="at-ativ-fundo">
      <div className="at-ativ at-claude">
        <LateralPassos agora={3} />
        <section className="at-claude__corpo">
          <div className="at-claude__col">
            <div className="at-claude__cab">
              <span className="at-claude__rotulo">CONECTAR O CLAUDE</span>
              <h1>O Claude é o construtor.</h1>
              <span className="at-ativ__txt">É ele quem faz o seu sistema. Ele trabalha com a sua assinatura do Claude, que você paga direto para a Anthropic. Agora vamos apresentar o Claude ao Atlas.</span>
            </div>

            {conferindoInicio && <p role="status" className="at-ativ__txt">Conferindo se o Claude já está conectado neste computador…</p>}

            {!conferindoInicio && !estado && etapaConta !== 'feito' && (
              <>
                <h2 className="at-claude__antes-titulo">Antes de começar: você precisa de uma conta no Claude.</h2>
                <div role="note" aria-label="Conta do Claude" className="at-claude__passo">
                  <span className="at-ativ__txt">O Claude é quem constrói o seu sistema. Ele é de outra empresa, a Anthropic, e a assinatura é paga direto para a Anthropic, à parte do Atlas.</span>
                  <span className="at-ativ__txt"><b>Sem um plano pago do Claude, o Atlas não consegue construir.</b> Quanto maior o plano, mais rápido a obra anda.</span>
                </div>
                {etapaConta === 'criando' && (
                  <ol aria-label="Como criar a sua conta do Claude" className="at-claude__caminho">
                    <li>Crie a sua conta no site do Claude, que acabei de abrir.</li>
                    <li>Assine um plano pago lá mesmo.</li>
                    <li>Volte aqui e clique em "Já criei e assinei".</li>
                  </ol>
                )}
                {aviso && <span role="alert" className="at-ativ__erro">{aviso}</span>}
                <div className="at-claude__botoes">
                  {etapaConta === 'aviso' ? (
                    <>
                      <Botao onClick={() => { setAviso(''); setEtapaConta('feito') }}>Já tenho conta e plano →</Botao>
                      <Botao variante="secundario" onClick={() => void aindaNaoTenho()}>Ainda não tenho</Botao>
                    </>
                  ) : (
                    <Botao onClick={() => { setAviso(''); setEtapaConta('feito') }}>Já criei e assinei →</Botao>
                  )}
                </div>
                <button type="button" className="at-ativ__link at-claude__negrito" onClick={() => void claude.abrirSite('planos').catch(() => {})}>Ver os planos no site do Claude ↗</button>
              </>
            )}

            {!conferindoInicio && !estado && etapaConta === 'feito' && (
              <>
                <div className="at-claude__passo" aria-live="polite">
                  <div className="at-claude__prog">
                    <span className="at-claude__prog-n">PASSO {passo + 1} DE {PASSOS_CLAUDE.length}</span>
                    <div className="at-ativ__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="at-claude__faca">{p.faca}</span>
                  {p.en && (
                    <span className="at-claude__palavra"><Icone nome="ajuda" tamanho={16} /> <b>{p.en}</b> quer dizer <b>&quot;{p.pt}&quot;</b></span>
                  )}
                  <span className="at-ativ__txt">{p.calma}</span>
                </div>
                <div className="at-ativ__rodape at-claude__acoes">
                  <Botao variante="secundario" onClick={voltar} disabled={passo === 0}>← Voltar</Botao>
                  <Botao onClick={() => void avancar()}>{passo === 0 ? 'Abrir o site →' : passo === ultimo ? 'Ver meu plano →' : 'Fiz isso →'}</Botao>
                </div>
                {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
                <button type="button" className="at-ativ__link at-claude__nao-consegui" onClick={() => setAjuda(!ajuda)} aria-expanded={ajuda}>Não consegui fazer este passo</button>
                {ajuda && (
                  <div className="at-claude__ajuda">
                    <b>Tudo bem, acontece com todo mundo.</b>
                    <div className="at-claude__ajuda-acoes">
                      <Botao><Icone nome="play" tamanho={16} /> Ver este passo em vídeo (40 s)</Botao>
                      <Botao variante="secundario" onClick={onPedirAjuda}><Icone nome="ajuda" tamanho={16} /> Pedir ajuda ao Atlas (mande um print)</Botao>
                    </div>
                  </div>
                )}
                <span className="at-claude__rodape-txt">
                  Ainda não tem conta no Claude?{' '}
                  <button type="button" className="at-ativ__link at-claude__negrito" onClick={() => void claude.abrirSite('criar-conta')}>Criar no site do Claude ↗</button>{' '}
                  e assinar um plano pago. Depois volte aqui.
                </span>
              </>
            )}

            {estado && (
              <>
                <div className="at-claude__ok"><span className="at-claude__ok-bola"><Icone nome="check" tamanho={16} /></span><span>Conectado! Conta <b>{estado.conta}</b>{estado.plano && <> · plano <b>{NOME_PLANO[estado.plano]}</b></>}</span></div>
                {jaEstava && <span className="at-ativ__txt">O Claude já estava conectado neste computador, então pulei os passos.</span>}
                <div className="at-claude__explica">
                  <span className="at-claude__explica-rotulo">{explicarPlano(estado.plano).titulo}</span>
                  <span>{explicarPlano(estado.plano).texto}</span>
                </div>
                {novidade && <p className="at-claude__novidade" role="status">{novidade}</p>}
                {mostrarConviteMax(estado.plano) && (
                  <div className="at-claude__convite">
                    <b>{TEXTO_CONVITE_MAX.titulo}</b>
                    <span>{TEXTO_CONVITE_MAX.texto}</span>
                    <button type="button" className="at-ativ__link at-claude__negrito" onClick={() => void claude.abrirSite('planos')}>{TEXTO_CONVITE_MAX.link}</button>
                    <Botao variante="secundario" onClick={() => void jaFizUpgrade()} disabled={conferindo}>{conferindo ? 'Conferindo…' : 'Já fiz o upgrade'}</Botao>
                  </div>
                )}
                <div className="at-ativ__rodape at-claude__acoes">
                  <Botao variante="secundario" onClick={voltar}>← Voltar</Botao>
                  <Botao onClick={onContinuar}>Continuar →</Botao>
                </div>
              </>
            )}
          </div>

          <div className="at-claude__previa">
            <span className="at-claude__previa-rotulo">É assim que vai aparecer na sua tela:</span>
            <div className="at-claude__janela">
              <div className="at-claude__barra-topo"><i /><i /><i /><span className="at-claude__url">{p.site.url}</span></div>
              <div className="at-claude__site">
                <b>{p.site.titulo}</b>
                {p.site.itens.map((i) => <ItemDoSite key={i.txt} i={i} />)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
