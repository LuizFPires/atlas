import { useEffect, useRef, useState } from 'react'
import { Esperando } from '../ui/Progresso'
import { textoDaTrava } from './explicar-trava'
import { Botao, CampoFalado, Icone, Microfone, Trabalhando, useVoz } from '../ui'
import { type PonteArquivos } from './ponte-arquivos'
import type { ObraDoEstilo } from './Estilo'
import { limparNome, LOGOS, resumoDaConferencia, type Conferencia, type Marca, type NomeProposto, type PonteBatismo, type PonteNomes } from './ponte-batismo'
import './batismo.css'

interface Props {
  obra: ObraDoEstilo
  batismo: PonteBatismo
  /** Confere nomes parecidos e se o endereço está livre (.app, .com.br). */
  nomes: PonteNomes
  /** Para quem já tem logo: sobe o arquivo para a pasta da obra (PNG, JPG, WebP ou PDF; SVG é recusado). */
  arquivos?: PonteArquivos
  onVoltar: () => void
  /** Segue para a aprovação (F08, M18) com a marca já gravada na pasta da obra. */
  onConcluir?: (marca: Marca, caminho: string) => void
}

const MODOS = [['sugerir', 'Quero sugestões do Atlas'], ['tenho', 'Já tenho nome e logomarca']] as const


export const recadoDoErroBatismo = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'O Claude que sugere os nomes ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; por enquanto, não há nada que você precise refazer.'
    case 'tipo-nao-aceito': return 'Esse tipo de arquivo não serve como logomarca. Mande PNG, JPG, WebP ou PDF (SVG não, porque pode esconder programas).'
    case 'grande-demais': return 'Esse arquivo é grande demais (o limite é 20 MB). Mande uma versão menor.'
    case 'nome-invalido': return 'Esse nome está curto demais ou tem símbolos que não dá para usar. Escreva ou fale de novo.'
    default: return textoDaTrava(e, 'Não consegui fazer isso agora.')
  }
}

const Logo = ({ id, tamanho }: { id: string; tamanho: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="#D9A066" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <path d={id in LOGOS ? LOGOS[id as keyof typeof LOGOS] : ''} />
  </svg>
)

/** Linha de conferência de um nome: ✓ livre, ⚠ já existe algo parecido ou endereço ocupado. */
function Verificacao({ c }: { c: Conferencia | null | undefined }) {
  if (c === undefined) return <span className="at-bat__check" role="status">conferindo nome e endereço…</span>
  if (c === null) return <span className="at-bat__check">não consegui conferir agora; tente de novo daqui a pouco</span>
  const r = resumoDaConferencia(c)
  return <span className={`at-bat__check ${r.ok ? '' : 'at-bat__check--aviso'}`}><span aria-hidden="true">{r.ok ? '✓' : '⚠'}</span> {r.texto}</span>
}

/** Os apps de sempre em volta do app do cliente (desenhos genéricos, sem marca de ninguém). Aprovado pelo Luiz em 27/11/2026. */
const GLIFOS: Record<string, { bg: string; svg: React.ReactNode }> = {
  Fotos: { bg: 'linear-gradient(160deg,#fff,#e9e9ee)', svg: <><circle cx="12" cy="7" r="3.2" fill="#F6B73C" /><circle cx="17" cy="12" r="3.2" fill="#E8584F" opacity=".9" /><circle cx="12" cy="17" r="3.2" fill="#6C8CF5" opacity=".9" /><circle cx="7" cy="12" r="3.2" fill="#5BC27A" opacity=".9" /></> },
  Mapas: { bg: 'linear-gradient(160deg,#dff3e4,#9fd6b0)', svg: <g fill="none" stroke="#2f7d4f" strokeWidth="2" strokeLinejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></g> },
  Câmera: { bg: 'linear-gradient(160deg,#6b6f76,#2f3237)', svg: <g fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="7" width="18" height="12" rx="3" /><circle cx="12" cy="13" r="3.4" /><path d="M8 7l1.5-3h5L16 7" /></g> },
  Clima: { bg: 'linear-gradient(160deg,#5aa9ff,#1f6fe0)', svg: <><circle cx="9" cy="9" r="3.5" fill="#FFD54A" /><path d="M7 18h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.6A2.7 2.7 0 0 0 7 18z" fill="#fff" /></> },
  Notas: { bg: 'linear-gradient(160deg,#fff6c9,#ffd94a)', svg: <path d="M6 4h12v16H6zM9 9h6M9 13h6M9 17h3" fill="none" stroke="#7a5a00" strokeWidth="2" strokeLinecap="round" /> },
  Agenda: { bg: 'linear-gradient(160deg,#fff,#eceef2)', svg: <g fill="none" stroke="#E8584F" strokeWidth="2"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M9 13h6M9 16h4" stroke="#555" /></g> },
  Ajustes: { bg: 'linear-gradient(160deg,#8e8e93,#48484c)', svg: <g fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></g> },
  Telefone: { bg: 'linear-gradient(160deg,#6ee07a,#2fb94a)', svg: <path fill="#fff" d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /> },
  Navegador: { bg: 'linear-gradient(160deg,#5ac8fa,#1e8cf0)', svg: <g fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="#fff" /></g> },
  Mensagens: { bg: 'linear-gradient(160deg,#6ee07a,#2fb94a)', svg: <path fill="#fff" d="M12 4c4.97 0 9 3.36 9 7.5S16.97 19 12 19c-1 0-1.96-.13-2.86-.38L5 20l1.2-3.3C4.8 15.4 3 13.6 3 11.5 3 7.36 7.03 4 12 4z" /> },
  'E-mail': { bg: 'linear-gradient(160deg,#fff,#eceef2)', svg: <g fill="none" stroke="#1e8cf0" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></g> },
}
const GRADE = ['Fotos', 'Mapas', 'Câmera', 'Clima', '*', 'Notas', 'Agenda', 'Ajustes']
const DOCK = ['Telefone', 'Navegador', 'Mensagens', 'E-mail']

/** Logo no celular: ícone sugerido, ou a inicial do nome quando a logo é um arquivo do cliente (o arquivo em si não é aberto aqui). */
function Marcador({ id, nome, tamanho }: { id: string; nome: string; tamanho: number }) {
  if (id in LOGOS) return <Logo id={id} tamanho={tamanho} />
  return <span aria-hidden="true" style={{ font: `700 ${Math.round(tamanho * 0.8)}px Fraunces, Georgia, serif`, color: '#D9A066' }}>{[...nome.trim()][0]?.toUpperCase() ?? ''}</span>
}

const AppIcone = ({ nome }: { nome: string }) => (
  <span className="at-bat__app"><i style={{ background: GLIFOS[nome].bg }}><svg viewBox="0 0 24 24" aria-hidden="true">{GLIFOS[nome].svg}</svg></i><span>{nome}</span></span>
)

const DATA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })

