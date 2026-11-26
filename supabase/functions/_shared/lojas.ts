// M59 — Os 12 testadores do Google (decisão do Luiz, 25/11/2026: "Página de convite do Atlas"). O Google não informa quem entrou no
// teste fechado; por isso o convite do WhatsApp abre uma página do Atlas (/teste/<código>): a pessoa entra no grupo do Google, vira
// testadora, instala e toca "Já instalei". O Atlas conta por ali e conta os 14 dias a partir do 12º.
//  - POST /lojas/convite (computador do cliente): cria (ou devolve) o convite da obra. Só endereços do Google (grupo e opt-in).
//  - POST /lojas/convite/ver e /lojas/teste/entrar (públicos, sem login): o mínimo para a página; limite por lugar e por convite.
//  - POST /lojas/testadores (computador do cliente): pessoas, dia do prazo e se completou.
// Nome do testador é DADO: cortado e limpo; nunca e-mail nem telefone.
import { limparDescricao } from './ajuda-caso.ts'
import { iguais, sha256 } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'

export const TESTADORES_PRECISOS = 12
export const DIAS_DE_TESTE = 14
const OBRA_RE = /^[A-Za-z0-9_.-]{1,80}$/
const CODIGO_RE = /^[a-z0-9]{10,40}$/
const DIA = 24 * 3600_000
const GRUPO_RE = /^https:\/\/groups\.google\.com\/g\/[A-Za-z0-9._-]{1,80}\/?$/
const OPTIN_RE = /^https:\/\/play\.google\.com\/apps\/(internaltest|testing)\/[A-Za-z0-9._-]{1,150}\/?$/

interface Auth { email: unknown; computador_hash: unknown; token_dispositivo: string }

async function licencaDoDispositivo(d: Deps, a: Auth) {
  const negado = () => new ErroRegra('nao_autorizado', 'A licença não foi reconhecida neste computador (ela vale para um computador ativo por vez). Confira no portal do Atlas qual computador está ativo.', 403)
  if (typeof a.computador_hash !== 'string' || !HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'O Atlas deste computador mandou uma identificação que o servidor não reconhece. Atualize o Atlas e tente de novo.')
  if (typeof a.email !== 'string') throw negado()
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && !cliente.excluido_em ? await d.store.licencaDoCliente(cliente.id) : null
  if (!cliente || !lic) throw negado()
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) throw negado()
  return lic
}

const novoCodigo = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('')
const nomeLimpo = (v: unknown) => (typeof v === 'string' ? limparDescricao(v).replace(/[\n\r\t]/g, ' ').trim().slice(0, 40) : '')
const chaveNome = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function criarConviteTeste(d: Deps, a: Auth & { obra_id: unknown; app_nome: unknown; grupo_url: unknown; optin_url: unknown }) {
  if (typeof a.obra_id !== 'string' || !OBRA_RE.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Identificação da obra inválida.')
  const appNome = nomeLimpo(a.app_nome)
  if (!appNome || typeof a.grupo_url !== 'string' || !GRUPO_RE.test(a.grupo_url) || typeof a.optin_url !== 'string' || !OPTIN_RE.test(a.optin_url)) {
    throw new ErroRegra('convite_invalido', 'O endereço do grupo ou do teste não parece do Google. Confira e tente de novo.')
  }
  const lic = await licencaDoDispositivo(d, a)
  const atual = await d.store.conviteTesteDaObra(lic.id, a.obra_id)
  if (atual) {
    await d.store.salvarConviteTeste({ ...atual, app_nome: appNome, grupo_url: a.grupo_url, optin_url: a.optin_url })
    return { codigo: atual.codigo }
  }
  const codigo = novoCodigo()
  await d.store.salvarConviteTeste({ codigo, licenca_id: lic.id, obra_id: a.obra_id, app_nome: appNome, grupo_url: a.grupo_url, optin_url: a.optin_url, criado_em: d.agora() })
  return { codigo }
}

export async function verConviteTeste(d: Deps, a: { codigo: unknown }) {
  const c = typeof a.codigo === 'string' && CODIGO_RE.test(a.codigo) ? await d.store.conviteTestePorCodigo(a.codigo) : null
  if (!c) throw new ErroRegra('nao_encontrado', 'Esse convite não existe.', 404)
  return { app_nome: c.app_nome, grupo_url: c.grupo_url, optin_url: c.optin_url }
}

export async function entrarNoTeste(d: Deps, a: { codigo: unknown; nome: unknown; ip: string }) {
  const c = typeof a.codigo === 'string' && CODIGO_RE.test(a.codigo) ? await d.store.conviteTestePorCodigo(a.codigo) : null
  if (!c) throw new ErroRegra('nao_encontrado', 'Esse convite não existe.', 404)
  const nome = nomeLimpo(a.nome)
  if (!nome) throw new ErroRegra('nome_invalido', 'Escreva o seu nome.')
  const agora = d.agora()
  if (!(await d.store.tentarEvento(`teste-ip:${await sha256(a.ip || '-')}`, 20, 3600_000, agora))) throw new ErroRegra('muitas_solicitacoes', 'Muitos pedidos seguidos. Espere uns 10 minutos e tente de novo.', 429)
  if (!(await d.store.tentarEvento(`teste-convite:${c.codigo}`, 200, DIA, agora))) throw new ErroRegra('muitas_solicitacoes', 'Muitos pedidos seguidos. Espere uns 10 minutos e tente de novo.', 429)
  const ja = (await d.store.testadoresDoConvite(c.codigo)).some((t) => chaveNome(t.nome) === chaveNome(nome))
  if (!ja) await d.store.registrarTestador({ codigo: c.codigo, nome, entrou_em: agora })
  return { ok: true as const }
}

export async function situacaoTestadores(d: Deps, a: Auth & { obra_id: unknown }) {
  if (typeof a.obra_id !== 'string' || !OBRA_RE.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Identificação da obra inválida.')
  const lic = await licencaDoDispositivo(d, a)
  const c = await d.store.conviteTesteDaObra(lic.id, a.obra_id)
  if (!c) return { codigo: null, pessoas: 0, faltam: TESTADORES_PRECISOS, dia: 0, completo: false, nomes: [] as string[] }
  const lista = (await d.store.testadoresDoConvite(c.codigo)).sort((x, y) => x.entrou_em.getTime() - y.entrou_em.getTime())
  const pessoas = lista.length
  const doze = pessoas >= TESTADORES_PRECISOS ? lista[TESTADORES_PRECISOS - 1].entrou_em : null
  const dia = doze ? Math.min(DIAS_DE_TESTE, Math.floor((d.agora().getTime() - doze.getTime()) / DIA) + 1) : 0
  return { codigo: c.codigo, pessoas, faltam: Math.max(0, TESTADORES_PRECISOS - pessoas), dia, completo: dia >= DIAS_DE_TESTE, nomes: lista.map((t) => t.nome).slice(0, 50) }
}
