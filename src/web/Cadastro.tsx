import { useState } from 'react'
import { AVISO_EMAIL } from '../ui/aviso-email'
import { CampoFalado, Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { useTema } from '../tema/tema'
import { EMAIL_RE, juntarFalaEmail } from './compra'
import { sessionIdDaUrl } from './cadastro-api'
import { LinksLegais } from './Legal'
import { CampoCidade } from './CampoCidade'
import type { Idioma } from '../i18n/idioma'
import { TEXTOS_VENDAS } from './textos-vendas'
import './web.css'

// M31: o cadastro em inglês (compra em dólar). Em inglês não há cidade/estado do Brasil: são 4 respostas.
const TX = {
  pt: {
    nome: 'Diga como o Atlas vai te chamar.', faz: 'Conte, com as suas palavras, o que a sua empresa faz.', cidade: 'Diga de qual cidade você é — ajuda a gente a te atender melhor.',
    uf: 'Não consegui achar o estado. Escolha a sua cidade na lista que aparece embaixo do campo, que o estado vem junto.', email: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.',
    endereco: 'atlas-ia.app.br/comecar', falta: 'Falta pouco', semProva: 'Para abrir o cadastro, volte pelo botão da página de pagamento: é ele que mostra ao Atlas que a compra é sua.',
    titulo: 'Bem-vindo ao Atlas! Só faltam 5 respostas.', lead: 'Com elas o Atlas te chama pelo nome, já entende o seu negócio e manda o seu acesso por e-mail.',
    dicaB: 'No Atlas, tudo pode ser falado.', dica: 'Aperte o microfone e responda como se estivesse conversando com um amigo na mesa de um restaurante. O Atlas escreve por você.',
    suaCompra: 'Sua compra', implantacao: 'Implantação do Atlas', valorImpl: `${TEXTOS_VENDAS.pt.preco.valorImplantacao},00`, mensal: 'Manutenção mensal (a partir do 2º mês)', valorMensal: `${TEXTOS_VENDAS.pt.preco.valorMensal},00/mês`, recibo: 'Recibo enviado para o seu e-mail',
    pronto: (n: string) => `Pronto, ${n}! Olhe o seu e-mail.`, mandamos: 'Mandamos o seu acesso para', daCompra: 'o e-mail da sua compra', mandamos2: ', o e-mail que você usou para pagar. Ele chega em até 1 minuto. Abra no computador onde você vai construir.',
    diferente: 'O e-mail que você digitou é diferente do da compra, então o acesso foi para o da compra.', caraLead: 'Agora falta pouco para o seu app ficar com a sua cara: nome, logo e duas cores.', cara: 'Deixar o app com a minha cara',
    avisoEmail: AVISO_EMAIL, ajuda: 'Dentro do Atlas, a Ajuda do Atlas te guia no que precisar.',
    rNome: 'Como o Atlas vai te chamar?', pNome: 'Seu nome ou apelido', rEmpresa: 'Qual o nome da sua empresa?', oEmpresa: '(se tiver)', pEmpresa: 'Ex.: Barbearia do Zé',
    rFaz: 'O que a sua empresa faz?', oFaz: '(com as suas palavras)', pFaz: 'Ex.: loja de roupas, consultório de dentista…', rEmail: 'Qual o seu e-mail?', oEmail: '(só para conferir)', pEmail: 'voce@suaempresa.com.br',
    aEmail: 'O acesso vai sempre para o e-mail que você usou no pagamento. Aqui é só para conferir.', enviando: 'Enviando…', enviar: 'Receber meu acesso por e-mail', chega: 'O e-mail chega em até 1 minuto. Abra no computador onde você vai construir.',
  },
  en: {
    nome: 'Tell us what Atlas should call you.', faz: 'Tell us, in your own words, what your business does.', cidade: '', uf: '', email: 'Check the email: it needs an @ and an ending, like .com.',
    endereco: 'use-atlas-ai.com/start', falta: 'Almost there', semProva: 'To open sign-up, come back through the button on the payment page: that’s how Atlas knows the purchase is yours.',
    titulo: 'Welcome to Atlas! Just 4 quick answers.', lead: 'With them Atlas calls you by name, already understands your business and emails you your access.',
    dicaB: 'In Atlas, everything can be spoken.', dica: 'Tap the microphone and answer like you’re chatting with a friend over dinner. Atlas writes it down for you.',
    suaCompra: 'Your purchase', implantacao: 'Atlas setup', valorImpl: TEXTOS_VENDAS.en.preco.valorImplantacao, mensal: 'Monthly plan (from month 2)', valorMensal: `${TEXTOS_VENDAS.en.preco.valorMensal}/month`, recibo: 'Receipt sent to your email',
    pronto: (n: string) => `Done, ${n}! Check your email.`, mandamos: 'We sent your access to', daCompra: 'your purchase email', mandamos2: ', the email you paid with. It arrives within 1 minute. Open it on the computer where you’ll build.',
    diferente: 'The email you typed is different from the purchase one, so the access went to the purchase email.', caraLead: 'Almost done making the app yours: name, logo and two colors.', cara: 'Make the app mine',
    avisoEmail: 'Can’t find the email? Also check the Promotions and Updates tabs in Gmail and your spam folder.', ajuda: 'Inside Atlas, the Atlas Help walks you through anything you need.',
    rNome: 'What should Atlas call you?', pNome: 'Your name or nickname', rEmpresa: 'What’s your business called?', oEmpresa: '(if you have one)', pEmpresa: 'E.g.: Joe’s Barber Shop',
    rFaz: 'What does your business do?', oFaz: '(in your own words)', pFaz: 'E.g.: clothing store, dental office…', rEmail: 'What’s your email?', oEmail: '(just to double-check)', pEmail: 'you@yourcompany.com',
    aEmail: 'Your access always goes to the email you paid with. This is just to double-check.', enviando: 'Sending…', enviar: 'Email me my access', chega: 'The email arrives within 1 minute. Open it on the computer where you’ll build.',
  },
}

export interface DadosCadastro { nome: string; empresa: string; faz: string; cidade: string; uf: string; email: string }
export type ResultadoCadastro = { ok: true; enviado_para?: string; email_diferente?: boolean; segmento?: string | null } | { ok: false; mensagem: string }

/** E-mail da compra guardado só nesta aba, para já vir preenchido na volta do pagamento. */
export const CHAVE_EMAIL_COMPRA = 'atlas.email_compra'
const emailGuardado = () => {
  // localStorage sobrevive ao ir ao Stripe e voltar (o sessionStorage, por aba, se perdia no redirect); sessionStorage como reserva.
  try { return localStorage.getItem(CHAVE_EMAIL_COMPRA) || sessionStorage.getItem(CHAVE_EMAIL_COMPRA) || '' } catch { return '' }
}
/** Depois que o cadastro conclui, apaga o e-mail guardado (não deixa rastro no navegador, nem em computador compartilhado). */
const limparEmailGuardado = () => {
  try { localStorage.removeItem(CHAVE_EMAIL_COMPRA); sessionStorage.removeItem(CHAVE_EMAIL_COMPRA) } catch { /* sem armazenamento */ }
}

/** Cadastro pós-pagamento (F00b): 5 respostas, todas podem ser faladas. */
export function Cadastro({ onEnviar, temProva = sessionIdDaUrl() !== '', idioma = 'pt' }: { onEnviar: (d: DadosCadastro) => Promise<ResultadoCadastro>; temProva?: boolean; idioma?: Idioma }) {
  const { tema } = useTema()
  const en = idioma === 'en'
  const T = TX[idioma]
  const [d, setD] = useState<DadosCadastro>({ nome: '', empresa: '', faz: '', cidade: '', uf: '', email: emailGuardado() })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState<{ para?: string; diferente?: boolean; segmento?: string | null } | null>(null)
  const mudar = (k: keyof DadosCadastro) => (v: string) => setD((x) => ({ ...x, [k]: v }))

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro('')
    if (!d.nome.trim()) return setErro(T.nome)
    if (!d.faz.trim()) return setErro(T.faz)
    if (!en && !d.cidade.trim()) return setErro(T.cidade)
    if (!en && !d.uf) return setErro(T.uf)
    if (!EMAIL_RE.test(d.email.trim())) return setErro(T.email)
    setEnviando(true)
    const r = await onEnviar({ nome: d.nome.trim(), empresa: d.empresa.trim(), faz: d.faz.trim(), cidade: d.cidade.trim(), uf: d.uf, email: d.email.trim().toLowerCase() })
    setEnviando(false)
    if (r.ok) { limparEmailGuardado(); setPronto({ para: r.enviado_para, diferente: r.email_diferente, segmento: r.segmento }) }
    else setErro(r.mensagem)
  }

  return (
    <div className="c" lang={en ? 'en-US' : 'pt-BR'}>
      <header className="c-topo">
        <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        <span>{T.endereco}</span>
      </header>
      <div className="c-corpo">
        <div className="c-esq">
          <span className="c-selo"><Icone nome="check" tamanho={14} />{T.falta}</span>
          {!temProva && <p role="alert" className="v-erro">{T.semProva}</p>}
          <h1>{T.titulo}</h1>
          <p className="c-lead">{T.lead}</p>
          <div className="c-dica">
            <span className="c-dica-mic"><Icone nome="microfone" tamanho={20} /></span>
            <span><b>{T.dicaB}</b> {T.dica}</span>
          </div>
          <div className="c-compra">
            <span className="v-mono" style={{ color: 'var(--mute2)', fontSize: 12, fontWeight: 500 }}>{T.suaCompra}</span>
            <div className="c-linha"><span>{T.implantacao}</span><b>{T.valorImpl}</b></div>
            <div className="c-linha c-mute"><span>{T.mensal}</span><span>{T.valorMensal}</span></div>
            <small>{T.recibo}</small>
          </div>
        </div>

        {pronto ? (
          <div className="c-form" role="status">
            <span className="c-ok"><Icone nome="check" tamanho={26} /></span>
            <h2>{T.pronto(d.nome.split(' ')[0])}</h2>
            <p className="c-lead">{T.mandamos} <b>{pronto.para ?? T.daCompra}</b>{T.mandamos2}</p>
            {pronto.diferente && <p className="c-mute">{T.diferente}</p>}
            {pronto.segmento && (
              <>
                <p className="c-lead">{T.caraLead}</p>
                <a className="v-acao" href="/personalizar" data-tema={tema}>{T.cara} <Icone nome="seta" /></a>
              </>
            )}
            <p className="aviso-email">{T.avisoEmail}</p>
            <p className="c-mute">{T.ajuda}</p>
          </div>
        ) : (
          <form className="c-form" onSubmit={enviar} noValidate>
            <CampoFalado en={en} rotulo={T.rNome} valor={d.nome} onChange={mudar('nome')} placeholder={T.pNome} autoComplete="given-name" />
            <CampoFalado en={en} rotulo={T.rEmpresa} obs={T.oEmpresa} valor={d.empresa} onChange={mudar('empresa')} placeholder={T.pEmpresa} autoComplete="organization" />
            <CampoFalado en={en} rotulo={T.rFaz} obs={T.oFaz} valor={d.faz} onChange={mudar('faz')} placeholder={T.pFaz} />
            {!en && <CampoCidade
              valor={d.cidade} uf={d.uf}
              onDigitar={(t) => setD((x) => ({ ...x, cidade: t, uf: '' }))}
              onEscolher={(cidade, uf) => setD((x) => ({ ...x, cidade, uf }))}
            />}
            <CampoFalado
              en={en}
              rotulo={T.rEmail} obs={T.oEmail}
              type="email"
              autoComplete="email"
              valor={d.email}
              onChange={mudar('email')}
              placeholder={T.pEmail}
              ajuda={T.aEmail}
              juntar={juntarFalaEmail}
            />
            {erro && <p role="alert" className="v-erro">{erro}</p>}
            <button type="submit" className="v-acao" disabled={enviando} data-tema={tema}>
              {enviando ? T.enviando : <>{T.enviar} <Icone nome="seta" /></>}
            </button>
            <span className="c-mute" style={{ fontSize: 13, lineHeight: 1.5 }}>{T.chega}</span>
            <span className="c-mute v-rodape-links" style={{ fontSize: 13, margin: 0 }}><LinksLegais novaAba idioma={idioma} /></span>
          </form>
        )}
      </div>
    </div>
  )
}
