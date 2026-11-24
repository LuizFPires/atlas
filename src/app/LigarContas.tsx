import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import { LateralPassos } from './Ativacao'
import type { PonteNavegador, Retangulo } from './ponte-navegador'
import type { ContaLigavel, EstadoLigacao, PonteLigarContas } from './ponte-ligar-contas'
import './app.css'
import './claude.css'
import './contas.css'
import './ligar-contas.css'

/** As três contas, na ordem do protótipo (C1Contas). "Ligar a Vercel" e não "o Vercel": é a vitrine. */
const LINHAS: { id: ContaLigavel; nome: string; artigo: 'o' | 'a'; papel: string; tipo: 'codigo' | 'chave'; dica: { en: string; pt: string } }[] = [
  { id: 'github', nome: 'GitHub', artigo: 'o', papel: 'o cofre', tipo: 'codigo', dica: { en: 'Device Activation', pt: 'Ligar um aparelho' } },
  { id: 'supabase', nome: 'Supabase', artigo: 'o', papel: 'o caderno', tipo: 'chave', dica: { en: 'Generate new token', pt: 'Criar uma chave nova' } },
  { id: 'hosp', nome: 'Vercel', artigo: 'a', papel: 'a vitrine', tipo: 'codigo', dica: { en: 'Connect a device', pt: 'Ligar um aparelho' } },
]

type Linha = { estado: EstadoLigacao; usuario: string | null; codigo?: string; copiado?: boolean }

interface Props {
  ponte: PonteLigarContas
  onContinuar: () => void
  onVoltar: () => void
  /** Navegador dentro do Atlas: posiciona e fecha o site ao lado (só no Atlas instalado). */
  navegador?: PonteNavegador
  /** De quanto em quanto tempo o Atlas confere se a pessoa já confirmou no site. */
  sondagemMs?: number
  /** Texto do botão final (dentro de uma obra: "voltar à obra"). */
  rotuloContinuar?: string
}

const ret = (el: HTMLElement | null): Retangulo => {
  const r = el?.getBoundingClientRect()
  return { x: r?.left ?? 0, y: r?.top ?? 0, width: r?.width ?? 1, height: r?.height ?? 1 }
}

/**
 * C1 · Ligar as contas a este computador (aprovada pelo Luiz em 24/11/2026). Depois de criar as contas nos sites, o Atlas liga
 * cada uma aqui: GitHub e Vercel mostram um código que a pessoa cola no site ao lado; o Supabase pede uma chave colada aqui.
 * A pessoa nunca digita comando nem senha. O último passo só aparece com as três ligadas.
 */
