import { useState } from 'react'
import { CampoFalado, falaParaEmail, Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { useTema } from '../tema/tema'
import { EMAIL_RE } from './compra'
import { PRECO } from './conteudo'
import './web.css'

export interface DadosCadastro { nome: string; empresa: string; faz: string; email: string }
export type ResultadoCadastro = { ok: true } | { ok: false; mensagem: string }

/** E-mail da compra guardado só nesta aba, para já vir preenchido na volta do pagamento. */
export const CHAVE_EMAIL_COMPRA = 'atlas.email_compra'
const emailGuardado = () => {
  try { return sessionStorage.getItem(CHAVE_EMAIL_COMPRA) ?? '' } catch { return '' }
}

/** Cadastro pós-pagamento (F00b): 4 respostas, todas podem ser faladas. */
export function Cadastro({ onEnviar }: { onEnviar: (d: DadosCadastro) => Promise<ResultadoCadastro> }) {
  const { tema } = useTema()
  const [d, setD] = useState<DadosCadastro>({ nome: '', empresa: '', faz: '', email: emailGuardado() })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const mudar = (k: keyof DadosCadastro) => (v: string) => setD((x) => ({ ...x, [k]: v }))

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro('')
    if (!d.nome.trim()) return setErro('Diga como o Atlas vai te chamar.')
    if (!d.faz.trim()) return setErro('Conte, com as suas palavras, o que a sua empresa faz.')
    if (!EMAIL_RE.test(d.email.trim())) return setErro('Confira o e-mail: ele precisa ter um @ e um final, como .com.br.')
    setEnviando(true)
    const r = await onEnviar({ nome: d.nome.trim(), empresa: d.empresa.trim(), faz: d.faz.trim(), email: d.email.trim().toLowerCase() })
    setEnviando(false)
    if (r.ok) setPronto(true)
    else setErro(r.mensagem)
  }

  return (
    <div className="c">
      <header className="c-topo">
        <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        <span>atlas-ia.app.br/comecar</span>
      </header>
      <div className="c-corpo">
        <div className="c-esq">
          <span className="c-selo"><Icone nome="check" tamanho={14} />Pagamento confirmado</span>
          <h1>Bem-vindo ao Atlas! Só faltam 4 respostas.</h1>
          <p className="c-lead">Com elas o Atlas te chama pelo nome, já entende o seu negócio e manda o seu acesso por e-mail.</p>
          <div className="c-dica">
            <span className="c-dica-mic"><Icone nome="microfone" tamanho={20} /></span>
            <span><b>No Atlas, tudo pode ser falado.</b> Aperte o microfone e responda como se estivesse conversando com um amigo na mesa de um restaurante. O Atlas escreve por você.</span>
          </div>
          <div className="c-compra">
            <span className="v-mono" style={{ color: 'var(--mute2)', fontSize: 12, fontWeight: 500 }}>Sua compra</span>
            <div className="c-linha"><span>Implantação do Atlas</span><b>{PRECO.implantacao},00</b></div>
            <div className="c-linha c-mute"><span>Manutenção mensal (a partir do 2º mês)</span><span>{PRECO.mensalidade},00/mês</span></div>
            <small>Recibo enviado para o seu e-mail</small>
          </div>
        </div>

        {pronto ? (
          <div className="c-form" role="status">
            <span className="c-ok"><Icone nome="check" tamanho={26} /></span>
            <h2>Pronto, {d.nome.split(' ')[0]}! Olhe o seu e-mail.</h2>
            <p className="c-lead">Mandamos o seu acesso para <b>{d.email.trim().toLowerCase()}</b>. Ele chega em até 1 minuto. Abra no computador onde você vai construir.</p>
            <p className="c-mute">Não chegou? Veja também a caixa de spam. Dentro do Atlas, a Ajuda do Atlas te guia no que precisar.</p>
          </div>
        ) : (
          <form className="c-form" onSubmit={enviar} noValidate>
            <CampoFalado rotulo="Como o Atlas vai te chamar?" valor={d.nome} onChange={mudar('nome')} placeholder="Seu nome ou apelido" autoComplete="given-name" />
            <CampoFalado rotulo="Qual o nome da sua empresa?" obs="(se tiver)" valor={d.empresa} onChange={mudar('empresa')} placeholder="Ex.: Barbearia do Zé" autoComplete="organization" />
            <CampoFalado rotulo="O que a sua empresa faz?" obs="(com as suas palavras)" valor={d.faz} onChange={mudar('faz')} placeholder="Ex.: loja de roupas, consultório de dentista…" />
            <CampoFalado
              rotulo="Qual o seu e-mail?"
              type="email"
              autoComplete="email"
              valor={d.email}
              onChange={mudar('email')}
              placeholder="voce@suaempresa.com.br"
              ajuda="É para ele que vai o seu acesso. Use um e-mail que você abre no computador."
              juntar={(atual, falado) => falaParaEmail(atual + falado)}
            />
            {erro && <p role="alert" className="v-erro">{erro}</p>}
            <button type="submit" className="v-acao" disabled={enviando} data-tema={tema}>
              {enviando ? 'Enviando…' : <>Receber meu acesso por e-mail <Icone nome="seta" /></>}
            </button>
            <span className="c-mute" style={{ fontSize: 13, lineHeight: 1.5 }}>O e-mail chega em até 1 minuto. Abra no computador onde você vai construir.</span>
          </form>
        )}
      </div>
    </div>
  )
}
