import { useRef, useState } from 'react'
import { AVISO_EMAIL } from '../ui/aviso-email'
import { Botao, CampoFalado, Icone, Microfone, useVoz, type NomeIcone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { juntarFalaEmail } from '../web/compra'
import './app.css'

/** O que a tela precisa do servidor de licenças (S4): quem implementa fica em ativacao-api.ts. */
export interface AtivacaoTela {
  pedirCodigo(email: string): Promise<{ ok: true } | { ok: false; mensagem: string }>
  confirmar(email: string, codigo: string): Promise<{ ok: true; nome: string } | { ok: false; mensagem: string }>
}

export type FaseAtivacao = 'email' | 'codigo' | 'instalando'

/** Progresso da instalação (vem do instalador, M8). Sem dado, a barra fica em "preparando". */
export interface ProgressoInstalacao { percentual: number; restante: string }

const PASSOS = ['Confirmar e-mail', 'Instalar', 'Conectar o Claude', 'Abrir as contas', 'Acompanhar pelo celular']

const NUMEROS: Record<string, string> = { zero: '0', um: '1', uma: '1', dois: '2', duas: '2', tres: '3', três: '3', quatro: '4', cinco: '5', seis: '6', sete: '7', oito: '8', nove: '9' }

/** "quatro oito dois zero sete um" -> "482071". Aceita também números já escritos. */
export function falaParaCodigo(t: string): string {
  return t.toLowerCase().split(/[\s,.-]+/).map((p) => NUMEROS[p] ?? p.replace(/\D/g, '')).join('').slice(0, 6)
}

export const DICAS: { icone: NomeIcone; titulo: string; texto: string }[] = [
  { icone: 'microfone', titulo: 'Aqui tudo pode ser falado.', texto: 'Em qualquer pergunta, aperte o microfone e converse como se estivesse com um amigo na mesa de um restaurante. Não precisa falar certo.' },
  { icone: 'computador', titulo: 'Este computador é o seu canteiro.', texto: 'É nele que a obra acontece. Deixe ligado durante a obra e acompanhe tudo pelo app do Claude no celular.' },
  { icone: 'pasta', titulo: 'Suas obras ficam numa pasta só.', texto: 'O Atlas criou a pasta Atlas\\Obras e um atalho na Área de Trabalho. Você não precisa mexer em nada lá.' },
]

interface Props {
  api: AtivacaoTela
  /** "DESKTOP-ZE · Windows 11" */
  computador: string
  faseInicial?: FaseAtivacao
  emailInicial?: string
  progresso?: ProgressoInstalacao | null
  /** Depois da ativação o cliente segue para F03 (Claude, M10). */
  onContinuar: () => void
  /** Avisa o app que a instalação começou (para impedir o computador de dormir). */
  onInstalando?: (instalando: boolean) => void
}

/** Lateral escura com os 5 passos de começar (F02 e F03 usam a mesma). `agora` é o passo atual (1 a 5). */
export function LateralPassos({ agora }: { agora: number }) {
  return (
    <aside className="at-ativ__lado">
      <div className="at-ativ__marca"><Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} /></div>
      <ol className="at-ativ__passos">
        {PASSOS.map((p, i) => {
          const n = i + 1
          const feito = n < agora
          const atual = n === agora
          return (
            <li key={p} className={`at-ativ__passo ${atual ? 'at-ativ__passo--atual' : ''}`} aria-current={atual ? 'step' : undefined}>
              <span className={`at-ativ__bola ${feito || atual ? 'at-ativ__bola--on' : ''}`}>{feito ? <Icone nome="check" tamanho={16} /> : n}</span>
              {p}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

/** F02: instalar e ativar. E-mail da compra -> código de 6 números -> instalação com as 3 dicas (prototipo/F02Ativacao). */
export function Ativacao({ api, computador, faseInicial = 'email', emailInicial = '', progresso = null, onContinuar, onInstalando }: Props) {
  const [fase, setFase] = useState<FaseAtivacao>(faseInicial)
  const [email, setEmail] = useState(emailInicial)
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const voz = useVoz((falado) => setCodigo(falaParaCodigo(falado)))

  const agora = fase === 'instalando' ? 2 : 1
  const resolver = async <T extends { ok: boolean }>(p: Promise<T>): Promise<T | null> => {
    setErro(''); setAviso(''); setOcupado(true)
    try { return await p } finally { setOcupado(false) }
  }

  const pedir = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const r = await resolver(api.pedirCodigo(email))
    if (!r) return
    if (!r.ok) return setErro(r.mensagem)
    setCodigo('')
    if (fase === 'codigo') setAviso('Mandamos um código novo. Ele vale por 10 minutos.')
    setFase('codigo')
  }
  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await resolver(api.confirmar(email, codigo))
    if (!r) return
    if (!r.ok) return setErro(r.mensagem)
    setNome(r.nome)
    setFase('instalando')
    onInstalando?.(true)
  }

  return (
    <div className="at-ativ-fundo">
      <div className="at-ativ">
        <LateralPassos agora={agora} />


        <section className="at-ativ__corpo">
          {fase === 'email' && (
            <form className="at-ativ__form" onSubmit={pedir}>
              <h1>Vamos ativar o seu Atlas</h1>
              <p className="at-ativ__txt">Qual e-mail você usou na compra? Vamos mandar um código de 6 números para ele.</p>
              <CampoFalado rotulo="E-mail da compra" type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder="ze@barbeariadoze.com.br" juntar={juntarFalaEmail} ajuda="Dica: pode falar. Diga &quot;arroba&quot; e &quot;ponto&quot; que a gente escreve." />
              {erro && <p className="at-ativ__erro" role="alert">{erro}</p>}
              <div className="at-ativ__rodape"><Botao type="submit" disabled={ocupado || !email.trim()}>{ocupado ? 'Enviando…' : 'Receber o código'}</Botao></div>
            </form>
          )}

          {fase === 'codigo' && (
            <form className="at-ativ__form" onSubmit={confirmar}>
              <h1>Confirme que é você</h1>
              <p className="at-ativ__txt">Mandamos um código de 6 números para <b>{email.trim().toLowerCase()}</b>. Ele vale por 10 minutos.</p>
              <p className="aviso-email">{AVISO_EMAIL}</p>
              <div className="at-ativ__codigo" onClick={() => entrada.current?.focus()}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={`at-ativ__digito ${codigo[i] || i === codigo.length ? 'at-ativ__digito--on' : ''}`} aria-hidden="true">{codigo[i] ?? ''}</div>
                ))}
                <input ref={entrada} className="at-ativ__entrada" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} aria-label="Código de 6 números"
                  value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <Microfone gravando={voz.gravando} onAlternar={voz.alternar} className="at-ativ__mic" />
              </div>
              <div className="at-ativ__caixa">
                <b>Este computador vai ficar com a sua licença</b>
                <span>{computador}. Trocou de computador? Você muda isso depois, no portal.</span>
              </div>
              {aviso && <p className="at-ativ__txt" role="status">{aviso}</p>}
              {erro && <p className="at-ativ__erro" role="alert">{erro}</p>}
              <div className="at-ativ__rodape">
                <Botao type="submit" disabled={ocupado || codigo.length !== 6}>{ocupado ? 'Confirmando…' : 'Confirmar e instalar'}</Botao>
                <button type="button" className="at-ativ__link" onClick={() => void pedir()} disabled={ocupado}>Reenviar código</button>
              </div>
            </form>
          )}

          {fase === 'instalando' && (
            <div className="at-ativ__form">
              <div className="at-ativ__progresso">
                <span className="at-ativ__prog-nome">Instalando o Atlas</span>
                <div className="at-ativ__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso?.percentual ?? 0}>
                  <div style={{ width: `${progresso?.percentual ?? 0}%` }} />
                </div>
                <span className="at-ativ__prog-resta">{progresso ? progresso.restante : 'preparando…'}</span>
              </div>
              <h1 className="at-ativ__h1-menor">Enquanto instala, 3 coisas para saber{nome ? `, ${nome}` : ''}.</h1>
              {DICAS.map((d) => (
                <div key={d.titulo} className="at-ativ__dica">
                  <span className="at-ativ__dica-icone"><Icone nome={d.icone} tamanho={22} /></span>
                  <div><b>{d.titulo}</b><span>{d.texto}</span></div>
                </div>
              ))}
              <div className="at-ativ__rodape">
                <Botao onClick={onContinuar}>Continuar <Icone nome="seta" tamanho={18} /></Botao>
                <span className="at-ativ__nota">O antivírus pediu permissão? Clique em &quot;Permitir&quot;.</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
