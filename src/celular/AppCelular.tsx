// M33 — o Atlas no celular (PWA em /app). Fiel a prototipo/celular (M00 a M09).
// O celular é o controle remoto do notebook do cliente: daqui saem os pedidos (ideia, visual, ajustes, nome, construir, pausar)
// e aqui chegam o estado do notebook, o progresso, as telas e o status das obras. Quem desenha e constrói é sempre o Claude
// do cliente, no notebook dele. As telas recebidas são NÃO confiáveis: só aparecem num iframe com sandbox vazio.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icone, type NomeIcone } from '../ui/Icone'
import { useVoz } from '../ui/voz'
import { Monograma } from '../marca/Marca'
import canteiro from '../assets/canteiro-3d.jpg'
import type { ObraStatus } from '../web/obras-status'
import type { ApiCelular, EstadoCelular, Projeto, Visual } from './api'
import { ambienteDoNavegador, ligarAvisos, situacaoDosAvisos, type SituacaoAvisos } from './avisos'
import { semFaceId, type FaceId } from './faceid'
import { predioSvg } from './predio'
import './celular.css'

type Tela = 'entrar' | 'faceid-ligar' | 'faceid-abrir' | 'obras' | 'ideia' | 'visual' | 'projeto' | 'obra' | 'desligado'
type Aba = 'andamento' | 'concluidas' | 'paradas' | 'excluidas'

const protegido = (d: string) => d.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'')
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':', 'h')

function Voltar({ onClick, rotulo }: { onClick: () => void; rotulo: string }) {
  return <button type="button" className="cel-voltar" aria-label={rotulo} onClick={onClick}><Icone nome="chevron" /></button>
}

function Cabecalho({ rotulo, onVoltar, voltarRotulo, etapa }: { rotulo: string; onVoltar: () => void; voltarRotulo: string; etapa?: number }) {
  return (
    <>
      <header className="cel-topo"><Voltar onClick={onVoltar} rotulo={voltarRotulo} /><span className="cel-rotulo">{rotulo}</span><span style={{ width: 44 }} /></header>
      {etapa && <div className="cel-etapas" aria-hidden="true">{[1, 2, 3].map((n) => <span key={n} className={n <= etapa ? 'on' : ''} />)}</div>}
    </>
  )
}

/** Microfone grande que junta o que foi falado ao texto. */
function MicFalar({ aoFalar, titulo, sub, pequeno }: { aoFalar: (t: string) => void; titulo?: string; sub?: string; pequeno?: boolean }) {
  const { gravando, alternar, suportado } = useVoz(aoFalar)
  const botao = (
    <button type="button" className={`cel-mic ${pequeno ? 'cel-mic--p' : ''} ${gravando ? 'cel-mic--grava' : ''}`} aria-pressed={gravando} aria-label={gravando ? 'Parar de gravar' : 'Falar'} onClick={alternar} disabled={!suportado}>
      <Icone nome="microfone" tamanho={pequeno ? 22 : 28} />
    </button>
  )
  if (!titulo) return botao
  return (
    <div className="cel-falar">
      {botao}
      <div><span className="cel-forte">{gravando ? 'Estou ouvindo' : titulo}</span><span className="cel-sub">{gravando ? 'Toque para terminar' : suportado ? sub : 'Este navegador não escuta a voz. Pode digitar.'}</span></div>
    </div>
  )
}

// ── M00 Entrar ──
// O tamanho do código é o do e-mail (o Supabase manda de 6 a 8 números): a tela não promete um número de dígitos.
const CODIGO_OK = /^\d{6,8}$/

function Entrar({ api, onEntrou }: { api: ApiCelular; onEntrou: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [fase, setFase] = useState<'email' | 'codigo'>('email')
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  const idE = useId(), idC = useId()
  const agir = async (f: () => Promise<void>) => { setErro(''); setIndo(true); try { await f() } catch (e) { setErro((e as Error).message || 'Não deu certo agora.') } finally { setIndo(false) } }
  return (
    <main className="cel">
      <header className="cel-topo"><span className="cel-marca"><Monograma largura={34} altura={19} />ATLAS</span></header>
      <div className="cel-corpo">
        <img src={canteiro} alt="O canteiro do Atlas: um prédio subindo" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 20 }} />
        <h1 className="cel-titulo">A sua obra, no bolso.</h1>
        <p className="cel-texto">Conte a ideia, veja as telas e acompanhe a construção daqui. Quem trabalha é o seu notebook, ligado no escritório.</p>
        {fase === 'email' ? (
          <div className="cel-campo"><label htmlFor={idE} className="cel-rotulo">E-mail da sua compra</label><input id={idE} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        ) : (
          <div className="cel-campo">
            <label htmlFor={idC} className="cel-rotulo">Código que chegou no e-mail</label>
            <input id={idC} inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ fontFamily: "'Geist Mono', monospace", letterSpacing: '.3em', fontSize: 22 }} />
            <span className="cel-sub">Mandamos para {email}</span>
            {(() => { const sa = api.ultimaSaida?.(); return sa ? <span className="cel-sub cel-saida">O login caiu sozinho em {new Date(sa.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · código {sa.motivo}. Se acontecer de novo, mande uma foto desta linha.</span> : null })()}
          </div>
        )}
        {erro && <p className="cel-erro" role="alert">{erro}</p>}
      </div>
      <footer className="cel-rodape">
        {fase === 'email'
          ? <button type="button" className="cel-botao" disabled={indo || !email.includes('@')} onClick={() => agir(async () => { await api.pedirCodigo(email.trim()); setFase('codigo') })}>Receber o código</button>
          : <button type="button" className="cel-botao" disabled={indo || !CODIGO_OK.test(codigo.replace(/\D/g, ''))} onClick={() => agir(async () => { await api.entrar(email.trim(), codigo); onEntrou(email.trim()) })}>Entrar</button>}
      </footer>
    </main>
  )
}

