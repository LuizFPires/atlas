import { useEffect, useRef, useState } from 'react'
import canteiroImagem from '../assets/canteiro-3d.jpg'
import { enderecoCanteiroSeguro } from './ponte-painel'

// Retrato do canteiro (M37, Luiz em 23/11/2026, K1Canteiro): no cartão, a cena fica parada; com o mouse em cima ela ganha vida
// (a cena real do kit, sempre 3D) e, quando o mouse sai, o cartão guarda o retrato daquele momento. O retrato fica só neste
// computador (localStorage), e só é aceito se vier da própria cena embutida, como JPEG.

export const chaveRetrato = (pasta: string) => `atlas:retrato:${pasta}`
const MAX = 1_500_000
const ESPERA_MS = 700

const lerRetrato = (pasta: string): string | null => {
  try {
    const v = localStorage.getItem(chaveRetrato(pasta))
    return v && v.startsWith('data:image/jpeg;base64,') && v.length <= MAX ? v : null
  } catch { return null }
}

export function RetratoCanteiro({ pasta, endereco, vivo }: { pasta: string; endereco: string | null; vivo: boolean }) {
  const seguro = enderecoCanteiroSeguro(endereco)
  const [retrato, setRetrato] = useState<string | null>(() => lerRetrato(pasta))
  const [saindo, setSaindo] = useState(false)
  const [eraVivo, setEraVivo] = useState(vivo)
  const quadro = useRef<HTMLIFrameElement>(null)

  // O mouse saiu: a cena continua montada um instante, só para devolver o retrato.
  if (eraVivo !== vivo) {
    setEraVivo(vivo)
    setSaindo(!vivo && !!seguro)
  }

  useEffect(() => {
    if (!saindo || !seguro) return
    const janela = quadro.current?.contentWindow
    const origem = new URL(seguro).origin
    const aoResponder = (ev: MessageEvent) => {
      if (!janela || ev.source !== janela || ev.origin !== origem) return
      const d = ev.data as { tipo?: unknown; imagem?: unknown } | null
      if (!d || d.tipo !== 'atlas:retrato' || typeof d.imagem !== 'string') return
      if (!d.imagem.startsWith('data:image/jpeg;base64,') || d.imagem.length > MAX) return
      const imagem = d.imagem
      try { localStorage.setItem(chaveRetrato(pasta), imagem) } catch { /* sem espaço: fica só na tela */ }
      setRetrato(imagem)
      setSaindo(false)
    }
    window.addEventListener('message', aoResponder)
    try { janela?.postMessage({ tipo: 'atlas:retrato' }, origem) } catch { /* a cena não respondeu: para assim mesmo */ }
    const t = setTimeout(() => setSaindo(false), ESPERA_MS)
    return () => { window.removeEventListener('message', aoResponder); clearTimeout(t) }
  }, [saindo, seguro, pasta])

  const aoVivo = !!seguro && (vivo || saindo)
  const src = seguro ? `${seguro}${seguro.includes('?') ? '&' : '?'}modo=3d&baloes=0&cena=1` : null
  return (
    <span className="at-ct__retrato">
      <img src={retrato ?? canteiroImagem} alt="" />
      {aoVivo && src && (
        <>
          <iframe ref={quadro} className="at-ct__retrato-vivo" title="O canteiro desta obra, ao vivo, em 3D" src={src} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" tabIndex={-1} />
          <span className="at-ct__aovivo"><span className="at-ct__ponto" aria-hidden="true" />AO VIVO</span>
        </>
      )}
    </span>
  )
}
