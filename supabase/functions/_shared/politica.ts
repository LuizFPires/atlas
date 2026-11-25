// M65 — O Atlas não constrói outro Atlas (decisão do Luiz, 25/11/2026). O porteiro roda no app (Claude do cliente, só leitor); aqui o
// servidor guarda o que aconteceu e é a FONTE DA VERDADE do embargo: obra embargada (ou licença recusada) não recebe o kit, e sem o
// kit a linha de produção não roda. O app pode ser adulterado; o servidor não.
//  - Pedido bloqueado → POST /politica/registrar. A partir do 2º bloqueio da MESMA obra (desde a última liberação), a obra fica
//    'embargada'. Só aquela obra: as outras e as novas seguem.
//  - "Acha que é engano?" → POST /politica/analise (o texto vai ao painel; não muda a situação).
//  - A equipe decide no painel (/admin/politica/decidir): liberar (a obra volta), manter o embargo, ou recusar o uso do Atlas
//    (licença inteira, obra '*'). Nada é decidido sozinho além do embargo da obra.
// O texto do cliente é DADO: cortado, limpo de segredo (limparDescricao) e só guardado.
import { adminLogado, type DepsAdmin } from './admin.ts'
import { limparDescricao } from './ajuda-caso.ts'
import { iguais, sha256 } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE, type OndePolitica, type SituacaoPolitica } from './tipos.ts'

export const BLOQUEIOS_PARA_EMBARGO = 2
const ONDES: OndePolitica[] = ['ideia', 'prototipo', 'planilha', 'posobra', 'codigo']
const OBRA_RE = /^[A-Za-z0-9_.-]{1,80}$/
const DIA = 24 * 3600_000

interface Auth { email: unknown; computador_hash: unknown; token_dispositivo: string }

/** Mesma autenticação do /ajuda-caso: e-mail + computador + token do dispositivo. Devolve a licença (nunca vem do corpo). */
async function licencaDoDispositivo(d: Deps, a: Auth) {
  const negado = () => new ErroRegra('nao_autorizado', 'Não foi possível confirmar este computador.', 403)
  if (typeof a.computador_hash !== 'string' || !HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  if (typeof a.email !== 'string') throw negado()
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && !cliente.excluido_em ? await d.store.licencaDoCliente(cliente.id) : null
  if (!cliente || !lic) throw negado()
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) throw negado()
  return { cliente, lic }
}

/** 'livre' | 'embargada' | 'recusada' para uma obra (a recusa da licença inteira vence). */
export function situacaoDaObra(situacoes: SituacaoPolitica[], obraId: string): 'livre' | 'embargada' | 'recusada' {
  if (situacoes.some((s) => s.obra_id === '*' && s.situacao === 'recusada')) return 'recusada'
  const s = situacoes.find((x) => x.obra_id === obraId)
  return s && (s.situacao === 'embargada' || s.situacao === 'mantida') ? 'embargada' : 'livre'
}

