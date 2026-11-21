import { useCallback, useEffect, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { juntarFalaEmail } from './compra'
import type { AdminApi, DominioBloqueado, ItemAtencao, LinhaCadastro, LinhaCliente, LinhaEntrega, PainelAdmin, Situacao } from './admin-api'
import './admin.css'

type Aba = 'geral' | 'cadastros' | 'entregas'
const MENU: { id: Aba; nome: string }[] = [
  { id: 'geral', nome: 'Visão geral' },
  { id: 'cadastros', nome: 'Cadastros' },
  { id: 'entregas', nome: 'Entregas e marca d’água' },
]

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')
const mesAno = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })

/** "agora", "há 3 h", "ontem", "há 5 dias" — como no protótipo. */
export function quandoFoi(iso: string | null, agora: Date = new Date()): string {
  if (!iso) return 'sem sinal ainda'
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000))
  if (min < 5) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`
  const dias = Math.floor(min / (24 * 60))
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

const SITUACAO: Record<Situacao, { texto: string; classe: string }> = {
  em_dia: { texto: 'Em dia', classe: 'ad-st--ok' },
  atrasada: { texto: 'Atrasada', classe: 'ad-st--aviso' },
  pausada: { texto: 'Pausada', classe: 'ad-st--aviso' },
  cancelada: { texto: 'Cancelada', classe: 'ad-st--neutro' },
  ativando: { texto: 'Ativando', classe: 'ad-st--neutro' },
}
const TRAVADO = { cadastro: 'responder o cadastro', instalacao: 'instalar e ativar' } as const

const DIA_MS = 24 * 3600_000
/** "AAAA-MM-DD" -> fim desse dia em Brasília (23:59), como instante ISO. */
export const fimDoDiaBrasilia = (aaaammdd: string) => new Date(`${aaaammdd}T23:59:59-03:00`).toISOString()
/** Data de hoje + n dias, em Brasília, no formato do <input type="date">. */
const dataEm = (base: Date, dias: number) => new Date(base.getTime() + dias * DIA_MS - 3 * 3600_000).toISOString().slice(0, 10)

/** Painel do administrador (F16) em /admin. Só o Luiz: o servidor recusa qualquer outro login. */
export function Admin({ api }: { api: AdminApi }) {
  const [email, setEmail] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(api.logado())
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!api.logado()) return
    let vivo = true
    api.eu().then((r) => {
      if (!vivo) return
      if (r.ok) setEmail(r.email)
      else setAviso(r.mensagem)
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [api])

  if (carregando) return <div className="ad-solo"><p role="status" className="ad-mute">Abrindo o painel…</p></div>
  if (!email) return <Entrada api={api} aviso={aviso} onEntrou={setEmail} />
  return <Painel api={api} email={email} onSair={() => { api.sair(); setEmail(null); setAviso('') }} />
}

function Entrada({ api, aviso, onEntrou }: { api: AdminApi; aviso: string; onEntrou: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(aviso)
  const [ocupado, setOcupado] = useState(false)

  const confirmar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setErro(''); setOcupado(true)
    const r = await api.entrar(email, senha)
    if (!r.ok) { setOcupado(false); setErro(r.mensagem); return }
    const eu = await api.eu() // o servidor decide se é admin; se não for, a sessão já cai
    setOcupado(false); setSenha('')
    if (eu.ok) onEntrou(eu.email); else setErro(eu.mensagem)
  }
  return (
    <div className="ad-solo">
      <form className="ad-login" onSubmit={confirmar} noValidate>
        <div className="ad-marca"><Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} /></div>
        <span className="ad-rotulo-lime">ADMINISTRADOR</span>
        <h1>Entrar no painel</h1>
        <CampoFalado rotulo="Seu e-mail de administrador" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@atlas.com.br" juntar={juntarFalaEmail} />
        <div className="at-campo">
          <label htmlFor="ad-senha" className="at-campo-rotulo">Senha</label>
          <div className="at-campo-linha">
            <input id="ad-senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
        </div>
        {erro && <p role="alert" className="ad-erro">{erro}</p>}
        <button type="submit" className="ad-botao ad-botao--lime" disabled={ocupado}>
          {ocupado ? 'Um instante…' : <>Entrar <Icone nome="seta" /></>}
        </button>
      </form>
    </div>
  )
}

function Painel({ api, email, onSair }: { api: AdminApi; email: string; onSair: () => void }) {
  const [aba, setAba] = useState<Aba>('geral')
  return (
    <div className="ad">
      <aside className="ad-lateral">
        <div className="ad-marca"><Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} /></div>
        <span className="ad-rotulo-lime">ADMINISTRADOR</span>
        <nav aria-label="Menu do administrador">
          {MENU.map((m) => (
            <a key={m.id} href={`#/${m.id}`} className={`ad-item ${aba === m.id ? 'ad-item--ativo' : ''}`} aria-current={aba === m.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setAba(m.id) }}>{m.nome}</a>
          ))}
        </nav>
        <div className="ad-eu">
          <span>{email}</span>
          <button type="button" className="ad-link" onClick={onSair}>Sair</button>
        </div>
      </aside>
      <main className="ad-main">
        {aba === 'geral' && <VisaoGeral api={api} />}
        {aba === 'cadastros' && <Cadastros api={api} />}
        {aba === 'entregas' && <Entregas api={api} />}
      </main>
    </div>
  )
}

