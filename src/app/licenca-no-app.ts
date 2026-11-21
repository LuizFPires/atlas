// Mantém o cartão da licença (contador do teste) em dia dentro do app.
// Lê ao abrir, a cada 10 minutos e quando a janela volta ao foco. Depois que o cliente vai pagar, confere a cada 10 segundos por
// até 30 minutos e para assim que a licença vira paga. Sem resposta do servidor, fica o último dado bom (ou nenhum contador).
import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { cartaoDaLicenca, type CartaoLicenca, type ResumoLicenca } from './licenca-resumo'

export const INTERVALO_NORMAL_MS = 10 * 60_000
export const INTERVALO_PAGAMENTO_MS = 10_000
export const ESPERA_PAGAMENTO_MS = 30 * 60_000

export interface LicencaNoApp {
  cartao: CartaoLicenca
  /** A licença virou paga enquanto o app esperava o pagamento. */
  pagou: boolean
  /** Chamar depois de abrir a página de pagamento: liga a conferência rápida. */
  esperarPagamento(): void
  /** Lê agora (ex.: logo depois de ativar o computador). */
  conferir(): Promise<void>
}

export function useLicencaNoApp(ler: () => Promise<ResumoLicenca | null>): LicencaNoApp {
  const [resumo, setResumo] = useState<ResumoLicenca | null>(null)
  const [pagou, setPagou] = useState(false)
  const [esperando, setEsperando] = useState(false)
  const esperandoRef = useRef(false)

  const conferir = useCallback(async () => {
    const r = await ler().catch(() => null)
    if (!r) return // sem resposta: mantém o último dado bom
    setResumo(r)
    if (r.tipo === 'paga' && esperandoRef.current) { esperandoRef.current = false; setEsperando(false); setPagou(true) }
  }, [ler])

  useEffect(() => {
    void (async () => { await conferir() })()
    const t = setInterval(() => void conferir(), INTERVALO_NORMAL_MS)
    const foco = () => void conferir()
    window.addEventListener('focus', foco)
    return () => { clearInterval(t); window.removeEventListener('focus', foco) }
  }, [conferir])

  useEffect(() => {
    if (!esperando) return
    const t = setInterval(() => void conferir(), INTERVALO_PAGAMENTO_MS)
    const fim = setTimeout(() => { esperandoRef.current = false; setEsperando(false) }, ESPERA_PAGAMENTO_MS)
    return () => { clearInterval(t); clearTimeout(fim) }
  }, [esperando, conferir])

  const esperarPagamento = useCallback(() => { esperandoRef.current = true; setPagou(false); setEsperando(true) }, [])
  return { cartao: cartaoDaLicenca(resumo), pagou, esperarPagamento, conferir }
}

/** O que as telas com menu lateral precisam: o cartão e como abrir a compra. Ausente = sem contador. */
export const ContextoLicenca = createContext<{ cartao: CartaoLicenca; comprar?: () => void } | null>(null)
