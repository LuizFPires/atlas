const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

export async function sha256(txt: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(txt)))
}

export async function hmac(segredo: string, txt: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(txt)))
}

export function tokenAleatorio(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function codigo6(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return String(n).padStart(6, '0')
}

/** Comparação em tempo constante (strings hex/base64url de mesmo formato). */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** Chave privada Ed25519 (PKCS8 em base64, vinda do env ATLAS_SIGN_SK). Só o servidor a tem. */
export function importarChavePrivada(pkcs8Base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', deB64(pkcs8Base64), 'Ed25519', false, ['sign'])
}

export async function assinarEd25519(sk: CryptoKey, txt: string): Promise<string> {
  return b64u(await crypto.subtle.sign('Ed25519', sk, enc.encode(txt)))
}