/** Liga/desliga a oferta de teste grátis da página de vendas (e o nº de dias). Quem decide é o servidor. */
function TesteGratis({ api }: { api: AdminApi }) {
  const [cfg, setCfg] = useState<{ ativa: boolean; dias: number } | null>(null)
  const [dias, setDias] = useState('5')
  const [erro, setErro] = useState('')
  useEffect(() => {
    let vivo = true
    api.degustacao().then((r) => { if (!vivo) return; if (r.ok) { setCfg({ ativa: r.ativa, dias: r.dias }); setDias(String(r.dias)) } else setErro(r.mensagem) })
    return () => { vivo = false }
  }, [api])
  const mudar = async (m: { ativa?: boolean; dias?: number }) => {
    setErro('')
    const r = await api.degustacao(m)
    if (r.ok) { setCfg({ ativa: r.ativa, dias: r.dias }); setDias(String(r.dias)) } else setErro(r.mensagem) // erro honesto: nada mudou
  }
  return (
    <section className="ad-card" aria-label="Teste grátis">
      <span className="ad-rotulo">TESTE GRÁTIS</span>
      <p className="ad-p">Deixa qualquer pessoa testar o Atlas por uns dias, depois de confirmar o e-mail. Desligado, o botão some da página de vendas.</p>
      {cfg && <p className="ad-p"><b>{cfg.ativa ? 'Ligado' : 'Desligado'}</b> · {cfg.dias} dias de teste</p>}
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {cfg && (
        <>
          <label className="ad-campo-data">Dias de teste
            <input type="number" min={1} max={30} value={dias} onChange={(e) => setDias(e.target.value)} />
          </label>
          <div className="ad-linha">
            <button type="button" className="ad-botao ad-botao--lime" onClick={() => mudar({ ativa: !cfg.ativa })}>{cfg.ativa ? 'Desligar o teste grátis' : 'Ligar o teste grátis'}</button>
            <button type="button" className="ad-botao" disabled={Number(dias) === cfg.dias} onClick={() => mudar({ dias: Number(dias) })}>Salvar os dias</button>
          </div>
        </>
      )}
    </section>
  )
}

