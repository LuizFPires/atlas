// Item 5 — /verificar: licença em dia + computador ativado + credencial da ativação, com tolerância curta offline.
// Fail-closed: só libera pelo que está na allowlist; qualquer outra coisa nega.
import { assinarEd25519, iguais, sha256 } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'
import { payloadResposta, type RespostaVerificar } from './verificar-publico.ts'

export type { RespostaVerificar } from './verificar-publico.ts'

/** Por quanto tempo o app pode confiar na última resposta sem internet. Curto de propósito. */
export const TOLERANCIA_OFFLINE_MS = 30 * 60_000

async function montarResposta(d: Deps, hash: string, pode: boolean, motivo: RespostaVerificar['motivo'], licencaId: string | null) {
  const base = {
    pode_construir: pode,
    motivo,
    licenca_id: licencaId,
    valido_ate: new Date(d.agora().getTime() + TOLERANCIA_OFFLINE_MS).toISOString(),
  }
  return { ...base, assinatura: await assinarEd25519(d.chaveAssinatura, payloadResposta(base, hash)) } satisfies RespostaVerificar
}

export async function verificar(
  d: Deps,
  a: { email: string; computador_hash: string; token_dispositivo: string },
): Promise<RespostaVerificar> {
  if (!HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  const negar = () => montarResposta(d, a.computador_hash, false, 'negado', null)
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!lic) return negar()
  // Credencial: o segredo da ativação (só o hash fica guardado). Sem ela, negação genérica, sem detalhes.
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) return negar()

  if (lic.status === 'ativa') return montarResposta(d, a.computador_hash, true, 'ok', lic.id)
  // 'atrasada' constrói só dentro da carência explícita (pausa_prevista_em no futuro).
  if (lic.status === 'atrasada') {
    if (lic.pausa_prevista_em && lic.pausa_prevista_em > d.agora()) return montarResposta(d, a.computador_hash, true, 'ok', lic.id)
    if (lic.pausa_prevista_em) return montarResposta(d, a.computador_hash, false, 'licenca_atrasada_pausa', lic.id)
    return negar() // atrasada sem pausa definida: fail-closed, motivo genérico
  }
  if (lic.status === 'pausada') return montarResposta(d, a.computador_hash, false, 'licenca_pausada', lic.id)
  if (lic.status === 'cancelada') return montarResposta(d, a.computador_hash, false, 'licenca_cancelada', lic.id)
  return negar() // status desconhecido
}
