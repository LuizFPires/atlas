// Verificação da resposta do /verificar usando SÓ a chave pública Ed25519.
// Este módulo não importa nem conhece segredo nenhum: é o que será embutido no app
// (a chave pública será embutida no app num milestone futuro; a privada, ATLAS_SIGN_SK, fica só no servidor).

export interface RespostaVerificar {
  pode_construir: boolean
  motivo: 'ok' | 'licenca_atrasada_pausa' | 'licenca_pausada' | 'licenca_cancelada' | 'negado'
  licenca_id: string | null
  valido_ate: string
  assinatura: string
}

/** Texto assinado. Inclui o motivo e o computador para a resposta não ser reaproveitada em outro PC. */
export const payloadResposta = (r: Pick<RespostaVerificar, 'pode_construir' | 'motivo' | 'licenca_id' | 'valido_ate'>, hash: string) =>
  `${r.pode_construir}|${r.motivo}|${r.licenca_id}|${hash}|${r.valido_ate}`

/** Chave pública Ed25519 crua (32 bytes) em base64. */
export function importarChavePublica(rawBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, 'Ed25519', true, ['verify'])
}

/** O app decide se a última resposta guardada ainda vale sem internet. */
export async function respostaAindaVale(pk: CryptoKey, r: RespostaVerificar, hash: string, agora: Date): Promise<boolean> {
  if (!r.pode_construir) return false
  if (new Date(r.valido_ate) <= agora) return false
  try {
    const sig = Uint8Array.from(atob(r.assinatura.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    return await crypto.subtle.verify('Ed25519', pk, sig, new TextEncoder().encode(payloadResposta(r, hash)))
  } catch {
    return false
  }
}
