import { useCallback, useEffect, useRef, useState } from 'react'
import { criarTranscricaoEmPartes } from './voz-partes'
import { definirEstadoVoz, estadoVoz, gravacaoSuportada, iniciarGravacao, noAtlasInstalado, RECADO_NAO_ESCREVI, RECADO_SEM_MICROFONE, transcritorAtual, transcritorRapido, type Gravacao } from './voz-motor'

// Reconhecimento de fala do navegador (pt-BR). Não há tipos no lib.dom, então declaramos o mínimo.
interface Reconhecedor {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e?: { error?: string }) => void) | null
  start(): void
  stop(): void
}
type Fabrica = new () => Reconhecedor

/** Erros em que religar não adianta: microfone bloqueado, sem microfone, sem serviço de voz. */
const ERROS_DEFINITIVOS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network'])

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
function useVozDoNavegador(aoFalar: (texto: string) => void) {
  const [gravando, setGravando] = useState(false)
  const rec = useRef<Reconhecedor | null>(null)
  const querOuvir = useRef(false)
  const religar = useRef<() => void>(() => {})
  const cb = useRef(aoFalar)
  useEffect(() => { cb.current = aoFalar })
  useEffect(() => () => { querOuvir.current = false; rec.current?.stop() }, [])

  const suportado = typeof window !== 'undefined' && fabrica() !== null

  // Fica ouvindo até a PESSOA apertar de novo. O navegador encerra a escuta sozinho numa pausa (ou depois de
  // um tempo); quando isso acontece sem a pessoa ter pedido, o Atlas religa na hora. Só desliga de vez se ela
  // apertar de novo ou se o microfone estiver bloqueado/indisponível (aí não adianta insistir).
  const parar = useCallback(() => { querOuvir.current = false; const r = rec.current; rec.current = null; setGravando(false); r?.stop() }, [])

  const ligar = useCallback(() => {
    const F = fabrica()
    if (!F) { parar(); return }
    const r = new F()
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = false
    r.onresult = (e) => {
      let texto = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) texto += e.results[i][0].transcript
      if (texto.trim()) cb.current(texto.trim())
    }
    r.onerror = (e) => { if (e?.error && ERROS_DEFINITIVOS.has(e.error)) querOuvir.current = false }
    r.onend = () => {
      if (rec.current !== r) return
      if (querOuvir.current) religar.current()
      else { rec.current = null; setGravando(false) }
    }
    rec.current = r
    try { r.start() } catch { parar() }
  }, [parar])
  useEffect(() => { religar.current = ligar }, [ligar])

  const alternar = useCallback(() => {
    if (querOuvir.current) { parar(); return }
    if (!fabrica()) return
    querOuvir.current = true
    setGravando(true)
    ligar()
  }, [ligar, parar])

  return { gravando, alternar, suportado }
}

/**
 * Microfone no Atlas instalado: grava até a pessoa apertar de novo e transcreve no computador (Whisper).
 * O estado (preparando, ouvindo, escrevendo, erro) vai para o aviso global <StatusVoz/>.
 */
function useVozWhisper(aoFalar: (texto: string) => void) {
  const [gravando, setGravando] = useState(false)
  const gravacao = useRef<Gravacao | null>(null)
  const emPartes = useRef<{ partes: ReturnType<typeof criarTranscricaoEmPartes>; timer: ReturnType<typeof setInterval>; rascunho?: ReturnType<typeof setInterval> } | null>(null)
  const ligando = useRef(false)
  const cb = useRef(aoFalar)
  useEffect(() => { cb.current = aoFalar })
  useEffect(() => () => { if (emPartes.current) { clearInterval(emPartes.current.timer); clearInterval(emPartes.current.rascunho) } gravacao.current?.cancelar(); gravacao.current = null; if (estadoVoz().fase === 'ouvindo') definirEstadoVoz({ fase: 'livre' }) }, [])

  const suportado = gravacaoSuportada() || noAtlasInstalado()

  const alternar = useCallback(() => {
    const g = gravacao.current
    if (g) {
      gravacao.current = null
      setGravando(false)
      definirEstadoVoz({ fase: 'escrevendo' })
      const ep = emPartes.current
      emPartes.current = null
      if (ep) { clearInterval(ep.timer); clearInterval(ep.rascunho) }
      void (async () => {
        try {
          const audio = await g.parar()
          const t = transcritorAtual()
          await t.preparar((pct) => { if (pct < 100) definirEstadoVoz({ fase: 'preparando', progresso: pct }) })
          definirEstadoVoz({ fase: 'escrevendo' })
          // Os trechos já falados foram sendo escritos durante a gravação; aqui falta só o finalzinho.
          const texto = (ep ? await ep.partes.terminar(audio) : await t.transcrever(audio)).trim()
          definirEstadoVoz({ fase: 'livre' })
          if (texto) cb.current(texto)
        } catch {
          definirEstadoVoz({ fase: 'erro', recado: RECADO_NAO_ESCREVI })
        }
      })()
      return
    }
    if (ligando.current) return
    ligando.current = true
    void (async () => {
      try {
        const g = await iniciarGravacao()
        gravacao.current = g
        setGravando(true)
        definirEstadoVoz({ fase: 'ouvindo' })
        // Enquanto a pessoa fala, o modelo (só na primeira vez) já vai sendo preparado.
        void transcritorAtual().preparar(() => {}).catch(() => {})
        // Texto ao vivo (23/11/2026): a cada 1,5 s olha se já tem um trecho de uns 4 s terminado num respiro; ele vai para o campo
        // assim que o Whisper bom escreve, sempre na ordem da fala. Ao parar, falta só o finalzinho.
        if (g.parcial) {
          const partes = criarTranscricaoEmPartes(transcritorAtual(), { minSegundos: 3, aoPronto: (x) => cb.current(x) })
          const timer = setInterval(() => { void g.parcial!().then((a) => partes.adiantar(a)).catch(() => {}) }, 1000)
          emPartes.current = { partes, timer }
          // Rascunho ao vivo ("sem delay na fala"): a cada ~1 s o Whisper rápido escreve o trecho ainda não confirmado, e ele
          // aparece no aviso "Ouvindo…". Um de cada vez: se o anterior ainda não voltou, pula a vez.
          const r = transcritorRapido()
          if (r) {
            void r.preparar(() => {}).catch(() => {})
            let ocupadoR = false
            emPartes.current.rascunho = setInterval(() => {
              if (ocupadoR || gravacao.current !== g) return
              ocupadoR = true
              void g.parcial!()
                .then((a) => { const resto = partes.pendente(a).slice(-12 * 16000); return resto.length > 0.4 * 16000 ? r.transcrever(resto.slice()) : '' })
                .then((x) => { if (gravacao.current === g && estadoVoz().fase === 'ouvindo') definirEstadoVoz({ fase: 'ouvindo', rascunho: x.trim() || undefined }) })
                .catch(() => {})
                .finally(() => { ocupadoR = false })
            }, 1000)
          }
        }
      } catch {
        definirEstadoVoz({ fase: 'erro', recado: RECADO_SEM_MICROFONE })
      } finally { ligando.current = false }
    })()
  }, [])

  return { gravando, alternar, suportado }
}

/** Microfone de um campo de texto: o Atlas instalado usa o Whisper no computador; o site usa a voz do navegador. */
export function useVoz(aoFalar: (texto: string) => void) {
  const whisper = noAtlasInstalado() || (fabrica() === null && gravacaoSuportada())
  const doNavegador = useVozDoNavegador(aoFalar)
  const local = useVozWhisper(aoFalar)
  return whisper ? local : doNavegador
}