// ── M01 Minhas obras ──
function selo(o: ObraStatus): { texto: string; classe: string } {
  if (o.estado === 'pronta' || o.estado === 'no_ar') return { texto: o.estado === 'no_ar' ? 'No ar' : 'Pronta', classe: 'cel-selo--neutro' }
  if (o.estado === 'aguardando_aprovacao') return { texto: 'Sua vez', classe: 'cel-selo--vez' }
  if (o.estado === 'pausada') return { texto: 'Parada', classe: 'cel-selo--vez' }
  return { texto: 'Construindo', classe: '' }
}
const SELO_FASE: Record<Projeto['fase'], string> = {
  na_fila: 'Na fila', desenhando: 'Desenhando', telas_prontas: 'Sua vez', ajustando: 'Ajustando', pensando_nomes: 'Pensando', nomes_prontos: 'Sua vez', pronto_para_construir: 'Sua vez', construindo: 'Construindo', erro: 'Deu erro',
}
const ETAPA_FASE: Record<Projeto['fase'], string> = {
  na_fila: 'Projeto · esperando o notebook', desenhando: 'Projeto · desenhando as telas', telas_prontas: 'Projeto · as telas estão prontas', ajustando: 'Projeto · ajustando as telas',
  pensando_nomes: 'Projeto · pensando nos nomes', nomes_prontos: 'Projeto · escolha o nome', pronto_para_construir: 'Projeto · pronto para construir', construindo: 'Obra começando', erro: 'Projeto · algo deu errado',
}

/** M41: ligar os avisos da obra neste celular (a cota do Claude voltou, a obra parou, a obra ficou pronta). */
function CartaoAvisos({ api }: { api: ApiCelular }) {
  const amb = ambienteDoNavegador()
  const [sit, setSit] = useState<SituacaoAvisos>(() => situacaoDosAvisos(amb))
  const [erro, setErro] = useState('')
  useEffect(() => {
    if (!amb.suporta || amb.permissao !== 'granted') return
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => { if (s) setSit('ligado') }, () => {})
  }, [amb.suporta, amb.permissao])
  if (!api.avisos || sit === 'sem-suporte') return null
  const ligar = async () => {
    setErro('')
    try {
      const r = await ligarAvisos({
        pedirPermissao: () => Notification.requestPermission(),
        chave: () => api.avisos!.chave(),
        assinar: async (o) => (await navigator.serviceWorker.ready).pushManager.subscribe(o),
        enviar: (a) => api.avisos!.assinar(a),
      })
      setSit(r)
    } catch (e) { setErro((e as Error).message || 'Não consegui ligar os avisos agora. Tente de novo.') }
  }
  const textos: Record<Exclude<SituacaoAvisos, 'sem-suporte'>, string> = {
    'pode-ligar': 'Receba um aviso quando a cota do Claude voltar, quando a obra parar ou quando ficar pronta.',
    ligado: 'Avisos ligados neste celular. O Atlas avisa quando a cota voltar, quando a obra parar ou ficar pronta.',
    bloqueado: 'Os avisos estão bloqueados neste celular. Libere nas configurações do navegador para o Atlas poder avisar.',
    'iphone-tela-inicio': 'No iPhone, os avisos só chegam com o Atlas na Tela de Início: no Safari, toque em Compartilhar e em "Adicionar à Tela de Início".',
  }
  return (
    <div className="cel-cartao cel-linha" style={{ flexDirection: 'row', alignItems: 'center' }} role="region" aria-label="Avisos da obra neste celular">
      <span className={`cel-bolinha ${sit === 'ligado' ? '' : 'cel-bolinha--aviso'}`}><Icone nome="sino" /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <span className="cel-forte">Avisos da obra</span>
        <span className="cel-sub">{textos[sit as Exclude<SituacaoAvisos, 'sem-suporte'>]}</span>
        {erro && <span className="cel-sub" role="alert">{erro}</span>}
        {sit === 'pode-ligar' && <button type="button" className="cel-botao" style={{ height: 44, minHeight: 44 }} onClick={() => { void ligar() }}>Receber avisos neste celular</button>}
      </span>
    </div>
  )
}

