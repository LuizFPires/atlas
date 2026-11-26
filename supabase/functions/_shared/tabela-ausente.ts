// Tabela de uma migration ainda não aplicada no banco (26/11/2026: a 0031 da M65 esperava o token do Supabase) não pode
// derrubar o servidor inteiro. Só para LEITURAS cuja ausência significa "nenhuma linha" (ex.: nenhuma obra embargada).

const CODIGOS = ['PGRST205', '42P01']
const TEXTO = /could not find the table|relation "[^"]+" does not exist/i

/** O erro diz que a tabela não existe (PostgREST ou Postgres)? */
export function tabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false
  const e = erro as { code?: unknown; message?: unknown; causa?: unknown }
  if (typeof e.code === 'string' && CODIGOS.includes(e.code)) return true
  if (typeof e.message === 'string' && (TEXTO.test(e.message) || CODIGOS.some((c) => e.message!.toString().includes(` ${c} `)))) return true
  return e.causa ? tabelaAusente(e.causa) : false
}

/** Roda a leitura; se a tabela ainda não existe, devolve lista vazia (e avisa no log). Qualquer outro erro continua estourando. */
export async function semTabelaEhVazio<T>(ler: () => Promise<T[]>): Promise<T[]> {
  try { return await ler() } catch (e) {
    if (!tabelaAusente(e)) throw e
    console.warn('tabela ausente (migration pendente): leitura tratada como vazia')
    return []
  }
}
