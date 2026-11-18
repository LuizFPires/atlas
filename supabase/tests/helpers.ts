import { sha256 } from '../functions/_shared/cripto.ts'
import { StoreMemoria } from '../functions/_shared/memoria.ts'
import type { Deps } from '../functions/_shared/tipos.ts'

export const H1 = 'a'.repeat(64)
export const H2 = 'b'.repeat(64)
export const TOKEN = 'token-de-teste'

const par = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair
/** Chave pública que o app teria embutida. */
export const chavePublica = par.publicKey

export function montar(status: 'ativa' | 'atrasada' | 'pausada' | 'cancelada' = 'ativa') {
  const store = new StoreMemoria()
  store.clientes.push({ id: 'c1', email_compra: 'ana@loja.com', nome_tratamento: 'Ana' })
  store.licencas.push({ id: 'l1', cliente_id: 'c1', status, pausa_prevista_em: null, troca_liberada_em: null })
  const relogio = { t: new Date('2026-11-18T12:00:00Z') }
  const emails: string[] = []
  const deps: Deps = {
    store,
    agora: () => relogio.t,
    enviarCodigoPorEmail: async (_e, c) => { emails.push(c) },
    segredo: 'segredo-de-teste',
    chaveAssinatura: par.privateKey,
  }
  const avancar = (ms: number) => { relogio.t = new Date(relogio.t.getTime() + ms) }
  /** Ativa direto no store; o segredo da ativação é TOKEN (no banco vai só o hash). */
  const ativar = async (hash = H1) => store.inserirAtivacao('l1', hash, relogio.t, await sha256(TOKEN))
  return { store, deps, emails, avancar, ativar }
}