export function LigarContas({ ponte, onContinuar, onVoltar, navegador, sondagemMs = 3000, rotuloContinuar = 'Tudo ligado · Último passo →' }: Props) {
  const [linhas, setLinhas] = useState<Record<ContaLigavel, Linha>>({ github: { estado: 'pendente', usuario: null }, supabase: { estado: 'pendente', usuario: null }, hosp: { estado: 'pendente', usuario: null } })
  const [chave, setChave] = useState('')
  const [avisoChave, setAvisoChave] = useState('')
  const [aviso, setAviso] = useState('')
  const [testando, setTestando] = useState(false)
  const area = useRef<HTMLDivElement>(null)

  const mudar = (c: ContaLigavel, l: Partial<Linha>) => setLinhas((x) => ({ ...x, [c]: { ...x[c], ...l } }))

  // Ao abrir: o que já está ligado (nas próximas obras, normalmente tudo).
  useEffect(() => {
    let vivo = true
    void ponte.situacao().then((s) => {
      if (!vivo) return
      setLinhas((x) => {
        const n = { ...x }
        for (const l of LINHAS) if (s[l.id].ligado) n[l.id] = { estado: 'ligado', usuario: s[l.id].usuario }
        return n
      })
    }, () => {})
    return () => { vivo = false }
  }, [ponte])

  // Enquanto alguma conta espera a confirmação no site, confere de tempos em tempos.
  const esperando = LINHAS.filter((l) => linhas[l.id].estado === 'esperando').map((l) => l.id).join(',')
  useEffect(() => {
    if (!esperando) return
    const ids = esperando.split(',') as ContaLigavel[]
    const t = setInterval(() => {
      for (const c of ids) {
        void ponte.estado(c).then(async (e) => {
          if (e === 'ligado') {
            const s = await ponte.situacao().catch(() => null)
            mudar(c, { estado: 'ligado', usuario: s?.[c].usuario ?? null })
          } else if (e === 'erro') mudar(c, { estado: 'erro' })
        }, () => {})
      }
    }, sondagemMs)
    return () => clearInterval(t)
  }, [esperando, ponte, sondagemMs])

  // Ao sair da tela: fecha o site ao lado e para logins pela metade.
  useEffect(() => () => {
    void navegador?.fechar().catch(() => {})
    for (const l of LINHAS) void ponte.cancelar(l.id).catch(() => {})
  }, [ponte, navegador])

  const ligar = async (c: ContaLigavel) => {
    setAviso('')
    if (c === 'supabase') {
      mudar(c, { estado: 'esperando' })
      try { await ponte.abrirChaves(ret(area.current)) } catch { /* sem site ao lado: o botão "abrir no meu navegador" resolve */ }
      return
    }
    mudar(c, { estado: 'esperando', codigo: undefined, copiado: false })
    try {
      const { codigo } = await ponte.ligar(c, ret(area.current))
      let copiado = false
      try { await navigator.clipboard?.writeText(codigo); copiado = true } catch { /* sem área de transferência: a pessoa copia da tela */ }
      mudar(c, { codigo, copiado })
    } catch {
      mudar(c, { estado: 'erro' })
      setAviso('Não consegui começar a ligação agora. Confira a internet e tente de novo.')
    }
  }

  const enviarChave = async () => {
    setAvisoChave('')
    setTestando(true)
    try {
      const r = await ponte.chaveSupabase(chave)
      if (r.ok) { setChave(''); mudar('supabase', { estado: 'ligado', usuario: null }) }
      else setAvisoChave(r.motivo === 'formato'
        ? 'Essa não parece a chave. A chave do Supabase começa com sbp_ e tem 44 letras e números. Copie de novo pelo botão de copiar do site.'
        : 'O Supabase não aceitou esta chave. Gere outra no site (Generate new token) e cole de novo.')
    } catch { setAvisoChave('Não consegui conferir a chave agora. Confira a internet e tente de novo.') } finally { setTestando(false) }
  }

  const feitas = LINHAS.filter((l) => linhas[l.id].estado === 'ligado').length
  const faltam = LINHAS.length - feitas
  const foco = LINHAS.find((l) => linhas[l.id].estado === 'esperando') ?? null

  return (
    <div className="at-ativ-fundo">
      <div className="at-ativ at-contas">
        <LateralPassos agora={4} />
        <section className="at-contas__corpo">
          <div className="at-claude__cab">
            <span className="at-claude__rotulo">AS CONTAS · LIGAR A ESTE COMPUTADOR · {feitas} DE 3</span>
            <h1>Agora o Atlas liga as suas contas a este computador.</h1>
            <span className="at-ativ__txt">Criar a conta no site não basta: o Atlas precisa da sua permissão para guardar, anotar e publicar o seu sistema daqui. É um clique em cada site.</span>
          </div>
          <div className="at-contas__grade at-contas__grade--nav">
            <div className="at-ligar__lista">
              {LINHAS.map((l) => {
                const x = linhas[l.id]
                const nomeCom = `${l.artigo} ${l.nome}`
                return (
                  <div key={l.id} className={`at-ligar__linha${x.estado === 'esperando' ? ' at-ligar__linha--ativa' : ''}`}>
                    <div className="at-ligar__topo">
                      <span className={`at-ligar__bola at-ligar__bola--${x.estado}`} aria-hidden="true">{x.estado === 'ligado' ? <Icone nome="check" tamanho={16} /> : x.estado === 'esperando' ? '…' : x.estado === 'erro' ? '!' : '○'}</span>
                      <div className="at-ligar__nome">
                        <b>{l.nome} <span>· {l.papel}</span></b>
                        <span className={x.estado === 'ligado' ? 'at-ligar__ok' : 'at-ligar__sub'}>
                          {x.estado === 'ligado' ? (x.usuario ? `Ligado como ${x.usuario}` : 'Ligado')
                            : x.estado === 'esperando' ? 'O Atlas abriu o site aqui ao lado'
                              : x.estado === 'erro' ? 'Não deu certo desta vez. Nada se perdeu.' : 'Ainda não ligado'}
                        </span>
                      </div>
                      {x.estado === 'pendente' && <Botao onClick={() => void ligar(l.id)} aria-label={`Ligar ${nomeCom}`}>Ligar →</Botao>}
                      {x.estado === 'erro' && <Botao onClick={() => void ligar(l.id)} aria-label={`Tentar de novo ${nomeCom}`}>Tentar de novo</Botao>}
                    </div>

                    {x.estado === 'esperando' && l.tipo === 'codigo' && (
                      <div className="at-ligar__caixa">
                        {x.codigo ? (
                          <>
                            <span>O site vai pedir este código. {x.copiado ? 'Já copiamos para você: é só colar lá' : 'Escreva lá'} e clicar em <b>Continue</b>.</span>
                            <div className="at-ligar__codigo"><span>{x.codigo}</span>{x.copiado && <em>✓ COPIADO</em>}</div>
                            <span className="at-ligar__espera" role="status"><span className="at-ligar__gira" aria-hidden="true" />Esperando você confirmar no site… o Atlas percebe sozinho.</span>
                          </>
                        ) : <span className="at-ligar__espera" role="status"><span className="at-ligar__gira" aria-hidden="true" />Preparando o código…</span>}
                        <button type="button" className="at-ativ__link" onClick={() => void ponte.siteFora(l.id)}>Abrir no meu navegador</button>
                      </div>
                    )}

                    {x.estado === 'esperando' && l.tipo === 'chave' && (
                      <div className="at-ligar__caixa">
                        <span>No site ao lado, clique em <b>Generate new token</b>, escreva <b>Atlas</b> no nome, clique em <b>Generate token</b> e copie a chave. Depois cole aqui.</span>
                        <span className="at-ligar__trad"><b>{l.dica.en}</b> quer dizer <b>"{l.dica.pt}"</b></span>
                        <div className="at-ligar__campo">
                          <label htmlFor="chave-supabase" className="at-ligar__oculto">Chave do Supabase</label>
                          <input id="chave-supabase" type="password" autoComplete="off" spellCheck={false} placeholder="sbp_…" value={chave} onChange={(e) => setChave(e.target.value)} />
                          <Botao onClick={() => void enviarChave()} disabled={!chave.trim() || testando}>{testando ? 'Conferindo…' : 'Pronto'}</Botao>
                        </div>
                        {avisoChave && <p className="at-ativ__erro" role="alert">{avisoChave}</p>}
                        <span className="at-ativ__txt">A chave fica guardada no cofre do Windows, nunca num arquivo. Dá para apagar quando quiser, no próprio site.</span>
                        <button type="button" className="at-ativ__link" onClick={() => void ponte.siteFora('supabase')}>Abrir no meu navegador</button>
                      </div>
                    )}
                  </div>
                )
              })}
              {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
              <div className="at-ativ__rodape at-claude__acoes">
                <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
                {faltam === 0
                  ? <Botao onClick={onContinuar}>{rotuloContinuar}</Botao>
                  : <span className="at-ativ__txt">{faltam === 1 ? 'Falta 1 conta' : `Faltam ${faltam} contas`}. Sem elas o Atlas constrói, mas não consegue guardar nem publicar.</span>}
              </div>
            </div>
            <div className="at-ligar__site">
              <span className="at-ativ__txt">{foco ? `O site ${foco.artigo === 'a' ? 'da' : 'do'} ${foco.nome}, aberto dentro do Atlas:` : 'O site de cada conta abre aqui quando você clicar em Ligar.'}</span>
              <div ref={area} className="at-ligar__area" aria-hidden={!foco}>
                {!foco && <span className="at-ativ__txt">Você nunca digita comando nem senha aqui. O Atlas só recebe a permissão que você der no site.</span>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
