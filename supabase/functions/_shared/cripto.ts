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
