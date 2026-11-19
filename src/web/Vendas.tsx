import type { ReactNode } from 'react'
import { Bolinha, Icone } from '../ui'
import { ImagemAssinatura, Monograma, NomeAtlas } from '../marca/Marca'
import { useTema } from '../tema/tema'
import { duvidas, ehParaVoce, etapas, exemplos, formas, naoEhParaVoce, PRECO, recebe, tresPassos, VIDEO_URL } from './conteudo'
import { BlocoDegustacao } from './Degustacao'
import type { DegustacaoApi } from './degustacao-api'
import { LinksLegais } from './Legal'
import './web.css'

function Comprar({ onComprar, className = '', children }: { onComprar: () => void; className?: string; children: ReactNode }) {
  return <button type="button" className={`v-acao ${className}`} onClick={onComprar}>{children}</button>
}

/** Página de vendas (F00). `onComprar` abre a compra no gateway do cliente. */
export function Vendas({ onComprar, extra, degustacaoApi }: { onComprar: () => void; extra?: ReactNode; degustacaoApi?: DegustacaoApi }) {
  const { tema } = useTema()
  return (
    <div className="v">
      <header className="v-topo">
        <div className="v-logo"><Monograma fundo={tema} largura={46} altura={26} /><NomeAtlas fundo={tema} largura={112} altura={16} /></div>
        <nav aria-label="Seções">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recebe">O que você recebe</a>
          <a href="#preco">Preço</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <Comprar onComprar={onComprar} className="v-acao--pequeno">Quero o meu</Comprar>
      </header>

      <section className="v-hero">
        <span className="v-selo">SISTEMAS SOB MEDIDA, FEITOS PELA IA</span>
        <h1>O sistema que a sua empresa precisa, do seu jeito. Sem saber programar.</h1>
        <p>Você conta o que precisa, como se falasse com um amigo. O Atlas desenha, constrói e entrega o sistema pronto, para usar no celular e no computador.</p>
        <div className="v-video">
          {VIDEO_URL ? (
            <iframe src={VIDEO_URL} title="O Atlas em 2 minutos" allow="fullscreen; picture-in-picture" loading="lazy" />
          ) : (
            <>
              <ImagemAssinatura />
              <div className="v-video-meio">
                <span className="v-play"><Icone nome="play" tamanho={40} fill="currentColor" stroke="none" /></span>
                <b>Assista: o Atlas em 2 minutos</b>
                <span className="v-reservado">[ espaço do seu vídeo · 16:9 ]</span>
              </div>
              <span className="v-duracao">2:00</span>
            </>
          )}
        </div>
        <div className="v-botoes">
          <Comprar onComprar={onComprar}>Quero construir o meu <Icone nome="seta" /></Comprar>
          <a className="v-acao v-acao--contorno" href="#exemplos">Ver o que dá para construir</a>
        </div>
      </section>

      <section className="v-tres">
        <div className="v-tres-cab"><h2>Você faz 3 passos. <span style={{ color: 'var(--lime-txt)' }}>A IA faz o resto.</span></h2><span>É só isso. Depois, pode ir dormir.</span></div>
        <div className="v-tres-grade">
          {tresPassos.map((nome, i) => (
            <div key={nome} className="v-card v-passo"><span className="v-num">{i + 1}</span><b>{nome}</b></div>
          ))}
          <div className="v-ia">
            <span className="v-ia-bola"><Icone nome="lua" tamanho={26} /></span>
            <div><span className="v-mono">Depois · a IA</span><b>Constrói sozinha, dia e noite. Inclusive enquanto você dorme.</b><span>Você acorda com notícias da obra no celular.</span></div>
          </div>
        </div>
      </section>

      <section id="exemplos" className="v-sec v-band">
        <div className="v-cab"><span className="v-mono">O que dá para construir</span><h2>Se dá para explicar, dá para construir.</h2><p>Um sistema financeiro, um app de controle de obra, a agenda da barbearia. Cada obra vira um sistema seu, com o seu nome, que funciona no celular e no computador.</p></div>
        <div className="v-grade4">
          {exemplos.map((x) => (
            <div key={x.nome} className="v-card"><Bolinha icone={x.icone} tamanho={44} /><b>{x.nome}</b><span>{x.txt}</span></div>
          ))}
        </div>
        <div className="v-formas">
          {formas.map((f) => <span key={f.txt} className="v-forma"><Icone nome={f.icone} tamanho={18} />{f.txt}</span>)}
        </div>
      </section>

      <section className="v-duas">
        <div>
          <span className="v-mono">Você vê a obra subir</span>
          <h2>Enquanto a IA trabalha, o seu sistema sobe andar por andar.</h2>
          <p>Cada etapa pronta vira um andar do prédio. Você acompanha de onde estiver e recebe notícias da obra no celular.</p>
        </div>
        <div className="v-canteiro"><ImagemAssinatura /></div>
      </section>

      <section id="como-funciona" className="v-sec v-band">
        <div className="v-cab"><span className="v-mono">Como funciona</span><h2>Fazer um sistema é igual construir uma casa.</h2><p>Por isso no Atlas cada sistema é uma obra. Você decide, a IA constrói.</p></div>
        <div className="v-grade5">
          {etapas.map((e) => (
            <div key={e.n} className="v-card" style={{ gap: 10 }}><span className="v-num v-num--p">{e.n}</span><b style={{ fontSize: 19 }}>{e.nome}</b><span>{e.txt}</span></div>
          ))}
        </div>
      </section>

      <section className="v-duas v-duas--igual">
        <div>
          <span className="v-mono">Você não precisa digitar</span>
          <h2>Fale como se estivesse com um amigo na mesa de um restaurante.</h2>
          <p>Tudo no Atlas pode ser falado: o que você quer, o que mudar, o que não ficou bom. Ele entende, escreve e mostra para você conferir.</p>
        </div>
        <div className="v-fala">
          <div className="v-fala-topo"><span className="v-fala-mic"><Icone nome="microfone" tamanho={26} /></span><span>Ouvindo… 0:18</span></div>
          <q>Olha, hoje o pessoal marca pelo WhatsApp e vira uma bagunça. Queria que o cliente escolhesse o barbeiro e o horário sozinho, e que eu visse tudo no meu celular.</q>
          <span className="v-entendeu"><Icone nome="check" tamanho={16} />O Atlas entendeu: agenda online com escolha de barbeiro e painel do dono.</span>
        </div>
      </section>

      <section id="recebe" className="v-sec v-band v-recebe">
        <div>
          <span className="v-mono">O que você recebe</span>
          <h2>Tudo o que precisa para construir quantos sistemas quiser.</h2>
          {recebe.map((r) => (
            <div key={r.t} className="v-item"><span className="v-check"><Icone nome="check" tamanho={14} /></span><span><b>{r.t}</b> <span className="v-mute">{r.d}</span></span></div>
          ))}
        </div>
        <div id="preco" className="v-preco">
          <span className="v-mono">Preço</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <small>Implantação, uma vez só</small>
            <span className="v-preco-valor">{PRECO.implantacao}</span>
            <small>em Pix ou parcelado no cartão</small>
          </div>
          <div className="v-linha" />
          <div className="v-mensal"><span>Manutenção mensal</span><b>{PRECO.mensalidade}<small>/mês</small></b></div>
          <small style={{ lineHeight: 1.5, fontSize: 14 }}>Inclui as atualizações do Atlas e o portal da sua conta.</small>
          <div className="v-aviso"><b>Você também vai precisar de uma assinatura do Claude</b>, paga direto à Anthropic. Ela é a força de trabalho da obra: no plano Pro a obra tem pausas, no Max ela termina mais rápido.</div>
          <Comprar onComprar={onComprar}>Quero construir o meu <Icone nome="seta" /></Comprar>
        </div>
      </section>

      <section className="v-sec">
        <div className="v-cab"><span className="v-mono">Para quem é</span><h2>Sejamos sinceros: o Atlas não é para todo mundo.</h2></div>
        <div className="v-quem">
          <div>
            <h3><Icone nome="check" className="v-ic-sim" />É para você se…</h3>
            {ehParaVoce.map((t) => <div key={t} className="v-item"><Icone nome="check" tamanho={18} className="v-ic-sim" /><span>{t}</span></div>)}
          </div>
          <div className="v-nao">
            <h3><Icone nome="x" className="v-ic-nao" />Não é para você se…</h3>
            {naoEhParaVoce.map((t) => <div key={t} className="v-item"><Icone nome="x" tamanho={18} className="v-ic-nao" /><span>{t}</span></div>)}
          </div>
        </div>
      </section>

      <section id="duvidas" className="v-sec">
        <div className="v-cab"><span className="v-mono">Dúvidas</span><h2>Perguntas de quem nunca programou</h2></div>
        <div className="v-faq">
          {duvidas.map((q) => <div key={q.p} className="v-card"><b>{q.p}</b><span>{q.r}</span></div>)}
        </div>
        <div className="v-depo">[Espaço para depoimentos reais dos primeiros clientes, com nome, empresa e foto autorizados]</div>
      </section>

      <BlocoDegustacao api={degustacaoApi} />

      <section className="v-final">
        <div><h2>A sua ideia merece sair do papel.</h2><span>Comece hoje. A primeira obra começa no mesmo dia.</span></div>
        <Comprar onComprar={onComprar} className="v-acao--escuro">Quero construir o meu <Icone nome="seta" /></Comprar>
      </section>

      <footer className="v-rodape">
        <Monograma fundo={tema} largura={34} altura={19} />
        <span>Atlas · PL Engenharia · CNPJ [__.___.___/____-__]</span>
        <span className="v-rodape-links"><LinksLegais /><span>Contato</span></span>
      </footer>
      {extra}
    </div>
  )
}
