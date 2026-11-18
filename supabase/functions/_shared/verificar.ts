// Item 5 — /verificar: licença em dia + computador ativado, com tolerância curta offline.
import { hmac } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE, type Licenca } from './tipos.ts'

/** Por quanto tempo o app pode confiar na última resposta sem internet. Curto de propósito. */
export const TOLERANCIA_OFFLINE_MS = 30 * 60_000

export interface RespostaVerificar {
  pode_construir: boolean
  motivo: 'ok' | 'licenca_atrasada_pausa' | 'licenca_pausada' | 'licenca_cancelada' | 'computador_nao_ativado' | 'sem_licenca'
  licenca_id: string | null
  valido_ate: string
  assinatura: string
}

const payload = (r: Pick<RespostaVerificar, 'pode_construir' | 'licenca_id' | 'valido_ate'>, hash: string) =>
  `${r.pode_construir}|${r.licenca_id}|${hash}|${r.valido_ate}`

async function montarResposta(d: Deps, hash: string, pode: boolean, motivo: RespostaVerificar['motivo'], lic: Licenca | null) {
  const base = {
    pode_construir: pode,
    licenca_id: lic?.id ?? null,
    valido_ate: new Date(d.agora().getTime() + TOLERANCIA_OFFLINE_MS).toISOString(),
  }
  return { ...base, motivo, assinatura: await hmac(d.segredo, payload(base, hash)) } satisfies RespostaVerificar
}

export async function verificar(d: Deps, a: { email: string; computador_hash: string }): Promise<RespostaVerificar> {
  if (!HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!lic) return montarResposta(d, a.computador_hash, false, 'sem_licenca', null)
  if (lic.status === 'cancelada') return montarResposta(d, a.computador_hash, false, 'licenca_cancelada', lic)
  if (lic.status === 'pausada') return montarResposta(d, a.computador_hash, false, 'licenca_pausada', lic)
  if (lic.status === 'atrasada' && lic.pausa_prevista_em && lic.pausa_prevista_em <= d.agora()) {
    return montarResposta(d, a.computador_hash, false, 'licenca_atrasada_pausa', lic)
  }
  const ativa = await d.store.ativacaoAtiva(lic.id)
  if (!ativa || ativa.computador_hash !== a.computador_hash) {
    return montarResposta(d, a.computador_hash, false, 'computador_nao_ativado', lic)
  }
  // 'atrasada' dentro dos 7 dias de carência ainda constrói (aviso é do app/e-mail)
  return montarResposta(d, a.computador_hash, true, 'ok', lic)
}

/**
 * Usado pelo app: decide se a última resposta guardada ainda vale sem internet.
 * Roda o mesmo HMAC; o segredo de verificação do app é o público/derivado (etapa do app, M posterior).
 */
export async function respostaAindaVale(d: Deps, r: RespostaVerificar, hash: string): Promise<boolean> {
  if (!r.pode_construir) return false
  if (new Date(r.valido_ate) <= d.agora()) return false
  return (await hmac(d.segredo, payload(r, hash))) === r.assinatura
}
