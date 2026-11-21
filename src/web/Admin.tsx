import { useCallback, useEffect, useRef, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import type { NomeIcone } from '../ui/Icone'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { juntarFalaEmail } from './compra'
import type { AdminApi, DominioBloqueado, FluxoCaixa as FluxoCaixaDado, ItemAtencao, LinhaCadastro, LinhaCliente, LinhaEntrega, PainelAdmin, RadarPirataria, MapaClientes, GravidadeSinal, SinalRadar, TipoSinal, Situacao } from './admin-api'
import { FILTROS, filtrarClientes, fluxoPorMes, indicadoresGerenciais, type FiltroConta } from './admin-calc'
import { LegendaMapa, MapaBrasil, nomeUf, resumirMapa, textoUf } from './AdminMapa'
import { NOME_REGIAO } from './mapa-brasil'
import './admin.css'

type Aba = 'geral' | 'caixa' | 'acoes' | 'radar' | 'mapa' | 'entregas'
const MENU: { id: Aba; nome: string; icone: NomeIcone }[] = [
  { id: 'geral', nome: 'Visão geral', icone: 'brilho' },
  { id: 'caixa', nome: 'Fluxo de caixa', icone: 'moeda' },
  { id: 'acoes', nome: 'Ações', icone: 'aperto' },
  { id: 'radar', nome: 'Radar', icone: 'escudo' },
  { id: 'mapa', nome: 'Mapa', icone: 'mapa' },
  { id: 'entregas', nome: 'Marca d’água', icone: 'pasta' },
]

const CHAVE_MENU = 'atlas.admin.menu-recolhido'
// Sem preferência salva, o menu começa recolhido.
const lerRecolhido = () => { try { return localStorage.getItem(CHAVE_MENU) !== '0' } catch { return true } }
const guardarRecolhido = (v: boolean) => { try { localStorage.setItem(CHAVE_MENU, v ? '1' : '0') } catch { /* vale só nesta carga */ } }

/** Quantas contas aparecem por página na lista de clientes. */
export const POR_PAGINA = 20

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
  const [recolhido, setRecolhido] = useState(lerRecolhido)
  const alternarMenu = () => { const novo = !recolhido; setRecolhido(novo); guardarRecolhido(novo) }
  return (
    <div className="ad">
      <aside className={`ad-lateral ${recolhido ? 'ad-lateral--recolhida' : ''}`}>
        <div className="ad-marca">
          <Monograma fundo="escuro" largura={40} altura={22} />
          {!recolhido && <NomeAtlas fundo="escuro" largura={96} altura={14} />}
        </div>
        {!recolhido && <span className="ad-rotulo-lime">ADMINISTRADOR</span>}
        <nav aria-label="Menu do administrador">
          {MENU.map((m) => (
            <a key={m.id} href={`#/${m.id}`} title={m.nome} aria-label={m.nome} className={`ad-item ${aba === m.id ? 'ad-item--ativo' : ''}`} aria-current={aba === m.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setAba(m.id) }}>
              <Icone nome={m.icone} tamanho={20} />
              {!recolhido && <span>{m.nome}</span>}
            </a>
          ))}
        </nav>
        <div className="ad-eu">
          <button type="button" className="ad-recolher" aria-expanded={!recolhido} aria-label={recolhido ? 'Abrir o menu' : 'Recolher o menu'} title={recolhido ? 'Abrir o menu' : 'Recolher o menu'} onClick={alternarMenu}>
            <Icone nome="chevron" tamanho={18} />
          </button>
          {!recolhido && <span>{email}</span>}
          <button type="button" className="ad-link" aria-label="Sair" title="Sair" onClick={onSair}>{recolhido ? <Icone nome="x" tamanho={18} /> : 'Sair'}</button>
        </div>
      </aside>
      <main className="ad-main">
        {aba === 'geral' && <VisaoGeral api={api} />}
        {aba === 'caixa' && <FluxoCaixa api={api} />}
        {aba === 'acoes' && <Acoes api={api} />}
        {aba === 'radar' && <Radar api={api} />}
        {aba === 'mapa' && <Mapa api={api} />}
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
function DominiosBloqueados({ api }: { api: AdminApi }) {
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
  }, [api])
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
  const [cadastros, setCadastros] = useState<Map<string, LinhaCadastro>>(new Map())
  const [liberando, setLiberando] = useState<{ licencaId: string; quem: string; motivo: string } | null>(null)
  const [msg, setMsg] = useState('')
  const [atencaoAberta, setAtencaoAberta] = useState(false)
  const [filtro, setFiltro] = useState<FiltroConta>('todas')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const listaRef = useRef<HTMLElement>(null)

  // E-mail, ramo e cadastro vêm de outra rota: junta por licenca_id. Se falhar, a lista segue sem esses dados.
  useEffect(() => {
    let vivo = true
    api.cadastros().then((r) => {
      if (!vivo || !r.ok || !Array.isArray(r.cadastros)) return
      setCadastros(new Map(r.cadastros.map((c) => [c.licenca_id, c])))
    })
    return () => { vivo = false }
  }, [api])

  if (!dado) return erro ? <p role="alert" className="ad-erro">{erro}</p> : <p role="status" className="ad-mute">Carregando os números…</p>
  const { indicadores: i, atencao, clientes } = dado
  const agora = new Date(dado.gerado_em)
  const visiveis = filtrarClientes(clientes, filtro, busca)
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const ini = (paginaAtual - 1) * POR_PAGINA
  const daPagina = visiveis.slice(ini, ini + POR_PAGINA)
  const mudarFiltro = (f: FiltroConta) => { setFiltro(f); setPagina(1) }
  const mudarBusca = (b: string) => { setBusca(b); setPagina(1) }

  const confirmarLiberar = async () => {
    if (!liberando) return
    const r = await api.liberarTroca(liberando.licencaId, liberando.motivo)
    if (!r.ok) { setMsg(r.mensagem); return }
    setMsg(r.ja_liberada ? `A troca de ${liberando.quem} já estava liberada.` : `Troca liberada para ${liberando.quem}. Ela vale uma vez e fica registrada no seu nome.`)
    setLiberando(null)
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
    await recarregar()
  }
  // "Liberar troca urgente" abre sempre aqui na Visão geral (acima da lista); se veio do painel de atenção, ele fecha para o formulário aparecer.
  const abrirLiberar = (licencaId: string, quem: string, motivo = '') => { setMsg(''); setAtencaoAberta(false); setLiberando({ licencaId, quem, motivo }) }

  const g = indicadoresGerenciais(i)
  // Linha de cima: só fatos (não clicam). Cartões de baixo: botões que filtram a lista de clientes.
  const infos = [
    { nome: 'Clientes ativos', v: String(i.clientes_ativos) },
    { nome: 'Receita recorrente (MRR)', v: dinheiro(g.mrr) },
    { nome: 'Ticket médio', v: g.ticketMedio === null ? '—' : dinheiro(g.ticketMedio) },
  ]
  // Obs.: o número de "Ativações no mês" conta as do mês, mas a lista não tem data de ativação; o filtro mostra quem está ativando agora.
  const cartoes: { nome: string; v: string; sub: string; tom: string; filtro: FiltroConta }[] = [
    { nome: 'Ativações no mês', v: String(i.ativacoes.no_mes), sub: `meta: ${i.ativacoes.meta} · ${i.ativacoes.computadores_ativos} computadores ativos`, tom: '', filtro: 'ativando' },
    { nome: 'Inadimplência', v: String(i.inadimplencia.atrasadas + i.inadimplencia.pausadas), sub: `${dinheiro(i.inadimplencia.valor_em_aberto)} em aberto · licença pausa em 7 dias`, tom: 'aviso', filtro: 'inadimplentes' },
    { nome: 'Cancelamentos no mês', v: g.cancelamentosNoMes === null ? '—' : String(g.cancelamentosNoMes), sub: g.cancelamentosNoMes === null ? 'o servidor ainda não informa esse número' : g.cancelamentosNoMes === 0 ? 'ninguém cancelou, bom sinal' : 'clientes que pediram para sair', tom: g.cancelamentosNoMes ? 'aviso' : '', filtro: 'canceladas' },
    { nome: 'Clientes travados', v: String(i.travados), sub: 'parados há mais de 2 dias', tom: i.travados > 0 ? 'aviso' : '', filtro: 'travados' },
  ]
  const alternar = (f: FiltroConta) => {
    const novo = filtro === f ? 'todas' : f
    mudarFiltro(novo)
    if (novo !== 'todas') setTimeout(() => listaRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <>
      <div className="ad-titulo"><h1>Visão geral</h1><span className="ad-mute">{mesAno(dado.gerado_em)}</span>
        <dl className="ad-infos" aria-label="Números do negócio">
          {infos.map((k) => (
            <div key={k.nome} className="ad-info"><dt className="ad-info-nome">{k.nome}</dt><dd className="ad-info-v">{k.v}</dd></div>
          ))}
        </dl>
        <button type="button" className={`ad-botao ad-botao--atencao ${atencao.length > 0 ? 'ad-botao--aviso' : ''}`} aria-haspopup="dialog" onClick={() => setAtencaoAberta(true)}>
          <Icone nome="alerta" tamanho={18} />Precisam de atenção ({atencao.length})
        </button>
      </div>
      {msg && <p role="status" className="ad-aviso-msg">{msg}</p>}
      <div className="ad-kpis" role="group" aria-label="Filtrar clientes por situação">
        {cartoes.map((k) => (
          <button key={k.nome} type="button" aria-pressed={filtro === k.filtro} onClick={() => alternar(k.filtro)} className={`ad-kpi ad-kpi--botao ${k.tom ? `ad-kpi--${k.tom}` : ''} ${filtro === k.filtro ? 'ad-kpi--ativo' : ''}`}>
            <span className="ad-kpi-nome">{k.nome}</span><span className="ad-kpi-v">{k.v}</span><span className="ad-mute2">{k.sub}</span>
          </button>
        ))}
      </div>
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
      <section className="ad-card" aria-label="Clientes" ref={listaRef}>
        <span className="ad-rotulo">CLIENTES</span>
        <div className="ad-filtro">
          <label className="ad-campo-data">Mostrar
            <select value={filtro} onChange={(e) => mudarFiltro(e.target.value as FiltroConta)}>
              {FILTROS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          <label className="ad-campo-data">Buscar por nome ou empresa
            <input type="search" value={busca} onChange={(e) => mudarBusca(e.target.value)} placeholder="Ex.: barbearia" autoComplete="off" />
          </label>
        </div>
        <p aria-live="polite" className="ad-mute2">{visiveis.length === clientes.length ? `${clientes.length} ${clientes.length === 1 ? 'conta' : 'contas'}` : `${visiveis.length} de ${clientes.length} contas`}</p>
        <div className="ad-tabela ad-tabela--cli ad-tabela--cab" role="row"><span>Cliente</span><span>E-mail</span><span className="ad-col-ramo">Ramo</span><span>Cadastro</span><span>Situação</span><span>Obras</span><span>Último sinal</span><span>Ação</span></div>
        {clientes.length === 0 && <p className="ad-mute">Ainda não há clientes.</p>}
        {clientes.length > 0 && visiveis.length === 0 && <p className="ad-mute">Nenhuma conta com esse filtro. Tente outro ou limpe a busca.</p>}
        {daPagina.map((c) => <LinhaDoCliente key={c.licenca_id} c={c} cad={cadastros.get(c.licenca_id)} agora={agora} onLiberar={() => abrirLiberar(c.licenca_id, c.empresa || c.nome)} />)}
        {visiveis.length > 0 && (
          <nav className="ad-pagina" aria-label="Páginas da lista de clientes">
            <span aria-live="polite" className="ad-mute2">mostrando {ini + 1}–{ini + daPagina.length} de {visiveis.length}</span>
            <div className="ad-linha">
              <button type="button" className="ad-botao" aria-label="Página anterior" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button>
              <span className="ad-mute2">página {paginaAtual} de {totalPaginas}</span>
              <button type="button" className="ad-botao" aria-label="Próxima página" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button>
            </div>
          </nav>
        )}
      </section>
      {atencaoAberta && (
        <GavetaAtencao itens={atencao} clientes={clientes} cadastros={cadastros} agora={agora} onFechar={() => setAtencaoAberta(false)}
          onBloquear={bloquearSugerido} onBaixa={dar_baixa}
          onLiberar={(a) => a.licenca_id && abrirLiberar(a.licenca_id, a.quem, 'Cliente pediu a troca antes do prazo de 7 dias.')} />
      )}
    </>
  )
}

function LinhaDoCliente({ c, cad, agora, onLiberar }: { c: LinhaCliente; cad?: LinhaCadastro; agora: Date; onLiberar: () => void }) {
  const st = SITUACAO[c.situacao]
  const ramo = cad?.ramo || c.ramo
  return (
    <div className="ad-tabela ad-tabela--cli" role="row">
      <div className="ad-quem"><b>{c.empresa || c.nome}</b><span className="ad-mute">{c.empresa ? c.nome : ''}<span className="ad-so-estreito">{c.empresa && ramo ? ' · ' : ''}{ramo}</span></span></div>
      <span className="ad-email">{cad?.email || '—'}</span>
      <span className="ad-col-ramo">{ramo || '—'}</span>
      {cad
        ? <span className={`ad-st ${cad.situacao === 'feito' ? 'ad-st--ok' : 'ad-st--aviso'}`}>{cad.situacao === 'feito' ? `Feito em ${dia(cad.cadastro_em)}` : 'Ainda não respondeu'}</span>
        : <span className="ad-mute">—</span>}
      <span className={`ad-st ${st.classe}`}>{st.texto}{c.tipo === 'cortesia' && <small className="ad-mute"> · cortesia até {dia(c.validade_em ?? null)}</small>}</span>
      <span>{c.obras > 0 ? `${c.obras} ${c.obras === 1 ? 'entregue' : 'entregues'}` : '—'}</span>
      <span className="ad-mute">{c.travado_em ? `travado em: ${TRAVADO[c.travado_em]}` : quandoFoi(c.ultimo_sinal_em, agora)}</span>
      <button type="button" className="ad-link" aria-label={`Liberar troca de ${c.empresa || c.nome}`} onClick={onLiberar} disabled={c.situacao === 'cancelada'}>Liberar troca</button>
    </div>
  )
}

const TIPO_ATENCAO: Record<string, string> = { travado: 'Cliente travado', atraso: 'Mensalidade atrasada', troca: 'Troca de computador', troca_antecipada: 'Troca de computador', licenca_pausada: 'Licença pausada', dominio: 'E-mail temporário' }

const FOCAVEIS = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Painel lateral "Precisam de atenção": desliza da direita, fecha com X, Esc ou clicando fora, e prende o foco enquanto está aberto. */
function GavetaAtencao({ itens, clientes, cadastros, agora, onFechar, onLiberar, onBloquear, onBaixa }: {
  itens: ItemAtencao[]; clientes: LinhaCliente[]; cadastros: Map<string, LinhaCadastro>; agora: Date
  onFechar: () => void; onLiberar: (a: ItemAtencao) => void; onBloquear: (a: ItemAtencao) => void; onBaixa: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  useEffect(() => { fechar.current = onFechar })
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    const corpo = document.body
    const overflowAntes = corpo.style.overflow
    corpo.style.overflow = 'hidden' // o fundo não rola enquanto a gaveta está aberta
    const menu = document.querySelector<HTMLElement>('.ad-lateral')
    menu?.setAttribute('inert', '') // leitor de tela e Tab não alcançam o menu de trás
    ref.current?.querySelector<HTMLElement>('.ad-gaveta-x')?.focus()
    // Esc e Tab valem no documento inteiro: mesmo com o foco no body, a gaveta manda.
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = [...ref.current.querySelectorAll<HTMLElement>(FOCAVEIS)]
      if (f.length === 0) return
      const primeiro = f[0], ultimo = f[f.length - 1]
      const ativo = document.activeElement
      if (!ref.current.contains(ativo)) { e.preventDefault(); (e.shiftKey ? ultimo : primeiro).focus() }
      else if (e.shiftKey && ativo === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', teclas)
    return () => {
      document.removeEventListener('keydown', teclas)
      corpo.style.overflow = overflowAntes
      menu?.removeAttribute('inert')
      antes?.focus?.()
    }
  }, [])
  return (
    <div className="ad-gaveta-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div ref={ref} className="ad-gaveta" role="dialog" aria-modal="true" aria-label="Precisam de atenção">
        <div className="ad-gaveta-topo">
          <span className="ad-rotulo ad-rotulo--aviso">PRECISAM DE ATENÇÃO ({itens.length})</span>
          <button type="button" className="ad-gaveta-x" aria-label="Fechar" title="Fechar" onClick={onFechar}><Icone nome="x" tamanho={18} /></button>
        </div>
        <div className="ad-gaveta-lista">
          {itens.length === 0 && <p className="ad-mute">Nada pedindo atenção agora.</p>}
          {itens.map((a) => {
            const cli = a.licenca_id ? clientes.find((c) => c.licenca_id === a.licenca_id) : undefined
            const cad = a.licenca_id ? cadastros.get(a.licenca_id) : undefined
            return (
              <Atencao key={a.id} a={a} tipo={TIPO_ATENCAO[a.tipo] ?? 'Aviso'} quando={quandoFoi(a.quando, agora)}
                detalhe={[cli && `Situação: ${SITUACAO[cli.situacao].texto}`, cad?.email, (cad?.ramo || cli?.ramo)].filter(Boolean).join(' · ')}
                onBloquear={() => onBloquear(a)} onBaixa={() => onBaixa(a.id)} onLiberar={() => onLiberar(a)} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Atencao({ a, tipo, quando, detalhe, onBaixa, onLiberar, onBloquear }: { a: ItemAtencao; tipo: string; quando: string; detalhe: string; onBaixa: () => void; onLiberar: () => void; onBloquear: () => void }) {
  return (
    <div className="ad-alerta">
      <span className="ad-alerta-tipo">{tipo} · {quando}</span>
      <b>{a.quem}</b>
      <span className="ad-mute">{a.oque}</span>
      {detalhe && <span className="ad-mute2">{detalhe}</span>}
      <div className="ad-linha">
        {a.licenca_id && <button type="button" className="ad-link" onClick={onLiberar}>Liberar troca</button>}
        {a.dominio_sugerido && <button type="button" className="ad-link" onClick={onBloquear}>Bloquear este domínio</button>}
        <button type="button" className="ad-link ad-link--mudo" onClick={onBaixa}>Já resolvi</button>
      </div>
    </div>
  )
}

/** Aba "Ações": teste grátis, e-mails bloqueados e cortesia, cada um num cartão grande. */
function Acoes({ api }: { api: AdminApi }) {
  return (
    <>
      <div className="ad-titulo"><h1>Ações</h1><span className="ad-mute">o que você liga, bloqueia ou libera na mão</span></div>
      <div className="ad-acoes">
        <TesteGratis api={api} />
        <DominiosBloqueados api={api} />
        <Cortesia api={api} />
      </div>
    </>
  )
}

function Cortesia({ api }: { api: AdminApi }) {
  const [cortesia, setCortesia] = useState({ email: '', data: '' })
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const hoje = new Date()
  const confirmar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setErro(''); setMsg('')
    if (!cortesia.data) { setErro('Escolha até quando a cortesia vale.'); return }
    const r = await api.liberarCortesia(cortesia.email, fimDoDiaBrasilia(cortesia.data))
    if (!r.ok) { setErro(r.mensagem); return } // erro honesto: nada foi liberado
    setMsg(`${r.nova ? 'Cortesia liberada' : 'Cortesia renovada'} para ${cortesia.email.trim().toLowerCase()} até ${dia(r.validade_em)}.`)
    setCortesia({ email: '', data: '' })
  }
  return (
    <section className="ad-card" aria-label="Liberar cortesia">
      <span className="ad-rotulo">LIBERAR CORTESIA</span>
      <p className="ad-p">Dê um acesso de presente a alguém, por uns dias. Quando a data chegar, o acesso acaba sozinho.</p>
      <form onSubmit={confirmar} noValidate>
        <CampoFalado rotulo="E-mail da pessoa" type="email" autoComplete="off" valor={cortesia.email} onChange={(email) => setCortesia({ ...cortesia, email })} placeholder="amigo@email.com" juntar={juntarFalaEmail} />
        <label className="ad-campo-data">Vale até
          <input type="date" value={cortesia.data} min={dataEm(hoje, 1)} max={dataEm(hoje, 180)} onChange={(e) => setCortesia({ ...cortesia, data: e.target.value })} />
        </label>
        <span className="ad-mute2">Entre 1 e 180 dias. Costuma ser de 10 a 15.</span>
        {msg && <p role="status" className="ad-aviso-msg">{msg}</p>}
        {erro && <p role="alert" className="ad-erro">{erro}</p>}
        <div className="ad-linha"><button type="submit" className="ad-botao ad-botao--lime" disabled={!cortesia.email.trim() || !cortesia.data}>Liberar cortesia</button></div>
      </form>
    </section>
  )
}

const TIPO_SINAL: Record<TipoSinal, string> = {
  instancia_recusada: 'Segundo computador barrado',
  troca_frequente: 'Trocas demais de computador',
  regioes_distantes: 'Lugares muito distantes',
  degustacao_repetida: 'Teste grátis repetido',
}
const TIPOS_SINAL = Object.keys(TIPO_SINAL) as TipoSinal[]
const GRAVIDADE: Record<GravidadeSinal, { texto: string; classe: string; ordem: number }> = {
  alta: { texto: 'Alta', classe: 'ad-st--erro', ordem: 0 },
  media: { texto: 'Média', classe: 'ad-st--aviso', ordem: 1 },
  baixa: { texto: 'Baixa', classe: 'ad-st--neutro', ordem: 2 },
}

/** Mais grave primeiro; dentro da mesma gravidade, o mais recente. */
export function ordenarSinais(l: SinalRadar[]): SinalRadar[] {
  return [...l].sort((a, b) => GRAVIDADE[a.gravidade].ordem - GRAVIDADE[b.gravidade].ordem || new Date(b.quando).getTime() - new Date(a.quando).getTime())
}

function detalhesTexto(s: SinalRadar): string[] {
  const d = s.detalhes
  const l: string[] = []
  if (d.regioes) l.push(`Lugares: ${d.regioes[0]} e ${d.regioes[1]}`)
  if (d.trocas !== undefined) l.push(`${d.trocas} trocas${d.dias ? ` em ${d.dias} dias` : ''}`)
  if (d.tentativas !== undefined) l.push(`${d.tentativas} ${d.tentativas === 1 ? 'tentativa' : 'tentativas'}`)
  if (d.dispositivo_hash) l.push(`Dispositivo (código curto): ${String(d.dispositivo_hash).slice(0, 8)}`)
  return l
}

/** Aba "Radar": sinais suspeitos de pirataria ou compartilhamento de licença. O servidor decide; aqui só se olha e se dá baixa. */
function Radar({ api }: { api: AdminApi }) {
  const buscar = useCallback(async () => {
    const r = await api.radarPirataria()
    return r.ok ? ({ ok: true, v: r.radar } as const) : r
  }, [api])
  const { dado, erro, recarregar } = useCarga<RadarPirataria>(buscar)
  const [tipo, setTipo] = useState<'todos' | TipoSinal>('todos')
  const [grav, setGrav] = useState<'todas' | GravidadeSinal>('todas')
  const [aberto, setAberto] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const baixa = async (id: string) => {
    const r = await api.resolverSinalRadar(id)
    setMsg(r.ok ? 'Pronto, marquei como verificado.' : r.mensagem)
    if (r.ok) await recarregar()
  }
  const visiveis = dado ? ordenarSinais(dado.sinais.filter((x) => (tipo === 'todos' || x.tipo === tipo) && (grav === 'todas' || x.gravidade === grav))) : []
  const agora = new Date()
  return (
    <>
      <div className="ad-titulo"><h1>Radar</h1><span className="ad-mute">sinais de licença compartilhada ou pirateada</span></div>
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {!dado && !erro && <p role="status" className="ad-mute">Carregando os sinais…</p>}
      {dado && !dado.ligado && (
        <section className="ad-card" aria-label="Radar ainda não ligado">
          <span className="ad-rotulo">AINDA NÃO LIGADO</span>
          <p className="ad-p">{dado.mensagem ?? 'O Radar ainda está sendo ligado no servidor.'}</p>
          <p className="ad-mute2">Enquanto isso, nenhum sinal é mostrado: prefiro não inventar número.</p>
        </section>
      )}
      {dado?.ligado && (
        <>
          <div className="ad-kpis ad-kpis--radar" role="group" aria-label="Resumo do Radar">
            <div className={`ad-kpi ${dado.resumo.licencas_sob_suspeita > 0 ? 'ad-kpi--aviso' : ''}`}><span className="ad-kpi-nome">Licenças sob suspeita</span><span className="ad-kpi-v">{dado.resumo.licencas_sob_suspeita}</span><span className="ad-mute2">com pelo menos um sinal aberto</span></div>
            <div className="ad-kpi"><span className="ad-kpi-nome">Sinais abertos</span><span className="ad-kpi-v">{dado.resumo.sinais_abertos}</span><span className="ad-mute2">ainda sem a sua conferência</span></div>
            {TIPOS_SINAL.map((t) => (
              <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? 'todos' : t)} className={`ad-kpi ad-kpi--botao ${tipo === t ? 'ad-kpi--ativo' : ''}`}>
                <span className="ad-kpi-nome">{TIPO_SINAL[t]}</span><span className="ad-kpi-v">{dado.resumo.por_tipo[t]}</span><span className="ad-mute2">{tipo === t ? 'filtrando (clique para limpar)' : 'clique para filtrar'}</span>
              </button>
            ))}
          </div>
          {msg && <p role="status" className="ad-aviso-msg">{msg}</p>}
          <section className="ad-card" aria-label="Sinais">
            <span className="ad-rotulo">SINAIS</span>
            <div className="ad-filtro">
              <label className="ad-campo-data">Mostrar
                <select value={tipo} onChange={(e) => setTipo(e.target.value as 'todos' | TipoSinal)}>
                  <option value="todos">Todos os tipos</option>
                  {TIPOS_SINAL.map((t) => <option key={t} value={t}>{TIPO_SINAL[t]}</option>)}
                </select>
              </label>
              <label className="ad-campo-data">Gravidade
                <select value={grav} onChange={(e) => setGrav(e.target.value as 'todas' | GravidadeSinal)}>
                  <option value="todas">Todas</option>
                  <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
                </select>
              </label>
            </div>
            <p aria-live="polite" className="ad-mute2">{visiveis.length === dado.sinais.length ? `${dado.sinais.length} ${dado.sinais.length === 1 ? 'sinal' : 'sinais'}` : `${visiveis.length} de ${dado.sinais.length} sinais`}</p>
            {dado.sinais.length === 0 && <p className="ad-mute">Nenhum sinal por enquanto. Tudo calmo.</p>}
            {dado.sinais.length > 0 && visiveis.length === 0 && <p className="ad-mute">Nenhum sinal com esse filtro. Tente outro.</p>}
            {visiveis.map((s) => {
              const g = GRAVIDADE[s.gravidade]
              const det = detalhesTexto(s)
              const exp = aberto === s.id
              return (
                <article key={s.id} className="ad-sinal" aria-label={`${TIPO_SINAL[s.tipo]} — ${s.cliente}`}>
                  <div className="ad-sinal-topo">
                    <span className={`ad-st ${g.classe}`}>Gravidade {g.texto.toLowerCase()}</span>
                    <span className="ad-alerta-tipo">{TIPO_SINAL[s.tipo]}</span>
                    <span className="ad-mute2">{quandoFoi(s.quando, agora)}</span>
                  </div>
                  <b>{s.cliente}</b>
                  <p className="ad-p">{s.descricao}</p>
                  {exp && (
                    <ul className="ad-sinal-det" aria-label="Detalhes do sinal">
                      {det.map((t) => <li key={t}>{t}</li>)}
                      <li>{s.licenca_id ? `Licença: ${s.licenca_id}` : 'Sem licença: é gente que ainda não comprou.'}</li>
                    </ul>
                  )}
                  <div className="ad-linha">
                    <button type="button" className="ad-link" aria-expanded={exp} aria-label={`${exp ? 'Esconder' : 'Ver'} detalhes de ${s.cliente}`} onClick={() => setAberto(exp ? null : s.id)}>{exp ? 'Esconder detalhes' : 'Ver detalhes'}</button>
                    <button type="button" className="ad-link ad-link--mudo" aria-label={`Já verifiquei o sinal de ${s.cliente}`} onClick={() => baixa(s.id)}>Já verifiquei</button>
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}
    </>
  )
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
/** Parece uma marca inteira (HMAC de 24 caracteres)? Então vale perguntar ao servidor, que acha também as entregas antigas. */
export const pareceMarcaInteira = (t: string) => /^[A-Za-z0-9+/_=-]{16,}$/.test(t.trim())
const mesmaEntrega = (a: LinhaEntrega, b: LinhaEntrega) => a.licenca_id === b.licenca_id && a.obra_id === b.obra_id && a.marca_dagua === b.marca_dagua && a.baixado_em === b.baixado_em

function DadosDoCliente({ licencaId, clientes, cadastros }: { licencaId: string; clientes: LinhaCliente[]; cadastros: LinhaCadastro[] }) {
  const cli = clientes.find((x) => x.licenca_id === licencaId)
  const cad = cadastros.find((x) => x.licenca_id === licencaId)
  const nome = cli?.nome ?? cad?.nome
  if (!cli && !cad) return <p className="ad-p" role="status">Não achei os dados deste cliente na lista. A licença é <code className="ad-marca-cod">{licencaId}</code>.</p>
  return (
    <div className="ad-cli-ficha" role="group" aria-label={`Dados de ${nome ?? licencaId}`}>
      <ul className="ad-sinal-det">
        <li>Nome: {nome || '—'}</li>
        <li>Empresa: {(cli?.empresa ?? cad?.empresa) || '—'}</li>
        <li>Ramo: {(cli?.ramo ?? cad?.ramo) || '—'}</li>
        <li>Situação: {cli ? SITUACAO[cli.situacao].texto : '—'}</li>
        <li>E-mail: {cad?.email || '—'}</li>
      </ul>
      <p className="ad-p">Próximo passo: <b>fale com este cliente</b>. Pergunte com calma como esse arquivo foi parar fora do lugar e peça que ele não compartilhe o kit.</p>
    </div>
  )
}

function Entregas({ api }: { api: AdminApi }) {
  const [texto, setTexto] = useState('')
  const [extras, setExtras] = useState<LinhaEntrega[]>([])
  const [avisoBusca, setAvisoBusca] = useState('')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [clientes, setClientes] = useState<LinhaCliente[]>([])
  const [cadastros, setCadastros] = useState<LinhaCadastro[]>([])
  const buscar = useCallback(async () => {
    const r = await api.entregas({})
    return r.ok ? ({ ok: true, v: r.entregas ?? [] } as const) : r
  }, [api])
  const { dado, erro } = useCarga<LinhaEntrega[]>(buscar)
  useEffect(() => {
    let vivo = true
    api.painel().then((r) => { if (vivo && r.ok) setClientes(r.painel.clientes ?? []) }).catch(() => undefined)
    api.cadastros().then((r) => { if (vivo && r.ok) setCadastros(r.cadastros ?? []) }).catch(() => undefined)
    return () => { vivo = false }
  }, [api])

  const procurar = async () => {
    const t = texto.trim()
    setAvisoBusca('')
    if (!pareceMarcaInteira(t)) { setExtras([]); return }
    const r = await api.entregas({ marca: t })
    if (r.ok) setExtras(r.entregas ?? [])
    else setAvisoBusca(`Não consegui conferir essa marca no servidor agora (${r.mensagem}). Mostro só o que já estava na lista.`)
  }
  const limpar = () => { setTexto(''); setExtras([]); setAvisoBusca('') }

  const base = dado ?? []
  const todas = [...base, ...extras.filter((x) => !base.some((y) => mesmaEntrega(x, y)))]
  const q = semAcento(texto)
  const mostradas = !q ? todas : todas.filter((e) => {
    const cli = clientes.find((x) => x.licenca_id === e.licenca_id)
    return [e.cliente, e.obra_id, e.marca_dagua, cli?.nome ?? '', cli?.empresa ?? ''].some((c) => semAcento(c).includes(q))
  })
  const alternar = (id: string) => setAbertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <>
      <div className="ad-titulo"><h1>Marca d&rsquo;água</h1><span className="ad-mute">cada arquivo do kit sai com a marca do cliente</span></div>
      <form className="ad-card ad-busca" onSubmit={(e) => { e.preventDefault(); void procurar() }}>
        <CampoFalado rotulo="Buscar por cliente, obra ou marca" valor={texto} onChange={(v) => { setTexto(v); setAvisoBusca('') }} placeholder="Nome do cliente, da obra ou a marca (inteira ou um pedaço)" ajuda="Serve para descobrir de qual cliente saiu um arquivo que apareceu fora do lugar. Não precisa de acento nem de maiúscula." />
        <div className="ad-linha">
          <button type="submit" className="ad-botao ad-botao--lime">Procurar</button>
          {(texto || extras.length > 0) && <button type="button" className="ad-botao" onClick={limpar}>Limpar e ver as últimas entregas</button>}
        </div>
        <details className="ad-ajuda-marca">
          <summary>Onde encontro a marca?</summary>
          <div className="ad-p">
            <p>A marca é um código de 24 letras e números, único de cada cliente. Por exemplo: <code className="ad-marca-cod">k3Zt9QpL0aXv7RmB2yHcN5dE</code></p>
            <ul className="ad-sinal-det">
              <li>No app do cliente: no rodapé, repetido assim: &ldquo;Nome do cliente · código&rdquo;.</li>
              <li>No topo dos arquivos de código: a linha <code className="ad-marca-cod">const ATLAS_LICENCA = &apos;...&apos;</code> e o comentário &ldquo;licenciado a &lt;nome&gt;&rdquo;.</li>
              <li>Em arquivos JSON: o campo <code className="ad-marca-cod">&quot;_marca&quot;</code>.</li>
              <li>Em páginas HTML: a linha <code className="ad-marca-cod">&lt;meta name=&quot;atlas-licenca&quot;&gt;</code>.</li>
            </ul>
            <p>Copie o código e cole aqui em cima. Se achar só um pedaço, pode colar o pedaço também.</p>
          </div>
        </details>
      </form>
      {avisoBusca && <p role="status" className="ad-mute">{avisoBusca}</p>}
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {dado && (
        <section className="ad-card" aria-label="Entregas">
          <p className="ad-mute" role="status">{q ? `Mostrando ${mostradas.length} de ${todas.length} entregas.` : `Mostrando as últimas ${todas.length} entregas.`}</p>
          <div className="ad-tabela ad-tabela--ent ad-tabela--cab"><span>Cliente</span><span>Obra</span><span>Marca d&rsquo;água</span><span>Baixado em</span></div>
          {mostradas.map((e) => {
            const chave = `${e.marca_dagua}|${e.licenca_id}|${e.obra_id}|${e.baixado_em}`
            const aberto = abertos.has(chave)
            return (
              <div key={chave} className="ad-entrega">
                <div className="ad-tabela ad-tabela--ent">
                  <b>{e.cliente}</b><span>{e.obra_id}</span><code className="ad-marca-cod">{e.marca_dagua}</code><span className="ad-mute">{dia(e.baixado_em)}</span>
                </div>
                <div className="ad-linha">
                  <button type="button" className="ad-link" aria-expanded={aberto} aria-label={`${aberto ? 'Esconder' : 'Ver'} o cliente ${e.cliente}`} onClick={() => alternar(chave)}>{aberto ? 'Esconder este cliente' : 'Ver este cliente'}</button>
                </div>
                {aberto && <DadosDoCliente licencaId={e.licenca_id} clientes={clientes} cadastros={cadastros} />}
              </div>
            )
          })}
          {mostradas.length === 0 && <p className="ad-mute">{q ? 'Nada encontrado com esse texto. Confira a grafia ou cole a marca inteira.' : 'Ainda não houve entregas.'}</p>}
        </section>
      )}
    </>
  )
}

const mesCurto = (aaaamm: string) => new Date(`${aaaamm}-15T12:00:00-03:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('.', '')

function FluxoCaixa({ api }: { api: AdminApi }) {
  const buscar = useCallback(async () => {
    const r = await api.fluxoCaixa()
    return r.ok ? ({ ok: true, v: r.fluxo } as const) : r
  }, [api])
  const { dado, erro } = useCarga<FluxoCaixaDado>(buscar)
  const meses = dado ? fluxoPorMes(dado, 6) : []
  const maior = Math.max(1, ...meses.map((m) => m.total))
  const atual = meses[meses.length - 1]
  const anterior = meses[meses.length - 2]
  return (
    <>
      <div className="ad-titulo"><h1>Fluxo de caixa</h1><span className="ad-mute">o dinheiro que entrou, mês a mês</span></div>
      {erro && <p role="status" className="ad-aviso-msg">{erro}</p>}
      {!dado && !erro && <p role="status" className="ad-mute">Carregando…</p>}
      {dado && meses.length === 0 && <p className="ad-mute">Ainda não entrou dinheiro registrado.</p>}
      {dado && atual && (
        <>
          <p className="ad-p">Por enquanto só mostramos o que <b>entra</b>: implantações, apps prontos da prateleira e mensalidades. As saídas (despesas) entram numa próxima etapa.
            {anterior && <> Em {mesCurto(atual.mes)} entrou <b>{dinheiro(atual.total)}</b>, {atual.total >= anterior.total ? 'mais' : 'menos'} que em {mesCurto(anterior.mes)} ({dinheiro(anterior.total)}).</>}</p>
          <section className="ad-card" aria-label="Gráfico dos últimos meses">
            <span className="ad-rotulo">ÚLTIMOS {meses.length} MESES</span>
            <div className="ad-barras" role="img" aria-label={`Entradas por mês: ${meses.map((m) => `${mesCurto(m.mes)} ${dinheiro(m.total)}`).join('; ')}`}>
              {meses.map((m) => (
                <div key={m.mes} className="ad-barra-col">
                  <span className="ad-mute2">{dinheiro(m.total)}</span>
                  <div className="ad-barra" style={{ height: `${Math.max(4, Math.round((m.total / maior) * 100))}%` }} />
                  <span className="ad-mute2">{mesCurto(m.mes)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="ad-card" aria-label="Entradas por mês">
            <div className="ad-tabela ad-tabela--caixa ad-tabela--cab"><span>Mês</span><span>Implantações</span><span>Prateleira</span><span>Mensalidades</span><span>Total</span></div>
            {[...meses].reverse().map((m) => (
              <div key={m.mes} className="ad-tabela ad-tabela--caixa">
                <b>{mesCurto(m.mes)}</b><span>{dinheiro(m.implantacoes)}</span><span>{dinheiro(m.prateleira)}</span><span>{dinheiro(m.mensalidades)}</span><b>{dinheiro(m.total)}</b>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  )
}

const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%')

/** Aba "Mapa": onde os clientes estão, por estado, pra saber onde vale mirar o tráfego. Só agregado por UF. */
function Mapa({ api }: { api: AdminApi }) {
  const buscar = useCallback(async () => {
    const r = await api.mapaClientes()
    return r.ok ? ({ ok: true, v: r.mapa } as const) : r
  }, [api])
  const { dado, erro } = useCarga<MapaClientes>(buscar)
  const [ativo, setAtivo] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const destaque = ativo ?? escolhido
  const r = dado?.ligado ? resumirMapa(dado.por_uf) : null
  const linhaAtiva = destaque && dado ? dado.por_uf.find((l) => l.uf === destaque) : null
  const escolher = (uf: string) => setEscolhido((x) => (x === uf ? null : uf))
  return (
    <>
      <div className="ad-titulo"><h1>Mapa</h1><span className="ad-mute">onde estão os seus clientes, estado por estado</span></div>
      {erro && <p role="alert" className="ad-erro">{erro}</p>}
      {!dado && !erro && <p role="status" className="ad-mute">Carregando o mapa…</p>}
      {dado && !dado.ligado && (
        <section className="ad-card" aria-label="Mapa ainda não ligado">
          <span className="ad-rotulo">AINDA NÃO LIGADO</span>
          <p className="ad-p">{dado.mensagem ?? 'O Mapa ainda está sendo ligado no servidor.'}</p>
          <p className="ad-mute2">Enquanto isso, nenhum estado é pintado: prefiro não inventar número.</p>
        </section>
      )}
      {dado?.ligado && r && (
        <>
          <div className="ad-kpis ad-kpis--radar" role="group" aria-label="Resumo do mapa">
            <div className="ad-kpi"><span className="ad-kpi-nome">Clientes no mapa</span><span className="ad-kpi-v">{dado.total}</span><span className="ad-mute2">em {r.ranking.length} {r.ranking.length === 1 ? 'estado' : 'estados'}</span></div>
            <div className="ad-kpi ad-kpi--lime"><span className="ad-kpi-nome">Estado líder</span><span className="ad-kpi-v">{r.lider ? r.lider.uf : '—'}</span><span className="ad-mute2">{r.lider ? `${nomeUf(r.lider.uf)}: ${pct(r.lider.clientes, dado.total)} dos clientes` : 'ainda sem clientes'}</span></div>
            <div className="ad-kpi"><span className="ad-kpi-nome">Região líder</span><span className="ad-kpi-v">{r.regiaoLider ? NOME_REGIAO[r.regiaoLider.regiao] : '—'}</span><span className="ad-mute2">{r.regiaoLider ? `${pct(r.regiaoLider.clientes, dado.total)} dos clientes` : 'ainda sem clientes'}</span></div>
          </div>
          <div className="ad-mapa-grade">
            <section className="ad-card" aria-label="Mapa do Brasil">
              <span className="ad-rotulo">CLIENTES POR ESTADO</span>
              <MapaBrasil por_uf={dado.por_uf} maximo={r.maximo} ativo={destaque} onAtivo={setAtivo} onEscolher={escolher} />
              <p className="ad-mapa-info" aria-live="polite">{linhaAtiva ? `${nomeUf(linhaAtiva.uf)} — ${textoUf(linhaAtiva)}` : 'Passe o mouse (ou use a tecla Tab) sobre um estado para ver os números.'}</p>
              <LegendaMapa maximo={r.maximo} />
            </section>
            <div className="ad-mapa-lado">
              <section className="ad-card" aria-label="Ranking por estado">
                <span className="ad-rotulo">RANKING POR ESTADO</span>
                {r.ranking.length === 0 && <p className="ad-mute">Nenhum cliente com estado registrado ainda.</p>}
                <ol className="ad-rank">
                  {r.ranking.map((l) => (
                    <li key={l.uf}>
                      <button type="button" className={`ad-rank-linha ${destaque === l.uf ? 'ad-rank-linha--ativa' : ''}`} aria-pressed={escolhido === l.uf} aria-label={`${nomeUf(l.uf)}: ${textoUf(l)}, ${pct(l.clientes, dado.total)} do total`} onClick={() => escolher(l.uf)} onMouseEnter={() => setAtivo(l.uf)} onMouseLeave={() => setAtivo(null)}>
                        <b>{l.uf}</b><span className="ad-rank-barra" aria-hidden="true"><i style={{ width: `${Math.max(4, Math.round((l.clientes / r.maximo) * 100))}%` }} /></span>
                        <span>{l.clientes}</span><span className="ad-mute2">{pct(l.clientes, dado.total)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {r.semCliente > 0 && r.ranking.length > 0 && <p className="ad-mute2">{r.semCliente} {r.semCliente === 1 ? 'estado ainda sem cliente' : 'estados ainda sem cliente'}: bom lugar para testar um anúncio.</p>}
              </section>
              <section className="ad-card" aria-label="Resumo por região">
                <span className="ad-rotulo">POR REGIÃO</span>
                <ul className="ad-rank">
                  {r.regioes.map((g) => (
                    <li key={g.regiao} className="ad-rank-linha ad-rank-linha--reg">
                      <b>{NOME_REGIAO[g.regiao]}</b><span className="ad-rank-barra" aria-hidden="true"><i style={{ width: `${g.clientes > 0 ? Math.max(4, Math.round((g.clientes / (r.regioes[0].clientes || 1)) * 100)) : 0}%` }} /></span>
                      <span>{g.clientes}</span><span className="ad-mute2">{pct(g.clientes, dado.total)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  )
}
