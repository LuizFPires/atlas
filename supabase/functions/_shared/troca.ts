// Item 4 — troca de computador: 1 a cada 7 dias, com override manual do admin.
import { consumirCodigo } from './ativacao.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'

export const INTERVALO_TROCA_MS = 7 * 24 * 3600_000

export async function trocarComputador(d: Deps, a: { email: string; codigo: string; novo_hash: string }) {
  if (!HASH_RE.test(a.novo_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!cliente || !lic || lic.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  const atual = await d.store.ativacaoAtiva(lic.id)
  if (!atual) throw new ErroRegra('sem_ativacao', 'Essa licença ainda não foi ativada em nenhum computador.', 409)
  if (atual.computador_hash === a.novo_hash) throw new ErroRegra('mesmo_computador', 'Esse já é o computador ativo.', 409)

  const override = lic.troca_liberada_em !== null
  if (!override) {
    const ultima = (await d.store.trocasDa(lic.id)).reduce<Date | null>((m, t) => (!m || t.feita_em > m ? t.feita_em : m), null)
    const proxima = ultima && new Date(ultima.getTime() + INTERVALO_TROCA_MS)
    if (proxima && proxima > d.agora()) {
      const e = new ErroRegra('troca_limite', 'Você já trocou de computador há pouco. Só dá para trocar 1 vez a cada 7 dias.', 429)
      Object.assign(e, { proxima_troca_em: proxima })
      throw e
    }
  }
  await consumirCodigo(d, cliente.id, 'troca', a.codigo)
  const agora = d.agora()
  await d.store.desativarAtivacao(atual.id, agora)
  await d.store.inserirAtivacao(lic.id, a.novo_hash, agora)
  await d.store.inserirTroca({ licenca_id: lic.id, de_hash: atual.computador_hash, para_hash: a.novo_hash, feita_em: agora, por_admin: override })
  if (override) await d.store.salvarLicenca({ ...lic, troca_liberada_em: null })
  return { ok: true }
}

/** Override manual (admin, F16): libera uma troca fora do limite. A autenticação do admin é da borda HTTP. */
export async function liberarTroca(d: Deps, licencaId: string, motivo: string) {
  const lic = await d.store.licencaPorId(licencaId)
  if (!lic) throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  await d.store.salvarLicenca({ ...lic, troca_liberada_em: d.agora() })
  await d.store.inserirOcorrencia({ cliente_id: lic.cliente_id, tipo: 'override_troca', descricao: motivo })
}
