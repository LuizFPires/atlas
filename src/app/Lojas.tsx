import { useCallback, useEffect, useState } from 'react'
import { linkWhatsapp } from './entrega-dados'
import { guiaApple, guiaChaveAsc, guiaDuns, guiaExpo, guiaGoogle, guiaGooglePrimeiro, guiaGrupoGoogle, guiaProducaoGoogle, type Guia } from './guias-site'
import type { DestinoSite } from './ponte-publicar'
import { explicarErroLojas, type CaminhoLojas, type ContaLoja, type EstadoLojas, type PonteLojas, type Testadores } from './ponte-lojas'

interface Props {
  pasta: string
  appNome: string
  lojas: PonteLojas
  /** Abre o passo a passo com o site (e diz qual conta ele cria, para marcar ao terminar). */
  onGuia: (guia: Guia, conta?: ContaLoja) => void
  /** Domínio próprio no ar (empresa precisa de site e e-mail no domínio). */
  dominio?: string | null
  onVoltar?: () => void
  /** Abre um site oficial no navegador do computador (App Store Connect, Google Play Console). */
  abrirSite?: (destino: DestinoSite) => Promise<void>
  intervaloMs?: number
}

function textoEnvio(e: EstadoLojas): string {
  const f = e.envio.fase
  if (f === 'preparando') return 'A linha da obra está montando a versão de app (mesmas telas, ícone, textos e privacidade).'
  if (f === 'montando') return 'Montando na nuvem da Expo. Leva uns 20 a 40 minutos; pode fechar o Atlas.'
  if (f === 'enviando') return 'Mandando a versão de iPhone para o TestFlight.'
  if (f === 'google-primeiro') return `${e.envio.ios === 'testflight' ? 'O iPhone já está no TestFlight. ' : ''}Falta o 1º envio ao Google (regra do Google, uma vez só): baixe o arquivo e siga o passo a passo.`
  if (f === 'teste') return e.envio.ios === 'testflight' ? 'No TestFlight e no teste fechado do Google.' : 'No teste fechado do Google. O iPhone entra quando a chave da Apple estiver guardada.'
  if (f === 'erro') return explicarErroLojas(e.envio.erro ?? '')
  return e.contas.expo ? 'Com as contas prontas, o Atlas monta ícone, textos, fotos, política de privacidade e a versão de app, e manda para os testes.' : 'Primeiro a conta da Expo: é nela que o Atlas monta a versão de app.'
}

const ICONE_OK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>

/**
 * Colocar nas lojas (M59; prototipo/caminho-novo/PB8Lojas e PB13Testadores). Uma pergunta antes (em nome de quem), depois a lista
 * do que falta, cada item com o seu passo a passo. O Atlas nunca cria conta, nunca paga e nunca aperta "Enviar para revisão".
 */
