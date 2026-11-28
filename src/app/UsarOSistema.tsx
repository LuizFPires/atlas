// Aba "Usar o sistema" (protótipo caminho-novo/U1UsarSistema.dc.html, abas 4 e 5; aprovado pelo Luiz em 28/11/2026).
// Duas metades: "Usando agora · R$ 0 por mês" (endereço grátis, QR, WhatsApp e as pessoas da equipe) e "Abrir para
// clientes · só se você quiser" (domínio, e-mails, lojas, vender). O prédio 3D fica na aba Obra.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icone, type NomeIcone } from '../ui'
import { AcessoDoDono } from './AcessoDoDono'
import { caminhoQr, enderecoDoSistema, linkWhatsapp, matrizQr, recadoEquipe } from './entrega-dados'
import { explicarTrava } from './explicar-trava'
import type { EstadoNoAr, PapelDaEquipe, PessoaDaEquipe, PonteNoAr } from './ponte-no-ar'
import './colocar-no-ar.css'
import './usar-sistema.css'

interface Props {
  obra: { nome: string; pasta: string }
  noAr: PonteNoAr
  /** Abrir para clientes: cada um só aparece se a tela dele existir nesta versão. */
  onDominio?: () => void
  onEmails?: () => void
  onLojas?: () => void
  onVender?: () => void
  /** Começa já em "Pessoas da equipe" (testes e atalhos). */
  inicio?: 'usar' | 'pessoas'
  /** Quanto da obra já foi construído (aba existe desde o início; Luiz, 28/11/2026). */
  lerPct?: () => Promise<number>
}

const erroDe = (e: unknown) => { const x = explicarTrava(e instanceof Error ? e.message : String(e)); return `${x.houve} ${x.fazer}` }

