import { useEffect, useRef, useState } from 'react'
import { Icone } from '../ui'
import type { IdConta } from './contas-passos'
import type { IdGuiaSite, PonteNavegador, Retangulo } from './ponte-navegador'
import './navegador.css'

const SOBREPOSICAO = '[aria-modal="true"], .at-ajuda-p'
const ret = (el: HTMLElement): Retangulo => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } }
const semProtocolo = (u: string) => u.replace(/^https:\/\//, '').replace(/\/$/, '')

interface Props {
  navegador: PonteNavegador
  /** Qual site: a conta (tela das contas) OU o guia (M58: Registro.br, Stripe, Asaas). */
  conta?: IdConta
  guia?: IdGuiaSite
  /** O site mostrou que a conta ficou pronta (ex.: chegou no painel do Supabase). */
  onPronta?: (conta: IdConta) => void
  /** Cada página nova do site (o guia decide se o passo andou). */
  onPagina?: (url: string) => void
}

/**
 * O site de verdade na metade direita da tela das contas (pedido do Luiz, 23/11/2026). O navegador é desenhado pelo processo
 * principal por cima deste espaço; aqui só medimos onde ele fica, mostramos o endereço e os botões. Quando abre uma janela por
 * cima (vídeo, ajuda), ele se esconde para não cobrir.
 */
export function NavegadorEmbutido({ navegador, conta, guia, onPronta, onPagina }: Props) {
  const area = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('')
  const pronta = useRef(onPronta)
  const pagina = useRef(onPagina)
  useEffect(() => { pronta.current = onPronta; pagina.current = onPagina })

  useEffect(() => navegador.aoMudarPagina((p) => {
    if (guia ? p.guia !== guia : (!p.conta || p.conta !== conta)) return
    setUrl(p.url)
    pagina.current?.(p.url)
    if (p.pronta && p.conta) pronta.current?.(p.conta)
  }), [navegador, conta, guia])

  useEffect(() => {
    const el = area.current
    if (!el) return
    if (guia) void navegador.abrirGuia?.(guia, ret(el)).catch(() => {})
    else if (conta) void navegador.abrir(conta, ret(el)).catch(() => {})
    const mover = () => { void navegador.posicionar(ret(el)).catch(() => {}) }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mover) : null
    ro?.observe(el)
    window.addEventListener('resize', mover)
    window.addEventListener('scroll', mover, true)
    return () => { ro?.disconnect(); window.removeEventListener('resize', mover); window.removeEventListener('scroll', mover, true) }
  }, [navegador, conta, guia])

  useEffect(() => {
    let coberto = false
    const conferir = () => {
      const agora = document.querySelector(SOBREPOSICAO) !== null
      if (agora !== coberto) { coberto = agora; void navegador.mostrar(!agora).catch(() => {}) }
    }
    const mo = new MutationObserver(conferir)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'class'] })
    return () => mo.disconnect()
  }, [navegador])

  useEffect(() => () => { void navegador.fechar().catch(() => {}) }, [navegador])

  return (
    <div className="at-nav">
      <div className="at-nav__barra">
        <button type="button" className="at-nav__botao" aria-label="Voltar a página" onClick={() => void navegador.voltar()}><Icone nome="seta-esquerda" tamanho={16} /></button>
        <button type="button" className="at-nav__botao" aria-label="Recarregar a página" onClick={() => void navegador.recarregar()}><Icone nome="recarregar" tamanho={16} /></button>
        <span className="at-nav__url"><Icone nome="cadeado" tamanho={13} /> {url ? semProtocolo(url) : 'abrindo o site…'}</span>
        <button type="button" className="at-nav__fora" onClick={() => void (guia ? navegador.foraGuia?.(guia) : conta ? navegador.fora(conta) : undefined)}>Abrir no meu navegador</button>
      </div>
      <div ref={area} className="at-nav__area" aria-label={guia ? 'Site do passo a passo' : 'Site da conta'} />
    </div>
  )
}
