// Item 3 — atraso da mensalidade: aviso por e-mail e pausa do pipeline em 7 dias.
// Falha de cobrança (webhook) → 'atrasada' + pausa_prevista_em = +7 dias + aviso 1. O job diário envia os avisos 2 e 3
// (dias 3 e 6) e, vencida a carência, muda para 'pausada'. Paga → volta a 'ativa'. O sistema já entregue continua no ar:
// só o pipeline (/verificar, que o M2 já nega em 'atrasada' vencida e em 'pausada') para.
import type { Licenca } from '../tipos.ts'
import { CARENCIA_ATRASO_MS, type DepsPagamento, MARCOS_AVISO_MS } from './config.ts'

/** Primeira falha de cobrança: abre a carência. Falhas seguintes (retentativas) não estendem o prazo. */
export async function marcarAtraso(d: DepsPagamento, lic: Licenca): Promise<void> {
  if (lic.status === 'cancelada' || lic.status === 'pausada') return
  if (lic.status === 'atrasada' && lic.pausa_prevista_em) return
  const nova: Licenca = { ...lic, status: 'atrasada', pausa_prevista_em: new Date(d.agora().getTime() + CARENCIA_ATRASO_MS), avisos_atraso: 0 }
  await d.store.salvarLicenca(nova)
  await enviarAvisosDevidos(d, nova) // aviso 1 na hora; se o e-mail falhar, o job tenta de novo
}

/** Pagamento confirmado: licença em dia de novo (inclusive se já estava pausada). Cancelada não volta. */
export async function sairDoAtraso(d: DepsPagamento, lic: Licenca): Promise<void> {
  if (lic.status === 'cancelada' || lic.status === 'ativa') return
  await d.store.salvarLicenca({ ...lic, status: 'ativa', pausa_prevista_em: null, avisos_atraso: 0 })
}

/** Envia (no máximo um por chamada) o próximo aviso cujo marco já passou. Grava só depois de enviar. */
async function enviarAvisosDevidos(d: DepsPagamento, lic: Licenca): Promise<void> {
  if (!lic.pausa_prevista_em) return
  const enviados = lic.avisos_atraso ?? 0
  if (enviados >= MARCOS_AVISO_MS.length) return
  const inicio = lic.pausa_prevista_em.getTime() - CARENCIA_ATRASO_MS
  if (d.agora().getTime() - inicio < MARCOS_AVISO_MS[enviados]) return
  const cliente = await d.store.clientePorId(lic.cliente_id)
  if (!cliente) return
  try {
    await d.enviarAvisoAtraso(cliente.email_compra, { n: (enviados + 1) as 1 | 2 | 3, pausa_em: lic.pausa_prevista_em, nome: cliente.nome_tratamento })
  } catch {
    return // e-mail fora do ar não pode derrubar o webhook nem o job; a próxima rodada repete
  }
  await d.store.salvarLicenca({ ...lic, avisos_atraso: enviados + 1 })
}

export interface ResumoAtrasos { avisos: number; pausadas: number; erros: number }

/** Job diário (agendador): avisos 2 e 3 e pausa ao fim da carência. Idempotente; uma licença com erro não trava as outras. */
export async function processarAtrasos(d: DepsPagamento): Promise<ResumoAtrasos> {
  const r: ResumoAtrasos = { avisos: 0, pausadas: 0, erros: 0 }
  for (const l of await d.store.licencasAtrasadas()) {
    try {
      const lic = (await d.store.licencaPorId(l.id)) ?? l // relê: o webhook pode ter confirmado o pagamento agora
      if (lic.status !== 'atrasada' || !lic.pausa_prevista_em) continue
      if (lic.pausa_prevista_em <= d.agora()) {
        await d.store.salvarLicenca({ ...lic, status: 'pausada' })
        await d.store.inserirOcorrencia({ cliente_id: lic.cliente_id, tipo: 'licenca_pausada', descricao: 'Pipeline pausado: mensalidade em atraso por mais de 7 dias.' })
        r.pausadas++
        continue
      }
      const antes = lic.avisos_atraso ?? 0
      await enviarAvisosDevidos(d, lic)
      const depois = (await d.store.licencaPorId(lic.id))?.avisos_atraso ?? antes
      if (depois > antes) r.avisos++
    } catch {
      r.erros++
    }
  }
  return r
}