export function UsarOSistema({ obra, noAr, onDominio, onEmails, onLojas, onVender, inicio = 'usar', lerPct }: Props) {
  const [estado, setEstado] = useState<EstadoNoAr | null>(null)
  const [pessoas, setPessoas] = useState<PessoaDaEquipe[] | null>(null)
  const [erroLista, setErroLista] = useState('')
  const [vendo, setVendo] = useState<'usar' | 'pessoas'>(inicio)
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [pct, setPct] = useState<number | null>(null)
  useEffect(() => { let vivo = true; lerPct?.().then((n) => { if (vivo) setPct(n) }, () => {}); return () => { vivo = false } }, [lerPct])

  const lerPessoas = useCallback(() => {
    if (!noAr.pessoas) return
    noAr.pessoas(obra.pasta).then((l) => { setPessoas(l); setErroLista('') }, (e) => { setPessoas([]); setErroLista(erroDe(e)) })
  }, [noAr, obra.pasta])

  useEffect(() => {
    let vivo = true
    noAr.estado(obra.pasta).then((e) => { if (vivo) setEstado(e) }, () => {})
    return () => { vivo = false }
  }, [noAr, obra.pasta])
  const noArJa = estado?.fase === 'noar' && !!estado.endereco
  useEffect(() => { if (noArJa) lerPessoas() }, [lerPessoas, noArJa])

  const link = useMemo(() => enderecoDoSistema(estado?.endereco ?? null), [estado?.endereco])
  const matriz = useMemo(() => (link ? matrizQr(link) : null), [link])
  const definirSenha = noAr.definirSenha ? (s: string) => noAr.definirSenha!(obra.pasta, s) : undefined

  if (vendo === 'pessoas') {
    return <PessoasDaEquipe obra={obra} noAr={noAr} link={link} pessoas={pessoas} erroLista={erroLista} onMudou={lerPessoas} onVoltar={() => setVendo('usar')} />
  }

  const semSenha = estado?.acesso && !estado.acesso.senha
  const guias = guiasDeAbrir(obra.nome, noArJa, { onDominio, onEmails, onLojas, onVender }, !!estado?.email)
  const ladoDireito = (
    <section className="at-usar__metade at-usar__metade--dir" aria-label="Abrir para clientes">
      <div className="at-usar__mtit"><span className="at-usar__pto at-usar__pto--off" aria-hidden="true" /><b>Abrir para clientes</b><span className="at-acd__tag at-usar__tag">SÓ SE VOCÊ QUISER</span></div>
      <span className="at-usar__txt">Nada disto é obrigatório. Cada item explica o que é, quanto custa e onde fazer. <b>Você pode fazer por conta própria, do seu jeito</b>, ou deixar o Atlas ajudar. Quando algo tem custo, você paga direto a quem vende, nunca ao Atlas.</span>
      {guias.map((g, i) => (
        <details key={g.id} className="at-usar__guia" open={i === 0 && !noArJa ? true : undefined}>
          <summary className="at-usar__abrir">
            <span className="at-usar__ic" aria-hidden="true"><Icone nome={g.icone} tamanho={18} /></span>
            <span className="at-usar__quem"><b>{g.titulo}</b><span>{g.sub}</span></span>
            <span className={`at-acd__tag ${g.tag === 'LIGADO' ? 'at-acd__tag--ok' : 'at-usar__tag'}`}>{g.tag}</span>
            <span className="at-usar__seta" aria-hidden="true">⌄</span>
          </summary>
          <div className="at-usar__como">
            {g.como.map(([t, txt]) => <p key={t}><b>{t}</b> {txt}</p>)}
            <div className="at-usar__cpe">
              <span className="at-usar__nota">Você pode fazer do seu jeito, por fora do Atlas.{g.acao ? ' Se quiser ajuda, é aqui:' : ` ${g.depois}`}</span>
              {g.acao && <button type="button" className="at-acd__sec" onClick={g.acao}>{g.botao}</button>}
            </div>
          </div>
        </details>
      ))}
    </section>
  )

  if (!estado) return <div className="at-usar"><span className="at-usar__txt" role="status">Lendo a sua obra…</span></div>

  if (!noArJa) {
    return (
      <div className="at-usar">
        <section className="at-usar__metade" aria-label="Quando a obra ficar pronta">
          <div className="at-usar__mtit"><span className="at-usar__pto at-usar__pto--off" aria-hidden="true" /><b>Quando a obra ficar pronta</b>{pct !== null && <span className="at-acd__tag at-usar__tag">{Math.round(pct)}% CONSTRUÍDO</span>}</div>
          <div className="at-noar__card">
            <span className="at-noar__rot">O QUE VAI ACONTECER · R$ 0 POR MÊS</span>
            <b className="at-usar__tit">O seu sistema vai funcionar de graça.</b>
            <span className="at-usar__txt">Você não precisa comprar nada para usar com a sua equipe. Assim que a obra chegar a 100%:</span>
            <ol className="at-usar__passos">
              <li><b>Colocar no ar</b><span>Um toque. O sistema fica num endereço grátis da Vercel (algo como {estado.nome || obra.pasta}.vercel.app).</span></li>
              <li><b>Sua senha de dono</b><span>Você cria aqui mesmo, sem e-mail.</span></li>
              <li><b>Sua equipe</b><span>Você coloca as pessoas e manda a senha pelo WhatsApp.</span></li>
            </ol>
          </div>
          <div className="at-noar__card at-usar__apagado" aria-label="Pessoas da equipe">
            <div className="at-usar__lin"><span className="at-noar__rot">PESSOAS DA EQUIPE</span><span className="at-acd__tag at-usar__tag">QUANDO ESTIVER NO AR</span></div>
            <span className="at-usar__txt">Aqui você vai colocar quem usa o sistema, com o papel de cada um (os papéis vêm do seu sistema).</span>
          </div>
        </section>
        {ladoDireito}
      </div>
    )
  }

  return (
    <div className="at-usar">
      <section className="at-usar__metade" aria-label="Usando agora">
        <div className="at-usar__mtit"><span className="at-usar__pto" aria-hidden="true" /><b>Usando agora</b><span className="at-acd__tag at-acd__tag--ok">R$ 0 POR MÊS</span></div>
        <div className="at-noar__card at-noar__card--lime at-usar__pronto">
          <span className="at-noar__rot at-noar__rot--lime">PRONTO PARA USAR · ENTREGA DAS CHAVES</span>
          <b className="at-usar__tit">Seu sistema já está funcionando.</b>
          <span className="at-usar__txt">Você e a sua equipe já podem usar tudo. <b>Não precisa pagar nada nem comprar domínio.</b> Só entra quem você cadastrar.</span>
          {link && (
            <div className="at-usar__end">
              {matriz && (
                <svg width="84" height="84" viewBox={`0 0 ${matriz.length} ${matriz.length}`} shapeRendering="crispEdges" role="img" aria-label="QR code para abrir o sistema no celular" data-endereco={link}>
                  <path d={caminhoQr(matriz)} fill="#141619" />
                </svg>
              )}
              <div>
                <span className="at-noar__rot">ENDEREÇO GRÁTIS</span>
                <b>{link.replace(/^https:\/\//, '')}</b>
                <span>Aponte a câmera do celular para abrir e instalar.</span>
              </div>
            </div>
          )}
          {link && (
            <div className="at-usar__pe">
              <a className="at-acd__sec at-usar__a" href={linkWhatsapp(recadoEquipe(obra.nome, link))} target="_blank" rel="noopener noreferrer">Mandar pelo WhatsApp</a>
              <a className="at-acd__prim" href={link} target="_blank" rel="noopener noreferrer">Abrir o sistema ↗</a>
            </div>
          )}
        </div>
        {estado?.acesso && (semSenha || trocandoSenha) && <AcessoDoDono key={`${estado.acesso.email}-${trocandoSenha}`} acesso={trocandoSenha ? { ...estado.acesso, senha: false } : estado.acesso} endereco={estado.endereco} definirSenha={definirSenha ? async (s) => { await definirSenha(s); setTrocandoSenha(false); setEstado((e) => (e && e.acesso ? { ...e, acesso: { ...e.acesso, senha: true } } : e)) } : undefined} />}
        {noAr.pessoas && (
          <div className="at-noar__card at-usar__equipe" aria-label="Pessoas da equipe">
            <div className="at-usar__lin">
              <span className="at-noar__rot">PESSOAS DA EQUIPE{pessoas ? ` · ${pessoas.filter((p) => !p.bloqueado).length}` : ''}</span>
              <button type="button" className="at-acd__sec at-usar__mini" onClick={() => setVendo('pessoas')}>+ Colocar uma pessoa</button>
            </div>
            {pessoas === null && <span className="at-usar__txt">Lendo quem já entra…</span>}
            {erroLista && <span className="at-usar__txt" role="alert">{erroLista}</span>}
            {pessoas?.map((p) => (
              <div key={p.id} className={`at-usar__pess${p.bloqueado ? ' at-usar__pess--off' : ''}`}>
                <span className="at-usar__av" aria-hidden="true">{(p.nome || p.email).slice(0, 1).toUpperCase()}</span>
                <span className="at-usar__quem"><b>{p.voce ? `${p.nome || 'Você'} (você)` : (p.nome || p.email)}</b><span>{p.email}</span></span>
                <span className={`at-acd__tag${p.voce ? ' at-acd__tag--ok' : ' at-usar__tag'}`}>{p.bloqueado ? 'SEM ACESSO' : nomeDoPapel(p.papel)}</span>
                {p.voce && definirSenha && <button type="button" className="at-usar__lk" onClick={() => setTrocandoSenha(true)}>Trocar senha</button>}
                {!p.voce && !p.bloqueado && <button type="button" className="at-usar__lk" onClick={() => setVendo('pessoas')}>Nova senha · Tirar</button>}
              </div>
            ))}
            {pessoas && pessoas.length <= 1 && !erroLista && <span className="at-usar__txt">Ainda só você. Coloque a sua equipe: o Atlas cria a conta e você manda a senha pelo WhatsApp, sem precisar de e-mail chegando.</span>}
          </div>
        )}
      </section>
      {ladoDireito}
    </div>
  )
}

interface Guia { id: string; icone: NomeIcone; titulo: string; sub: string; tag: string; como: [string, string][]; acao?: () => void; botao: string; depois: string }
/** Guias de "Abrir para clientes" (aba 6 aprovada em 28/11/2026): instrução para fazer por fora ou com o Atlas.
 *  Valores "cerca de": quem vende mostra o preço final antes de cobrar. */
function guiasDeAbrir(nome: string, noAr: boolean, h: { onDominio?: () => void; onEmails?: () => void; onLojas?: () => void; onVender?: () => void }, emailLigado: boolean): Guia[] {
  const quandoNoAr = 'O Atlas ajuda nisso assim que o sistema estiver no ar.'
  return [
    { id: 'dominio', icone: 'mapa', titulo: 'Usar meu domínio', sub: 'o endereço com o nome da sua empresa (ex.: suaempresa.com.br)', tag: 'PAGO · DOMÍNIO',
      como: [
        ['O que é.', 'Sem domínio, o sistema fica num endereço grátis da Vercel (.vercel.app). O domínio é o nome próprio, como suaempresa.com.br. Você paga por ano a quem vende, nunca ao Atlas.'],
        ['Onde comprar um .com.br.', 'No Registro.br (registro.br), a entidade oficial do Brasil, por cerca de R$ 40 por ano.'],
        ['Onde comprar um .com (e outros).', 'Na sua conta da Vercel, que mostra o preço antes de você confirmar.'],
        ['Pode comprar quando quiser.', 'Mesmo com a obra em andamento: quando o sistema estiver no ar, o Atlas liga o domínio (sozinho na Vercel, ou com um passo no Registro.br).'],
      ], acao: noAr ? h.onDominio : undefined, botao: 'Fazer pelo Atlas →', depois: quandoNoAr },
    { id: 'emails', icone: 'sino', titulo: 'E-mails para qualquer pessoa', sub: '“Esqueci minha senha” e avisos para clientes, pelo Resend', tag: emailLigado ? 'LIGADO' : 'GRÁTIS · PEDE DOMÍNIO',
      como: [
        ['O que é.', 'Para a sua equipe não faz falta: quem esquece a senha pede ao dono, que gera uma nova no Atlas. Para clientes receberem e-mails (senha, avisos), o sistema precisa de um “carteiro”: o Resend.'],
        ['Quanto custa.', 'A conta do Resend é sua e tem plano grátis. Ele pede um domínio seu.'],
        ['Pode ligar quando quiser.', 'A conta e o domínio valem para todos os seus sistemas.'],
      ], acao: h.onEmails, botao: emailLigado ? 'Ver o Resend →' : 'Ligar o Resend pelo Atlas →', depois: '' },
    { id: 'lojas', icone: 'celular', titulo: 'App Store e Google Play', sub: `o ${nome} aparece nas lojas, com ícone e página`, tag: 'PAGO · LOJAS',
      como: [
        ['O que é.', 'O sistema já funciona no celular pelo navegador e pode ser instalado na tela inicial, de graça. Estar nas lojas é opcional.'],
        ['Quanto custa.', 'A conta é sua, paga direto às lojas: Apple, cerca de US$ 99 por ano; Google, cerca de US$ 25 uma vez só.'],
        ['Pode abrir as contas quando quiser.', 'A aprovação das lojas costuma levar alguns dias, então vale começar antes.'],
      ], acao: noAr ? h.onLojas : undefined, botao: 'Ver o passo a passo pelo Atlas →', depois: quandoNoAr },
    { id: 'vender', icone: 'moeda', titulo: `Vender o ${nome} para outras empresas`, sub: 'página de vendas e cobrança na sua conta', tag: 'OPCIONAL',
      como: [
        ['O que é.', 'Se o sistema serve para outras empresas, o Atlas monta a página de vendas e a cobrança. O dinheiro cai na conta do seu meio de pagamento (Stripe ou Asaas), nunca passa pelo Atlas.'],
        ['Quando.', 'Depois que o sistema estiver pronto e testado com a sua equipe.'],
      ], acao: noAr ? h.onVender : undefined, botao: 'Ver como funciona pelo Atlas →', depois: quandoNoAr },
  ].filter((g) => g.id === 'emails' ? !!h.onEmails : g.id === 'dominio' ? !!h.onDominio || !noAr : g.id === 'lojas' ? !!h.onLojas || !noAr : !!h.onVender || !noAr) as Guia[]
}

const NOMES_PADRAO: Record<string, string> = { dono: 'DONO', equipe: 'FUNCIONÁRIO' }
const nomeDoPapel = (id: string) => (NOMES_PADRAO[id] ?? id).toLocaleUpperCase('pt-BR')

function PessoasDaEquipe({ obra, noAr, link, pessoas, erroLista, onMudou, onVoltar }: { obra: { nome: string; pasta: string }; noAr: PonteNoAr; link: string | null; pessoas: PessoaDaEquipe[] | null; erroLista: string; onMudou: () => void; onVoltar: () => void }) {
  const [papeis, setPapeis] = useState<PapelDaEquipe[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string; nova?: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [tirando, setTirando] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    noAr.papeis?.(obra.pasta).then((l) => {
      if (!vivo) return
      setPapeis(l)
      setPapel((atual) => atual || (l.find((p) => p.id !== 'dono') ?? l[0])?.id || '')
    }, () => {})
    return () => { vivo = false }
  }, [noAr, obra.pasta])

  const nomeDe = (id: string) => papeis.find((p) => p.id === id)?.nome.toLocaleUpperCase('pt-BR') ?? nomeDoPapel(id)
  const ok = nome.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim()) && !!papel
  const criar = async () => {
    if (!ok || !noAr.colocarPessoa) return
    setSalvando(true); setErro('')
    try {
      const r = await noAr.colocarPessoa(obra.pasta, { nome: nome.trim(), email: email.trim(), papel })
      setCriado({ nome: nome.trim(), email: email.trim().toLowerCase(), senha: r.senha })
      setNome(''); setEmail(''); setCopiado(false)
      onMudou()
    } catch (e) { setErro(erroDe(e)) } finally { setSalvando(false) }
  }
  const novaSenha = async (p: PessoaDaEquipe) => {
    if (!noAr.novaSenha) return
    setErro('')
    try { const r = await noAr.novaSenha(obra.pasta, p.id); setCriado({ nome: p.nome || p.email, email: p.email, senha: r.senha, nova: true }); setCopiado(false); onMudou() } catch (e) { setErro(erroDe(e)) }
  }
  const tirar = async (p: PessoaDaEquipe) => {
    if (!noAr.tirarAcesso) return
    setErro('')
    try { await noAr.tirarAcesso(obra.pasta, p.id); setTirando(null); onMudou() } catch (e) { setErro(erroDe(e)) }
  }
  const primeiro = criado ? criado.nome.split(' ')[0] : ''
  const recado = criado && link ? `Oi ${primeiro}! Seu acesso ao ${obra.nome}: ${link.replace(/^https:\/\//, '')} · login ${criado.email} · senha ${criado.senha} (troque no primeiro acesso).` : ''

  return (
    <div className="at-pess">
      <button type="button" className="at-usar__voltar" onClick={onVoltar}><Icone nome="seta-esquerda" tamanho={14} />Usar o sistema</button>
      <h2 className="at-pess__tit">Pessoas da equipe</h2>
      <span className="at-usar__txt">Quem você colocar aqui entra no {obra.nome} com e-mail e senha. O Atlas cria a conta na hora, sem depender de e-mail chegar.</span>
      <div className="at-pess__duas">
        {!criado ? (
          <div className="at-noar__card" aria-label="Colocar uma pessoa">
            <span className="at-noar__rot">COLOCAR UMA PESSOA</span>
            <label className="at-acd__campo"><span>Nome</span><span className={`at-acd__inp${nome.trim() ? ' at-acd__inp--ok' : ''}`}><input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" autoComplete="off" /></span></label>
            <label className="at-acd__campo"><span>E-mail (é o login dela; não precisa ser um e-mail que funcione)</span><span className={`at-acd__inp${/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim()) ? ' at-acd__inp--ok' : ''}`}><input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" inputMode="email" autoComplete="off" onKeyDown={(e) => { if (e.key === 'Enter') void criar() }} /></span></label>
            {papeis.length > 1 && (
              <div className="at-acd__campo">
                <span>O que ela pode fazer</span>
                <div className="at-pess__papeis" role="radiogroup" aria-label="Papel">
                  {papeis.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={papel === p.id} className={`at-pess__papel${papel === p.id ? ' at-pess__papel--on' : ''}`} onClick={() => setPapel(p.id)}><b>{p.nome}</b>{p.descricao && <span>{p.descricao}</span>}</button>
                  ))}
                </div>
              </div>
            )}
            {erro && <span className="at-usar__erro" role="alert">{erro}</span>}
            <div className="at-usar__pe"><button type="button" className="at-acd__prim" disabled={!ok || salvando} onClick={() => void criar()}>{salvando ? 'Criando…' : 'Criar acesso'}</button></div>
          </div>
        ) : (
          <div className="at-noar__card at-noar__card--lime" aria-label="Acesso criado">
            <span className="at-noar__rot at-noar__rot--lime">{criado.nova ? 'NOVA SENHA' : 'ACESSO CRIADO'}</span>
            <div className="at-acd__ok">
              <span className="at-acd__ic" aria-hidden="true">✓</span>
              <div><b>{criado.nova ? `Nova senha para ${primeiro}.` : `${primeiro} já pode entrar.`}</b><span>Mande para {criado.nova ? 'a pessoa' : 'ela'} o endereço, o login e a senha. No primeiro acesso o sistema pede para trocar a senha.</span></div>
            </div>
            <div className="at-pess__senha"><span className="at-noar__rot">SENHA INICIAL</span><b>{criado.senha}</b><button type="button" className="at-acd__sec at-usar__mini" onClick={() => { void navigator.clipboard?.writeText(criado.senha).then(() => setCopiado(true), () => {}) }}>{copiado ? 'Copiada' : 'Copiar'}</button></div>
            {recado && <div className="at-pess__recado">{recado}</div>}
            <div className="at-usar__pe">
              <button type="button" className="at-acd__sec" onClick={() => setCriado(null)}>Colocar outra pessoa</button>
              {recado && <a className="at-acd__prim" href={linkWhatsapp(recado)} target="_blank" rel="noopener noreferrer">Mandar pelo WhatsApp</a>}
            </div>
            <span className="at-usar__nota">O Atlas mostra a senha só agora e não guarda. Se perder, é só gerar outra.</span>
            {erro && <span className="at-usar__erro" role="alert">{erro}</span>}
          </div>
        )}
        <div className="at-noar__card" aria-label="Quem já entra">
          <span className="at-noar__rot">QUEM JÁ ENTRA</span>
          {pessoas === null && <span className="at-usar__txt">Lendo…</span>}
          {erroLista && <span className="at-usar__txt" role="alert">{erroLista}</span>}
          {pessoas?.map((p) => (
            <div key={p.id} className={`at-usar__pess${p.bloqueado ? ' at-usar__pess--off' : ''}`}>
              <span className="at-usar__av" aria-hidden="true">{(p.nome || p.email).slice(0, 1).toUpperCase()}</span>
              <span className="at-usar__quem"><b>{p.voce ? `${p.nome || 'Você'} (você)` : (p.nome || p.email)}</b><span>{p.email}{p.trocarSenha && !p.bloqueado ? ' · ainda vai trocar a senha' : ''}</span></span>
              <span className={`at-acd__tag${p.voce ? ' at-acd__tag--ok' : ' at-usar__tag'}`}>{p.bloqueado ? 'SEM ACESSO' : nomeDe(p.papel)}</span>
              {p.voce && <span className="at-usar__mudo">você</span>}
              {!p.voce && !p.bloqueado && tirando !== p.id && (
                <span className="at-usar__acoes">
                  <button type="button" className="at-usar__lk" onClick={() => void novaSenha(p)}>Nova senha</button>
                  <button type="button" className="at-usar__lk" onClick={() => setTirando(p.id)}>Tirar acesso</button>
                </span>
              )}
              {tirando === p.id && (
                <span className="at-usar__acoes">
                  <span className="at-usar__mudo">Tirar o acesso de {p.nome || p.email}?</span>
                  <button type="button" className="at-usar__lk at-usar__lk--perigo" onClick={() => void tirar(p)}>Sim, tirar</button>
                  <button type="button" className="at-usar__lk" onClick={() => setTirando(null)}>Não</button>
                </span>
              )}
            </div>
          ))}
          <span className="at-usar__nota">Esqueceu a senha? Sem e-mail ligado, quem resolve é o dono: toque em “Nova senha” e mande pelo WhatsApp. Quem perde o acesso não entra mais, e o que ela lançou continua no sistema.</span>
        </div>
      </div>
    </div>
  )
}
