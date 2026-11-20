// M32 (c) — trava SINGLE-TENANT. O app entregue pergunta: "esta instância é do comprador?".
// Mesma auth do /ajuda-caso e do /status-obras (e-mail + computador + token do dispositivo): a licença é descoberta
// pelo servidor, nunca aceita do corpo (anti-IDOR). Uma licença = um computador ativo = uma instância.
// Só confere a licença; não coleta nada além do que já existe (e-mail, hash do computador, token).
import { iguais, sha256 } from './cripto.ts'
import { motivoDaLicenca } from './verificar.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'

export type VereditoInstancia = { ok: true } | { ok: false; motivo: 'outra_instancia' | 'licenca_invalida' }

export async function validarInstancia(
  d: Deps,
  a: { email: unknown; computador_hash: unknown; token_dispositivo: string },
): Promise<VereditoInstancia> {
  const negado = () => new ErroRegra('nao_autorizado', 'Não foi possível confirmar esta instalação.', 403)
  if (typeof a.computador_hash !== 'string' || !HASH_RE.test(a.computador_hash)) throw new ErroRegra('computador_invalido', 'Identificação do computador inválida.')
  if (typeof a.email !== 'string' || !a.token_dispositivo) throw negado()
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const lic = cliente && !cliente.excluido_em ? await d.store.licencaDoCliente(cliente.id) : null
  if (!cliente || !lic) throw negado()
  const ativa = await d.store.ativacaoAtiva(lic.id)
  if (!ativa || !ativa.token_hash) throw negado()
  // Quem não tem o token do dispositivo da licença não é nem "outra instância": é intruso.
  if (!iguais(await sha256(a.token_dispositivo), ativa.token_hash)) throw negado()
  if (!(await d.store.tentarEvento(`instancia:${lic.id}`, 120, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas conferências seguidas. Tente de novo mais tarde.', 429)
  }
  // Mesma matriz do /verificar (M2): pausada, atrasada sem carência, cortesia vencida, cancelada etc. negam.
  if (motivoDaLicenca(lic, d.agora()) !== 'ok') return { ok: false, motivo: 'licenca_invalida' }
  // Token certo, mas num computador que não é o ativo: cópia do app rodando em outro lugar.
  if (ativa.computador_hash !== a.computador_hash) return { ok: false, motivo: 'outra_instancia' }
  return { ok: true }
}
