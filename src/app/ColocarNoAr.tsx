import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { predioSvg } from '../celular/predio'
import { motivoDoTravamento } from './motivo-travou'
import { caminhoQr, enderecoDoSistema, linkWhatsapp, matrizQr, recadoEquipe } from './entrega-dados'
import { DominioProprio } from './DominioProprio'
import { Lojas } from './Lojas'
import type { Guia } from './guias-site'
import type { ContaLoja, PonteLojas } from './ponte-lojas'
import type { DestinoSite } from './ponte-publicar'
import type { EstadoDominio, PonteDominio } from './ponte-dominio'
import { PASSOS_NO_AR, explicarErro, type EstadoNoAr, type PonteNoAr, type SituacaoNomeNoAr } from './ponte-no-ar'
import './colocar-no-ar.css'

interface Props {
  obra: { nome: string; pasta: string }
  noAr: PonteNoAr
  /** Etapas da obra (um andar por etapa). */
  andares?: number
  /** Parte do nome sugerido quando o nome da obra já tem dono (ex.: o nome da empresa). */
  extra?: string
  onVoltar?: () => void
  /** Recebem o endereço que já está no ar. */
  onDominio?: (endereco: string | null) => void
  onLojas?: (endereco: string | null) => void
  /** Travou ou deu erro: a Ajuda do Atlas, já sabendo em que passo está. */
  onAjuda?: (contexto: { onde: string; erro?: string }) => void
  /** O erro é de uma conta desligada: abre "As contas" para religar. */
  onLigarContas?: () => void
  /** De quanto em quanto tempo a tela pergunta como está. */
  intervaloMs?: number
  /** Domínio próprio (M57): com a ponte, "Usar meu domínio" abre aqui mesmo, ao lado do prédio. */
  dominio?: PonteDominio
  abrirRegistro?: () => Promise<void>
  /** M58: o passo a passo do Registro.br com o site ao lado. */
  onGuiaRegistro?: (estado: EstadoDominio) => void
  /** Volta do passo a passo direto no domínio próprio. */
  dominioAberto?: boolean
  /** Lojas (M59): com a ponte, "Colocar na App Store e no Google Play" abre aqui mesmo. */
  lojas?: PonteLojas
  onGuiaLojas?: (guia: Guia, conta?: ContaLoja) => void
  lojasAberto?: boolean
  abrirSiteLojas?: (destino: DestinoSite) => Promise<void>
  /** M60: "Quer vender o [app] para outras empresas?" (opcional; sem tocar, nada muda). */
  onVender?: () => void
}

type Tela = 'pronta' | 'endereco'

const ICONE_OK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>

/**
 * Colocar no ar com um clique (M56; prototipo/caminho-novo/PB1Publicar, PB2Endereco, PB3Publicando, PB4Vistoria e PB5NoAr).
 * O endereço já vem escolhido e as contas são as ligadas no começo da obra: o cliente só aperta "Colocar no ar".
 * Daí em diante o Atlas faz sozinho (vistoria, banco, publicação, GitHub, teste) e a tela só acompanha.
 */
/** Por que a correção da vistoria não saiu, em português. */
export function motivoDaCorrecao(codigo: string): string {
  if (codigo === 'nada-para-corrigir') return 'A vistoria já não tem pontos para corrigir. Toque em Colocar no ar de novo.'
  return motivoDoTravamento(codigo, 'Corrigir e continuar', 'Não consegui mandar as correções agora. Tente de novo em instantes.')
}