/** Lista de e-mails temporários bloqueados no teste grátis: ver, bloquear mais um e liberar de volta. O servidor valida de novo. */
function DominiosBloqueados({ api, versao }: { api: AdminApi; versao: number }) {
  const [lista, setLista] = useState<DominioBloqueado[] | null>(null)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => {
    const r = await api.dominios()
    if (r.ok) { setLista(r.dominios); setErro('') } else setErro(r.mensagem)
  }, [api])
  useEffect(() => {
    let vivo = true
    api.dominios().then((r) => { if (!vivo) return; if (r.ok) { setLista(r.dominios); setErro('') } else setErro(r.mensagem) })
    return () => { vivo = false }
  }, [api, versao])
  const adicionar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setErro(''); setMsg('')
    const r = await api.bloquearDominio(novo)
    if (!r.ok) { setErro(r.mensagem); return }
    setMsg(r.ja_existia ? `${r.dominio} já estava na lista.` : `${r.dominio} bloqueado.`)
    setNovo('')
    await carregar()
  }
  const liberar = async (dominio: string) => {
    setErro(''); setMsg('')
    const r = await api.liberarDominio(dominio)
    if (!r.ok) setErro(r.mensagem); else setMsg(`${dominio} liberado de volta.`)
    await carregar()
  }
  return (
    <section className="ad-card" aria-label="E-mails temporários bloqueados">
      <span className="ad-rotulo">E-MAILS TEMPORÁRIOS BLOQUEADOS</span>
      <p className="ad-p">Domínios de e-mail que não podem pedir o teste grátis (daqueles que somem em minutos). O Atlas já vem com uma lista; aqui você acrescenta os que aparecerem.</p>
      <form onSubmit={adicionar} noValidate>
        <label className="ad-campo-data">Domínio para bloquear
          <input type="text" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="mailinator.com" autoComplete="off" />
        </label>
        <div className="ad-linha"><button type="submit" className="ad-botao ad-botao--lime" disabled={!novo.trim()}>Bloquear domínio</button></div>
      </form>
      {msg && <p role="status" className="ad-aviso-msg">{msg}</p>}
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {lista && lista.length === 0 && <p className="ad-mute">Nenhum domínio acrescentado por você ainda.</p>}
      {lista?.map((x) => (
        <div key={x.dominio} className="ad-linha">
          <b>{x.dominio}</b><span className="ad-mute">desde {dia(x.criado_em)}</span>
          <button type="button" className="ad-link" aria-label={`Liberar ${x.dominio}`} onClick={() => liberar(x.dominio)}>Liberar</button>
        </div>
      ))}
    </section>
  )
}

function useCarga<T>(buscar: () => Promise<{ ok: true; v: T } | { ok: false; mensagem: string }>) {
  const [dado, setDado] = useState<T | null>(null)
  const [erro, setErro] = useState('')
  const recarregar = useCallback(async () => {
    const r = await buscar()
    if (r.ok) { setDado(r.v); setErro('') } else setErro(r.mensagem)
  }, [buscar])
  useEffect(() => {
    let vivo = true
    buscar().then((r) => { if (!vivo) return; if (r.ok) setDado(r.v); else setErro(r.mensagem) })
    return () => { vivo = false }
  }, [buscar])
  return { dado, erro, recarregar }
}

