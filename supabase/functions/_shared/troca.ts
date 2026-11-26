// Item 4 — troca de computador: 1 a cada 7 dias, com override manual do admin.
import { consumirCodigo, ehTesteGratis, hashDispositivo, MSG_JA_TESTOU } from './ativacao.ts'
import { sha256, tokenAleatorio } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'

export const INTERVALO_TROCA_MS = 7 * 24 * 3600_000

/** Cliente tentou trocar antes dos 7 dias: vira "precisa de atenção" no painel (F16) — uma por cliente a cada 24 h, sem texto livre dele. */
export async function registrarTrocaAntecipada(d: Deps, clienteId: string, proxima: Date) {
  if (!(await d.store.tentarEvento(`ocorrencia:troca_antecipada:${clienteId}`, 1, 24 * 3600_000, d.agora()))) return
  try {
    await d.store.inserirOcorrencia({ cliente_id: clienteId, tipo: 'troca_antecipada', descricao: `Tentou trocar de computador antes do prazo de 7 dias (libera em ${proxima.toISOString().slice(0, 10)}).` })
  } catch { /* o aviso ao admin nunca pode derrubar a resposta ao cliente */ }
}

export async function trocarComputador(d: Deps, a: { email: string; codigo: string; novo_hash: string }) {
  if (!HASH_RE.test(a.novo_hash)) throw new ErroRegra('computador_invalido', 'O Atlas deste computador mandou uma identificação que o servidor não reconhece. Atualize o Atlas e tente de novo.')
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!cliente || !lic || lic.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Não achamos essa licença. Confira se é o mesmo e-mail da compra.', 404)
  const atual = await d.store.ativacaoAtiva(lic.id)
  if (!atual) throw new ErroRegra('sem_ativacao', 'Essa licença ainda não foi ativada em nenhum computador.', 409)
  if (atual.computador_hash === a.novo_hash) throw new ErroRegra('mesmo_computador', 'Esse já é o computador ativo.', 409)

  const override = lic.troca_liberada_em !== null
  if (!override) {
    const ultima = (await d.store.trocasDa(lic.id)).reduce<Date | null>((m, t) => (!m || t.feita_em > m ? t.feita_em : m), null)
    const proxima = ultima && new Date(ultima.getTime() + INTERVALO_TROCA_MS)
    if (proxima && proxima > d.agora()) {
      await registrarTrocaAntecipada(d, cliente.id, proxima)
      const e = new ErroRegra('troca_limite', 'Você já trocou de computador há pouco. Só dá para trocar 1 vez a cada 7 dias.', 429)
      Object.assign(e, { proxima_troca_em: proxima })
      throw e
    }
  }
  // Teste grátis não lava o limite trocando de PC: mesma checagem da ativação, antes de gastar o código.
  const dispositivo = ehTesteGratis(lic) ? await hashDispositivo(d, a.novo_hash) : null
  if (dispositivo && (await d.store.computadorJaTestou(dispositivo, lic.id))) {
    await d.store.registrarBarradaDispositivo(dispositivo, d.agora()) // alimenta a auto-auditoria (bloco C)
    throw new ErroRegra('ja_testou_neste_computador', MSG_JA_TESTOU, 409)
  }
  await consumirCodigo(d, cliente.id, 'troca', a.codigo)
  const token_dispositivo = tokenAleatorio()
  // Uma transação só (RPC trocar_computador): desativa a atual, cria a nova, registra a troca e zera o override.
  const feita = await d.store.trocarAtivacao({
    licenca_id: lic.id,
    ativacao_atual_id: atual.id,
    de_hash: atual.computador_hash,
    para_hash: a.novo_hash,
    token_hash: await sha256(token_dispositivo),
    quando: d.agora(),
    por_admin: override,
    intervalo_ms: override ? 0 : INTERVALO_TROCA_MS,
    dispositivo_hmac: dispositivo,
  })
  if (!feita) throw new ErroRegra('troca_conflito', 'A troca não pôde ser concluída agora. Peça um novo código e tente de novo.', 409)
  return { ok: true, token_dispositivo }
}

/** Override manual (admin, F16): libera uma troca fora do limite. A autenticação do admin é da borda HTTP. */
export async function liberarTroca(d: Deps, licencaId: string, motivo: string) {
  const lic = await d.store.licencaPorId(licencaId)
  if (!lic) throw new ErroRegra('sem_licenca', 'Não achamos essa licença. Confira se é o mesmo e-mail da compra.', 404)
  await d.store.salvarLicenca({ ...lic, troca_liberada_em: d.agora() })
  await d.store.inserirOcorrencia({ cliente_id: lic.cliente_id, tipo: 'override_troca', descricao: motivo })
}