/** O celular do cliente (aprovado pelo Luiz em 27/11/2026): aparelho realista, fundo na cor da marca, o app entre os de sempre e
 *  um aviso como os clientes vão receber (com o slogan). Nenhum app de verdade de ninguém: só desenhos genéricos. */
function CelularMarca({ nome, slogan, logo }: { nome: string; slogan: string; logo: string }) {
  const [hoje] = useState(() => { const t = DATA.format(new Date()); return t.charAt(0).toUpperCase() + t.slice(1) })
  return (
    <aside className="at-bat__lado" aria-label="Como fica no celular">
      <span className="at-bat__dica">Assim fica no celular dos seus clientes:</span>
      <div className="at-bat__aparelho">
        <div className="at-bat__tela">
          <div className="at-bat__ilha" aria-hidden="true" />
          <div className="at-bat__barra" aria-hidden="true">
            <span>9:41</span>
            <span className="at-bat__icos">
              <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff" /><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff" /><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff" /></svg>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0M4 7a6 6 0 0 1 8 0" /><circle cx="8" cy="10" r="1.2" fill="#fff" stroke="none" /></svg>
              <svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="#fff" strokeOpacity=".5" /><rect x="2.5" y="2.5" width="16" height="7" rx="2" fill="#fff" /><rect x="23.5" y="4" width="2" height="4" rx="1" fill="#fff" fillOpacity=".5" /></svg>
            </span>
          </div>
          <div className="at-bat__aviso">
            <span className="at-bat__aviso-logo"><Marcador id={logo} nome={nome} tamanho={22} /></span>
            <span className="at-bat__aviso-txt"><b>{nome}</b><small>{slogan || 'Toque para abrir o app.'}</small></span>
            <span className="at-bat__aviso-quando">agora</span>
          </div>
          <div className="at-bat__relogio" aria-hidden="true"><span>{hoje}</span><b>9:41</b></div>
          <div className="at-bat__grade">
            {GRADE.map((n) => n === '*'
              ? <span key="meu" className="at-bat__app at-bat__app--meu"><i><Marcador id={logo} nome={nome} tamanho={28} /></i><span>{nome}</span></span>
              : <AppIcone key={n} nome={n} />)}
          </div>
          <div className="at-bat__paginas" aria-hidden="true"><b /><b /></div>
          <div className="at-bat__dock" aria-hidden="true">{DOCK.map((n) => <AppIcone key={n} nome={n} />)}</div>
        </div>
      </div>
    </aside>
  )
}