function VisaoGeral({ api }: { api: AdminApi }) {
  const buscar = useCallback(async () => {
    const r = await api.painel()
    return r.ok ? ({ ok: true, v: r.painel } as const) : r
  }, [api])
  const { dado, erro, recarregar } = useCarga<PainelAdmin>(buscar)
  const [liberando, setLiberando] = useState<{ licencaId: string; quem: string; motivo: string } | null>(null)
  const [msg, setMsg] = useState('')
  const [cortesia, setCortesia] = useState({ email: '', data: '' })
  const [erroCortesia, setErroCortesia] = useState('')
  const [versaoDominios, setVersaoDominios] = useState(0)

  if (!dado) return erro ? <p role="alert" className="ad-erro">{erro}</p> : <p role="status" className="ad-mute">Carregando os números…</p>
  const { indicadores: i, atencao, clientes } = dado
  const agora = new Date(dado.gerado_em)

  const confirmarLiberar = async () => {
    if (!liberando) return
    const r = await api.liberarTroca(liberando.licencaId, liberando.motivo)
    if (!r.ok) { setMsg(r.mensagem); return }
    setMsg(r.ja_liberada ? `A troca de ${liberando.quem} já estava liberada.` : `Troca liberada para ${liberando.quem}. Ela vale uma vez e fica registrada no seu nome.`)
    setLiberando(null)
    await recarregar()
  }
  const confirmarCortesia = async (ev: React.FormEvent) => {
    ev.preventDefault(); setErroCortesia(''); setMsg('')
    if (!cortesia.data) { setErroCortesia('Escolha até quando a cortesia vale.'); return }
    const r = await api.liberarCortesia(cortesia.email, fimDoDiaBrasilia(cortesia.data))
    if (!r.ok) { setErroCortesia(r.mensagem); return } // erro honesto: nada foi liberado
    setMsg(`${r.nova ? 'Cortesia liberada' : 'Cortesia renovada'} para ${cortesia.email.trim().toLowerCase()} até ${dia(r.validade_em)}.`)
    setCortesia({ email: '', data: '' })
    await recarregar()
  }
  const dar_baixa = async (id: string) => {
    const r = await api.resolverOcorrencia(id)
    setMsg(r.ok ? '' : r.mensagem)
    await recarregar()
  }
  const bloquearSugerido = async (a: ItemAtencao) => {
    if (!a.dominio_sugerido) return
    const r = await api.bloquearDominio(a.dominio_sugerido)
    if (!r.ok) { setMsg(r.mensagem); return }
    await api.resolverOcorrencia(a.id) // o alerta está atendido
    setMsg(`${r.dominio} bloqueado. Quem pedir o teste com esse e-mail será recusado.`)
    setVersaoDominios((v) => v + 1)
    await recarregar()
  }
  const abrirLiberar = (licencaId: string, quem: string, motivo = '') => { setMsg(''); setLiberando({ licencaId, quem, motivo }) }

  const kpis = [
    { nome: 'Clientes ativos', v: String(i.clientes_ativos), sub: 'licenças em dia', tom: '' },
    { nome: 'Receita recorrente', v: dinheiro(i.receita.recorrente_mensal), sub: `por mês · ${dinheiro(i.receita.recebida_no_mes)} recebidos neste mês`, tom: 'lime' },
    { nome: 'Ativações no mês', v: String(i.ativacoes.no_mes), sub: `meta: ${i.ativacoes.meta} · ${i.ativacoes.computadores_ativos} computadores ativos`, tom: '' },
    { nome: 'Inadimplência', v: String(i.inadimplencia.atrasadas + i.inadimplencia.pausadas), sub: `${dinheiro(i.inadimplencia.valor_em_aberto)} em aberto · licença pausa em 7 dias`, tom: 'aviso' },
    { nome: 'Clientes travados', v: String(i.travados), sub: 'parados há mais de 2 dias', tom: i.travados > 0 ? 'aviso' : '' },
  ]

  return (
    <>
      <div className="ad-titulo"><h1>Visão geral</h1><span className="ad-mute">{mesAno(dado.gerado_em)}</span></div>
      {msg && <p role="status" className="ad-aviso-msg">{msg}</p>}
      <div className="ad-kpis">
        {kpis.map((k) => (
          <div key={k.nome} className={`ad-kpi ${k.tom ? `ad-kpi--${k.tom}` : ''}`}>
            <span className="ad-kpi-nome">{k.nome}</span><span className="ad-kpi-v">{k.v}</span><span className="ad-mute2">{k.sub}</span>
          </div>
        ))}
      </div>
      <div className="ad-grade">
        <section className="ad-card" aria-label="Clientes">
          <span className="ad-rotulo">CLIENTES</span>
          <div className="ad-tabela ad-tabela--cab" role="row"><span>Cliente</span><span>Licença</span><span>Obras</span><span>Último sinal</span><span>Ação</span></div>
          {clientes.length === 0 && <p className="ad-mute">Ainda não há clientes.</p>}
          {clientes.map((c) => <LinhaDoCliente key={c.licenca_id} c={c} agora={agora} onLiberar={() => abrirLiberar(c.licenca_id, c.empresa || c.nome)} />)}
        </section>
        <div className="ad-coluna">
          <section className="ad-card ad-card--aviso" aria-label="Precisam de atenção">
            <span className="ad-rotulo ad-rotulo--aviso">PRECISAM DE ATENÇÃO</span>
            {atencao.length === 0 && <p className="ad-mute">Nada pedindo atenção agora.</p>}
            {atencao.map((a) => <Atencao key={a.id} a={a} onBloquear={() => bloquearSugerido(a)} onBaixa={() => dar_baixa(a.id)} onLiberar={() => a.licenca_id && abrirLiberar(a.licenca_id, a.quem, 'Cliente pediu a troca antes do prazo de 7 dias.')} />)}
          </section>
          <TesteGratis api={api} />
          <DominiosBloqueados api={api} versao={versaoDominios} />
          <section className="ad-card" aria-label="Liberar cortesia">
            <span className="ad-rotulo">LIBERAR CORTESIA</span>
            <p className="ad-p">Dê um acesso de presente a alguém, por uns dias. Quando a data chegar, o acesso acaba sozinho.</p>
            <form onSubmit={confirmarCortesia} noValidate>
              <CampoFalado rotulo="E-mail da pessoa" type="email" autoComplete="off" valor={cortesia.email} onChange={(email) => setCortesia({ ...cortesia, email })} placeholder="amigo@email.com" juntar={juntarFalaEmail} />
              <label className="ad-campo-data">Vale até
                <input type="date" value={cortesia.data} min={dataEm(agora, 1)} max={dataEm(agora, 180)} onChange={(e) => setCortesia({ ...cortesia, data: e.target.value })} />
              </label>
              <span className="ad-mute2">Entre 1 e 180 dias. Costuma ser de 10 a 15.</span>
              {erroCortesia && <p role="alert" className="ad-erro">{erroCortesia}</p>}
              <div className="ad-linha"><button type="submit" className="ad-botao ad-botao--lime" disabled={!cortesia.email.trim() || !cortesia.data}>Liberar cortesia</button></div>
            </form>
          </section>
          {liberando && (
            <section className="ad-card" aria-label="Liberar troca urgente">
              <span className="ad-rotulo">LIBERAR TROCA URGENTE</span>
              <p className="ad-p">{liberando.quem} poderá trocar de computador agora, uma vez, sem esperar os 7 dias. Fica registrado no seu nome.</p>
              <CampoFalado rotulo="Motivo" valor={liberando.motivo} onChange={(motivo) => setLiberando({ ...liberando, motivo })} placeholder="Ex.: o computador do cliente quebrou" />
              <div className="ad-linha">
                <button type="button" className="ad-botao ad-botao--lime" onClick={confirmarLiberar} disabled={liberando.motivo.trim().length < 5}>Liberar a troca</button>
                <button type="button" className="ad-botao" onClick={() => setLiberando(null)}>Cancelar</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}

function LinhaDoCliente({ c, agora, onLiberar }: { c: LinhaCliente; agora: Date; onLiberar: () => void }) {
  const st = SITUACAO[c.situacao]
  return (
    <div className="ad-tabela" role="row">
      <div className="ad-quem"><b>{c.empresa || c.nome}</b><span className="ad-mute">{c.ramo || (c.empresa ? c.nome : '')}</span></div>
      <span className={`ad-st ${st.classe}`}>{st.texto}{c.tipo === 'cortesia' && <small className="ad-mute"> · cortesia até {dia(c.validade_em ?? null)}</small>}</span>
      <span>{c.obras > 0 ? `${c.obras} ${c.obras === 1 ? 'entregue' : 'entregues'}` : '—'}</span>
      <span className="ad-mute">{c.travado_em ? `travado em: ${TRAVADO[c.travado_em]}` : quandoFoi(c.ultimo_sinal_em, agora)}</span>
      <button type="button" className="ad-link" aria-label={`Liberar troca de ${c.empresa || c.nome}`} onClick={onLiberar} disabled={c.situacao === 'cancelada'}>Liberar troca</button>
    </div>
  )
}

function Atencao({ a, onBaixa, onLiberar, onBloquear }: { a: ItemAtencao; onBaixa: () => void; onLiberar: () => void; onBloquear: () => void }) {
  return (
    <div className="ad-alerta">
      <b>{a.quem}</b>
      <span className="ad-mute">{a.oque}</span>
      <div className="ad-linha">
        {a.licenca_id && <button type="button" className="ad-link" onClick={onLiberar}>Liberar troca</button>}
        {a.dominio_sugerido && <button type="button" className="ad-link" onClick={onBloquear}>Bloquear este domínio</button>}
        <button type="button" className="ad-link ad-link--mudo" onClick={onBaixa}>Já resolvi</button>
      </div>
    </div>
  )
}

function Cadastros({ api }: { api: AdminApi }) {
  const buscar = useCallback(async () => {
    const r = await api.cadastros()
    return r.ok ? ({ ok: true, v: r.cadastros } as const) : r
  }, [api])
  const { dado, erro } = useCarga<LinhaCadastro[]>(buscar)
  return (
    <>
      <div className="ad-titulo"><h1>Cadastros</h1><span className="ad-mute">as respostas que cada cliente deu depois de pagar</span></div>
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {!dado && !erro && <p role="status" className="ad-mute">Carregando…</p>}
      {dado && (
        <section className="ad-card" aria-label="Cadastros">
          <div className="ad-tabela ad-tabela--cad ad-tabela--cab"><span>Cliente</span><span>E-mail</span><span>Ramo</span><span>Cadastro</span></div>
          {dado.map((c) => (
            <div key={c.licenca_id} className="ad-tabela ad-tabela--cad">
              <div className="ad-quem"><b>{c.empresa || c.nome}</b><span className="ad-mute">{c.empresa ? c.nome : ''}</span></div>
              <span>{c.email}</span>
              <span>{c.ramo || '—'}</span>
              <span className={`ad-st ${c.situacao === 'feito' ? 'ad-st--ok' : 'ad-st--aviso'}`}>{c.situacao === 'feito' ? `Feito em ${dia(c.cadastro_em)}` : 'Ainda não respondeu'}</span>
            </div>
          ))}
          {dado.length === 0 && <p className="ad-mute">Ainda não há cadastros.</p>}
        </section>
      )}
    </>
  )
}

function Entregas({ api }: { api: AdminApi }) {
  const [marca, setMarca] = useState('')
  const [filtro, setFiltro] = useState('')
  const buscar = useCallback(async () => {
    const r = await api.entregas(filtro ? { marca: filtro } : {})
    return r.ok ? ({ ok: true, v: r.entregas } as const) : r
  }, [api, filtro])
  const { dado, erro } = useCarga<LinhaEntrega[]>(buscar)
  return (
    <>
      <div className="ad-titulo"><h1>Entregas e marca d&rsquo;água</h1><span className="ad-mute">cada arquivo do kit sai com a marca do cliente</span></div>
      <form className="ad-card ad-busca" onSubmit={(e) => { e.preventDefault(); setFiltro(marca.trim()) }}>
        <CampoFalado rotulo="De quem é esta marca?" valor={marca} onChange={setMarca} placeholder="Cole a marca encontrada num arquivo" ajuda="Serve para descobrir de qual cliente saiu um arquivo que apareceu fora do lugar." />
        <div className="ad-linha">
          <button type="submit" className="ad-botao ad-botao--lime">Procurar</button>
          {filtro && <button type="button" className="ad-botao" onClick={() => { setMarca(''); setFiltro('') }}>Ver as últimas entregas</button>}
        </div>
      </form>
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {dado && (
        <section className="ad-card" aria-label="Entregas">
          <div className="ad-tabela ad-tabela--ent ad-tabela--cab"><span>Cliente</span><span>Obra</span><span>Marca d&rsquo;água</span><span>Baixado em</span></div>
          {dado.map((e, n) => (
            <div key={`${e.marca_dagua}-${n}`} className="ad-tabela ad-tabela--ent">
              <b>{e.cliente}</b><span>{e.obra_id}</span><code className="ad-marca-cod">{e.marca_dagua}</code><span className="ad-mute">{dia(e.baixado_em)}</span>
            </div>
          ))}
          {dado.length === 0 && <p className="ad-mute">{filtro ? 'Nenhum cliente recebeu essa marca.' : 'Ainda não houve entregas.'}</p>}
        </section>
      )}
    </>
  )
}
