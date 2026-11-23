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
  /** Cortesia ou teste vencido: o Atlas inteiro fica travado até a compra. Lembrado no computador, para continuar travado sem internet. */
  encerrado: Encerrado | null
}

export interface Encerrado { rotulo: string; titulo: string }

export const CHAVE_ENCERRADO = 'atlas:acesso-encerrado'
function lerEncerrado(): Encerrado | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ENCERRADO) ?? 'null') as Partial<Encerrado> | null
    return v && typeof v.titulo === 'string' && typeof v.rotulo === 'string' ? { rotulo: v.rotulo, titulo: v.titulo } : null
  } catch { return null }
}
function gravarEncerrado(v: Encerrado | null) {
  try { if (v) localStorage.setItem(CHAVE_ENCERRADO, JSON.stringify(v)); else localStorage.removeItem(CHAVE_ENCERRADO) } catch { /* sem armazenamento: vale só nesta sessão */ }
}
/** Vencido de verdade (prazo passado na hora do servidor): o que mostrar no aviso. */
export function encerradoDo(r: ResumoLicenca): Encerrado | null {
  const c = cartaoDaLicenca(r)
  return c.estado === 'vencida' ? { rotulo: c.rotulo, titulo: c.titulo } : null
}

export function useLicencaNoApp(ler: () => Promise<ResumoLicenca | null>): LicencaNoApp {
  const [resumo, setResumo] = useState<ResumoLicenca | null>(null)
  const [pagou, setPagou] = useState(false)
  const [encerrado, setEncerrado] = useState<Encerrado | null>(lerEncerrado)
  const [esperando, setEsperando] = useState(false)
  const esperandoRef = useRef(false)

  const conferir = useCallback(async () => {
    const r = await ler().catch(() => null)
    if (!r) return // sem resposta: mantém o último dado bom
    setResumo(r)
    const venceu = encerradoDo(r)
    setEncerrado(venceu)
    gravarEncerrado(venceu)
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
  return { cartao: cartaoDaLicenca(resumo), pagou, esperarPagamento, conferir, encerrado }
}

/** O que as telas com menu lateral precisam: o cartão e como abrir a compra. Ausente = sem contador. */
export const ContextoLicenca = createContext<{ cartao: CartaoLicenca; comprar?: () => void } | null>(null)
