import { StoreMemoria } from '../functions/_shared/memoria.ts'
import type { Deps } from '../functions/_shared/tipos.ts'

export const H1 = 'a'.repeat(64)
export const H2 = 'b'.repeat(64)

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
  }
  const avancar = (ms: number) => { relogio.t = new Date(relogio.t.getTime() + ms) }
  return { store, deps, emails, avancar }
}
