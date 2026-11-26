// Item 5 — /verificar: licença em dia + computador ativado + credencial da ativação, com tolerância curta offline.
// Fail-closed: só libera pelo que está na allowlist; qualquer outra coisa nega.
import { assinarEd25519, iguais, sha256 } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'
import { payloadResposta, type RespostaVerificar } from './verificar-publico.ts'

export type { RespostaVerificar } from './verificar-publico.ts'

/** Por quanto tempo o app pode confiar na última resposta sem internet. Curto de propósito. */
export const TOLERANCIA_OFFLINE_MS = 30 * 60_000

type LicencaStatus = NonNullable<Awaited<ReturnType<Deps['store']['licencaDoCliente']>>>

/** Matriz única de status (fail-closed), usada por /verificar e /instancia/validar. Só 'ok' libera. */
export function motivoDaLicenca(lic: Pick<LicencaStatus, 'tipo' | 'status' | 'validade_em' | 'pausa_prevista_em'>, agora: Date): RespostaVerificar['motivo'] {
  // Cortesia: vale só até validade_em. Venceu (ou veio sem prazo): acesso cai.
  if (lic.tipo === 'cortesia' && lic.status === 'ativa' && (!lic.validade_em || lic.validade_em.getTime() <= agora.getTime())) return 'cortesia_expirada'
  if (lic.status === 'ativa') return 'ok'
  // 'atrasada' constrói só dentro da carência explícita (pausa_prevista_em no futuro).
  if (lic.status === 'atrasada') {
    if (lic.pausa_prevista_em && lic.pausa_prevista_em > agora) return 'ok'
    return lic.pausa_prevista_em ? 'licenca_atrasada_pausa' : 'negado'
  }
  if (lic.status === 'pausada') return 'licenca_pausada'
  if (lic.status === 'cancelada') return 'licenca_cancelada'
  return 'negado' // status desconhecido
}

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
  if (!HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'O Atlas deste computador mandou uma identificação que o servidor não reconhece. Atualize o Atlas e tente de novo.')
  const negar = () => montarResposta(d, a.computador_hash, false, 'negado', null)
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!lic) return negar()
  // Credencial: o segredo da ativação (só o hash fica guardado). Sem ela, negação genérica, sem detalhes.
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) return negar()

  const motivo = motivoDaLicenca(lic, d.agora())
  // Cortesia vencida: a licença é encerrada (best-effort; o bloqueio não depende disso).
  if (motivo === 'cortesia_expirada') await d.store.atualizarLicencaSe(lic.id, { status: 'cancelada' }, { status: 'ativa' })
  return motivo === 'ok' ? montarResposta(d, a.computador_hash, true, 'ok', lic.id) : motivo === 'negado' ? negar() : montarResposta(d, a.computador_hash, false, motivo, lic.id)
}
