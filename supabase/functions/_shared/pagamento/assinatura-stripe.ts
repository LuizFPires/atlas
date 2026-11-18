// Verificação da assinatura do webhook da Stripe (cabeçalho Stripe-Signature: t=<ts>,v1=<hmac>[,v1=...]).
// HMAC-SHA256 de `${t}.${corpoBruto}` com o segredo do webhook da conta DO CLIENTE; tolerância de 5 min.
import { hmac, iguais } from '../cripto.ts'

export const TOLERANCIA_ASSINATURA_S = 300

export async function verificarAssinaturaStripe(corpoBruto: string, cabecalho: string | null, segredo: string, agoraMs: number): Promise<boolean> {
  if (!cabecalho || !segredo) return false
  let t = ''
  const v1: string[] = []
  for (const parte of cabecalho.split(',')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    const k = parte.slice(0, i).trim()
    const v = parte.slice(i + 1).trim()
    if (k === 't') t = v
    else if (k === 'v1') v1.push(v)
  }
  const ts = Number(t)
  if (!Number.isFinite(ts) || ts <= 0 || v1.length === 0) return false
  if (Math.abs(agoraMs / 1000 - ts) > TOLERANCIA_ASSINATURA_S) return false
  const esperado = await hmac(segredo, `${t}.${corpoBruto}`)
  let ok = false
  for (const c of v1) if (iguais(c, esperado)) ok = true // sem curto-circuito: tempo constante entre candidatos
  return ok
}
