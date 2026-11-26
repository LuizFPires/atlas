// M33 — Atlas no celular: o celular é o controle remoto do notebook do cliente.
// O celular (login do Portal) deixa PEDIDOS numa fila; o notebook (credencial da ativação) bate de tempos em tempos, leva os
// pedidos, executa com o Claude DO CLIENTE e publica o resultado (fase, progresso, telas, nomes). Aqui nunca roda Claude, nunca
// passa código nem segredo: só recados, as telas já protegidas (mesmo armazém do link do celular) e fotos de referência que
// ficam só até o notebook baixar.
import { clienteLogado, type DepsPortal } from './portal.ts'
import { limparTexto } from './status-obras.ts'
import { type ArmazemPrototipos, guardarTelasDoProjeto } from './prototipo-link.ts'
import { ErroRegra, type Deps } from './tipos.ts'
import { motivoDaLicenca, verificar } from './verificar.ts'

export const TIPOS_PEDIDO = ['obra_nova', 'ajuste', 'aprovar_telas', 'nome', 'construir', 'pausar', 'continuar', 'foto_ajuda'] as const
export type TipoPedido = (typeof TIPOS_PEDIDO)[number]
export const FASES = ['na_fila', 'desenhando', 'telas_prontas', 'ajustando', 'pensando_nomes', 'nomes_prontos', 'pronto_para_construir', 'construindo', 'erro'] as const
export type FaseProjeto = (typeof FASES)[number]
export type EstadoPedido = 'pendente' | 'entregue' | 'feito' | 'erro'

export interface Pedido {
  id: string
  licenca_id: string
  tipo: TipoPedido
  obra_id: string
  dados: Record<string, unknown>
  estado: EstadoPedido
  mensagem: string
  criado_em: Date
  entregue_em: Date | null
}
export interface ProjetoCelular {
  obra_id: string
  nome: string
  fase: FaseProjeto
  progresso: { feitas: number; total: number; atual: string; telas: Array<{ nome: string; pronta: boolean }> }
  nomes: Array<{ nome: string; porque: string }>
  mensagem: string
  telas_token: string | null
  atualizado_em: Date
}
export interface Referencia { licenca_id: string; imagem: string; criada_em: Date }

/** Porta do armazenamento do canal (tabelas celular_* e pasta privada "referencias"). Sempre filtrada pela licença. */
export interface CanalCelular {
  sinal(licencaId: string, agora: Date, ocupado: string | null): Promise<void>
  ultimoSinal(licencaId: string): Promise<{ visto_em: Date; ocupado: string | null } | null>
  criarPedido(p: Pedido): Promise<void>
  contarAbertos(licencaId: string): Promise<number>
  /** Atômico: devolve os pendentes (e os entregues sem resposta há mais de `reentregaMs`) e marca como entregues. */
  levarPedidos(licencaId: string, agora: Date, reentregaMs: number, limite: number): Promise<Pedido[]>
  responder(licencaId: string, id: string, estado: 'feito' | 'erro', mensagem: string): Promise<boolean>
  pedidosRecentes(licencaId: string, limite: number): Promise<Pedido[]>
  salvarProjeto(licencaId: string, p: ProjetoCelular): Promise<void>
  projetos(licencaId: string): Promise<ProjetoCelular[]>
  guardarReferencia(id: string, r: Referencia): Promise<void>
  contarReferencias(licencaId: string): Promise<number>
  /** Lê e apaga numa vez só (a foto só existe até o notebook baixar). null = não existe ou é de outra licença. */
  tirarReferencia(licencaId: string, id: string): Promise<Referencia | null>
  referenciaExiste(licencaId: string, id: string): Promise<boolean>
}

