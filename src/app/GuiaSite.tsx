import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from '../ui'
import type { PedidoAjudaPasso } from './ajuda-passo'
import { caminhoQr, matrizQr } from './entrega-dados'
import { APP_APPLE_DEVELOPER, passoPeloEndereco, type Guia } from './guias-site'
import { NavegadorEmbutido } from './NavegadorEmbutido'
import type { PonteNavegador } from './ponte-navegador'
import type { DestinoSite } from './ponte-publicar'
import './guia-site.css'

interface Props {
  guia: Guia
  /** O navegador de verdade dentro do Atlas (só no Atlas instalado). Sem ele, o site abre no navegador do computador. */
  navegador?: PonteNavegador
  /** Abre o site no navegador do computador (lista fechada de sites oficiais). */
  abrirFora?: (destino: DestinoSite) => Promise<void>
  onFim: () => void
  onVoltar?: () => void
  /** "Falar com o Atlas": a Ajuda já sabe o guia, o passo, o botão certo e o que se sabe do site. */
  onAjuda?: (p: PedidoAjudaPasso) => void
  /** O Atlas confere sozinho se a parte do cliente já chegou (ex.: a troca no Registro.br). true = terminou. */
  conferirFim?: () => Promise<boolean>
  intervaloMs?: number
}

const FORA_DO_SITE: Partial<Record<NonNullable<Guia['site']>, DestinoSite>> = { registro: 'registro' }

/**
 * Passo a passo clique por clique (M58; prototipo/caminho-novo/PBGuia). À esquerda, uma frase por passo, o botão certo, a tradução,
 * o que copiar e "Falar com o Atlas". À direita, o site de verdade dentro do Atlas (o passo anda sozinho pelo endereço), o QR do
 * iPhone (Apple) ou o botão que abre o site no navegador do computador (Google não deixa entrar dentro de outros apps).
 */
export function GuiaSite({ guia, navegador, abrirFora, onFim, onVoltar, onAjuda, conferirFim, intervaloMs = 30_000 }: Props) {
  const [k, setK] = useState(0)
  const [url, setUrl] = useState('')
  const [copiado, setCopiado] = useState('')
  const total = guia.passos.length
  const passo = guia.passos[Math.min(k, total - 1)]
  const ultimo = k >= total - 1
  const fim = useRef(onFim)
  useEffect(() => { fim.current = onFim })

  useEffect(() => {
    if (!conferirFim) return
    let vivo = true
    const olhar = () => { void conferirFim().then((ok) => { if (vivo && ok) fim.current() }, () => {}) }
    olhar()
    const t = setInterval(olhar, intervaloMs)
    return () => { vivo = false; clearInterval(t) }
  }, [conferirFim, intervaloMs])

  const aoMudarPagina = (u: string) => { setUrl(u); setK((atual) => passoPeloEndereco(guia, atual, u)) }

  const pct = Math.round(((k + 1) / total) * 100)
  const noSite = guia.onde === 'site' && guia.site && navegador?.abrirGuia
  const qr = useMemo(() => (guia.onde === 'iphone' ? matrizQr(APP_APPLE_DEVELOPER) : null), [guia.onde])
  const destinoFora = guia.fora ?? (guia.site ? FORA_DO_SITE[guia.site] : undefined)

  const copiar = (v: string) => { void navigator.clipboard?.writeText(v).then(() => setCopiado(v), () => {}) }
  const pedirAjuda = () => onAjuda?.({
    origem: 'guia', conta: guia.nome, passo: k + 1, totalPassos: total,
    print: { url: url || guia.legenda, titulo: passo.texto, ...(passo.botao ? { botaoCerto: passo.botao } : {}) },
    instrucao: passo.botao ? `${passo.texto} (botão: ${passo.botao})` : passo.texto, saber: guia.saber,
  })

  return (
    <main className="at-guia">
      <section className="at-guia__esq" aria-label="Passo a passo">
        {onVoltar && <button type="button" className="at-guia__voltar" onClick={onVoltar}>← VOLTAR</button>}
        <span className="at-guia__rot">{guia.rotulo}</span>
        <div className="at-guia__prog">
          <span>PASSO {k + 1} DE {total}</span>
          <div className="at-guia__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div style={{ width: `${pct}%` }} /></div>
        </div>
        <p className="at-guia__texto" aria-live="polite">{passo.texto}</p>
        {passo.botao && <span className="at-guia__botao"><Icone nome="alvo" tamanho={14} /> O botão certo: <b>{passo.botao}</b></span>}
        {passo.traducao && <span className="at-guia__trad"><Icone nome="ajuda" tamanho={14} /> {passo.traducao}</span>}
        {passo.copiar && passo.copiar.length > 0 && (
          <ul className="at-guia__copiar">
            {passo.copiar.map((c, i) => (
              <li key={c.campo}><span>{c.campo}</span><code>{c.valor}</code>
                <button type="button" aria-label={`Copiar ${c.campo}`} onClick={() => copiar(c.valor)}>{copiado === c.valor ? 'copiado' : passo.copiar && passo.copiar.length > 1 ? `Copiar ${i + 1}` : 'Copiar'}</button></li>
            ))}
          </ul>
        )}
        {passo.dica && <span className="at-guia__dica">{passo.dica}</span>}
        <div className="at-guia__acoes">
          {k > 0 && <button type="button" className="at-guia__sec" onClick={() => setK(k - 1)}>← Anterior</button>}
          {!ultimo
            ? <button type="button" className="at-guia__prim" onClick={() => setK(k + 1)}>Fiz, próximo →</button>
            : <button type="button" className="at-guia__prim" onClick={onFim}>{guia.fimTexto} →</button>}
        </div>
        {onAjuda && (
          <div className="at-guia__ajuda">
            <b>Travou ou apareceu algo diferente?</b>
            <span>O Atlas já sabe em que passo você está e vê o site. Fale, escreva ou mande um print ou uma foto da tela.</span>
            <button type="button" className="at-guia__sec" onClick={pedirAjuda}>Falar com o Atlas</button>
          </div>
        )}
        <span className="at-guia__nota">O Atlas nunca digita senha, código ou cartão: essa parte é sempre sua.</span>
      </section>

      <section className="at-guia__dir" aria-label={guia.legenda}>
        <span className="at-guia__legenda">{guia.legenda}</span>
        {noSite && guia.site && <NavegadorEmbutido navegador={navegador} guia={guia.site} onPagina={aoMudarPagina} />}
        {guia.onde === 'iphone' && qr && (
          <div className="at-guia__qr">
            <svg width="220" height="220" viewBox={`0 0 ${qr.length} ${qr.length}`} shapeRendering="crispEdges" role="img" aria-label="QR para abrir o app Apple Developer no iPhone" data-endereco={APP_APPLE_DEVELOPER}>
              <path d={caminhoQr(qr)} fill="#141619" />
            </svg>
            <span>Aponte a câmera do iPhone. Abre o app Apple Developer na App Store (grátis, da própria Apple).</span>
          </div>
        )}
        {!noSite && guia.onde !== 'iphone' && (
          <div className="at-guia__fora">
            <span>{guia.onde === 'fora' ? 'O site abre no seu navegador. Deixe as duas janelas lado a lado e siga os passos daqui.' : 'Neste computador o site abre no seu navegador. Siga os passos daqui.'}</span>
            {destinoFora && abrirFora && <button type="button" className="at-guia__prim" onClick={() => void abrirFora(destinoFora).catch(() => {})}>Abrir o site do {guia.nome} →</button>}
          </div>
        )}
      </section>
    </main>
  )
}
