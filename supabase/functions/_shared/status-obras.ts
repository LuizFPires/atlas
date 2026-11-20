// M30 — relay do status das obras. O computador PUBLICA um resumo; o Portal LÊ. Nunca código, caminho de arquivo nem segredo.
// Publicar: mesma auth do /ajuda-caso (e-mail + computador + token do dispositivo); a licença vem do servidor, nunca do corpo.
// Ler: parte do login do Portal (clienteLogado); só devolve as obras da licença do dono (anti-IDOR).
import { iguais, sha256 } from './cripto.ts'
import { clienteLogado, type DepsPortal } from './portal.ts'
import { type Deps, ErroRegra, HASH_RE, type EstadoObra, type StatusObraLinha } from './tipos.ts'

export const MAX_OBRAS = 20
const ESTADOS: EstadoObra[] = ['construindo', 'pausada', 'aguardando_aprovacao', 'pronta', 'no_ar']

/** Texto de exibição: sem controle, e-mail, link, caminho de arquivo nem cara de segredo; cortado no tamanho. */
export function limparTexto(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  const semControle = [...v].map((c) => { const n = c.charCodeAt(0); return n < 32 || n === 127 ? ' ' : c }).join('')
  return semControle
    .replace(/\b(sk|pk|rk|whsec|ghp|gho|github_pat|sbp|xox[abp])[-_][A-Za-z0-9_-]{8,}/gi, '')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, '')
    .replace(/(senha|password|token|secret|chave)\s*[:=]\s*\S+/gi, '')
    .replace(/\b(?:https?|ftp|file):\/\/\S+|\bwww\.\S+/gi, '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '')
    .replace(/\b[A-Za-z]:[\\/]\S*/g, '')
    .replace(/(?:^|\s)(?:~|\.{1,2})?\/[\w.-]+\/\S*/g, ' ')
    .replace(/\\\\\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

const invalido = () => new ErroRegra('status_invalido', 'Status das obras inválido.', 400)
const inteiro = (v: unknown, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw invalido()
  return v
}

/** Valida e limpa a lista inteira; qualquer item fora do formato recusa o pedido todo (nada parcial). */
export function validarObras(entrada: unknown, agora: Date): StatusObraLinha[] {
  if (!Array.isArray(entrada) || entrada.length > MAX_OBRAS) throw invalido()
  const vistos = new Set<string>()
  let achouAtiva = false
  return entrada.map((x) => {
    if (!x || typeof x !== 'object') throw invalido()
    const o = x as Record<string, unknown>
    const e = (o.etapa_atual ?? {}) as Record<string, unknown>
    if (typeof o.id !== 'string' || !/^[\w.-]{1,64}$/.test(o.id) || vistos.has(o.id)) throw invalido()
    vistos.add(o.id)
    if (!ESTADOS.includes(o.estado as EstadoObra)) throw invalido()
    const nome = limparTexto(o.nome, 80)
    if (!nome) throw invalido()
    const quando = typeof o.quando === 'string' ? new Date(o.quando) : agora
    const ativa = o.ativa_agora === true && !achouAtiva // no máximo uma obra ativa
    if (ativa) achouAtiva = true
    return {
      obra_id: o.id,
      nome,
      segmento: limparTexto(o.segmento, 60) || null,
      etapa_atual_numero: inteiro(e.numero, 0, 1000),
      etapa_atual_rotulo: limparTexto(e.rotulo, 80),
      total_etapas: inteiro(o.total_etapas, 0, 1000),
      percentual: inteiro(o.percentual, 0, 100),
      estado: o.estado as EstadoObra,
      ativa_agora: ativa,
      ultima_noticia: limparTexto(o.ultima_noticia, 280),
      // Data inválida ou no futuro não vale: usa o relógio do servidor.
      ultima_noticia_em: Number.isNaN(quando.getTime()) || quando.getTime() > agora.getTime() + 5 * 60_000 ? agora : quando,
    }
  })
}

export async function publicarStatusObras(
  d: Deps,
  a: { email: unknown; computador_hash: unknown; token_dispositivo: string; obras: unknown },
): Promise<{ ok: true; obras: number }> {
  const negado = () => new ErroRegra('nao_autorizado', 'Não foi possível confirmar este computador.', 403)
  if (typeof a.computador_hash !== 'string' || !HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  if (typeof a.email !== 'string') throw negado()
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && !cliente.excluido_em ? await d.store.licencaDoCliente(cliente.id) : null
  if (!cliente || !lic) throw negado()
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) throw negado()
  if (!(await d.store.tentarEvento(`status-obras:${lic.id}`, 120, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas atualizações seguidas. Tente de novo mais tarde.', 429)
  }
  const linhas = validarObras(a.obras, d.agora())
  await d.store.substituirStatusObras(lic.id, linhas, d.agora())
  return { ok: true, obras: linhas.length }
}

/** Portal: as obras do DONO logado (licença descoberta pelo login). */
export async function obrasDoPortal(d: DepsPortal, jwt: string) {
  const { licenca } = await clienteLogado(d, jwt)
  const linhas = await d.store.statusObrasDaLicenca(licenca.id)
  return {
    obras: linhas.map((l) => ({
      id: l.obra_id,
      nome: l.nome,
      ...(l.segmento ? { segmento: l.segmento } : {}),
      etapa_atual: { numero: l.etapa_atual_numero, rotulo: l.etapa_atual_rotulo },
      total_etapas: l.total_etapas,
      percentual: l.percentual,
      estado: l.estado,
      ativa_agora: l.ativa_agora,
      ultima_noticia: l.ultima_noticia,
      quando: l.ultima_noticia_em.toISOString(),
    })),
  }
}
