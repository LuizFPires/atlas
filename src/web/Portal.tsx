import { useEffect, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { juntarFalaEmail } from './compra'
import type { ContaPortal, PerfilPortal, PortalApi } from './portal-api'
import './web.css'

/** Portal do cliente (F15) em /conta: login próprio do Atlas (e-mail + código), independente do login do Claude. */
export function Portal({ api }: { api: PortalApi }) {
  const [perfil, setPerfil] = useState<PerfilPortal | null>(null)
  const [carregando, setCarregando] = useState(api.logado())
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!api.logado()) return
    let vivo = true
    api.eu().then((r) => {
      if (!vivo) return
      if (r.ok) setPerfil(r.perfil)
      else setAviso(r.mensagem)
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [api])

  const sair = () => { api.sair(); setPerfil(null); setAviso('') }
  const rotulo = perfil ? [perfil.nome, perfil.empresa].filter(Boolean).join(' · ') : ''

  return (
    <div className="c">
      <header className="c-topo">
        <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        <span>atlas-ia.app.br/conta</span>
        {perfil && <span className="p-quem">{rotulo}</span>}
        {perfil && <button type="button" className="p-sair" onClick={sair}>Sair</button>}
      </header>
      {carregando ? (
        <main className="p-main"><p className="c-lead" role="status">Abrindo a sua conta…</p></main>
      ) : perfil ? (
        <Conta api={api} />
      ) : (
        <Entrada api={api} aviso={aviso} onEntrou={(p) => setPerfil(p)} />
      )}
    </div>
  )
}

function Entrada({ api, aviso, onEntrou }: { api: PortalApi; aviso: string; onEntrou: (p: PerfilPortal) => void }) {
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [erro, setErro] = useState(aviso)
  const [ocupado, setOcupado] = useState(false)

  const pedir = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro(''); setOcupado(true)
    const r = await api.pedirCodigoLogin(email)
    setOcupado(false)
    if (r.ok) setEtapa('codigo')
    else setErro(r.mensagem)
  }
  const confirmar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro(''); setOcupado(true)
    const r = await api.entrar(email, codigo)
    if (!r.ok) { setOcupado(false); setErro(r.mensagem); return }
    const eu = await api.eu()
    setOcupado(false)
    if (eu.ok) onEntrou(eu.perfil)
    else { api.sair(); setErro(eu.mensagem) }
  }

  return (
    <main className="p-entrada">
      <form className="c-form p-form" onSubmit={etapa === 'email' ? pedir : confirmar} noValidate>
        <span className="c-ok"><Icone nome="check" tamanho={26} /></span>
        <h1>Entrar na minha conta</h1>
        {etapa === 'email' ? (
          <>
            <p className="c-lead">Use o e-mail que você usou na compra. A gente manda um código de 6 números para ele. Não precisa de senha.</p>
            <CampoFalado rotulo="Qual o seu e-mail?" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="voce@suaempresa.com.br" juntar={juntarFalaEmail} />
          </>
        ) : (
          <>
            <p className="c-lead">Mandamos um código para o seu e-mail. Digite os números aqui. Ele vale por alguns minutos.</p>
            <CampoFalado rotulo="Código que chegou no e-mail" valor={codigo} onChange={(v) => setCodigo(v.replace(/[^\d\s]/g, ''))} placeholder="000000" autoComplete="one-time-code" />
          </>
        )}
        {erro && <p role="alert" className="v-erro">{erro}</p>}
        <button type="submit" className="v-acao" disabled={ocupado}>
          {ocupado ? 'Um instante…' : etapa === 'email' ? <>Receber o código <Icone nome="seta" /></> : <>Entrar <Icone nome="seta" /></>}
        </button>
        {etapa === 'codigo' && (
          <button type="button" className="p-link" onClick={() => { setEtapa('email'); setCodigo(''); setErro('') }}>Usar outro e-mail ou pedir um novo código</button>
        )}
        <span className="c-mute" style={{ fontSize: 13, lineHeight: 1.5 }}>Esta conta é só sua: ela mostra apenas a sua licença e os seus pagamentos. Qualquer dúvida, a Ajuda do Atlas te guia.</span>
      </form>
    </main>
  )
}

const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')
const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const STATUS_LICENCA = {
  ativa: 'Ativa',
  atrasada: 'Pagamento atrasado',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
} as const
const STATUS_PAGAMENTO = { pago: 'Pago', pendente: 'Aguardando', falhou: 'Não passou', estornado: 'Devolvido' } as const

