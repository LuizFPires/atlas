// POST /ajuda-caso — o app anota, no painel do Luiz, um caso que a Ajuda do Atlas não resolveu (ponte-ajuda-casos).
// Auth = a mesma do /verificar: e-mail + computador + token do dispositivo (cabeçalho). O cliente_id vem da LICENÇA no servidor,
// nunca do corpo (anti-IDOR). A descrição é DADO (texto livre do cliente), nunca instrução: é cortada, limpa de segredo e só guardada.
import { iguais, sha256 } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'

export const MAX_DESCRICAO_CASO = 1200

/** Defesa em profundidade: o app já tira segredo; aqui tiramos de novo antes de gravar. */
export function limparDescricao(texto: string): string {
  return texto
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\b(sk|pk|rk|whsec|ghp|gho|github_pat|sbp|xox[abp])[-_][A-Za-z0-9_-]{8,}/gi, '[segredo removido]')
    .replace(/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*)/g, '[segredo removido]')
    .replace(/(senha|password|token|secret|chave)\s*[:=]\s*\S+/gi, '$1: [removido]')
    .slice(0, MAX_DESCRICAO_CASO)
    .trim()
}

export async function registrarCasoAjuda(
  d: Deps,
  a: { email: unknown; computador_hash: unknown; token_dispositivo: string; tipo: unknown; descricao: unknown },
): Promise<{ ok: true }> {
  const negado = () => new ErroRegra('nao_autorizado', 'Não foi possível confirmar este computador.', 403)
  if (typeof a.computador_hash !== 'string' || !HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  if (typeof a.email !== 'string') throw negado()
  if (a.tipo !== 'ajuda_nao_resolvida' || typeof a.descricao !== 'string') throw new ErroRegra('caso_invalido', 'Caso inválido.', 400)
  const descricao = limparDescricao(a.descricao)
  if (!descricao) throw new ErroRegra('caso_invalido', 'Caso inválido.', 400)
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && !cliente.excluido_em ? await d.store.licencaDoCliente(cliente.id) : null
  if (!cliente || !lic) throw negado()
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) throw negado()
  if (!(await d.store.tentarEvento(`ajuda-caso:${lic.id}`, 10, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitos casos seguidos. Tente de novo mais tarde.', 429)
  }
  await d.store.inserirOcorrencia({ cliente_id: cliente.id, tipo: 'ajuda_nao_resolvida', descricao, autor: 'app', resolvida: false })
  return { ok: true }
}
