// Item 3 — ativação por e-mail + código de 6 dígitos. 1 licença = 1 computador ativo.
import { codigo6, hmac, iguais, sha256, tokenAleatorio } from './cripto.ts'
import { consumirLinkOuFalha, validarLink } from './links.ts'
import { type Deps, ErroRegra, type Finalidade, HASH_RE } from './tipos.ts'

export const VALIDADE_CODIGO_MS = 10 * 60_000
export const MAX_TENTATIVAS = 5
/** Emissão: no máximo 3 códigos a cada 15 min, por cliente e por IP. */
export const MAX_EMISSOES = 3
export const JANELA_LIMITE_MS = 15 * 60_000
/** Tentativas de conferir código por cliente+finalidade na janela (somando todos os códigos emitidos). */
export const MAX_TENTATIVAS_JANELA = 10

const norm = (e: string) => e.trim().toLowerCase()

/** HMAC do computador para o ledger de teste grátis (domínio 'dispositivo:'; sem o segredo não dá para reverter). */
export const hashDispositivo = (d: Deps, computadorHash: string) => hmac(d.segredo, `dispositivo:${computadorHash}`)
/** A trava "1 teste por computador" vale só para teste grátis de verdade: cortesia E origem degustacao. Compra nunca entra. */
export const ehTesteGratis = (l: { tipo?: string; origem?: string | null }) => l.tipo === 'cortesia' && l.origem === 'degustacao'
export const MSG_JA_TESTOU = 'Este computador já usou o teste grátis do Atlas. Para continuar por aqui, é só assinar; seu teste fica por conta da casa, mas o próximo é pago.'

/** Hash do código com HMAC do servidor: sem o segredo, o banco vazado não deixa testar 10^6 códigos offline. */
const hashCodigo = (d: Deps, clienteId: string, f: Finalidade, codigo: string) => hmac(d.segredo, `codigo:${clienteId}:${f}:${codigo}`)

/**
 * Resposta neutra: não revela se o e-mail existe nem se o limite por cliente foi atingido.
 * O limite por IP vale para qualquer e-mail (429), então não vaza nada sobre contas.
 */
export async function solicitarCodigo(d: Deps, email: string, finalidade: Finalidade = 'ativacao', ip = 'desconhecido') {
  if (!(await d.store.tentarEvento(`emissao:ip:${ip}`, MAX_EMISSOES, JANELA_LIMITE_MS, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Você pediu códigos demais. Espere uns 15 minutos e tente de novo.', 429)
  }
  const cliente = await d.store.clientePorEmail(norm(email))
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (cliente && lic && lic.status !== 'cancelada') {
    if (await d.store.tentarEvento(`emissao:cliente:${cliente.id}:${finalidade}`, MAX_EMISSOES, JANELA_LIMITE_MS, d.agora())) {
      const c = codigo6()
      await d.store.inserirCodigo(
        {
          cliente_id: cliente.id,
          finalidade,
          codigo_hash: await hashCodigo(d, cliente.id, finalidade, c),
          expira_em: new Date(d.agora().getTime() + VALIDADE_CODIGO_MS),
        },
        d.agora(),
      )
      await d.enviarCodigoPorEmail(cliente.email_compra, c)
    }
  }
  return { ok: true }
}

/** Confere e consome o código (usado também pela troca de computador). Tudo por UPDATE atômico no store. */
export async function consumirCodigo(d: Deps, clienteId: string, finalidade: Finalidade, codigo: string) {
  const chave = `falhas:${clienteId}:${finalidade}`
  if (!(await d.store.tentarEvento(chave, MAX_TENTATIVAS_JANELA, JANELA_LIMITE_MS, d.agora()))) {
    throw new ErroRegra('muitas_tentativas', 'Muitas tentativas seguidas. Espere uns 15 minutos.', 429)
  }
  const c = await d.store.codigoAberto(clienteId, finalidade)
  if (!c || c.expira_em <= d.agora()) throw new ErroRegra('codigo_invalido', 'Código vencido ou inexistente. Peça um novo.', 400)
  if (c.tentativas >= MAX_TENTATIVAS) throw new ErroRegra('codigo_bloqueado', 'Muitas tentativas. Peça um novo código.', 429)
  // A tentativa é contada ANTES de comparar: quem chuta em paralelo gasta as mesmas 5 vagas.
  const t = await d.store.incrementarTentativa(c.id, MAX_TENTATIVAS, d.agora())
  if (!t) throw new ErroRegra('codigo_bloqueado', 'Muitas tentativas. Peça um novo código.', 429)
  if (!iguais(await hashCodigo(d, clienteId, finalidade, codigo.trim()), t.codigo_hash)) {
    throw new ErroRegra('codigo_invalido', 'Código incorreto.', 400)
  }
  if (!(await d.store.consumirCodigo(c.id, MAX_TENTATIVAS, d.agora()))) {
    throw new ErroRegra('codigo_invalido', 'Código vencido ou já usado. Peça um novo.', 400)
  }
  await d.store.limparEventos(chave)
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
  // 1 degustação por computador (só teste grátis; compra e cortesia manual do gestor não entram). Antes de gastar o código.
  const dispositivo = ehTesteGratis(lic) ? await hashDispositivo(d, a.computador_hash) : null
  if (!atual && dispositivo && (await d.store.computadorJaTestou(dispositivo, lic.id))) {
    throw new ErroRegra('ja_testou_neste_computador', MSG_JA_TESTOU, 409)
  }
  await consumirCodigo(d, cliente.id, 'ativacao', a.codigo)
  await consumirLinkOuFalha(d, link.id)
  // Segredo da ativação: devolvido uma única vez ao app; no banco fica só o hash.
  const token_dispositivo = tokenAleatorio()
  const tokenHash = await sha256(token_dispositivo)
  if (atual) await d.store.rotacionarToken(atual.id, tokenHash)
  else {
    if (dispositivo && !(await d.store.registrarDispositivoTeste(dispositivo, lic.id, d.agora()))) throw new ErroRegra('ja_testou_neste_computador', MSG_JA_TESTOU, 409)
    await d.store.inserirAtivacao(lic.id, a.computador_hash, d.agora(), tokenHash)
  }
  return { licenca_id: lic.id, nome_tratamento: cliente.nome_tratamento, token_dispositivo }
}