/** Tela principal (F15): licença, computador com a licença e pagamentos. Tudo vem do servidor, já escopado pelo login. */
function Conta({ api }: { api: PortalApi }) {
  const [conta, setConta] = useState<ContaPortal | null>(null)
  const [erro, setErro] = useState('')
  const [fora, setFora] = useState(false)

  useEffect(() => {
    let vivo = true
    api.conta().then((r) => {
      if (!vivo) return
      if (r.ok) setConta(r.conta); else { setErro(r.mensagem); setFora(!api.logado()) }
    })
    return () => { vivo = false }
  }, [api])

  if (fora) return <main className="p-main"><p role="alert" className="v-erro">{erro} Atualize a página para entrar de novo.</p></main>
  if (!conta) return <main className="p-main">{erro ? <p role="alert" className="v-erro">{erro}</p> : <p className="c-lead" role="status">Abrindo a sua conta…</p>}</main>
  return <ContaTela api={api} conta={conta} erro={erro} />
}

function ContaTela({ api, conta, erro }: { api: PortalApi; conta: ContaPortal; erro: string }) {
  const { licenca: l } = conta
  const [msgPag, setMsgPag] = useState('')
  const mudarPagamento = async () => {
    setMsgPag('')
    const r = await api.formaPagamento()
    if (r.ok) window.location.assign(r.url)
    else setMsgPag(r.mensagem)
  }
  const ativa = l.status === 'ativa'
  return (
    <main className="p-main">
      <h1>Minha conta</h1>
      {erro && <p role="alert" className="v-erro">{erro}</p>}
      <div className="p-grade">
        <section className="p-card" aria-labelledby="p-lic">
          <span className="v-mono p-rotulo" id="p-lic">Licença</span>
          <span className={`p-selo${ativa ? '' : ' p-selo--aviso'}`}>● {STATUS_LICENCA[l.status]}</span>
          {l.comprada_em && <span className="c-mute">Implantação paga em {dia(l.comprada_em)}</span>}
          <span className="c-mute">Manutenção: <b className="p-forte">{dinheiro(l.mensalidade_valor)}/mês</b></span>
          {l.mensalidade_encerra_em ? (
            <span className="c-mute">Mensalidade cancelada. Sua licença vale até <b className="p-forte">{dia(l.mensalidade_encerra_em)}</b>.</span>
          ) : l.proxima_cobranca_em ? (
            <span className="c-mute">Próxima cobrança: {dia(l.proxima_cobranca_em)}</span>
          ) : null}
          {l.pode_mudar_pagamento && <button type="button" className="p-link p-fim" onClick={mudarPagamento}>Trocar forma de pagamento</button>}
          {msgPag && <span role="alert" className="v-erro">{msgPag}</span>}
        </section>

        <section className="p-card p-larga" aria-labelledby="p-pc">
          <span className="v-mono p-rotulo" id="p-pc">Computador com a licença</span>
          {conta.computador ? (
            <div className="p-pc">
              <span className="p-pc-icone"><Icone nome="computador" tamanho={26} /></span>
              <div className="p-pc-txt"><b>Seu computador</b><span className="c-mute">Ativado em {dia(conta.computador.ativado_em)}</span></div>
            </div>
          ) : (
            <p className="c-mute p-p">Nenhum computador está com a licença agora.</p>
          )}
        </section>
      </div>

      <section className="p-card" aria-labelledby="p-pg">
        <span className="v-mono p-rotulo" id="p-pg">Pagamentos</span>
        {conta.pagamentos.length === 0 && <p className="c-mute p-p">Ainda não há pagamentos por aqui.</p>}
        {conta.pagamentos.map((p, i) => (
          <div className="p-pag" key={i}>
            <span className="p-pag-data">{dia(p.data)}</span>
            <span className="p-pag-desc">{p.descricao}</span>
            <b>{dinheiro(p.valor)}</b>
            <span className={`p-pag-st${p.status === 'pago' ? '' : ' p-pag-st--mute'}`}>{STATUS_PAGAMENTO[p.status]}</span>
          </div>
        ))}
        {l.proxima_cobranca_em && !l.mensalidade_encerra_em && (
          <div className="p-pag">
            <span className="p-pag-data">{dia(l.proxima_cobranca_em)}</span>
            <span className="p-pag-desc">Manutenção mensal</span>
            <b>{dinheiro(l.mensalidade_valor)}</b>
            <span className="p-pag-st p-pag-st--mute">Agendado</span>
          </div>
        )}
      </section>
    </main>
  )
}