function Obras({ api, estado, obras, nome, onNova, onAbrirObra, onAbrirProjeto, onNotebook, menu }: {
  api?: ApiCelular; estado: EstadoCelular | null; obras: ObraStatus[]; nome: string; onNova: () => void; onAbrirObra: (id: string) => void; onAbrirProjeto: (id: string) => void; onNotebook: () => void; menu: ReactNode
}) {
  const [aba, setAba] = useState<Aba>('andamento')
  const idsObras = new Set(obras.map((o) => o.id))
  const projetos = (estado?.projetos ?? []).filter((p) => p.fase !== 'construindo' || !idsObras.has(p.obra_id))
  const lista: Record<Aba, Array<{ id: string; nome: string; etapa: string; selo: { texto: string; classe: string }; pct: number; quando: string; abrir: () => void }>> = {
    andamento: [
      ...projetos.map((p) => ({ id: p.obra_id, nome: p.nome || 'Obra nova', etapa: ETAPA_FASE[p.fase], selo: { texto: SELO_FASE[p.fase], classe: ['telas_prontas', 'nomes_prontos', 'pronto_para_construir', 'erro'].includes(p.fase) ? 'cel-selo--vez' : '' }, pct: p.progresso.total ? Math.round((p.progresso.feitas / p.progresso.total) * 20) : 0, quando: `Atualizado às ${hora(p.atualizado_em)}`, abrir: () => onAbrirProjeto(p.obra_id) })),
      ...obras.filter((o) => o.estado === 'construindo' || o.estado === 'aguardando_aprovacao').map((o) => ({ id: o.id, nome: o.nome, etapa: `Etapa ${o.etapa_atual.numero} de ${o.total_etapas} · ${o.etapa_atual.rotulo}`, selo: selo(o), pct: o.percentual, quando: o.ultima_noticia, abrir: () => onAbrirObra(o.id) })),
    ],
    concluidas: obras.filter((o) => o.estado === 'pronta' || o.estado === 'no_ar').map((o) => ({ id: o.id, nome: o.nome, etapa: o.estado === 'no_ar' ? 'No ar' : 'Pronta', selo: selo(o), pct: 100, quando: `Desde ${new Date(o.quando).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, abrir: () => onAbrirObra(o.id) })),
    paradas: obras.filter((o) => o.estado === 'pausada').map((o) => ({ id: o.id, nome: o.nome, etapa: `Etapa ${o.etapa_atual.numero} de ${o.total_etapas}`, selo: selo(o), pct: o.percentual, quando: o.ultima_noticia, abrir: () => onAbrirObra(o.id) })),
    excluidas: [],
  }
  const vazios: Record<Aba, string> = {
    andamento: 'Nenhuma obra em andamento. Toque em "Começar uma obra nova" e conte a sua ideia.',
    concluidas: 'Nenhuma obra concluída ainda.',
    paradas: 'Nenhuma obra parada. Se a cota do Claude acabar ou o notebook desligar, a obra aparece aqui e continua sozinha depois.',
    excluidas: 'Nenhuma obra excluída.',
  }
  const c = estado?.computador
  return (
    <main className="cel">
      <header className="cel-topo"><span className="cel-marca"><Monograma largura={34} altura={19} />ATLAS</span></header>
      <div className="cel-corpo">
        <div><span className="cel-rotulo">{nome ? `Olá, ${nome}` : 'Olá'}</span><h1 className="cel-titulo">Minhas obras</h1></div>
        <button type="button" className="cel-cartao cel-linha" style={{ flexDirection: 'row', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }} onClick={onNotebook}>
          <span className={`cel-bolinha ${c && !c.ligado ? 'cel-bolinha--aviso' : ''}`}><Icone nome="computador" /></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <span className="cel-forte">Notebook do escritório</span>
            <span className="cel-sub"><span className={`cel-ponto ${c?.ligado ? 'cel-ponto--vivo' : 'cel-ponto--off'}`} />{!c ? 'Conferindo…' : c.ligado ? `Ligado · Atlas aberto${c.ocupado ? ` · ${c.ocupado.toLowerCase()}` : ''}` : 'Desligado ou com o Atlas fechado'}</span>
          </span>
          <Icone nome="chevron" style={{ transform: 'rotate(180deg)' }} />
        </button>
        {api && <CartaoAvisos api={api} />}
        <button type="button" className="cel-novo" onClick={onNova}>
          <span className="cel-bolinha"><Icone nome="microfone" tamanho={24} /></span>
          <span><b>Começar uma obra nova</b><span>Conte a ideia falando. O notebook desenha as telas.</span></span>
        </button>
        <div className="cel-abas" role="tablist" aria-label="Situação das obras">
          {([['andamento', 'Em andamento'], ['concluidas', 'Concluídas'], ['paradas', 'Paradas'], ['excluidas', 'Excluídas']] as const).map(([id, n]) => (
            <button key={id} type="button" role="tab" className="cel-aba" aria-selected={aba === id} onClick={() => setAba(id)}>{n} <span style={{ fontFamily: "'Geist Mono', monospace", opacity: 0.75 }}>{lista[id].length}</span></button>
          ))}
        </div>
        {lista[aba].map((o) => (
          <button key={o.id} type="button" className="cel-obra" onClick={o.abrir}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="cel-obra__nome">{o.nome}</span><span className="cel-sub">{o.etapa}</span></span>
              <span className={`cel-selo ${o.selo.classe}`}>{o.selo.texto}</span>
            </span>
            <span className="cel-barra" aria-hidden="true"><span style={{ width: `${o.pct}%` }} /></span>
            <span className="cel-sub" style={{ justifyContent: 'space-between' }}><span>{o.quando}</span><span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--text)' }}>{o.pct}%</span></span>
          </button>
        ))}
        {lista[aba].length === 0 && <div className="cel-vazio">{vazios[aba]}</div>}
      </div>
      {menu}
    </main>
  )
}

// ── M02 Etapa 1: a ideia ──
function Ideia({ relato, setRelato, onVoltar, onContinuar }: { relato: string; setRelato: (t: string) => void; onVoltar: () => void; onContinuar: () => void }) {
  const [escrevendo, setEscrevendo] = useState(relato.length > 0)
  const id = useId()
  const juntar = useCallback((t: string) => { setEscrevendo(true); setRelato([relato, t].filter(Boolean).join(' ')) }, [relato, setRelato])
  return (
    <main className="cel">
      <Cabecalho rotulo="Etapa 1 de 3 · A ideia" onVoltar={onVoltar} voltarRotulo="Voltar para Minhas obras" etapa={1} />
      <div className="cel-corpo">
        <h1 className="cel-titulo">Conte tudo o que você imagina.</h1>
        <p className="cel-texto">Fale como se estivesse com um amigo na mesa de um restaurante. Quanto mais detalhe, mais certeiras ficam as telas.</p>
        {!escrevendo ? (
          <>
            <span className="cel-rotulo">Ideias do que contar</span>
            <div className="cel-chips">{['Como é hoje, no papel', 'O que mais te incomoda', 'Quem vai usar', 'O que o cliente vê', 'Relatórios que você quer'].map((c) => <span key={c}>{c}</span>)}</div>
            <button type="button" className="cel-link" style={{ alignSelf: 'flex-start' }} onClick={() => setEscrevendo(true)}>Digitar em vez de falar</button>
          </>
        ) : (
          <div className="cel-campo">
            <label htmlFor={id} className="cel-rotulo">O que o Atlas escreveu · pode mexer</label>
            <textarea id={id} value={relato} onChange={(e) => setRelato(e.target.value)} placeholder="Conte como funciona hoje e o que você quer que o sistema faça." />
            <span className="cel-sub">Esqueceu algo? Toque no microfone e continue falando: o Atlas junta ao que já está aqui.</span>
          </div>
        )}
      </div>
      <footer className="cel-rodape" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}><MicFalar aoFalar={juntar} titulo={relato ? 'Falar mais' : 'Aperte e fale'} sub={relato ? 'Junta ao texto acima' : 'Pode falar à vontade'} /></div>
        {relato.trim().length >= 20 && <button type="button" className="cel-botao" style={{ width: 'auto', padding: '0 18px', height: 52, minHeight: 52 }} onClick={onContinuar}>Continuar</button>}
      </footer>
    </main>
  )
}

// ── M03 Etapa 2: o visual ──
const AMOSTRAS = ['#10233B', '#1F6F5C', '#C6F135', '#E8C27A', '#E36B3C', '#B4314C', '#6C4AB6', '#F4F1EA']

/** Reduz a foto no próprio celular (até 1600 px, JPEG) antes de mandar: chega rápido e cabe no limite de 2 MB. */
async function reduzirFoto(arquivo: File, esperaMs = 8000): Promise<string> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement | null>((ok) => { const i = new Image(); const t = setTimeout(() => ok(null), esperaMs); i.onload = () => { clearTimeout(t); ok(i) }; i.onerror = () => { clearTimeout(t); ok(null) }; i.src = url })
    // Não deu para abrir a imagem aqui: manda a original, se couber no limite (2 MB).
    if (!img) {
      if (arquivo.size > 2_000_000) throw new Error('Essa foto é grande demais. Tente outra.')
      return await new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(new Error('Essa foto não foi. Tente outra.')); r.readAsDataURL(arquivo) })
    }
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } finally { URL.revokeObjectURL(url) }
}

function VisualTela({ api, visual, setVisual, onVoltar, onMandar, enviando, erro }: { api: ApiCelular; visual: Visual & { previas: string[] }; setVisual: (v: Visual & { previas: string[] }) => void; onVoltar: () => void; onMandar: () => void; enviando: boolean; erro: string }) {
  const [slot, setSlot] = useState(0)
  const [subindo, setSubindo] = useState('')
  const idObs = useId()
  const opcoes: Array<[Visual['modo'], string, string, NomeIcone]> = [
    ['prints', 'Mostrar apps que eu gosto', 'Tire foto da tela ou escolha prints da galeria.', 'imagem'],
    ['marca', 'Já tenho a minha marca', 'Mande a logo e as cores que você já usa.', 'brilho'],
    ['sugere', 'O Atlas sugere 3 estilos', 'O notebook escolhe o melhor e você ajusta falando.', 'paleta'],
  ]
  const cores = visual.cores.length ? visual.cores : ['#10233B', '#E8C27A', '#F4F1EA']
  const foto = async (f: File | undefined) => {
    if (!f) return
    setSubindo('Mandando a foto…')
    try {
      const dataUrl = await reduzirFoto(f)
      const id = await api.foto(dataUrl)
      setVisual({ ...visual, referencias: [...visual.referencias, id], previas: [...visual.previas, dataUrl] })
      setSubindo('')
    } catch (e) { setSubindo((e as Error).message || 'Essa foto não foi. Tente outra.') }
  }
  return (
    <main className="cel">
      <Cabecalho rotulo="Etapa 2 de 3 · O visual" onVoltar={onVoltar} voltarRotulo="Voltar para a ideia" etapa={2} />
      <div className="cel-corpo">
        <h1 className="cel-titulo">Com que cara vai ficar?</h1>
        <p className="cel-texto">Mostre o que você gosta. O notebook usa isso para desenhar as telas.</p>
        {opcoes.map(([m, t, s, ic]) => (
          <button key={m} type="button" className="cel-opcao" aria-pressed={visual.modo === m} onClick={() => setVisual({ ...visual, modo: m })}>
            <span className="cel-bolinha cel-bolinha--lima"><Icone nome={ic} /></span><span><b>{t}</b><small>{s}</small></span>
          </button>
        ))}
        {visual.modo !== 'sugere' && (
          <>
            <span className="cel-rotulo">{visual.modo === 'marca' ? 'Sua logo e o que mais tiver' : 'Suas referências'} · {visual.referencias.length}</span>
            <div className="cel-fotos">
              {visual.previas.map((p, i) => <img key={i} src={p} alt={`Referência ${i + 1}`} />)}
              {visual.referencias.length < 6 && (
                <label><Icone nome="imagem" tamanho={24} />Foto ou print<input type="file" accept="image/*" onChange={(e) => void foto(e.target.files?.[0])} /></label>
              )}
            </div>
            {subindo && <span className="cel-sub" role="status">{subindo}</span>}
            <div className="cel-campo">
              <label htmlFor={idObs} className="cel-sub">O que você gostou nelas</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input id={idObs} value={visual.observacao} onChange={(e) => setVisual({ ...visual, observacao: e.target.value })} style={{ height: 48 }} />
                <MicFalar pequeno aoFalar={(t) => setVisual({ ...visual, observacao: [visual.observacao, t].filter(Boolean).join(' ') })} />
              </div>
            </div>
          </>
        )}
        <span className="cel-rotulo">Cores · toque para trocar</span>
        <div className="cel-cores">
          {cores.map((c, i) => (
            <button key={i} type="button" className="cel-cor" aria-pressed={slot === i} onClick={() => setSlot(i)}><i style={{ background: c }} />{c}<span style={{ fontFamily: "'Geist', system-ui, sans-serif", color: 'var(--mute2)' }}>{['Principal', 'Destaque', 'Fundo'][i]}</span></button>
          ))}
        </div>
        <div className="cel-amostras">
          {AMOSTRAS.map((c) => <button key={c} type="button" aria-label={`Usar a cor ${c}`} style={{ background: c }} onClick={() => { const n = cores.slice(); n[slot] = c; setVisual({ ...visual, cores: n }) }} />)}
        </div>
        {erro && <p className="cel-erro" role="alert">{erro}</p>}
      </div>
      <footer className="cel-rodape">
        <button type="button" className="cel-botao" disabled={enviando} onClick={onMandar}><Icone nome="computador" />{enviando ? 'Mandando…' : 'Mandar o notebook desenhar'}</button>
      </footer>
    </main>
  )
}

// ── M04 a M07: o projeto, conforme a fase que o notebook publicou ──
function Desenhando({ projeto, ligado, onVoltar, onVerTelas }: { projeto: Projeto | null; ligado: boolean; onVoltar: () => void; onVerTelas: () => void }) {
  const g = projeto?.progresso
  const pct = g && g.total ? Math.round((g.feitas / g.total) * 100) : 0
  const prontas = g?.telas.filter((t) => t.pronta).length ?? 0
  return (
    <main className="cel">
      <Cabecalho rotulo="As telas" onVoltar={onVoltar} voltarRotulo="Voltar para Minhas obras" />
      <div className="cel-corpo">
        <span className="cel-sub"><span className={`cel-ponto ${ligado ? 'cel-ponto--vivo' : 'cel-ponto--off'}`} />{ligado ? (projeto ? 'Notebook do escritório · desenhando agora' : 'Notebook do escritório · pegando o seu pedido') : 'Notebook desligado: o pedido está guardado e começa quando ele ligar'}</span>
        <h1 className="cel-titulo" style={{ fontSize: 26 }}>O seu notebook está desenhando as telas.</h1>
        <div className="cel-cartao" role="status">
          <span style={{ display: 'flex', justifyContent: 'space-between' }}><span className="cel-forte">{g && g.total ? `Tela ${Math.min(g.feitas + 1, g.total)} de ${g.total}${g.atual ? ` · ${g.atual}` : ''}` : 'Lendo a sua ideia e as referências'}</span><span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--lime)' }}>{pct}%</span></span>
          <span className="cel-barra cel-barra--grossa"><span style={{ width: `${pct}%` }} /></span>
          <span className="cel-sub">Costuma levar uns 12 minutos. Pode fechar o app: as telas ficam aqui quando ficarem prontas.</span>
        </div>
        {g && g.telas.length > 0 && (
          <>
            <span className="cel-rotulo">Mapa de telas</span>
            <ul className="cel-mapa" style={{ margin: 0, padding: 0 }}>
              {g.telas.map((t, i) => <li key={i} className={t.pronta ? 'pronta' : i === prontas ? 'agora' : ''}><i aria-hidden="true" />{t.nome}{t.pronta ? '' : i === prontas ? ' · desenhando' : ''}</li>)}
            </ul>
          </>
        )}
      </div>
      {prontas > 0 && projeto?.telas_token && <footer className="cel-rodape"><button type="button" className="cel-botao cel-botao--sec" onClick={onVerTelas}>Ver as telas prontas</button></footer>}
    </main>
  )
}

function PrototipoTela({ api, projeto, onVoltar, onAjuste, onAprovar }: { api: ApiCelular; projeto: Projeto; onVoltar: () => void; onAjuste: (t: string) => Promise<void>; onAprovar: () => void }) {
  const [doc, setDoc] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [texto, setTexto] = useState('')
  const [fala, setFala] = useState('')
  const id = useId()
  useEffect(() => {
    let vivo = true
    if (!projeto.telas_token) return
    api.telas(projeto.telas_token).then((d) => { if (vivo) { if (protegido(d)) { setDoc(d); setErro('') } else setErro('Essas telas não abriram.') } }, (e) => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, [api, projeto.telas_token])
  const mandar = async (t: string) => { if (!t.trim()) return; setFala(t.trim()); setTexto(''); await onAjuste(t.trim()) }
  const ajustando = projeto.fase === 'ajustando'
  return (
    <main className="cel" style={{ background: '#101214', minHeight: '100dvh' }}>
      <header className="cel-topo">
        <Voltar onClick={onVoltar} rotulo="Voltar para Minhas obras" />
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="cel-rotulo">Protótipo · {projeto.progresso.telas.length} telas</span><span className="cel-forte" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{projeto.nome}</span></span>
        <button type="button" className="cel-botao" style={{ width: 'auto', height: 44, minHeight: 44, padding: '0 14px', fontSize: 15 }} disabled={ajustando} onClick={onAprovar}>Aprovar</button>
      </header>
      <div className="cel-proto">
        {doc ? <iframe className="cel-proto__quadro" title={`Protótipo · ${projeto.nome}`} sandbox="" srcDoc={doc} referrerPolicy="no-referrer" />
          : <div className="cel-carregando" role="status">{erro || 'Abrindo as telas…'}</div>}
      </div>
      <footer className="cel-rodape" style={{ background: '#101214', borderTop: 0 }}>
        {fala && <span className="cel-fala">{fala}</span>}
        {ajustando && <span className="cel-sub" role="status"><span className="cel-ponto cel-ponto--vivo" />O notebook está ajustando as telas…</span>}
        <div className="cel-barra-voz">
          <label htmlFor={id} className="cel-sub" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Peça um ajuste</label>
          <input id={id} placeholder="Peça um ajuste falando" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void mandar(texto) }} />
          {texto.trim()
            ? <button type="button" className="cel-mic cel-mic--p" aria-label="Mandar o ajuste" onClick={() => void mandar(texto)}><Icone nome="seta" /></button>
            : <MicFalar pequeno aoFalar={(t) => void mandar(t)} />}
        </div>
      </footer>
    </main>
  )
}

function NomeTela({ projeto, onVoltar, onUsar }: { projeto: Projeto; onVoltar: () => void; onUsar: (nome: string) => Promise<void> }) {
  const [sel, setSel] = useState(0)
  const [outro, setOutro] = useState('')
  const [indo, setIndo] = useState(false)
  const id = useId()
  const pronto = projeto.fase === 'nomes_prontos'
  const escolhido = outro.trim() || projeto.nomes[sel]?.nome || ''
  const sigla = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return (
    <main className="cel">
      <Cabecalho rotulo="Etapa 3 de 3 · O nome" onVoltar={onVoltar} voltarRotulo="Voltar para Minhas obras" etapa={3} />
      <div className="cel-corpo">
        <h1 className="cel-titulo">Como vai se chamar o seu sistema?</h1>
        {!pronto ? <div className="cel-cartao" role="status"><span className="cel-sub"><span className="cel-ponto cel-ponto--vivo" />O notebook está pensando em 3 nomes a partir da sua ideia…</span></div> : (
          <>
            <p className="cel-texto">O notebook pensou em 3 nomes a partir da sua ideia. Escolha um ou diga o seu.</p>
            {projeto.nomes.map((n, i) => (
              <button key={n.nome} type="button" className="cel-opcao" aria-pressed={!outro && sel === i} onClick={() => { setSel(i); setOutro('') }}>
                <span className="cel-sigla" aria-hidden="true">{sigla(n.nome)}</span><span><b style={{ fontSize: 18 }}>{n.nome}</b><small>{n.porque}</small></span>
              </button>
            ))}
          </>
        )}
        <div className="cel-campo">
          <label htmlFor={id} className="cel-rotulo">Ou diga o seu</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input id={id} placeholder="Ex.: Agenda do Zé" value={outro} maxLength={60} onChange={(e) => setOutro(e.target.value)} style={{ height: 50 }} />
            <MicFalar pequeno aoFalar={(t) => setOutro(t.slice(0, 60))} />
          </div>
        </div>
      </div>
      <footer className="cel-rodape">
        <button type="button" className="cel-botao" disabled={!escolhido || indo || (!pronto && !outro.trim())} onClick={async () => { setIndo(true); try { await onUsar(escolhido) } finally { setIndo(false) } }}>{escolhido ? `Usar “${escolhido}”` : 'Escolha um nome'}</button>
      </footer>
    </main>
  )
}

function AprovarTela({ projeto, ligado, onVoltar, onConstruir }: { projeto: Projeto; ligado: boolean; onVoltar: () => void; onConstruir: (modo: 'auto' | 'passo') => Promise<void> }) {
  const [modo, setModo] = useState<'auto' | 'passo'>('auto')
  const [indo, setIndo] = useState(false)
  return (
    <main className="cel">
      <Cabecalho rotulo="Projeto pronto" onVoltar={onVoltar} voltarRotulo="Voltar para Minhas obras" />
      <div className="cel-corpo">
        <h1 className="cel-titulo">Tudo certo para a obra começar.</h1>
        <div className="cel-cartao cel-linha" style={{ flexDirection: 'row' }}>
          <span className="cel-sigla">{projeto.nome.slice(0, 2).toUpperCase()}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="cel-forte" style={{ fontSize: 19 }}>{projeto.nome}</span><span className="cel-sub">{projeto.progresso.telas.length || 'As'} telas aprovadas</span></span>
        </div>
        <div className="cel-dupla">
          <div className="cel-cartao"><span className="cel-rotulo">Quem constrói</span><span className="cel-forte">O seu notebook</span><span className="cel-sub"><span className={`cel-ponto ${ligado ? '' : 'cel-ponto--off'}`} />{ligado ? 'ligado agora' : 'desligado agora'}</span></div>
          <div className="cel-cartao"><span className="cel-rotulo">Prazo</span><span className="cel-forte">O notebook calcula</span><span className="cel-sub">no seu plano do Claude</span></div>
        </div>
        <span className="cel-rotulo">Como você quer acompanhar</span>
        <div className="cel-dupla">
          {([['auto', 'Automático', 'O Atlas segue sozinho e te avisa de cada etapa.'], ['passo', 'Etapa por etapa', 'Para no fim de cada etapa para você ver.']] as const).map(([m, t, s]) => (
            <button key={m} type="button" className="cel-opcao" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} aria-pressed={modo === m} onClick={() => setModo(m)}><b>{t}</b><small>{s}</small></button>
          ))}
        </div>
      </div>
      <footer className="cel-rodape">
        <button type="button" className="cel-botao" disabled={indo} onClick={async () => { setIndo(true); try { await onConstruir(modo) } finally { setIndo(false) } }}><Icone nome="play" />Deixar o Atlas construir</button>
        <span className="cel-sub" style={{ justifyContent: 'center' }}>Você pode pausar a qualquer hora, daqui ou do notebook.</span>
      </footer>
    </main>
  )
}

// ── M08 Acompanhar a obra ──
function ObraTela({ obra, projeto, onVoltar, onPausar, onContinuar }: { obra: ObraStatus | null; projeto: Projeto | null; onVoltar: () => void; onPausar: () => Promise<void>; onContinuar: () => Promise<void> }) {
  const [indo, setIndo] = useState(false)
  const pausada = obra?.estado === 'pausada'
  const nome = obra?.nome ?? projeto?.nome ?? 'Obra'
  const pct = obra?.percentual ?? 0
  const agir = async (f: () => Promise<void>) => { setIndo(true); try { await f() } finally { setIndo(false) } }
  const total = obra?.total_etapas ?? 0
  const prontos = !obra ? 0 : obra.estado === 'pronta' ? total : Math.max(0, Math.min(total, obra.etapa_atual.numero - 1))
  const predioUrl = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(predioSvg({ andares: total || 8, prontos }))}`, [total, prontos])
  return (
    <main className="cel">
      <header className="cel-topo">
        <Voltar onClick={onVoltar} rotulo="Voltar para Minhas obras" />
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><span className="cel-forte" style={{ fontSize: 17 }}>{nome}</span>
          <span className="cel-sub"><span className={`cel-ponto ${pausada ? 'cel-ponto--off' : 'cel-ponto--vivo'}`} />{!obra ? 'Começando a obra no notebook' : pausada ? 'Parada' : obra.estado === 'pronta' ? 'Pronta' : 'Construindo agora no notebook'}</span></span>
      </header>
      {/* M08b (aprovado em 25/11/2026): o prédio em primeiro plano, desenhado com os números da obra (um andar por etapa). */}
      <div className="cel-corpo cel-obra">
        <section className="cel-predio" aria-label="O prédio da obra">
          <img src={predioUrl} alt={`O prédio: ${prontos} de ${total} andares prontos${obra && obra.estado !== 'pronta' ? `, o ${prontos + 1}º em obra` : ''}`} />
          <div className="cel-predio-pct"><span>{pct}%</span><small>{total ? `ANDARES · ${prontos} DE ${total} ${prontos === 1 ? 'PRONTO' : 'PRONTOS'}` : 'PREPARANDO O CANTEIRO'}</small></div>
        </section>
        {obra && (obra.estado === 'aguardando_aprovacao' || /Precisa de você/.test(obra.ultima_noticia)) && (
          <div className="cel-cartao cel-cartao--aviso">
            <span className="cel-forte" style={{ color: '#F6D28E', display: 'flex', gap: 8, alignItems: 'center' }}><Icone nome="alerta" />Precisa de você</span>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>{obra.ultima_noticia}</span>
          </div>
        )}
        <div className="cel-cartao cel-obra-agora">
          <span className="cel-rotulo">{obra ? `Etapa ${obra.etapa_atual.numero} de ${obra.total_etapas}` : 'Começando'}</span>
          <b>{obra ? obra.etapa_atual.rotulo : 'Preparando o canteiro'}</b>
          {obra
            ? <span className="cel-obra-noticia"><time>{hora(obra.quando)}</time>{obra.ultima_noticia || 'Sem novidades ainda.'}</span>
            : <span className="cel-obra-noticia">As notícias da obra aparecem aqui assim que o notebook começar.</span>}
        </div>
      </div>
      <footer className="cel-rodape">
        {pausada
          ? <button type="button" className="cel-botao" disabled={indo || !obra} onClick={() => agir(onContinuar)}>Continuar a obra</button>
          : <button type="button" className="cel-botao cel-botao--sec" disabled={indo || !obra || obra.estado === 'pronta'} onClick={() => agir(onPausar)}>Pausar</button>}
      </footer>
    </main>
  )
}

// ── M09 Notebook desligado ──
function Desligado({ visto, onVoltar }: { visto: string | null; onVoltar: () => void }) {
  return (
    <main className="cel">
      <Cabecalho rotulo="O seu canteiro" onVoltar={onVoltar} voltarRotulo="Voltar para Minhas obras" />
      <div className="cel-corpo">
        <span className="cel-bolinha cel-bolinha--aviso" style={{ width: 72, height: 72, borderRadius: 36 }}><Icone nome="computador" tamanho={34} /></span>
        <h1 className="cel-titulo" style={{ fontSize: 27 }}>O notebook do escritório está desligado.</h1>
        <p className="cel-texto">{visto ? `Visto pela última vez às ${hora(visto)}. ` : ''}Quem desenha e constrói é ele, então a obra espera por ele.</p>
        <div className="cel-cartao"><span className="cel-forte">Seus pedidos ficam guardados</span><span className="cel-sub" style={{ lineHeight: 1.45 }}>O que você pedir daqui vai para o notebook assim que ele ligar, e começa sozinho.</span></div>
        <span className="cel-rotulo">Para voltar a andar</span>
        <ol className="cel-lista">
          <li><span className="cel-num">1</span>Ligue o notebook do escritório</li>
          <li><span className="cel-num">2</span>O Atlas abre sozinho com o Windows</li>
          <li><span className="cel-num">3</span>Pronto: a bolinha fica verde aqui</li>
        </ol>
        <p className="cel-sub" style={{ lineHeight: 1.5 }}>Dica: no notebook, deixe a energia em “nunca suspender” enquanto houver obra.</p>
      </div>
      <footer className="cel-rodape"><button type="button" className="cel-botao cel-botao--sec" onClick={onVoltar}>Voltar para Minhas obras</button></footer>
    </main>
  )
}

// ── M09b / M10 / M11 Face ID (protótipo aprovado em 25/11/2026) ──
function LigarFaceId({ onLigar, onAgoraNao }: { onLigar: () => Promise<void>; onAgoraNao: () => void }) {
  const [indo, setIndo] = useState(false)
  return (
    <main className="cel">
      <header className="cel-topo"><span className="cel-marca"><Monograma largura={34} altura={19} />ATLAS</span></header>
      <div className="cel-corpo cel-face">
        <span className="cel-face-ico" aria-hidden="true"><Icone nome="rosto" tamanho={44} /></span>
        <span className="cel-rotulo cel-face-rot">Você entrou</span>
        <h1 className="cel-titulo">Da próxima vez, é só olhar para o celular</h1>
        <p className="cel-texto">Ligue o Face ID e o Atlas abre direto nas suas obras, sem código no e-mail. Ninguém mais consegue abrir pelo seu celular.</p>
      </div>
      <footer className="cel-rodape cel-face-pe">
        <button type="button" className="cel-botao" disabled={indo} onClick={() => { setIndo(true); void onLigar().finally(() => setIndo(false)) }}>Ligar o Face ID</button>
        <button type="button" className="cel-botao cel-botao--sec" onClick={onAgoraNao}>Agora não</button>
        <span className="cel-sub cel-face-nota">O seu rosto fica só no iPhone: o Atlas nunca recebe a imagem. Dá para desligar quando quiser, em Sair.</span>
      </footer>
    </main>
  )
}

function AbrirComFaceId({ nome, onConferir, onCodigo }: { nome: string; onConferir: () => Promise<boolean>; onCodigo: () => void }) {
  const [falhou, setFalhou] = useState(false)
  const [indo, setIndo] = useState(false)
  return (
    <main className="cel">
      <header className="cel-topo"><span className="cel-marca"><Monograma largura={34} altura={19} />ATLAS</span></header>
      <div className="cel-corpo cel-face">
        <img src={canteiro} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 20, opacity: 0.9 }} />
        <span className={`cel-face-ico${falhou ? ' cel-face-ico--falhou' : ' cel-face-pulso'}`} aria-hidden="true"><Icone nome="rosto" tamanho={44} /></span>
        <h1 className="cel-titulo">{falhou ? 'Não reconheci' : `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}`}</h1>
        <p className="cel-texto" role={falhou ? 'alert' : undefined}>{falhou ? 'Tente de novo olhando para a tela, ou entre com o código do e-mail.' : 'Olhe para o celular para abrir as suas obras.'}</p>
      </div>
      <footer className="cel-rodape cel-face-pe">
        <button type="button" className="cel-botao" disabled={indo} onClick={() => { setIndo(true); void onConferir().then((ok) => { if (!ok) setFalhou(true) }).finally(() => setIndo(false)) }}>{falhou ? 'Tentar de novo' : 'Entrar com o Face ID'}</button>
        <button type="button" className="cel-botao cel-botao--sec" onClick={onCodigo}>Entrar com o código do e-mail</button>
      </footer>
    </main>
  )
}

// ── O app ──
export function AppCelular({ api, intervalo = 4000, faceId = semFaceId }: { api: ApiCelular; intervalo?: number; faceId?: FaceId }) {
  const [tela, setTela] = useState<Tela>(!api.logado() ? 'entrar' : faceId.ligado() && !faceId.destravado() ? 'faceid-abrir' : 'obras')
  const [estado, setEstado] = useState<EstadoCelular | null>(null)
  const [obras, setObras] = useState<ObraStatus[]>([])
  const [nome, setNome] = useState('')
  const [obraId, setObraId] = useState<string | null>(null)
  const [relato, setRelato] = useState('')
  const [visual, setVisual] = useState<Visual & { previas: string[] }>({ modo: 'sugere', observacao: '', cores: [], referencias: [], previas: [] })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [emailEntrou, setEmailEntrou] = useState('')
  const logado = tela !== 'entrar' && tela !== 'faceid-abrir'
  const viva = useRef(true)

  const atualizar = useCallback(async () => {
    const [e, o] = await Promise.all([api.estado().catch(() => null), api.obras().catch(() => null)])
    if (!viva.current) return
    if (e) setEstado(e)
    if (o) setObras(o)
    if (!api.logado()) setTela('entrar')
  }, [api])

  useEffect(() => {
    viva.current = true
    if (!logado) return
    void (async () => { await atualizar() })()
    void api.nome().then((n) => { if (viva.current) setNome(n) }, () => {})
    const t = setInterval(() => void atualizar(), intervalo)
    return () => { viva.current = false; clearInterval(t) }
  }, [logado, api, atualizar, intervalo])

  const pedir = async (tipo: Parameters<ApiCelular['pedir']>[0], id: string | null, dados: object = {}) => {
    const r = await api.pedir(tipo, id, dados)
    await atualizar()
    return r
  }
  const projeto = (obraId && estado?.projetos.find((p) => p.obra_id === obraId)) || null
  const ligado = estado?.computador.ligado ?? false
  const irObras = () => { setTela('obras'); setObraId(null) }
  // M58: a foto vai para a Ajuda do Atlas no computador (o notebook baixa e mostra na conversa).
  const [avisoFoto, setAvisoFoto] = useState('')
  const fotoAjuda = async (f: File | undefined) => {
    if (!f) return
    setAvisoFoto('Mandando a foto…')
    try {
      const id = await api.foto(await reduzirFoto(f, 2500))
      await api.pedir('foto_ajuda', 'ajuda', { referencia: id })
      setAvisoFoto('A foto foi para a Ajuda do Atlas no computador. Ela aparece lá quando o computador estiver ligado.')
    } catch (e) { setAvisoFoto((e as Error).message || 'Essa foto não foi. Tente outra.') }
  }
  const menu = (
    <nav className="cel-menu" aria-label="Menu">
      <button type="button" aria-current={tela === 'obras' ? 'page' : undefined} onClick={irObras}><Icone nome="obra" />Obras</button>
      <button type="button" onClick={() => { setRelato(''); setVisual({ modo: 'sugere', observacao: '', cores: [], referencias: [], previas: [] }); setTela('ideia') }}><Icone nome="microfone" />Nova obra</button>
      <label className="cel-menu__foto"><Icone nome="imagem" />Foto para a Ajuda<input type="file" accept="image/*" capture="environment" aria-label="Foto para a Ajuda do Atlas" onChange={(e) => void fotoAjuda(e.target.files?.[0])} /></label>
      <button type="button" onClick={() => { api.sair(); faceId.desligar(); setTela('entrar') }}><Icone nome="x" />Sair</button>
      {avisoFoto && <p className="cel-menu__aviso" role="status">{avisoFoto}</p>}
    </nav>
  )

  if (tela === 'entrar') return <Entrar api={api} onEntrou={(em) => { setEmailEntrou(em); void faceId.disponivel().then((d) => setTela(d && !faceId.ligado() ? 'faceid-ligar' : 'obras'), () => setTela('obras')) }} />
  if (tela === 'faceid-ligar') return <LigarFaceId onAgoraNao={() => setTela('obras')} onLigar={async () => { await faceId.ligar(emailEntrou, nome); setTela('obras') }} />
  if (tela === 'faceid-abrir') return <AbrirComFaceId nome={nome} onCodigo={() => { api.sair(); faceId.desligar(); setTela('entrar') }} onConferir={async () => { const ok = await faceId.conferir(); if (ok) setTela('obras'); return ok }} />
  if (tela === 'ideia') return <Ideia relato={relato} setRelato={setRelato} onVoltar={irObras} onContinuar={() => setTela('visual')} />
  if (tela === 'visual') {
    return <VisualTela api={api} visual={visual} setVisual={setVisual} onVoltar={() => setTela('ideia')} enviando={enviando} erro={erro} onMandar={async () => {
      setEnviando(true); setErro('')
      try {
        const { obra_id } = await pedir('obra_nova', null, { relato: relato.trim(), visual: { modo: visual.modo, observacao: visual.observacao.trim(), cores: visual.cores, referencias: visual.referencias } })
        setObraId(obra_id); setTela('projeto')
      } catch (e) { setErro((e as Error).message) } finally { setEnviando(false) }
    }} />
  }
  if (tela === 'desligado') return <Desligado visto={estado?.computador.visto_em ?? null} onVoltar={irObras} />
  if ((tela === 'obra' || (tela === 'projeto' && projeto?.fase === 'construindo')) && obraId) {
    const obra = obras.find((o) => o.id === obraId) ?? null
    return <ObraTela obra={obra} projeto={projeto} onVoltar={irObras} onPausar={async () => { await pedir('pausar', obraId) }} onContinuar={async () => { await pedir('continuar', obraId) }} />
  }
  if (tela === 'projeto' && obraId) {
    const f = projeto?.fase ?? 'na_fila'
    if (!projeto || f === 'na_fila' || f === 'desenhando') return <Desenhando projeto={projeto} ligado={ligado} onVoltar={irObras} onVerTelas={() => {}} />
    if (f === 'erro') {
      return (
        <main className="cel">
          <Cabecalho rotulo="O seu projeto" onVoltar={irObras} voltarRotulo="Voltar para Minhas obras" />
          <div className="cel-corpo"><h1 className="cel-titulo">Algo deu errado no notebook.</h1><p className="cel-texto">{projeto.mensagem || 'Tente de novo daqui a pouco.'}</p></div>
          <footer className="cel-rodape"><button type="button" className="cel-botao" onClick={irObras}>Voltar para Minhas obras</button></footer>
        </main>
      )
    }
    if (f === 'telas_prontas' || f === 'ajustando') return <PrototipoTela api={api} projeto={projeto} onVoltar={irObras} onAjuste={async (t) => { await pedir('ajuste', obraId, { texto: t }) }} onAprovar={() => void pedir('aprovar_telas', obraId)} />
    if (f === 'pensando_nomes' || f === 'nomes_prontos') return <NomeTela projeto={projeto} onVoltar={irObras} onUsar={async (n) => { await pedir('nome', obraId, { nome: n }) }} />
    return <AprovarTela projeto={projeto} ligado={ligado} onVoltar={irObras} onConstruir={async (modo) => { await pedir('construir', obraId, { modo }); setTela('obra') }} />
  }
  return (
    <Obras api={api} estado={estado} obras={obras} nome={nome} menu={menu}
      onNova={() => { setRelato(''); setVisual({ modo: 'sugere', observacao: '', cores: [], referencias: [], previas: [] }); setTela('ideia') }}
      onAbrirObra={(id) => { setObraId(id); setTela('obra') }}
      onAbrirProjeto={(id) => { setObraId(id); setTela('projeto') }}
      onNotebook={() => setTela(estado?.computador.ligado ? 'obras' : 'desligado')} />
  )
}
