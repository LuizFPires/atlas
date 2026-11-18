import { useCallback, useEffect, useRef, useState } from 'react'

// Reconhecimento de fala do navegador (pt-BR). Não há tipos no lib.dom, então declaramos o mínimo.
interface Reconhecedor {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
type Fabrica = new () => Reconhecedor

function fabrica(): Fabrica | null {
  const w = window as unknown as { SpeechRecognition?: Fabrica; webkitSpeechRecognition?: Fabrica }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Ajusta o que foi falado para um e-mail ("zé arroba empresa ponto com ponto br"). */
export function falaParaEmail(t: string): string {
  return t
    .toLowerCase()
    .replace(/\s+arroba\s+/g, '@')
    .replace(/\s+ponto\s+/g, '.')
    .replace(/\s+/g, '')
}

/**
 * Microfone de um campo de texto. A cada frase final chama `aoFalar(texto)`; o campo junta ao que já estava
 * escrito e o cliente pode editar à vontade (transcrição editável).
 */
export function useVoz(aoFalar: (texto: string) => void) {
  const [gravando, setGravando] = useState(false)
  const rec = useRef<Reconhecedor | null>(null)
  const cb = useRef(aoFalar)
  useEffect(() => { cb.current = aoFalar })
  useEffect(() => () => rec.current?.stop(), [])

  const suportado = typeof window !== 'undefined' && fabrica() !== null

  const alternar = useCallback(() => {
    if (rec.current) { rec.current.stop(); return }
    const F = fabrica()
    if (!F) return
    const r = new F()
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = false
    r.onresult = (e) => {
      let texto = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) texto += e.results[i][0].transcript
      if (texto.trim()) cb.current(texto.trim())
    }
    const fim = () => { rec.current = null; setGravando(false) }
    r.onend = fim
    r.onerror = fim
    rec.current = r
    setGravando(true)
    try { r.start() } catch { fim() }
  }, [])

  return { gravando, alternar, suportado }
}