export const LIGADO_MS = 90_000
export const REENTREGA_MS = 10 * 60_000
export const MAX_ABERTOS = 20
export const MAX_REFERENCIAS = 6
export const MAX_IMAGEM_BYTES = 2 * 1024 * 1024
const OBRA_RE = /^[\w.-]{1,64}$/
const ID_RE = /^[0-9a-f]{32}$/
const HEX_RE = /^#[0-9A-Fa-f]{6}$/
const MODOS_VISUAL = ['prints', 'marca', 'sugere']

const invalido = (msg = 'Pedido inválido.') => new ErroRegra('pedido_invalido', msg, 400)
const indisponivel = () => new ErroRegra('celular_indisponivel', 'O Atlas no celular ainda não está disponível. Tente mais tarde.', 503)
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')

/** Texto livre do PRÓPRIO dono para o Claude dele: tira só controle/bidi e corta. (E-mail ou link dentro do relato são do dono.) */
function textoLivre(v: unknown, min: number, max: number): string {
  if (typeof v !== 'string') throw invalido()
  const limpo = [...v].filter((c) => {
    const n = c.codePointAt(0) ?? 0
    return !(n < 32 && c !== '\n' && c !== '\t') && n !== 127 && !(n >= 0x80 && n <= 0x9f) && !(n >= 0x200b && n <= 0x200f) && !(n >= 0x202a && n <= 0x202e) && !(n >= 0x2066 && n <= 0x2069) && n !== 0xfeff
  }).join('').trim()
  if ([...limpo].length < min || [...limpo].length > max) throw invalido()
  return limpo
}

async function licencaDoCelular(d: DepsPortal, jwt: string) {
  const { licenca } = await clienteLogado(d, jwt)
  if (motivoDaLicenca(licenca as never, d.agora()) !== 'ok') throw new ErroRegra('licenca_inativa', 'Seu acesso ao Atlas não está ativo. Fique com o Atlas para continuar.', 403)
  return licenca
}

async function licencaDoComputador(d: Deps, a: { email: unknown; computador_hash: unknown; token_dispositivo: string }) {
  const v = await verificar(d, { email: typeof a.email === 'string' ? a.email : '', computador_hash: typeof a.computador_hash === 'string' ? a.computador_hash : '', token_dispositivo: a.token_dispositivo })
  if (!v.pode_construir || !v.licenca_id) throw new ErroRegra('nao_autorizado', 'Não foi possível confirmar este computador.', 403)
  return v.licenca_id
}

async function validarDados(canal: CanalCelular, licencaId: string, tipo: TipoPedido, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (tipo) {
    case 'obra_nova': {
      const v = (dados.visual ?? {}) as Record<string, unknown>
      if (!MODOS_VISUAL.includes(v.modo as string)) throw invalido()
      const cores = v.cores ?? []
      if (!Array.isArray(cores) || cores.length > 3 || !cores.every((c) => typeof c === 'string' && HEX_RE.test(c))) throw invalido()
      const refs = v.referencias ?? []
      if (!Array.isArray(refs) || refs.length > MAX_REFERENCIAS || !refs.every((r) => typeof r === 'string' && ID_RE.test(r))) throw invalido()
      for (const r of refs) if (!(await canal.referenciaExiste(licencaId, r as string))) throw invalido()
      return {
        relato: textoLivre(dados.relato, 20, 20_000),
        visual: { modo: v.modo, observacao: v.observacao ? textoLivre(v.observacao, 0, 500) : '', cores, referencias: refs },
      }
    }
    case 'ajuste': return { texto: textoLivre(dados.texto, 1, 4000) }
    case 'nome': {
      const nome = limparTexto(dados.nome, 60)
      if (!nome) throw invalido()
      return { nome }
    }
    case 'construir':
      if (dados.modo !== 'auto' && dados.modo !== 'passo') throw invalido()
      return { modo: dados.modo }
    // M58: foto tirada no celular para a Ajuda do Atlas (a foto já subiu como referência; só o id vai no pedido).
    case 'foto_ajuda': {
      const r = dados.referencia
      if (typeof r !== 'string' || !ID_RE.test(r) || !(await canal.referenciaExiste(licencaId, r))) throw invalido()
      return { referencia: r }
    }
    default: return {}
  }
}

