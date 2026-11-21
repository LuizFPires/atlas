// Contador do teste no app: lê do servidor o tipo e a validade da licença (/licenca/resumo) e monta o texto do cartão da lateral.
// Regra de ouro: sem resposta válida do servidor não existe contador. O app nunca inventa prazo, e os dias são contados a partir
// da hora do SERVIDOR (campo `agora`), não do relógio do computador.
import { cabecalhoDispositivo, lerAtivacao } from './ativacao-api'
import type { PonteDesktop } from './ponte'

export interface ResumoLicenca {
  tipo: 'paga' | 'cortesia'
  origem: 'degustacao' | null
  validade_em: string | null
  vencida: boolean
  agora: string
}

export type CartaoLicenca =
  | { estado: 'ativa' }
  | { estado: 'contando' | 'vencida'; rotulo: 'TESTE GRÁTIS' | 'CORTESIA'; titulo: string; sub: string | null }

const DIA_MS = 24 * 60 * 60_000
const dataValida = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

/** Confere a resposta do servidor campo a campo. Qualquer coisa fora do esperado = null. */
function validar(d: unknown): ResumoLicenca | null {
  if (!d || typeof d !== 'object') return null
  const r = d as Record<string, unknown>
  if (!dataValida(r.agora) || typeof r.vencida !== 'boolean') return null
  if (r.tipo === 'paga') return { tipo: 'paga', origem: null, validade_em: null, vencida: false, agora: r.agora }
  if (r.tipo !== 'cortesia') return null
  const origem = r.origem === 'degustacao' ? 'degustacao' : r.origem === null || r.origem === undefined ? null : undefined
  if (origem === undefined) return null
  // Cortesia sem data só faz sentido se já venceu; contando, a data é obrigatória.
  if (r.validade_em === null) return r.vencida ? { tipo: 'cortesia', origem, validade_em: null, vencida: true, agora: r.agora } : null
  if (!dataValida(r.validade_em)) return null
  return { tipo: 'cortesia', origem, validade_em: r.validade_em, vencida: r.vencida, agora: r.agora }
}

/** Lê o resumo da licença deste computador. null em qualquer dúvida (não ativado, sem servidor, recusa, rede, resposta estranha). */
export async function lerResumo(ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>, api: string | null, f: typeof fetch = fetch): Promise<ResumoLicenca | null> {
  if (!api) return null
  try {
    const ativ = await lerAtivacao(ponte.cofre)
    if (!ativ) return null
    const r = await f(`${api.replace(/[/]+$/, '')}/licenca/resumo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await cabecalhoDispositivo(ponte.cofre)) },
      body: JSON.stringify({ email: ativ.email, computador_hash: await ponte.hashComputador() }),
    })
    if (!r.ok) return null
    return validar(await r.json().catch(() => null))
  } catch { return null }
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Texto do cartão da lateral. Paga ou sem resposta: a linha de sempre ("Licença ativa"), sem contador. */
export function cartaoDaLicenca(r: ResumoLicenca | null): CartaoLicenca {
  if (!r || r.tipo !== 'cortesia') return { estado: 'ativa' }
  const teste = r.origem === 'degustacao'
  const rotulo = teste ? 'TESTE GRÁTIS' : 'CORTESIA'
  const agora = new Date(r.agora)
  const validade = r.validade_em ? new Date(r.validade_em) : null
  const faltam = validade ? validade.getTime() - agora.getTime() : 0
  if (r.vencida || !validade || faltam <= 0) return { estado: 'vencida', rotulo, titulo: teste ? 'Seu teste acabou' : 'Sua cortesia acabou', sub: null }
  const dias = Math.ceil(faltam / DIA_MS)
  const titulo = mesmoDia(validade, agora) ? 'Vence hoje' : dias === 1 ? 'Falta 1 dia' : `Faltam ${dias} dias`
  return { estado: 'contando', rotulo, titulo, sub: `Vence em ${doisDigitos(validade.getDate())}/${doisDigitos(validade.getMonth() + 1)}` }
}
