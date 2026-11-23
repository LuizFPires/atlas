import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import { LateralPassos } from './Ativacao'
import { explicarPlano, mostrarConviteMax, NOME_PLANO, TEXTO_CONVITE_MAX } from './claude-plano'
import type { EstadoClaude, PonteClaude } from './ponte-claude'
import './app.css'
import './claude.css'
import videoConectar from '../assets/video-conectar-claude.mp4'

interface Props {
  claude: PonteClaude
  /** Segue para F04 (contas). */
  onContinuar: () => void
  /** Abre a Ajuda do Atlas (F17), onde o cliente manda um print. */
  onPedirAjuda?: () => void
  /** De quanto em quanto tempo o Atlas olha o plano sozinho (leve). Padrão: 15 s. */
  sondagemMs?: number
  /** Enquanto espera o cliente clicar em Autorizar no navegador, de quanto em quanto tempo confere. Padrão: 2 s. */
  esperaMs?: number
}

/**
 * F03: conectar o Claude. UM clique (divergência aprovada em 23/11/2026; antes eram 6 passos no claude.ai): o Atlas chama o
 * login OFICIAL do Claude Code (`claude auth login`), o navegador do cliente abre direto na página de autorização do Claude
 * (já logado, só pede "Autorizar") e o Atlas percebe sozinho. O login é do próprio cliente: a credencial fica com o Claude
 * Code, o Atlas nunca vê senha, código nem token.
 */
export function Claude({ claude, onContinuar, onPedirAjuda, sondagemMs = 15000, esperaMs = 2000 }: Props) {
  const [esperando, setEsperando] = useState(false)
  const [ajuda, setAjuda] = useState(false)
  const [video, setVideo] = useState(false)
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

  // Abre a autorização do Claude Code e passa a conferir sozinho até a conexão aparecer.
  const conectarClaude = async () => {
    setAviso('')
    try {
      await claude.abrirLogin()
      setEsperando(true)
    } catch {
      setEsperando(false)
      setAviso('Não consegui abrir o Claude agora. Feche e abra o Atlas e tente de novo; se continuar, peça ajuda ao Atlas.')
    }
  }
  useEffect(() => {
    if (!esperando || estado) return
    let vivo = true
    const id = setInterval(() => {
      void claude.estado().then((e) => { if (vivo && e.conectado) { planoVisto.current = e.plano; setEstado(e); setEsperando(false) } }).catch(() => {})
    }, esperaMs)
    return () => { vivo = false; clearInterval(id) }
  }, [esperando, estado, claude, esperaMs])

  const aindaNaoTenho = async () => {
    setAviso('')
    setEtapaConta('criando')
    try { await claude.abrirSite('criar-conta') } catch { setAviso('Não consegui abrir o site do Claude agora. Abra o claude.ai no seu navegador.') }
  }
  const voltar = () => {
    setAviso('')
    if (estado) { setEstado(null); setNovidade(''); setJaEstava(false) }
    else { setEsperando(false); setEtapaConta('aviso') }
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
                  <span className="at-claude__faca">Ligue o Claude ao Atlas com um clique.</span>
                  <ol className="at-claude__caminho" aria-label="Como conectar">
                    <li>Clique em <b>Conectar o Claude</b>, aqui embaixo.</li>
                    <li>O seu navegador abre a página do Claude. Clique em Autorizar (lá aparece em inglês: <b>Authorize</b>). Se pedir para entrar, use a conta que você assina.</li>
                    <li>Volte aqui: o Atlas percebe sozinho e segue.</li>
                  </ol>
                  <span className="at-claude__palavra"><Icone nome="ajuda" tamanho={16} /> <b>Authorize</b> quer dizer <b>&quot;Autorizar&quot;</b></span>
                </div>
                {esperando && <p role="status" className="at-claude__esperando"><span className="at-claude__ponto" aria-hidden="true" />Esperando você clicar em Autorizar no navegador…</p>}
                {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
                <div className="at-ativ__rodape at-claude__acoes">
                  <Botao variante="secundario" onClick={voltar}>← Voltar</Botao>
                  {esperando
                    ? <Botao variante="secundario" onClick={() => void conectarClaude()}>Abrir de novo</Botao>
                    : <Botao onClick={() => void conectarClaude()}>Conectar o Claude</Botao>}
                </div>
                <button type="button" className="at-ativ__link at-claude__nao-consegui" onClick={() => setAjuda(!ajuda)} aria-expanded={ajuda}>Não consegui fazer este passo</button>
                {ajuda && (
                  <div className="at-claude__ajuda">
                    <b>Tudo bem, acontece com todo mundo.</b>
                    <div className="at-claude__ajuda-acoes">
                      <Botao onClick={() => setVideo(true)}><Icone nome="play" tamanho={16} /> Ver este passo em vídeo (40 s)</Botao>
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
            <span className="at-claude__previa-rotulo">É assim que vai aparecer no seu navegador:</span>
            <div className="at-claude__janela">
              <div className="at-claude__barra-topo"><i /><i /><i /><span className="at-claude__url">claude.ai/oauth/authorize</span></div>
              <div className="at-claude__site">
                <b>Claude Code would like to connect to your Claude account</b>
                <div className="at-claude__item">
                  <div className="at-claude__botao at-claude__hl">Authorize</div>
                  <span className="at-claude__dica-hl"><Icone nome="seta" tamanho={14} /> clique aqui</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      {video && (
        <div className="at-claude__video-fundo" onClick={() => setVideo(false)}>
          <div role="dialog" aria-modal="true" aria-label="Conectar o Claude em vídeo" className="at-claude__video" onClick={(e) => e.stopPropagation()}>
            <video src={videoConectar} controls autoPlay playsInline />
            <button type="button" className="at-claude__video-fechar" aria-label="Fechar o vídeo" onClick={() => setVideo(false)}><Icone nome="x" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