const pedidoParaFora = (p: Pedido) => ({ id: p.id, tipo: p.tipo, obra_id: p.obra_id, estado: p.estado, mensagem: p.mensagem, criado_em: p.criado_em.toISOString() })
const projetoParaFora = (p: ProjetoCelular) => ({ ...p, atualizado_em: p.atualizado_em.toISOString() })

// ── lado do celular (login do Portal) ──

export async function estadoDoCelular(d: DepsPortal, canal: CanalCelular | undefined, jwt: string) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoCelular(d, jwt)
  const [s, projetos, pedidos] = await Promise.all([canal.ultimoSinal(lic.id), canal.projetos(lic.id), canal.pedidosRecentes(lic.id, 30)])
  const ligado = !!s && d.agora().getTime() - s.visto_em.getTime() <= LIGADO_MS
  return {
    computador: { ligado, visto_em: s ? s.visto_em.toISOString() : null, ocupado: ligado ? s!.ocupado : null },
    projetos: projetos.map(projetoParaFora),
    pedidos: pedidos.map(pedidoParaFora),
  }
}

export async function pedirPeloCelular(d: DepsPortal, canal: CanalCelular | undefined, jwt: string, b: Record<string, unknown>) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoCelular(d, jwt)
  const tipo = b.tipo as TipoPedido
  if (!TIPOS_PEDIDO.includes(tipo)) throw invalido()
  const dados = (b.dados && typeof b.dados === 'object' && !Array.isArray(b.dados) ? b.dados : {}) as Record<string, unknown>
  let obra_id: string
  if (tipo === 'obra_nova') obra_id = `c${hex(8)}`
  else if (typeof b.obra_id === 'string' && OBRA_RE.test(b.obra_id)) obra_id = b.obra_id
  else throw invalido()
  const limpos = await validarDados(canal, lic.id, tipo, dados)
  if ((await canal.contarAbertos(lic.id)) >= MAX_ABERTOS || !(await d.store.tentarEvento(`celular-pedido:${lic.id}`, 60, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitos pedidos esperando o notebook. Espere ele terminar alguns.', 429)
  }
  const p: Pedido = { id: hex(16), licenca_id: lic.id, tipo, obra_id, dados: limpos, estado: 'pendente', mensagem: '', criado_em: d.agora(), entregue_em: null }
  await canal.criarPedido(p)
  return { id: p.id, obra_id }
}

export async function enviarReferencia(d: DepsPortal, canal: CanalCelular | undefined, jwt: string, imagem: unknown) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoCelular(d, jwt)
  const m = typeof imagem === 'string' ? /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(imagem) : null
  if (!m || m[2].length * 0.75 > MAX_IMAGEM_BYTES) throw invalido('Essa foto não deu certo. Tente outra, de até 2 MB.')
  if ((await canal.contarReferencias(lic.id)) >= MAX_REFERENCIAS) throw new ErroRegra('muitas_solicitacoes', 'Já são 6 fotos esperando o notebook. Ele baixa quando ligar.', 429)
  const id = hex(16)
  await canal.guardarReferencia(id, { licenca_id: lic.id, imagem: imagem as string, criada_em: d.agora() })
  return { id }
}

// ── lado do notebook (credencial da ativação; a licença vem do servidor) ──

type Auth = { email: unknown; computador_hash: unknown; token_dispositivo: string }

export async function sinalDoComputador(d: Deps, canal: CanalCelular | undefined, a: Auth & { ocupado: unknown }) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoComputador(d, a)
  const ocupado = limparTexto(a.ocupado, 80) || null
  await canal.sinal(lic, d.agora(), ocupado)
  const pedidos = await canal.levarPedidos(lic, d.agora(), REENTREGA_MS, 10)
  return { pedidos: pedidos.map((p) => ({ id: p.id, tipo: p.tipo, obra_id: p.obra_id, dados: p.dados, criado_em: p.criado_em.toISOString() })) }
}