export function ColocarNoAr({ obra, noAr, andares = 12, extra = '', onVoltar, onDominio, onLojas, onAjuda, onLigarContas, intervaloMs = 2000, dominio, abrirRegistro, onGuiaRegistro, dominioAberto = false, lojas, onGuiaLojas, lojasAberto = false, abrirSiteLojas, onVender }: Props) {
  const [vendoDominio, setVendoDominio] = useState(dominioAberto)
  const [vendoLojas, setVendoLojas] = useState(lojasAberto)
  const [enderecoDominio, setEnderecoDominio] = useState<string | null>(null)
  useEffect(() => {
    if (!dominio) return
    let vivo = true
    void dominio.estado(obra.pasta).then((e) => { if (vivo && e.fase === 'noar' && e.endereco) setEnderecoDominio(e.endereco) }, () => {})
    return () => { vivo = false }
  }, [dominio, obra.pasta])
  const [estado, setEstado] = useState<EstadoNoAr | null>(null)
  const [tela, setTela] = useState<Tela>('pronta')
  const [nome, setNome] = useState('')
  const [livres, setLivres] = useState<string[]>([])
  const [digitado, setDigitado] = useState('')
  const [conferido, setConferido] = useState<{ nome: string; situacao: SituacaoNomeNoAr } | null>(null)
  const situacao = conferido && conferido.nome === digitado ? conferido.situacao : null
  const [aviso, setAviso] = useState('')
  const vivo = useRef(true)

  const ler = useCallback(async () => {
    try { const e = await noAr.estado(obra.pasta); if (vivo.current) setEstado(e) } catch { /* tenta de novo na próxima */ }
  }, [noAr, obra.pasta])

  useEffect(() => {
    vivo.current = true
    void noAr.estado(obra.pasta).then((e) => { if (vivo.current) setEstado(e) }, () => {})
    void noAr.sugerir(obra.pasta, obra.nome, extra).then((s) => { if (!vivo.current) return; setLivres(s.livres); if (s.nome) { setNome(s.nome); setDigitado(s.nome) } }, () => {})
    return () => { vivo.current = false }
  }, [noAr, obra.pasta, obra.nome, extra])

  // Deu erro de verdade: a Ajuda do Atlas abre sozinha, já sabendo onde parou (uma vez por erro).
  const avisado = useRef('')
  const chaveErro = estado?.fase === 'erro' && estado.erro ? `${estado.erro.passo}:${estado.erro.motivo}` : ''
  useEffect(() => {
    if (!chaveErro || !onAjuda || avisado.current === chaveErro) return
    avisado.current = chaveErro
    onAjuda({ onde: 'colocar no ar', erro: chaveErro.split(':')[1] })
  }, [chaveErro, onAjuda])

  const andando = estado?.fase === 'rodando' || estado?.fase === 'corrigindo'
  useEffect(() => {
    if (!andando) return
    const t = setInterval(() => { void ler() }, intervaloMs)
    return () => clearInterval(t)
  }, [andando, intervaloMs, ler])

  // Conferir o nome digitado (com uma pausinha para não perguntar a cada letra).
  useEffect(() => {
    if (tela !== 'endereco' || !digitado) return
    const n = digitado
    const t = setTimeout(() => { void noAr.nomeLivre(n, obra.pasta).then((s) => { if (vivo.current) setConferido({ nome: n, situacao: s }) }, () => setConferido({ nome: n, situacao: 'incerto' })) }, 400)
    return () => clearTimeout(t)
  }, [tela, digitado, noAr, obra.pasta])

  const [travouInicio, setTravouInicio] = useState<string | null>(null)
  const colocar = async (n: string) => {
    setAviso('')
    setTravouInicio(null)
    try { setEstado(await noAr.iniciar(obra.pasta, n)); setTela('pronta') } catch (e) {
      const m = e instanceof Error ? e.message : ''
      setAviso(m === 'nome-ocupado' ? 'Esse nome acabou de ser usado por outra pessoa. Escolha outro.' : m === 'ja-rodando' ? 'O Atlas já está colocando no ar.' : motivoDoTravamento(m, 'Colocar no ar', 'Não consegui começar agora. Tente de novo em instantes.'))
      if (m !== 'nome-ocupado' && m !== 'ja-rodando') setTravouInicio(m || 'sem-codigo')
      if (m === 'nome-ocupado') setTela('endereco')
    }
  }

  // Destravar pelo app (26/11/2026): a correção que não sai nunca deixa o cliente preso esperando uma versão nova.
  // Outra obra ocupando a linha: o Atlas espera a vez e tenta sozinho. Outro motivo: "Tentar de novo" e "Pedir ao Atlas para destravar".
  const [travou, setTravou] = useState<string | null>(null)
  const [esperandoVez, setEsperandoVez] = useState(false)
  const [vez, setVez] = useState(0) // cada tentativa na fila reagenda a próxima
  const corrigir = async () => {
    setAviso('')
    try {
      const novo = await noAr.corrigir(obra.pasta)
      if (!vivo.current) return
      setTravou(null); setEsperandoVez(false); setEstado(novo)
    } catch (e) {
      if (!vivo.current) return
      const codigo = e instanceof Error ? e.message : ''
      if (codigo === 'ja-rodando') { setTravou(null); setEsperandoVez(true); setVez((v) => v + 1); return }
      setEsperandoVez(false); setTravou(codigo); setAviso(motivoDaCorrecao(codigo))
    }
  }
  const corrigirDeNovo = useRef(corrigir)
  useEffect(() => { corrigirDeNovo.current = corrigir })
  useEffect(() => {
    if (!esperandoVez) return
    const t = setTimeout(() => { void corrigirDeNovo.current() }, intervaloMs * 5)
    return () => clearTimeout(t)
  }, [esperandoVez, vez, intervaloMs])

  const fase = estado?.fase ?? 'parado'
  const noArAgora = fase === 'noar'
  const link = useMemo(() => (noArAgora ? enderecoDoSistema(enderecoDominio ?? estado?.endereco ?? null) : null), [noArAgora, enderecoDominio, estado?.endereco])
  const matriz = useMemo(() => (link ? matrizQr(link) : null), [link])
  const predio = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(predioSvg({ andares, prontos: andares, altura: 560 }))}`, [andares])
  const selo = noArAgora ? 'NO AR' : fase === 'parado' ? 'PRONTA PARA PUBLICAR' : fase === 'erro' ? 'PRECISA DE VOCÊ' : 'PUBLICANDO'
  const nomeMostrado = nome || '…'
  const okDigitado = situacao === 'livre' || situacao === 'seu'

  return (
    <main className="at-noar">
      <header className="at-noar__cab">
        <div>
          {onVoltar && <button type="button" className="at-noar__voltar" onClick={onVoltar}>← CANTEIRO DE OBRAS</button>}
          <h1>{obra.nome}</h1>
        </div>
        <span className={`at-noar__selo ${noArAgora || fase === 'parado' ? 'at-noar__selo--ok' : 'at-noar__selo--anda'}`}>{selo}</span>
      </header>
      <div className="at-noar__grade">
        <section className="at-noar__cena" aria-label={`O prédio pronto: ${andares} de ${andares} andares`}>
          <img src={predio} alt="" />
          <div className="at-noar__pct"><b>100%</b><span>{andares} DE {andares} ANDARES PRONTOS · TESTES OK</span></div>
          {noArAgora && <span className="at-noar__noar"><span aria-hidden="true" />NO AR</span>}
        </section>

        <aside className="at-noar__lado">
          {fase === 'parado' && tela === 'pronta' && (
            <>
              <section className="at-noar__card at-noar__card--lime">
                <span className="at-noar__rot at-noar__rot--lime">A OBRA FICOU PRONTA</span>
                <b className="at-noar__tit">Agora é colocar no ar para a sua equipe usar.</b>
                <span className="at-noar__txt">O Atlas publica o {obra.nome} num endereço na internet, liga o banco de dados de verdade e deixa pronto para instalar no celular, como um app. Tudo nas suas contas.</span>
                <div className="at-noar__lista">
                  <span><span>Endereço (o Atlas já escolheu)</span><b>{nomeMostrado}.vercel.app <button type="button" className="at-noar__link" onClick={() => setTela('endereco')}>trocar</button></b></span>
                  <span><span>Contas</span><b className="at-noar__verde">✓ GitHub · Vercel · Supabase</b></span>
                  <span><span>Quanto custa</span><b>R$ 0 (planos grátis)</b></span>
                  <span><span>O que você faz</span><b>só este clique</b></span>
                </div>
                <button type="button" className="at-noar__prim" disabled={!nome || noAr.indisponivel} onClick={() => void colocar(nome)}>Colocar no ar →</button>
                {noAr.indisponivel && <span className="at-noar__nota" role="status">Esta parte ainda não está ligada neste computador. O Atlas não finge que publicou.</span>}
                <span className="at-noar__nota">Daqui pra frente o Atlas faz tudo sozinho: vistoria, banco de dados, publicação e teste. Se algo der errado, ele corrige antes de abrir as portas.</span>
              </section>
              <section className="at-noar__card at-noar__card--calmo">
                <span className="at-noar__rot">DEPOIS DE NO AR, SE QUISER · O ATLAS JÁ DEIXA PRONTO</span>
                <span className="at-noar__linha"><span>Domínio próprio ({nomeMostrado}.com.br)</span><span className="at-noar__mudo">~R$ 40/ano</span></span>
                <span className="at-noar__linha"><span>App Store e Google Play</span><span className="at-noar__mudo">US$ 99/ano · US$ 25 uma vez</span></span>
              </section>
            </>
          )}

          {fase === 'parado' && tela === 'endereco' && (
            <section className="at-noar__card">
              <span className="at-noar__rot">OPCIONAL · ESCOLHER OUTRO NOME</span>
              <b className="at-noar__tit">Digite um nome. O Atlas confere na hora se está livre.</b>
              <div className={`at-noar__campo ${situacao === 'ocupado' || situacao === 'invalido' ? 'at-noar__campo--ruim' : ''}`}>
                <input aria-label="Nome do endereço" value={digitado} onChange={(ev) => setDigitado(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48))} aria-describedby="noar-situacao" />
                <span className="at-noar__mudo">.vercel.app</span>
                <span id="noar-situacao" className="at-noar__sit" role="status">{situacao === 'livre' || situacao === 'seu' ? '✓ livre' : situacao === 'ocupado' ? '✗ já é de outra pessoa' : situacao === 'invalido' ? 'use letras, números e hífen' : situacao === 'incerto' ? 'não deu para conferir' : 'conferindo…'}</span>
              </div>
              {livres.length > 0 && (
                <>
                  <span className="at-noar__rot">LIVRES AGORA · TOQUE PARA ESCOLHER</span>
                  <div className="at-noar__opcoes">
                    {livres.map((n) => (
                      <button key={n} type="button" className={`at-noar__opcao ${n === digitado ? 'at-noar__opcao--on' : ''}`} onClick={() => setDigitado(n)}><b>{n}</b><span className="at-noar__mudo">.vercel.app</span><span className="at-noar__verde">{n === digitado ? '✓ escolhido' : '✓ livre'}</span></button>
                    ))}
                  </div>
                </>
              )}
              <span className="at-noar__nota">É o endereço grátis. Quer algo como {digitado || nome}.com.br? Depois de no ar, use "Usar meu domínio".</span>
              <button type="button" className="at-noar__prim" disabled={!okDigitado} onClick={() => { setNome(digitado); void colocar(digitado) }}>Usar {digitado || 'este nome'} e colocar no ar →</button>
              <button type="button" className="at-noar__sec" onClick={() => setTela('pronta')}>Voltar</button>
            </section>
          )}

          {(fase === 'rodando' || fase === 'corrigindo') && (
            <section className="at-noar__card at-noar__card--cheio">
              <span className="at-noar__rot at-noar__rot--lime"><span className="at-noar__pisca" aria-hidden="true" />{fase === 'corrigindo' ? 'CORRIGINDO ANTES DE ABRIR AS PORTAS' : 'COLOCANDO NO AR · O ATLAS FAZ SOZINHO'}</span>
              <b className="at-noar__tit at-noar__tit--m">{fase === 'corrigindo' ? 'O Atlas está corrigindo pela linha da obra. Quando terminar, ele confere de novo e continua sozinho.' : 'Pode deixar o Atlas trabalhando. Ele avisa no celular quando estiver pronto.'}</b>
              <Passos estado={estado} />
            </section>
          )}

          {fase === 'vistoria' && estado && (
            <section className="at-noar__card at-noar__card--ambar">
              <span className="at-noar__rot at-noar__rot--ambar">A VISTORIA ACHOU {estado.achados.length} {estado.achados.length === 1 ? 'PONTO' : 'PONTOS'} · NÃO É ERRO SEU</span>
              <b className="at-noar__tit at-noar__tit--m">Antes de abrir as portas, o Atlas vai acertar isto:</b>
              <ul className="at-noar__achados">{estado.achados.map((a) => <li key={a}>{a}</li>)}</ul>
              <span className="at-noar__txt">O Atlas corrige pela mesma linha da obra, testa de novo e continua a publicação sozinho.</span>
              {esperandoVez
                ? <span className="at-noar__txt" role="status">Outra obra está trabalhando agora neste computador. Assim que ela terminar, o Atlas corrige sozinho; pode deixar esta tela aberta.</span>
                : <button type="button" className="at-noar__prim" onClick={() => void corrigir()}>Corrigir e continuar →</button>}
              {travou !== null && (
                <div className="at-noar__destravar">
                  <button type="button" className="at-noar__sec" onClick={() => void corrigir()}>Tentar de novo</button>
                  {onAjuda && <button type="button" className="at-noar__sec" onClick={() => onAjuda({ onde: 'a correção que a vistoria pediu antes de publicar', erro: travou || 'sem-codigo' })}>Pedir ao Atlas para destravar</button>}
                </div>
              )}
            </section>
          )}

          {fase === 'erro' && estado?.erro && (
            <section className="at-noar__card at-noar__card--ambar">
              <span className="at-noar__rot at-noar__rot--ambar">PAROU NO PASSO: {(PASSOS_NO_AR.find((p) => p.id === estado.erro?.passo)?.titulo ?? '').toUpperCase()}</span>
              <b className="at-noar__tit at-noar__tit--m">{explicarErro(estado.erro.motivo).frase}</b>
              <span className="at-noar__codigo">código: {estado.erro.motivo}</span>
              <Passos estado={estado} />
              {explicarErro(estado.erro.motivo).conta && onLigarContas && <button type="button" className="at-noar__sec" onClick={onLigarContas}>Religar a conta</button>}
              <button type="button" className="at-noar__prim" onClick={() => void colocar(estado.nome ?? nome)}>Tentar de novo →</button>
              {onAjuda && <button type="button" className="at-noar__sec" onClick={() => onAjuda({ onde: 'colocar no ar', erro: estado.erro?.motivo })}>Falar com o Atlas</button>}
            </section>
          )}

          {noArAgora && vendoDominio && dominio && (
            <DominioProprio pasta={obra.pasta} dominio={dominio} sugestao={estado?.nome ?? nome} abrirRegistro={abrirRegistro ?? (async () => {})} onNoAr={setEnderecoDominio} onVoltar={() => setVendoDominio(false)} onAjuda={onAjuda} onAbrirGuia={onGuiaRegistro} intervaloMs={Math.max(intervaloMs, 30)} />
          )}
          {noArAgora && vendoLojas && lojas && onGuiaLojas && (
            <Lojas pasta={obra.pasta} appNome={obra.nome} lojas={lojas} onGuia={onGuiaLojas} dominio={enderecoDominio ? enderecoDominio.replace(/^https:\/\//, '') : null} onVoltar={() => setVendoLojas(false)} abrirSite={abrirSiteLojas} />
          )}
          {noArAgora && !vendoDominio && !vendoLojas && (
            <>
              <section className="at-noar__card at-noar__card--lime">
                <span className="at-noar__rot at-noar__rot--lime">ESTÁ NO AR · ENTREGA DAS CHAVES</span>
                <b className="at-noar__tit at-noar__tit--m">{link ? link.replace(/^https:\/\//, '') : ''}</b>
                <div className="at-noar__qr">
                  {link && matriz && (
                    <svg width="132" height="132" viewBox={`0 0 ${matriz.length} ${matriz.length}`} shapeRendering="crispEdges" role="img" aria-label="QR code para abrir o sistema no celular" data-endereco={link}>
                      <path d={caminhoQr(matriz)} fill="#141619" />
                    </svg>
                  )}
                  <span className="at-noar__txt">Aponte a câmera do celular. No iPhone: Compartilhar → Adicionar à Tela de Início. No Android: Instalar app.</span>
                </div>
                {link && <a className="at-noar__prim" href={linkWhatsapp(recadoEquipe(obra.nome, link))} target="_blank" rel="noopener noreferrer">Mandar pelo WhatsApp</a>}
                {estado?.avisos.map((a) => <span key={a} className="at-noar__nota">{a}</span>)}
                <span className="at-noar__nota">Daqui pra frente, toda mudança que você pedir no pós-obra entra no ar sozinha, depois dos testes.</span>
              </section>
              {(onDominio || dominio || onLojas || lojas || onVender) && (
                <section className="at-noar__card at-noar__card--calmo">
                  <span className="at-noar__rot">PRÓXIMOS PASSOS · SÓ SE VOCÊ QUISER</span>
                  {(dominio || onDominio) && <button type="button" className="at-noar__prox" onClick={() => (dominio ? setVendoDominio(true) : onDominio?.(link))}><span><b>{enderecoDominio ? 'Meu domínio' : 'Usar meu domínio'}</b><span className="at-noar__mudo">{enderecoDominio ? enderecoDominio.replace(/^https:\/\//, '') : `${nomeMostrado}.com.br no lugar do .vercel.app`}</span></span><span className="at-noar__verde">→</span></button>}
                  {(onLojas || (lojas && onGuiaLojas)) && <button type="button" className="at-noar__prox" onClick={() => (lojas && onGuiaLojas ? setVendoLojas(true) : onLojas?.(link))}><span><b>Colocar na App Store e no Google Play</b><span className="at-noar__mudo">o {obra.nome} aparece nas lojas, com ícone e página</span></span><span className="at-noar__verde">→</span></button>}
                  {onVender && <button type="button" className="at-noar__prox" onClick={onVender}><span><b>Quer vender o {obra.nome} para outras empresas?</b><span className="at-noar__mudo">opcional: página de vendas, cobrança na sua conta e o seu painel de dono</span></span><span className="at-noar__verde">→</span></button>}
                </section>
              )}
            </>
          )}
          {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
          {travouInicio !== null && onAjuda && <button type="button" className="at-noar__sec" onClick={() => onAjuda({ onde: 'o começo da publicação', erro: travouInicio })}>Pedir ao Atlas para destravar</button>}
        </aside>
      </div>
    </main>
  )
}

function Passos({ estado }: { estado: EstadoNoAr | null }) {
  return (
    <ol className="at-noar__passos">
      {PASSOS_NO_AR.map((p) => {
        const s = estado?.passos.find((x) => x.id === p.id)?.estado ?? 'falta'
        const rotulo = s === 'feito' ? 'feito' : s === 'agora' ? 'fazendo agora' : s === 'pulado' ? 'não precisa' : s === 'atencao' ? 'com aviso' : s === 'erro' ? 'parou aqui' : 'falta'
        return (
          <li key={p.id} className={`at-noar__passo at-noar__passo--${s}`} aria-label={`${p.titulo}: ${rotulo}`}>
            <span className="at-noar__bola" aria-hidden="true">{s === 'feito' || s === 'pulado' ? ICONE_OK : s === 'erro' || s === 'atencao' ? '!' : ''}</span>
            <span className="at-noar__ptxt"><b>{p.titulo}</b><span>{s === 'pulado' ? 'Este sistema não usa banco de dados.' : p.sub}</span></span>
          </li>
        )
      })}
    </ol>
  )
}