/** F07b: batismo (projeto 3/3). O Atlas sugere 3 nomes com logo, slogan e motivo. */
export function Batismo({ obra, batismo, nomes: conferidor, arquivos, onVoltar, onConcluir }: Props) {
  const [nomes, setNomes] = useState<NomeProposto[]>([])
  // Conferência por nome: undefined = conferindo, null = não deu para conferir agora.
  const [conferencias, setConferencias] = useState<Record<string, Conferencia | null>>({})
  const [vistos, setVistos] = useState<string[]>([])
  const [escolhido, setEscolhido] = useState('')
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [ideia, setIdeia] = useState('')
  const [falando, setFalando] = useState(false)
  const [modo, setModo] = useState<'sugerir' | 'tenho'>('sugerir')
  const [meuNome, setMeuNome] = useState('')
  const [meuLogo, setMeuLogo] = useState('')
  const [meuCheck, setMeuCheck] = useState<Conferencia | null | undefined>()
  const iniciou = useRef(false)
  const { gravando, alternar, suportado } = useVoz((falado) => setIdeia((p) => [p, falado].filter(Boolean).join(' ')))

  const pedir = async (pedido: { ideia?: string; evitar?: string[] }) => {
    setOcupado(true)
    setErro('')
    try {
      const lista = await batismo.sugerir(obra.pasta, obra.nome, pedido)
      setNomes(lista)
      setVistos((v) => [...new Set([...v, ...lista.map((n) => n.nome)])])
      setEscolhido(lista[0]?.id ?? '')
      for (const n of lista) {
        conferidor.conferir(n.nome).then((c) => setConferencias((m) => ({ ...m, [n.nome]: c })), () => setConferencias((m) => ({ ...m, [n.nome]: null })))
      }
    } catch (x) { setErro(recadoDoErroBatismo(x)) } finally { setOcupado(false); setPronto(true) }
  }

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    void pedir({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nomeLimpo = limparNome(meuNome)
  const atual = nomes.find((n) => n.id === escolhido) ?? nomes[0]

  const subirLogo = async () => {
    if (!arquivos) return
    setErro('')
    try {
      const a = await arquivos.escolher('logo')
      if (!a) return
      const g = await arquivos.guardar(obra.pasta, 'marca', a.token)
      setMeuLogo(g.nome)
    } catch (x) { setErro(recadoDoErroBatismo(x)) }
  }

  const conferirMeu = async () => {
    setMeuCheck(undefined)
    try { setMeuCheck(await conferidor.conferir(nomeLimpo)) } catch { setMeuCheck(null) }
  }

  const batizar = async () => {
    if ((modo === 'tenho' ? !nomeLimpo : !atual) || ocupado) return
    setOcupado(true)
    setErro('')
    const marca: Marca = modo === 'tenho'
      ? { origem: 'cliente', nome: nomeLimpo, slogan: '', logo: meuLogo ? { arquivo: meuLogo } : null }
      : { origem: 'sugestao', nome: atual!.nome, slogan: atual!.slogan, logo: atual!.logo }
    try {
      const { caminho } = await batismo.batizar(obra.pasta, marca)
      if (onConcluir) onConcluir(marca, caminho)
      else onVoltar()
    } catch (x) { setErro(recadoDoErroBatismo(x)) } finally { setOcupado(false) }
  }

  return (
    <div className="at-bat">
      <div className="at-bat__principal">
        <div className="at-bat__fases">
          <span className="at-bat__proj">OBRA · {obra.nome.toUpperCase()}</span>
        </div>
        <header className="at-bat__cab">
          <h1>Hora do batismo.</h1>
          <span>Agora o Atlas já sabe o que o sistema faz, para quem é e qual é a cara dele. Por isso o nome vem no final: ele nasce de tudo o que vocês construíram.</span>
        </header>

        <div className="at-bat__modos" role="group" aria-label="Como você quer o nome">
          {MODOS.map(([id, nome]) => <button key={id} type="button" aria-pressed={modo === id} className={`at-bat__modo ${modo === id ? 'at-bat__modo--on' : ''}`} onClick={() => { setModo(id); setErro('') }}>{nome}</button>)}
        </div>

        {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
        {modo === 'sugerir' && !pronto && <Trabalhando titulo="O Claude está pensando nos nomes" segundos={60} etapas={['Relendo o que o sistema faz e para quem é', 'Criando nomes que combinam com o seu negócio', 'Desenhando uma logo e um slogan para cada um', 'Conferindo nomes parecidos e endereços livres']} />}

        {modo === 'sugerir' && (<>
        {pronto && ocupado && <Trabalhando titulo="O Claude está pensando em outros nomes" segundos={60} etapas={['Relendo o que o sistema faz e para quem é', 'Criando nomes diferentes dos que você já viu', 'Desenhando uma logo e um slogan para cada um', 'Conferindo nomes parecidos e endereços livres']} />}
        <div className={`at-bat__nomes${pronto && ocupado ? ' at-bat__nomes--esperando' : ''}`} role="radiogroup" aria-label="Nomes sugeridos" aria-busy={ocupado}>
          {nomes.map((n) => (
            <button key={n.id} type="button" role="radio" aria-checked={n.id === atual?.id} className={`at-bat__nome ${n.id === atual?.id ? 'at-bat__nome--on' : ''}`} onClick={() => setEscolhido(n.id)}>
              <span className="at-bat__amostra"><span className="at-bat__amostra-logo"><Logo id={n.logo} tamanho={26} /></span><span className="at-bat__amostra-nome">{n.nome}</span></span>
              <b>{n.nome}</b>
              <span className="at-bat__slogan">"{n.slogan}"</span>
              <span className="at-bat__porque">{n.porque}</span>
              <Verificacao c={conferencias[n.nome]} />
            </button>
          ))}
        </div>
        <div className="at-bat__acoes-meio">
          <Botao variante="secundario" disabled={ocupado} onClick={() => void pedir({ evitar: vistos })}>{ocupado && pronto ? 'Pensando em outros nomes…' : '↻ Sugerir outros'}</Botao>
          {ocupado && pronto && <Esperando rotulo="Pensando em outros nomes" agora="Lendo as telas e pensando em 3 nomes" costume={[20, 40]} />}
          <button type="button" className="at-bat__falar" aria-expanded={falando} onClick={() => setFalando((f) => !f)}><Icone nome="microfone" tamanho={16} />Falar uma ideia de nome</button>
        </div>
        {falando && (
          <form className="at-bat__ideia" onSubmit={(e) => { e.preventDefault(); if (ideia.trim() && !ocupado) void pedir({ ideia, evitar: vistos }) }}>
            <Microfone gravando={gravando} onAlternar={alternar} />
            <label htmlFor="ideia-nome" className="at-bat__so-leitor">Sua ideia de nome</label>
            <input id="ideia-nome" value={ideia} onChange={(e) => setIdeia(e.target.value)} placeholder="Fale ou escreva uma ideia: Barba Boa" autoComplete="off" />
            <Botao type="submit" disabled={!limparNome(ideia) || ocupado}>Pensar nisso</Botao>
          </form>
        )}
        {falando && !suportado && <span className="at-bat__dica">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}

        <p className="at-bat__nota">Antes de você decidir, o Atlas procura nomes parecidos e confere se o endereço na internet está livre.</p>
        </>)}

        {modo === 'tenho' && (
          <div className="at-bat__tenho">
            <CampoFalado rotulo="Qual o nome do sistema?" valor={meuNome} onChange={(v) => { setMeuNome(v); setMeuCheck(undefined) }} placeholder="Ex.: Agenda do Zé" autoComplete="off" />
            <div className="at-bat__acoes-meio">
              <Botao variante="secundario" disabled={!nomeLimpo} onClick={() => void conferirMeu()}>Conferir nome e endereço</Botao>
              {meuCheck !== undefined && <Verificacao c={meuCheck} />}
            </div>
            <div className="at-bat__logo-caixa">
              <Icone nome="imagem" tamanho={24} />
              <div><b>Logomarca</b><span>PNG, JPG, WebP ou PDF. O Atlas cria o ícone do app a partir dela.</span>{meuLogo && <span role="status">Guardada na pasta da obra: {meuLogo}</span>}</div>
              {arquivos && <button type="button" className="at-bat__escolher" onClick={() => void subirLogo()}>{meuLogo ? 'Trocar arquivo' : 'Escolher arquivo'}</button>}
            </div>
          </div>
        )}

        <div className="at-bat__rodape">
          <Botao variante="secundario" onClick={onVoltar}>← Voltar às telas</Botao>
          <Botao disabled={(modo === 'tenho' ? !nomeLimpo : !atual) || ocupado} onClick={() => void batizar()}>Batizar como "{(modo === 'tenho' ? nomeLimpo : atual?.nome) || '…'}" →</Botao>
        </div>
      </div>
      {modo === 'tenho'
        ? <CelularMarca nome={nomeLimpo || obra.nome} slogan="" logo={meuLogo ? '' : 'cadeira'} />
        : <CelularMarca nome={atual?.nome ?? obra.nome} slogan={atual?.slogan ?? ''} logo={atual?.logo ?? 'cadeira'} />}
    </div>
  )
}
