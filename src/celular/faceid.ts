// M52 (protótipo M09b/M10/M11 aprovado pelo Luiz em 25/11/2026): abrir o app do celular com o Face ID (ou a digital, no Android).
// Usa a chave de acesso do próprio aparelho (WebAuthn, autenticador da plataforma, com verificação do usuário): o rosto nunca sai
// do iPhone e o Atlas nunca recebe imagem nenhuma. É a trava de abrir o app neste aparelho: o login continua sendo o do código
// do e-mail (que fica guardado e se renova sozinho). Aqui só guardamos o identificador da chave criada (nada secreto).
export const CHAVE_FACEID = 'atlas.celular.faceid'
export const CHAVE_DESTRAVADO = 'atlas.celular.destravado'

export interface FaceId {
  /** O aparelho tem Face ID / digital disponível para sites? */
  disponivel(): Promise<boolean>
  /** Já foi ligado neste aparelho? */
  ligado(): boolean
  /** Cria a chave (o iPhone pede o rosto). false se a pessoa cancelou ou não deu. */
  ligar(email: string, nome: string): Promise<boolean>
  /** Confere o rosto. false se não reconheceu ou cancelou. */
  conferir(): Promise<boolean>
  desligar(): void
  /** Já conferiu desde que o app abriu? (o iPhone fecha o app em segundo plano: abriu de novo, confere de novo) */
  destravado(): boolean
}

const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const ler = (k: string, s: Storage) => { try { return s.getItem(k) } catch { return null } }
const gravar = (k: string, v: string | null, s: Storage) => { try { if (v === null) s.removeItem(k); else s.setItem(k, v) } catch { /* sem armazenamento */ } }

export function criarFaceIdNavegador(): FaceId {
  const id = () => { try { return (JSON.parse(ler(CHAVE_FACEID, localStorage) ?? 'null') as { id?: string } | null)?.id ?? null } catch { return null } }
  return {
    async disponivel() {
      try { return typeof PublicKeyCredential !== 'undefined' && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() } catch { return false }
    },
    ligado: () => id() !== null,
    async ligar(email, nome) {
      try {
        const c = await navigator.credentials.create({ publicKey: {
          challenge: aleatorio(32), rp: { name: 'Atlas' },
          user: { id: aleatorio(16), name: email || 'atlas', displayName: nome || email || 'Atlas' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
          timeout: 60_000, attestation: 'none',
        } }) as PublicKeyCredential | null
        if (!c) return false
        gravar(CHAVE_FACEID, JSON.stringify({ id: b64url(c.rawId), em: new Date().toISOString() }), localStorage)
        gravar(CHAVE_DESTRAVADO, '1', sessionStorage)
        return true
      } catch { return false }
    },
    async conferir() {
      const k = id()
      if (!k) return false
      try {
        const a = await navigator.credentials.get({ publicKey: { challenge: aleatorio(32), allowCredentials: [{ type: 'public-key', id: deB64url(k), transports: ['internal'] }], userVerification: 'required', timeout: 60_000 } }) as PublicKeyCredential | null
        const ok = !!a && (a.response as AuthenticatorAssertionResponse).authenticatorData !== undefined
        if (ok) gravar(CHAVE_DESTRAVADO, '1', sessionStorage)
        return ok
      } catch { return false }
    },
    desligar() { gravar(CHAVE_FACEID, null, localStorage); gravar(CHAVE_DESTRAVADO, null, sessionStorage) },
    destravado: () => ler(CHAVE_DESTRAVADO, sessionStorage) === '1',
  }
}

/** Sem Face ID (testes e navegadores sem a função): o app abre direto, como antes. */
export const semFaceId: FaceId = { disponivel: async () => false, ligado: () => false, ligar: async () => false, conferir: async () => false, desligar() {}, destravado: () => true }
