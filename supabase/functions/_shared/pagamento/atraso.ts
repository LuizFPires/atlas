// Atraso da mensalidade: entra em 'atrasada' com pausa prevista em 7 dias; paga → volta a 'ativa'.
// (O M2 já trata 'atrasada' no /verificar: constrói dentro da carência, nega depois.)
import type { Licenca } from '../tipos.ts'
import { CARENCIA_ATRASO_MS, type DepsPagamento } from './config.ts'

/** Primeira falha de cobrança: abre a carência. Falhas seguintes (retentativas) não estendem o prazo. */
export async function marcarAtraso(d: DepsPagamento, lic: Licenca): Promise<void> {
  if (lic.status === 'cancelada' || lic.status === 'pausada') return
  if (lic.status === 'atrasada' && lic.pausa_prevista_em) return
  await d.store.salvarLicenca({ ...lic, status: 'atrasada', pausa_prevista_em: new Date(d.agora().getTime() + CARENCIA_ATRASO_MS), avisos_atraso: 0 })
}

/** Pagamento confirmado: licença em dia de novo (inclusive se já estava pausada). Cancelada não volta. */
export async function sairDoAtraso(d: DepsPagamento, lic: Licenca): Promise<void> {
  if (lic.status === 'cancelada' || lic.status === 'ativa') return
  await d.store.salvarLicenca({ ...lic, status: 'ativa', pausa_prevista_em: null, avisos_atraso: 0 })
}