export async function registrarPolitica(d: Deps, a: Auth & { obra_id: unknown; onde: unknown; texto: unknown }) {
  if (typeof a.obra_id !== 'string' || !OBRA_RE.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Identificação da obra inválida.')
  if (typeof a.onde !== 'string' || !ONDES.includes(a.onde as OndePolitica)) throw new ErroRegra('politica_invalida', 'Registro inválido.')
  const texto = typeof a.texto === 'string' ? limparDescricao(a.texto) : ''
  if (!texto) throw new ErroRegra('politica_invalida', 'Registro inválido.')
  const { lic } = await licencaDoDispositivo(d, a)
  if (!(await d.store.tentarEvento(`politica:${lic.id}`, 30, 3600_000, d.agora()))) throw new ErroRegra('muitas_solicitacoes', 'Muitos pedidos seguidos. Tente de novo mais tarde.', 429)
  const agora = d.agora()
  await d.store.registrarEventoPolitica({ licenca_id: lic.id, obra_id: a.obra_id, onde: a.onde as OndePolitica, texto, criado_em: agora })
  const situacoes = await d.store.situacoesPolitica(lic.id)
  const atual = situacoes.find((s) => s.obra_id === a.obra_id)
  const desde = atual && atual.situacao === 'liberada' ? new Date(atual.desde.getTime() + 1) : new Date(0)
  const bloqueios = (await d.store.eventosPoliticaDaObra(lic.id, a.obra_id, desde)).filter((e) => e.onde !== 'engano').length
  if (bloqueios >= BLOQUEIOS_PARA_EMBARGO && situacaoDaObra(situacoes, a.obra_id) === 'livre') {
    await d.store.definirSituacaoPolitica({ licenca_id: lic.id, obra_id: a.obra_id, situacao: 'embargada', desde: agora, decidido_por: null })
  }
  return { situacao: situacaoDaObra(await d.store.situacoesPolitica(lic.id), a.obra_id) }
}

export async function pedirAnalise(d: Deps, a: Auth & { obra_id: unknown; texto: unknown }) {
  if (typeof a.obra_id !== 'string' || !OBRA_RE.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Identificação da obra inválida.')
  const texto = typeof a.texto === 'string' ? limparDescricao(a.texto) : ''
  if (!texto) throw new ErroRegra('politica_invalida', 'Conte em poucas palavras para que serve o sistema.')
  const { lic } = await licencaDoDispositivo(d, a)
  if (!(await d.store.tentarEvento(`politica-analise:${lic.id}`, 5, DIA, d.agora()))) throw new ErroRegra('muitas_solicitacoes', 'Você já pediu análise hoje. A equipe responde em até 1 dia útil.', 429)
  await d.store.registrarEventoPolitica({ licenca_id: lic.id, obra_id: a.obra_id, onde: 'engano', texto, criado_em: d.agora() })
  return { ok: true as const }
}

export async function situacaoPolitica(d: Deps, a: Auth & { obra_id: unknown }) {
  if (typeof a.obra_id !== 'string' || !OBRA_RE.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Identificação da obra inválida.')
  const { lic } = await licencaDoDispositivo(d, a)
  return { situacao: situacaoDaObra(await d.store.situacoesPolitica(lic.id), a.obra_id) }
}

// ── Painel do Luiz ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function painelPolitica(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const desde = new Date(d.agora().getTime() - 30 * DIA)
  const [eventos, abertas, clientes, licencas] = await Promise.all([d.store.eventosPoliticaRecentes(desde, 300), d.store.situacoesPoliticaAbertas(), d.store.listarClientes(), d.store.listarLicencas()])
  const nome = (licencaId: string) => { const l = licencas.find((x) => x.id === licencaId); const c = l ? clientes.find((x) => x.id === l.cliente_id) : null; return c ? (c.nome_tratamento || c.email_compra) : 'cliente' }
  const chave = (e: { licenca_id: string; obra_id: string }) => `${e.licenca_id}|${e.obra_id}`
  const grupos = new Map<string, { licenca_id: string; obra_id: string; cliente: string; bloqueios: number; ultimo: { onde: string; texto: string; quando: Date }; analise: string | null; situacao: string }>()
  for (const e of eventos) {
    const k = chave(e)
    const g = grupos.get(k) ?? { licenca_id: e.licenca_id, obra_id: e.obra_id, cliente: nome(e.licenca_id), bloqueios: 0, ultimo: { onde: e.onde, texto: e.texto, quando: e.criado_em }, analise: null, situacao: 'livre' }
    if (e.onde === 'engano') { if (!g.analise) g.analise = e.texto } else g.bloqueios++
    grupos.set(k, g)
  }
  for (const s of abertas) {
    const g = grupos.get(chave(s)) ?? { licenca_id: s.licenca_id, obra_id: s.obra_id, cliente: nome(s.licenca_id), bloqueios: 0, ultimo: { onde: '-', texto: '', quando: s.desde }, analise: null, situacao: 'livre' }
    g.situacao = s.situacao
    grupos.set(chave(s), g)
  }
  return { casos: [...grupos.values()].sort((a, b) => b.ultimo.quando.getTime() - a.ultimo.quando.getTime()), no_mes: eventos.filter((e) => e.onde !== 'engano').length }
}

export async function decidirPolitica(d: DepsAdmin, jwt: string, a: { licenca_id: unknown; obra_id: unknown; decisao: unknown }) {
  const eu = await adminLogado(d, jwt)
  if (typeof a.licenca_id !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(a.licenca_id)) throw new ErroRegra('licenca_invalida', 'Licença inválida.')
  if (typeof a.obra_id !== 'string' || !OBRA_RE.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Obra inválida.')
  const mapa: Record<string, SituacaoPolitica['situacao']> = { liberar: 'liberada', manter: 'mantida', recusar: 'recusada' }
  const nova = typeof a.decisao === 'string' ? mapa[a.decisao] : undefined
  if (!nova) throw new ErroRegra('decisao_invalida', 'Decisão inválida.')
  const quem = eu.email.slice(0, 120)
  // Recusar o uso vale para a licença inteira (obra '*'); a obra fica registrada como mantida.
  if (nova === 'recusada') {
    await d.store.definirSituacaoPolitica({ licenca_id: a.licenca_id, obra_id: '*', situacao: 'recusada', desde: d.agora(), decidido_por: quem })
    await d.store.definirSituacaoPolitica({ licenca_id: a.licenca_id, obra_id: a.obra_id, situacao: 'mantida', desde: d.agora(), decidido_por: quem })
  } else {
    await d.store.definirSituacaoPolitica({ licenca_id: a.licenca_id, obra_id: a.obra_id, situacao: nova, desde: d.agora(), decidido_por: quem })
  }
  return { ok: true as const }
}
