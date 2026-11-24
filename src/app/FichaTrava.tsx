import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import type { PonteNavegador, Retangulo } from './ponte-navegador'
import type { PonteTravas } from './ponte-travas'
import { fichaDaTrava, type OpcaoTrava, type TravaObra } from './travas'
import './ficha-trava.css'

interface Props {
  pasta: string
  trava: TravaObra
  ponte: PonteTravas
  /** Para fechar o site ao lado ao sair (só no Atlas instalado). */
  navegador?: PonteNavegador
  /** Conta desligada: abre a tela das contas. */
  onLigarContas?: () => void
  agora?: Date
}

const ret = (el: HTMLElement | null): Retangulo => {
  const r = el?.getBoundingClientRect()
  return { x: r?.left ?? 0, y: r?.top ?? 0, width: r?.width ?? 1, height: r?.height ?? 1 }
}

/**
 * Ficha da trava no topo da obra (prototipo/caminho-novo/T1Travas e TF3/TF4, aprovadas pelo Luiz em 24/11/2026). Responde o que
 * aconteceu, se passa sozinho e o que o Atlas faz enquanto isso; as opções têm uma "Recomendado". A obra continua por baixo.
 */
export function FichaTrava({ pasta, trava, ponte, navegador, onLigarContas, agora }: Props) {
  const f = fichaDaTrava(trava, agora)
  const [recolhida, setRecolhida] = useState(false)
  const [resolvendo, setResolvendo] = useState<'site' | 'esperando' | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [publico, setPublico] = useState(false)
  const [aviso, setAviso] = useState('')
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    if (trava.tipo === 'github-minutos') void ponte.ehPublico(pasta).then((p) => { if (vivo) setPublico(p) }, () => {})
    return () => { vivo = false }
  }, [ponte, pasta, trava.tipo])
  useEffect(() => () => { void navegador?.fechar().catch(() => {}) }, [navegador])

  const abrirSite = async () => {
    setAviso('')
    setResolvendo('site')
    // espera o espaço do site aparecer na tela antes de medir
    await new Promise((r) => setTimeout(r, 0))
    try { await ponte.site(trava.tipo, ret(area.current)) } catch { setAviso('Não consegui abrir o site aqui. Use "Abrir no meu navegador".') }
  }

  const agir = (o: OpcaoTrava) => {
    if (o.acao === 'site') void abrirSite()
    else if (o.acao === 'publico') setConfirmar(true)
    else if (o.acao === 'ligar') onLigarContas?.()
    else if (o.acao === 'depois') setRecolhida(true)
  }

  const deixarPublico = async () => {
    setAviso('')
    try { await ponte.deixarPublico(pasta); setPublico(true); setConfirmar(false) } catch { setAviso('Não consegui mudar agora. O Atlas continua conferindo aqui, sem custo.') }
  }

  if (recolhida) {
    return (
      <div className={`at-trava at-trava--linha${f.precisaDeVoce ? ' at-trava--voce' : ''}`}>
        <span className="at-trava__selo">{f.selo}</span>
        <span>{f.linha}</span>
        <button type="button" className="at-ativ__link" onClick={() => setRecolhida(false)}>Ver o que fazer</button>
      </div>
    )
  }

  return (
    <section className={`at-trava${f.precisaDeVoce ? ' at-trava--voce' : ''}`} aria-label={`${trava.servico}: ${f.selo.toLowerCase()}`}>
      <div className="at-trava__cab">
        <span className="at-trava__selo">{trava.servico.toUpperCase()} · {f.precisaDeVoce ? 'PRECISA DE VOCÊ' : f.volta}</span>
        <h2>{f.titulo}</h2>
      </div>

      {resolvendo && f.guia ? (
        <div className="at-trava__resolver">
          <div className="at-trava__guia">
            {resolvendo === 'site' ? (
              <>
                <b>{f.guia.passo}</b>
                <span className="at-trava__trad"><b>{f.guia.en}</b> quer dizer <b>"{f.guia.pt}"</b></span>
                <span className="at-ativ__txt">Se o site pedir para entrar, use "Continue with GitHub", como quando você criou a conta.</span>
                <div className="at-trava__acoes">
                  <Botao onClick={() => { setResolvendo('esperando'); void navegador?.fechar().catch(() => {}) }}>Já cliquei</Botao>
                  <button type="button" className="at-ativ__link" onClick={() => void ponte.siteFora(trava.tipo)}>Abrir no meu navegador</button>
                  <button type="button" className="at-ativ__link" onClick={() => { setResolvendo(null); void navegador?.fechar().catch(() => {}) }}>Voltar</button>
                </div>
              </>
            ) : (
              <>
                <b role="status"><span className="at-trava__gira" aria-hidden="true" />{f.guia.depois}</b>
                <button type="button" className="at-ativ__link" onClick={() => void abrirSite()}>Não deu certo? Abrir o site de novo</button>
              </>
            )}
          </div>
          {resolvendo === 'site' && <div ref={area} className="at-trava__site" aria-hidden="true" />}
        </div>
      ) : (
        <>
          <div className="at-trava__blocos">
            {f.blocos.map((b) => (
              <div key={b.rotulo} className="at-trava__bloco"><span>{b.rotulo}</span><p>{b.texto}</p></div>
            ))}
          </div>
          {publico && <p className="at-trava__ok" role="status"><Icone nome="check" tamanho={16} /> Projeto público por enquanto. O Atlas volta para privado sozinho quando o GitHub liberar.</p>}
          <span className="at-trava__rotulo">O QUE VOCÊ PODE FAZER AGORA</span>
          <div className="at-trava__opcoes">
            {f.opcoes.filter((o) => !(publico && o.acao === 'publico')).map((o) => (
              <div key={o.nome} className={`at-trava__opcao${o.recomendado ? ' at-trava__opcao--rec' : ''}`}>
                <div className="at-trava__opcao-txt">
                  <b>{o.nome}{o.recomendado && <em className="at-trava__tag">RECOMENDADO</em>}{o.atencao && <em className="at-trava__tag at-trava__tag--atencao">ATENÇÃO</em>}</b>
                  <span>{o.desc}</span>
                </div>
                <Botao variante={o.recomendado ? 'principal' : 'secundario'} onClick={() => agir(o)} disabled={o.acao === 'feito'}>{o.botao}</Botao>
              </div>
            ))}
          </div>
          {confirmar && (
            <div role="dialog" aria-label="Deixar o projeto público" className="at-trava__confirmar">
              <b>Antes de deixar o projeto público por um tempo</b>
              <span>Enquanto estiver público, qualquer pessoa na internet pode ver o código do seu sistema (não os dados dos seus clientes, nem as senhas, que ficam no Supabase). O Atlas volta para privado sozinho quando o GitHub liberar.</span>
              <div className="at-trava__acoes">
                <Botao onClick={() => void deixarPublico()}>Entendi, deixar público até o GitHub voltar</Botao>
                <Botao variante="secundario" onClick={() => setConfirmar(false)}>Não, prefiro o recomendado</Botao>
              </div>
            </div>
          )}
          <span className="at-ativ__txt">{f.rodape}</span>
        </>
      )}
      {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
    </section>
  )
}
