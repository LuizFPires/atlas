import { useEffect, useRef, useState } from 'react'
import { AVISO_EMAIL } from '../ui/aviso-email'
import { Botao, CampoFalado, Icone, Microfone, useVoz, type NomeIcone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { juntarFalaEmail } from '../web/compra'
import type { EstadoPreparo } from './ponte'
import { useIdioma, useTextos } from '../i18n/app'
import './app.css'

/** O que a tela precisa do servidor de licenças (S4): quem implementa fica em ativacao-api.ts. */
export interface AtivacaoTela {
  pedirCodigo(email: string): Promise<{ ok: true } | { ok: false; mensagem: string }>
  confirmar(email: string, codigo: string): Promise<{ ok: true; nome: string } | { ok: false; mensagem: string }>
  /** Abriu pelo link do e-mail: o código vai sozinho e a pessoa não digita o e-mail. */
  pedirCodigoPeloLink?(): Promise<{ ok: true; emailMascarado: string } | { ok: false; mensagem: string }>
}

export type FaseAtivacao = 'email' | 'codigo' | 'instalando'

/** Progresso da instalação (vem do instalador, M8). Sem dado, a barra fica em "preparando". */
export interface ProgressoInstalacao { percentual: number; restante: string }

const PASSOS = { pt: ['Confirmar e-mail', 'Instalar', 'Conectar o Claude', 'Abrir as contas', 'Acompanhar pelo celular'], en: ['Confirm email', 'Install', 'Connect Claude', 'Open the accounts', 'Follow on your phone'] }

const NUMEROS: Record<string, string> = { zero: '0', um: '1', uma: '1', dois: '2', duas: '2', tres: '3', três: '3', quatro: '4', cinco: '5', seis: '6', sete: '7', oito: '8', nove: '9',
  // M31: o código também pode ser falado em inglês.
  oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' }

/** "quatro oito dois zero sete um" -> "482071". Aceita também números já escritos. */
export function falaParaCodigo(t: string): string {
  return t.toLowerCase().split(/[\s,.-]+/).map((p) => NUMEROS[p] ?? p.replace(/\D/g, '')).join('').slice(0, 6)
}

export const DICAS_EN: { icone: NomeIcone; titulo: string; texto: string }[] = [
  { icone: 'microfone', titulo: 'Everything here can be spoken.', texto: 'On any question, tap the microphone and talk like you’re chatting with a friend over dinner. No need to say it perfectly.' },
  { icone: 'computador', titulo: 'This computer is your job site.', texto: 'That’s where the build happens. Leave it on during the build and follow everything in the Claude app on your phone.' },
  { icone: 'pasta', titulo: 'Your projects live in one folder.', texto: 'Atlas created the Atlas\\Obras folder and a desktop shortcut. You don’t need to touch anything there.' },
]

// M31: os textos da tela nos dois idiomas.
const TX = {
  pt: {
    ativarT: 'Vamos ativar o seu Atlas', ativarTxt: 'Qual e-mail você usou na compra? Vamos mandar um código de 6 números para ele.', emailRot: 'E-mail da compra', emailPh: 'ze@barbeariadoze.com.br',
    emailDica: 'Dica: pode falar. Diga "arroba" e "ponto" que a gente escreve.', enviando: 'Enviando…', receber: 'Receber o código', confirmeT: 'Confirme que é você',
    mandamos: 'Mandamos um código de 6 números para', vale: 'Ele vale por 10 minutos.', novo: 'Mandamos um código novo. Ele vale por 10 minutos.', codigoRot: 'Código de 6 números',
    licencaB: 'Este computador vai ficar com a sua licença', licenca: 'Trocou de computador? Você muda isso depois, no portal.', confirmando: 'Confirmando…', confirmar: 'Confirmar e instalar', reenviar: 'Reenviar código',
    instalando: 'Instalando o Atlas', preparando: 'preparando…', tres: (n: string) => `Enquanto instala, 3 coisas para saber${n ? `, ${n}` : ''}.`, continuar: 'Continuar', antivirus: 'O antivírus pediu permissão? Clique em "Permitir".',
    avisoEmail: AVISO_EMAIL,
    macT: 'Preparando o seu Mac', pronto: 'pronto', minutos: 'uns minutos', macH: (n: string) => `O Atlas instala o resto sozinho${n ? `, ${n}` : ''}. Você só acompanha.`, macLista: 'O que o Atlas está preparando',
    macB: 'O Mac é o seu canteiro.', mac: 'Enquanto a obra constrói, deixe a tampa aberta e o carregador ligado. Com a tampa fechada, o Mac dorme e a obra pausa (ela volta sozinha quando você abrir).', tentar: 'Tentar de novo', preparandoBtn: 'Preparando…',
    marca: { pronto: 'PRONTO', agora: 'AGORA', 'esperando-voce': 'ESPERANDO VOCÊ', fila: 'NA FILA', erro: 'NÃO DEU' } as Record<string, string>,
  },
  en: {
    ativarT: 'Let’s activate your Atlas', ativarTxt: 'Which email did you use to buy? We’ll send a 6-digit code to it.', emailRot: 'Purchase email', emailPh: 'joe@joesbarbershop.com',
    emailDica: 'Tip: you can say it. Say "at" and "dot" and we’ll write it.', enviando: 'Sending…', receber: 'Get the code', confirmeT: 'Confirm it’s you',
    mandamos: 'We sent a 6-digit code to', vale: 'It’s valid for 10 minutes.', novo: 'We sent a new code. It’s valid for 10 minutes.', codigoRot: '6-digit code',
    licencaB: 'This computer will hold your license', licenca: 'Switching computers? You can change it later in the portal.', confirmando: 'Confirming…', confirmar: 'Confirm and install', reenviar: 'Resend code',
    instalando: 'Installing Atlas', preparando: 'getting ready…', tres: (n: string) => `While it installs, 3 things to know${n ? `, ${n}` : ''}.`, continuar: 'Continue', antivirus: 'Did your antivirus ask for permission? Click "Allow".',
    avisoEmail: 'Can’t find the email? Also check the Promotions and Updates tabs in Gmail and your spam folder.',
    macT: 'Getting your Mac ready', pronto: 'ready', minutos: 'a few minutes', macH: (n: string) => `Atlas installs the rest on its own${n ? `, ${n}` : ''}. You just watch.`, macLista: 'What Atlas is getting ready',
    macB: 'Your Mac is the job site.', mac: 'While the project builds, keep the lid open and the charger plugged in. With the lid closed the Mac sleeps and the build pauses (it picks up again when you open it).', tentar: 'Try again', preparandoBtn: 'Getting ready…',
    marca: { pronto: 'DONE', agora: 'NOW', 'esperando-voce': 'WAITING FOR YOU', fila: 'IN LINE', erro: 'DIDN’T WORK' } as Record<string, string>,
  },
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
  /** M47 (Mac, tela M5Preparando): o Atlas prepara o computador; a tela mostra cada passo de verdade. Sem isso (Windows): como antes. */
  preparo?: EstadoPreparo | null
  onTentarPreparo?: () => void
}

/** Lateral escura com os 5 passos de começar (F02 e F03 usam a mesma). `agora` é o passo atual (1 a 5). */
export function LateralPassos({ agora }: { agora: number }) {
  const passos = PASSOS[useIdioma()]
  return (
    <aside className="at-ativ__lado">
      <div className="at-ativ__marca"><Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} /></div>
      <ol className="at-ativ__passos">
        {passos.map((p, i) => {
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
export function Ativacao({ api, computador, faseInicial = 'email', emailInicial = '', progresso = null, onContinuar, onInstalando, preparo, onTentarPreparo }: Props) {
  const T = useTextos(TX)
  const en = useIdioma() === 'en'
  const [fase, setFase] = useState<FaseAtivacao>(faseInicial)
  const [email, setEmail] = useState(emailInicial)
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const voz = useVoz((falado) => setCodigo(falaParaCodigo(falado)), en ? 'en-US' : 'pt-BR')
  /** E-mail mascarado quando o código foi pelo link (a***@gmail.com); null = caminho de sempre, com o e-mail digitado. */
  const [peloLink, setPeloLink] = useState<string | null>(null)
  const pediuPeloLink = useRef(false)
  useEffect(() => {
    if (pediuPeloLink.current || faseInicial !== 'email' || !api.pedirCodigoPeloLink) return
    pediuPeloLink.current = true
    void api.pedirCodigoPeloLink().then((r) => {
      if (r.ok) { setPeloLink(r.emailMascarado); setFase('codigo') } else setErro(r.mensagem)
    })
  }, [api, faseInicial])

  const agora = fase === 'instalando' ? 2 : 1
  const resolver = async <T extends { ok: boolean }>(p: Promise<T>): Promise<T | null> => {
    setErro(''); setAviso(''); setOcupado(true)
    try { return await p } finally { setOcupado(false) }
  }

  const pedir = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const r = await resolver(peloLink && api.pedirCodigoPeloLink ? api.pedirCodigoPeloLink() : api.pedirCodigo(email))
    if (!r) return
    if (!r.ok) return setErro(r.mensagem)
    setCodigo('')
    if (fase === 'codigo') setAviso(T.novo)
    setFase('codigo')
  }
  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await resolver(api.confirmar(peloLink ? '' : email, codigo))
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
              <h1>{T.ativarT}</h1>
              <p className="at-ativ__txt">{T.ativarTxt}</p>
              <CampoFalado en={en} rotulo={T.emailRot} type="email" autoComplete="email" valor={email} onChange={setEmail} placeholder={T.emailPh} juntar={juntarFalaEmail} ajuda={T.emailDica} />
              {erro && <p className="at-ativ__erro" role="alert">{erro}</p>}
              <div className="at-ativ__rodape"><Botao type="submit" disabled={ocupado || !email.trim()}>{ocupado ? T.enviando : T.receber}</Botao></div>
            </form>
          )}

          {fase === 'codigo' && (
            <form className="at-ativ__form" onSubmit={confirmar}>
              <h1>{T.confirmeT}</h1>
              <p className="at-ativ__txt">{T.mandamos} <b>{peloLink ?? email.trim().toLowerCase()}</b>. {T.vale}</p>
              <p className="aviso-email">{T.avisoEmail}</p>
              <div className="at-ativ__codigo" onClick={() => entrada.current?.focus()}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={`at-ativ__digito ${codigo[i] || i === codigo.length ? 'at-ativ__digito--on' : ''}`} aria-hidden="true">{codigo[i] ?? ''}</div>
                ))}
                <input ref={entrada} className="at-ativ__entrada" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} aria-label={T.codigoRot}
                  value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <Microfone gravando={voz.gravando} onAlternar={voz.alternar} className="at-ativ__mic" en={en} />
              </div>
              <div className="at-ativ__caixa">
                <b>{T.licencaB}</b>
                <span>{computador}. {T.licenca}</span>
              </div>
              {aviso && <p className="at-ativ__txt" role="status">{aviso}</p>}
              {erro && <p className="at-ativ__erro" role="alert">{erro}</p>}
              <div className="at-ativ__rodape">
                <Botao type="submit" disabled={ocupado || codigo.length !== 6}>{ocupado ? T.confirmando : T.confirmar}</Botao>
                <button type="button" className="at-ativ__link" onClick={() => void pedir()} disabled={ocupado}>{T.reenviar}</button>
              </div>
            </form>
          )}

          {fase === 'instalando' && preparo !== undefined && (
            <PreparandoMac preparo={preparo} nome={nome} onTentar={onTentarPreparo} onContinuar={onContinuar} />
          )}
          {fase === 'instalando' && preparo === undefined && (
            <div className="at-ativ__form">
              <div className="at-ativ__progresso">
                <span className="at-ativ__prog-nome">{T.instalando}</span>
                <div className="at-ativ__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso?.percentual ?? 0}>
                  <div style={{ width: `${progresso?.percentual ?? 0}%` }} />
                </div>
                <span className="at-ativ__prog-resta">{progresso ? progresso.restante : T.preparando}</span>
              </div>
              <h1 className="at-ativ__h1-menor">{T.tres(nome)}</h1>
              {(en ? DICAS_EN : DICAS).map((d) => (
                <div key={d.titulo} className="at-ativ__dica">
                  <span className="at-ativ__dica-icone"><Icone nome={d.icone} tamanho={22} /></span>
                  <div><b>{d.titulo}</b><span>{d.texto}</span></div>
                </div>
              ))}
              <div className="at-ativ__rodape">
                <Botao onClick={onContinuar}>{T.continuar} <Icone nome="seta" tamanho={18} /></Botao>
                <span className="at-ativ__nota">{T.antivirus}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const MARCA_PASSO: Record<string, { ic: string; rotulo: string }> = {
  pronto: { ic: '✓', rotulo: 'PRONTO' }, agora: { ic: '…', rotulo: 'AGORA' }, 'esperando-voce': { ic: '!', rotulo: 'ESPERANDO VOCÊ' }, fila: { ic: '·', rotulo: 'NA FILA' }, erro: { ic: '!', rotulo: 'NÃO DEU' },
}

/** M47 (tela M5Preparando, aprovada pelo Luiz em 24/11/2026): o Atlas instala o resto sozinho no Mac; o cliente só acompanha. */
function PreparandoMac({ preparo, nome, onTentar, onContinuar }: { preparo: EstadoPreparo | null; nome: string; onTentar?: () => void; onContinuar: () => void }) {
  const T = useTextos(TX)
  const erro = preparo?.passos.find((p) => p.estado === 'erro')
  return (
    <div className="at-ativ__form">
      <div className="at-ativ__progresso">
        <span className="at-ativ__prog-nome">{T.macT}</span>
        <div className="at-ativ__barra" role="progressbar" aria-label={T.macT} aria-valuemin={0} aria-valuemax={100} aria-valuenow={preparo?.percentual ?? 0}>
          <div style={{ width: `${preparo?.percentual ?? 0}%` }} />
        </div>
        <span className="at-ativ__prog-resta">{preparo?.pronto ? T.pronto : T.minutos}</span>
      </div>
      <h1 className="at-ativ__h1-menor">{T.macH(nome)}</h1>
      <ul className="at-prep" aria-label={T.macLista}>
        {(preparo?.passos ?? []).map((p) => (
          <li key={p.id} className={`at-prep__item at-prep__item--${p.estado}`}>
            <span className="at-prep__bola" aria-hidden="true">{MARCA_PASSO[p.estado]?.ic}</span>
            <div><b>{p.nome}</b><span>{p.estado === 'erro' && p.dica ? p.dica : p.txt}</span></div>
            <span className="at-prep__rotulo">{T.marca[p.estado] ?? MARCA_PASSO[p.estado]?.rotulo}</span>
          </li>
        ))}
      </ul>
      <div className="at-ativ__dica">
        <span className="at-ativ__dica-icone"><Icone nome="computador" tamanho={22} /></span>
        <div><b>{T.macB}</b><span>{T.mac}</span></div>
      </div>
      <div className="at-ativ__rodape">
        {erro
          ? <Botao onClick={onTentar}>{T.tentar}</Botao>
          : <Botao onClick={onContinuar} disabled={!preparo?.pronto}>{preparo?.pronto ? <>{T.continuar} <Icone nome="seta" tamanho={18} /></> : T.preparandoBtn}</Botao>}
      </div>
    </div>
  )
}
