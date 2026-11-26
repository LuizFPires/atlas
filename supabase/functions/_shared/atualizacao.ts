// Atualização automática do app (Windows). O app pergunta, com a credencial da ativação, se há versão nova. Só um computador
// com licença ativada recebe (qualquer tipo de licença: paga, cortesia ou teste; decisão do Luiz em 22/11/2026). O .exe fica
// na pasta PRIVADA do Storage; o app recebe só um endereço temporário e a impressão digital (sha512) para conferir o arquivo.
// O manifesto (atualizacao.json: versao, sha512, tamanho) é escrito pelo workflow do instalador, junto do .exe.
import { ErroRegra } from './tipos.ts'
import { verificar } from './verificar.ts'
import type { Deps } from './tipos.ts'

export interface Manifesto { versao: string; sha512: string; tamanho: number }
export interface FonteAtualizacao {
  /** Conteúdo do atualizacao.json (ou null). DADO: validado aqui. */
  manifesto(): Promise<unknown>
  /** Endereço temporário do .exe, baixando com o nome pedido. */
  link(nomeDoDownload: string): Promise<string | null>
}
/** motivo: por que não há versão para baixar (o app mostra quando não é 'atual'). */
export type MotivoSemVersao = 'atual' | 'sem-configuracao' | 'sem-manifesto' | 'sem-link'
export type RespostaAtualizacao = { atualizar: false; motivo: MotivoSemVersao } | ({ atualizar: true; url: string } & Manifesto)

const VERSAO_RE = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/
const SHA512_B64_RE = /^[A-Za-z0-9+/]{86}==$/
const MAX_TAMANHO = 600 * 1024 * 1024

export function compararVersoes(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

export function manifestoValido(m: unknown): Manifesto | null {
  if (!m || typeof m !== 'object') return null
  const { versao, sha512, tamanho } = m as Record<string, unknown>
  if (typeof versao !== 'string' || !VERSAO_RE.test(versao)) return null
  if (typeof sha512 !== 'string' || !SHA512_B64_RE.test(sha512)) return null
  if (typeof tamanho !== 'number' || !Number.isInteger(tamanho) || tamanho < 1 || tamanho > MAX_TAMANHO) return null
  return { versao, sha512, tamanho }
}

/** M48: uma fonte por sistema. Passar só uma fonte (como antes) vale para o Windows. */
export type FontesAtualizacao = FonteAtualizacao | { windows?: FonteAtualizacao; mac?: FonteAtualizacao }

export async function verAtualizacao(
  d: Deps,
  fontes: FontesAtualizacao | undefined,
  a: { email: string; computador_hash: string; token_dispositivo: string; versao: string; sistema?: string | null },
): Promise<RespostaAtualizacao> {
  if (!VERSAO_RE.test(a.versao)) throw new ErroRegra('versao_invalida', 'Versão do app inválida.')
  const v = await verificar(d, a)
  if (!v.licenca_id) throw new ErroRegra('negado', 'A licença não foi reconhecida, então a atualização não foi liberada. Confira a sua assinatura no portal do Atlas.', 403)
  const mac = a.sistema === 'mac'
  const porSistema = fontes && !('manifesto' in fontes) ? fontes : { windows: fontes as FonteAtualizacao | undefined }
  const fonte = mac ? porSistema.mac : porSistema.windows
  if (!fonte) return { atualizar: false, motivo: 'sem-configuracao' }
  const m = manifestoValido(await fonte.manifesto().catch(() => null))
  if (!m) return { atualizar: false, motivo: 'sem-manifesto' }
  if (compararVersoes(m.versao, a.versao) <= 0) return { atualizar: false, motivo: 'atual' }
  const url = await fonte.link(`Atlas-Atualizacao-${m.versao}.${mac ? 'zip' : 'exe'}`).catch(() => null)
  if (!url || !/^https:\/\//.test(url)) return { atualizar: false, motivo: 'sem-link' }
  return { atualizar: true, ...m, url }
}