export async function responderPedido(d: Deps, canal: CanalCelular | undefined, a: Auth & { pedido_id: unknown; estado: unknown; mensagem: unknown }) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoComputador(d, a)
  if (typeof a.pedido_id !== 'string' || !ID_RE.test(a.pedido_id) || (a.estado !== 'feito' && a.estado !== 'erro')) throw invalido()
  const ok = await canal.responder(lic, a.pedido_id, a.estado, limparTexto(a.mensagem, 280))
  if (!ok) throw new ErroRegra('pedido_nao_encontrado', 'Pedido não encontrado.', 404)
  return { ok: true }
}

function validarProjeto(obra_id: unknown, x: unknown): Omit<ProjetoCelular, 'telas_token' | 'atualizado_em'> {
  if (typeof obra_id !== 'string' || !OBRA_RE.test(obra_id) || !x || typeof x !== 'object') throw invalido()
  const p = x as Record<string, unknown>
  if (!FASES.includes(p.fase as FaseProjeto)) throw invalido()
  const g = (p.progresso ?? {}) as Record<string, unknown>
  const int = (v: unknown, max: number) => { if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) throw invalido(); return v }
  const telas = g.telas ?? []
  if (!Array.isArray(telas) || telas.length > 40) throw invalido()
  const nomes = p.nomes ?? []
  if (!Array.isArray(nomes) || nomes.length > 3) throw invalido()
  return {
    obra_id,
    nome: limparTexto(p.nome, 80),
    fase: p.fase as FaseProjeto,
    progresso: {
      feitas: int(g.feitas, 40), total: int(g.total, 40), atual: limparTexto(g.atual, 80),
      telas: telas.map((t) => ({ nome: limparTexto((t as Record<string, unknown>)?.nome, 60), pronta: (t as Record<string, unknown>)?.pronta === true })),
    },
    nomes: nomes.map((n) => ({ nome: limparTexto((n as Record<string, unknown>)?.nome, 60), porque: limparTexto((n as Record<string, unknown>)?.porque, 140) })).filter((n) => n.nome),
    mensagem: limparTexto(p.mensagem, 280),
  }
}

export async function publicarProjeto(d: Deps, canal: CanalCelular | undefined, armazem: ArmazemPrototipos | undefined, a: Auth & { obra_id: unknown; projeto: unknown; documento: unknown }) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoComputador(d, a)
  const base = validarProjeto(a.obra_id, a.projeto)
  if (!(await d.store.tentarEvento(`celular-projeto:${lic}`, 600, 60 * 60_000, d.agora()))) throw new ErroRegra('muitas_solicitacoes', 'Muitas atualizações seguidas.', 429)
  const anterior = (await canal.projetos(lic)).find((p) => p.obra_id === base.obra_id)
  let telas_token = anterior?.telas_token ?? null
  if (a.documento !== undefined && a.documento !== null && a.documento !== '') {
    telas_token = await guardarTelasDoProjeto(d, armazem, base.nome || 'Protótipo', a.documento)
  }
  await canal.salvarProjeto(lic, { ...base, telas_token, atualizado_em: d.agora() })
  return { ok: true, telas_token }
}

export async function baixarReferencia(d: Deps, canal: CanalCelular | undefined, a: Auth & { id: unknown }) {
  if (!canal) throw indisponivel()
  const lic = await licencaDoComputador(d, a)
  if (typeof a.id !== 'string' || !ID_RE.test(a.id)) throw invalido()
  const r = await canal.tirarReferencia(lic, a.id)
  if (!r) throw new ErroRegra('referencia_nao_encontrada', 'Essa foto não está mais aqui.', 404)
  return { imagem: r.imagem }
}