export function Lojas({ pasta, appNome, lojas, onGuia, dominio = null, onVoltar, abrirSite, intervaloMs = 60_000 }: Props) {
  const [e, setE] = useState<EstadoLojas | null>(null)
  const [escolha, setEscolha] = useState<CaminhoLojas>('pessoa')
  const [mudando, setMudando] = useState(false)
  const [tokenExpo, setTokenExpo] = useState('')
  const [issuer, setIssuer] = useState('')
  const [team, setTeam] = useState('')
  const [grupo, setGrupo] = useState('')
  const [teste, setTeste] = useState<Testadores | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true
    void lojas.estado(pasta).then((x) => { if (vivo) { setE(x); if (x.caminho) setEscolha(x.caminho) } }, () => {})
    return () => { vivo = false }
  }, [lojas, pasta])

  const comConvite = !!e?.convite && e.caminho === 'pessoa'
  const andando = !!e && ['preparando', 'montando', 'enviando'].includes(e.envio.fase)
  useEffect(() => {
    if (!andando) return
    const t = setInterval(() => { void lojas.estado(pasta).then(setE, () => {}) }, Math.min(intervaloMs, 15_000))
    return () => clearInterval(t)
  }, [andando, lojas, pasta, intervaloMs])
  useEffect(() => {
    if (!comConvite) return
    let vivo = true
    const olhar = () => { void lojas.testadores(pasta).then((t) => { if (vivo) setTeste(t) }, () => {}) }
    olhar()
    const t = setInterval(olhar, intervaloMs)
    return () => { vivo = false; clearInterval(t) }
  }, [comConvite, lojas, pasta, intervaloMs])

  const tentar = useCallback(async (f: () => Promise<unknown>) => {
    setAviso('')
    try { await f(); setE(await lojas.estado(pasta)) } catch (x) { setAviso(explicarErroLojas((x as Error).message)) }
  }, [lojas, pasta])

  if (!e) return <section className="at-noar__card"><p className="at-noar__txt" role="status">Abrindo…</p></section>

  if (!e.caminho || mudando) {
    return (
      <section className="at-noar__card at-noar__card--cheio">
        <span className="at-noar__rot">COLOCAR NAS LOJAS · 1 PERGUNTA ANTES</span>
        <b className="at-noar__tit at-noar__tit--m">Na loja, o {appNome} vai aparecer em nome de quem?</b>
        <div className="at-lojas__opcoes" role="radiogroup" aria-label="Em nome de quem">
          <label className={`at-lojas__op ${escolha === 'pessoa' ? 'at-lojas__op--on' : ''}`}>
            <input type="radio" name="lojas-caminho" checked={escolha === 'pessoa'} onChange={() => setEscolha('pessoa')} aria-label="No meu nome (pessoa física ou MEI)" />
            <span><b>No meu nome (pessoa física ou MEI)</b> <span className="at-lojas__selo">MAIS RÁPIDO</span>
              <span className="at-noar__mudo">Apple: inscrição pelo iPhone, pronta em uns 2 dias. Google: antes de abrir para todos, 12 pessoas precisam testar o app por 14 dias seguidos (regra do Google). O Atlas convida e acompanha.</span></span>
          </label>
          <label className={`at-lojas__op ${escolha === 'empresa' ? 'at-lojas__op--on' : ''}`}>
            <input type="radio" name="lojas-caminho" checked={escolha === 'empresa'} onChange={() => setEscolha('empresa')} aria-label="No nome da empresa (LTDA, S/A…)" />
            <span><b>No nome da empresa (LTDA, S/A…)</b>
              <span className="at-noar__mudo">Precisa de 3 coisas antes: o número D-U-N-S da empresa (grátis, pode levar até 30 dias), um e-mail com o domínio da empresa e o site no ar nesse domínio. Sem a regra dos 12 testadores. O Atlas guia cada uma.</span></span>
          </label>
        </div>
        <span className="at-noar__nota">Custos, pagos por você: Apple ~US$ 99 por ano (aparece em reais) · Google US$ 25 uma vez.</span>
        <button type="button" className="at-noar__prim" onClick={() => void tentar(async () => { await lojas.escolher(pasta, escolha); setMudando(false) })}>Seguir →</button>
        {onVoltar && <button type="button" className="at-noar__sec" onClick={onVoltar}>Voltar</button>}
        {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
      </section>
    )
  }

  const empresa = e.caminho === 'empresa'
  const item = (id: string, titulo: string, pronto: boolean, sub: string, filho?: React.ReactNode) => (
    <li key={id} className={`at-noar__passo at-noar__passo--${pronto ? 'feito' : 'falta'}`} aria-label={`${titulo}: ${pronto ? 'pronta' : 'falta'}`}>
      <span className="at-noar__bola" aria-hidden="true">{pronto ? ICONE_OK : ''}</span>
      <span className="at-noar__ptxt"><b>{titulo}</b><span>{sub}</span>{filho}</span>
    </li>
  )
  const guiaBotao = (titulo: string, g: Guia, conta?: ContaLoja) => <button type="button" className="at-lojas__guia" aria-label={`Passo a passo: ${titulo}`} onClick={() => onGuia(g, conta)}>Passo a passo →</button>
  const zap = e.convite ? linkWhatsapp(`Oi! Me ajuda a testar o app ${appNome}? Leva 2 minutos, precisa de Android: ${e.convite.link}`) : null

  return (
    <section className="at-noar__card at-noar__card--cheio">
      <span className="at-noar__rot">COLOCAR NAS LOJAS · {empresa ? 'NO NOME DA EMPRESA' : 'NO SEU NOME'}</span>
      <b className="at-noar__tit at-noar__tit--m">O que falta para o {appNome} entrar nas lojas</b>
      <ol className="at-noar__passos" aria-label="O que falta para as lojas">
        {empresa && item('duns', 'Número D-U-N-S da empresa', e.contas.duns, 'Grátis. Pode levar até 30 dias: peça logo.', guiaBotao('Número D-U-N-S', guiaDuns(), 'duns'))}
        {empresa && item('email', 'Um e-mail com o domínio da empresa', !!dominio, dominio ? `Ex.: contato@${dominio}. A Apple pede para conta de empresa.` : 'Primeiro ligue o domínio próprio ("Usar meu domínio"). Depois crie um e-mail nele.')}
        {empresa && item('site', 'O site no ar no domínio da empresa', !!dominio, dominio ? `${dominio} já está no ar.` : 'Vem junto com o domínio próprio.')}
        {item('apple', 'Conta da Apple (App Store)', e.contas.apple, 'Pelo iPhone, no app Apple Developer. ~US$ 99 por ano.', guiaBotao('Conta da Apple', guiaApple(), 'apple'))}
        {item('google', 'Conta do Google Play', e.contas.google, 'US$ 25 uma vez. Pede um documento com foto.', guiaBotao('Conta do Google Play', guiaGoogle({ nomeDev: appNome }), 'google'))}
        {item('expo', 'Conta da Expo', e.contas.expo, 'Grátis. É onde o Atlas monta a versão de app na nuvem.', (
          <>
            {guiaBotao('Conta da Expo', guiaExpo())}
            {!e.contas.expo && (
              <span className="at-lojas__campo">
                <input aria-label="Chave da Expo" placeholder="cole aqui a chave da Expo" value={tokenExpo} onChange={(x) => setTokenExpo(x.target.value)} autoComplete="off" spellCheck={false} />
                <button type="button" aria-label="Guardar a chave da Expo" onClick={() => void tentar(async () => { await lojas.guardarTokenExpo(tokenExpo); setTokenExpo('') })}>Guardar</button>
              </span>
            )}
          </>
        ))}
        {item('asc', 'Chave da App Store Connect', e.chaveAsc, e.contas.apple ? 'Deixa o Atlas mandar o app para o TestFlight sozinho.' : 'Depois que a Apple aprovar a sua conta.', e.contas.apple && !e.chaveAsc ? (
          <>
            {guiaBotao('Chave da App Store Connect', guiaChaveAsc())}
            <span className="at-lojas__campo">
              <input aria-label="Issuer ID" placeholder="cole aqui o Issuer ID" value={issuer} onChange={(x) => setIssuer(x.target.value)} autoComplete="off" spellCheck={false} />
            </span>
            <span className="at-lojas__campo">
              <input aria-label="Team ID" placeholder="Team ID (10 letras e números)" value={team} onChange={(x) => setTeam(x.target.value)} autoComplete="off" spellCheck={false} />
              <button type="button" onClick={() => void tentar(() => lojas.escolherChaveAsc(pasta, issuer, team))}>Escolher o arquivo da chave</button>
            </span>
          </>
        ) : undefined)}
        {!empresa && item('testadores', 'Google: os 12 testadores por 14 dias', !!teste?.completo, teste ? (teste.dia > 0 ? `Dia ${teste.dia} de 14 · ${teste.pessoas} pessoas no teste.` : `${teste.pessoas} de 12 pessoas já entraram. Faltam ${teste.faltam}.`) : 'O Atlas convida pelo WhatsApp e conta as pessoas e os dias.', (
          <>
            {!e.convite && (
              <>
                {guiaBotao('Grupo dos testadores', guiaGrupoGoogle({ appNome }))}
                <span className="at-lojas__campo">
                  <input aria-label="Endereço do grupo" placeholder="groups.google.com/g/…" value={grupo} onChange={(x) => setGrupo(x.target.value)} autoComplete="off" spellCheck={false} />
                  <button type="button" onClick={() => void tentar(() => lojas.criarConvite(pasta, appNome, grupo.trim().replace(/^(?!https:\/\/)/, 'https://')))}>Criar o convite</button>
                </span>
              </>
            )}
            {zap && <a className="at-noar__prim at-lojas__zap" href={zap} target="_blank" rel="noopener noreferrer">Mandar o convite pelo WhatsApp</a>}
          </>
        ))}
        {item('app', 'Versão de app e envio aos testes das lojas', e.envio.fase === 'teste', textoEnvio(e), (
          <>
            {e.contas.expo && (e.envio.fase === 'nada' || e.envio.fase === 'erro') && (
              <button type="button" className="at-noar__prim at-lojas__zap" onClick={() => void tentar(() => lojas.montar(pasta))}>{e.envio.fase === 'erro' ? 'Tentar de novo →' : 'Montar a versão de app e mandar →'}</button>
            )}
            {e.envio.fase === 'google-primeiro' && (
              <>
                <button type="button" className="at-noar__prim at-lojas__zap" onClick={() => void tentar(() => lojas.baixarAab(pasta))}>Baixar o arquivo do app (.aab)</button>
                {guiaBotao('1º envio ao Google', guiaGooglePrimeiro({ appNome }))}
                <button type="button" className="at-lojas__guia" onClick={() => void tentar(() => lojas.googleEnviado(pasta))}>Já fiz o 1º envio</button>
              </>
            )}
          </>
        ))}
        {!empresa && teste?.completo && item('producao', 'Dia 14: pedir para abrir a todos', false, 'As respostas do pedido já estão prontas para copiar.', guiaBotao('Pedir a produção ao Google', guiaProducaoGoogle({ appNome, pessoas: teste.pessoas })))}
      </ol>
      {e.envio.fase === 'teste' && (
        <div className="at-dom__conferiu">
          <span className="at-noar__rot at-noar__rot--lime">PRONTO PARA AS LOJAS · FALTA SÓ O SEU ENVIO</span>
          <span className="at-noar__txt">O {appNome} já está no teste {e.envio.ios === 'testflight' ? 'das duas lojas' : 'do Google'}. Instale no seu celular e confira. Gostou? Em cada loja, aperte "Enviar para revisão". A revisão leva de 1 a 3 dias e o Atlas avisa quando aprovar.</span>
          {abrirSite && e.envio.ios === 'testflight' && <button type="button" className="at-noar__sec" onClick={() => void abrirSite('app-store-connect')}>Abrir a App Store Connect</button>}
          {abrirSite && <button type="button" className="at-noar__sec" onClick={() => void abrirSite('google-play-console')}>Abrir o Google Play Console</button>}
        </div>
      )}
      <span className="at-noar__nota">O "Enviar para revisão" de cada loja é sempre seu: é você quem publica em seu nome.</span>
      <button type="button" className="at-noar__sec" onClick={() => setMudando(true)}>Trocar: {empresa ? 'no meu nome' : 'no nome da empresa'}</button>
      {onVoltar && <button type="button" className="at-noar__sec" onClick={onVoltar}>Voltar</button>}
      {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
    </section>
  )
}
