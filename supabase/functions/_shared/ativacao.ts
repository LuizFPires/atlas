// Item 3 — ativação por e-mail + código de 6 dígitos. 1 licença = 1 computador ativo.
import { codigo6, sha256 } from './cripto.ts'
import { validarLink } from './links.ts'
import { type Deps, ErroRegra, type Finalidade, HASH_RE } from './tipos.ts'

export const VALIDADE_CODIGO_MS = 10 * 60_000
export const MAX_TENTATIVAS = 5

const norm = (e: string) => e.trim().toLowerCase()

/** Resposta neutra: não revela se o e-mail existe. */
export async function solicitarCodigo(d: Deps, email: string, finalidade: Finalidade = 'ativacao') {
  const cliente = await d.store.clientePorEmail(norm(email))
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (cliente && lic && lic.status !== 'cancelada') {
    const c = codigo6()
    await d.store.inserirCodigo({
      cliente_id: cliente.id,
      finalidade,
      codigo_hash: await sha256(`${cliente.id}:${c}`),
      expira_em: new Date(d.agora().getTime() + VALIDADE_CODIGO_MS),
    })
    await d.enviarCodigoPorEmail(cliente.email_compra, c)
  }
  return { ok: true }
}

/** Confere e consome o código (usado também pela troca de computador). */
export async function consumirCodigo(d: Deps, clienteId: string, finalidade: Finalidade, codigo: string) {
  const c = await d.store.codigoAberto(clienteId, finalidade)
  if (!c || c.expira_em <= d.agora()) throw new ErroRegra('codigo_invalido', 'Código vencido ou inexistente. Peça um novo.', 400)
  if (c.tentativas >= MAX_TENTATIVAS) throw new ErroRegra('codigo_bloqueado', 'Muitas tentativas. Peça um novo código.', 429)
  if ((await sha256(`${clienteId}:${codigo.trim()}`)) !== c.codigo_hash) {
    await d.store.salvarCodigo({ ...c, tentativas: c.tentativas + 1 })
    throw new ErroRegra('codigo_invalido', 'Código incorreto.', 400)
  }
  await d.store.salvarCodigo({ ...c, usado_em: d.agora() })
}

export async function confirmarAtivacao(d: Deps, a: { email: string; codigo: string; token: string; computador_hash: string }) {
  if (!HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  const link = await validarLink(d, a.token)
  const cliente = await d.store.clientePorEmail(norm(a.email))
  if (!cliente || cliente.id !== link.cliente_id) throw new ErroRegra('codigo_invalido', 'E-mail ou código não conferem.', 400)
  const lic = await d.store.licencaDoCliente(cliente.id)
  if (!lic || lic.status === 'cancelada') throw new ErroRegra('sem_licenca', 'Licença não encontrada.', 404)
  const atual = await d.store.ativacaoAtiva(lic.id)
  if (atual && atual.computador_hash !== a.computador_hash) {
    throw new ErroRegra('outro_computador', 'Essa licença já está em outro computador. Use "Trocar de computador" no portal.', 409)
  }
  await consumirCodigo(d, cliente.id, 'ativacao', a.codigo)
  if (!atual) await d.store.inserirAtivacao(lic.id, a.computador_hash, d.agora())
  await d.store.marcarLinkUsado(link.id, d.agora())
  return { licenca_id: lic.id, nome_tratamento: cliente.nome_tratamento }
}
