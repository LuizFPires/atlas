// /licenca/resumo — o que o app instalado precisa para mostrar o contador do teste: tipo da licença e até quando vale.
// Só responde para o computador ativado (mesma credencial do /verificar). Não libera nem bloqueia nada: quem decide se a obra
// pode rodar continua sendo o /verificar. Aqui é só leitura, e a recusa é sempre genérica.
import { iguais, sha256 } from './cripto.ts'
import { type Deps, ErroRegra, HASH_RE } from './tipos.ts'

export interface ResumoLicenca {
  tipo: 'paga' | 'cortesia'
  /** 'degustacao' = teste grátis self-service; null = compra ou cortesia do gestor. */
  origem: 'degustacao' | null
  /** Cortesia: até quando vale (ISO). Paga: null. */
  validade_em: string | null
  /** Cortesia cujo prazo passou (ou sem prazo gravado), mesmo que a licença já tenha sido encerrada. */
  vencida: boolean
  /** Hora do servidor (ISO): o app conta os dias a partir dela, não do relógio do computador. */
  agora: string
}

const negado = () => new ErroRegra('negado', 'Não foi possível ler a licença deste computador.', 401)

export async function resumoDaLicenca(d: Deps, a: { email: string; computador_hash: string; token_dispositivo: string }): Promise<ResumoLicenca> {
  if (!HASH_RE.test(a.computador_hash ?? '')) throw negado()
  const cliente = await d.store.clientePorEmail((a.email ?? '').trim().toLowerCase())
  const lic = cliente && (await d.store.licencaDoCliente(cliente.id))
  if (!lic) throw negado()
  const ativa = await d.store.ativacaoAtiva(lic.id)
  const hashToken = await sha256(a.token_dispositivo || '-')
  if (!ativa || ativa.computador_hash !== a.computador_hash || !ativa.token_hash || !iguais(hashToken, ativa.token_hash)) throw negado()

  const agora = d.agora()
  if (lic.tipo !== 'cortesia') return { tipo: 'paga', origem: null, validade_em: null, vencida: false, agora: agora.toISOString() }
  const validade = lic.validade_em ?? null
  return {
    tipo: 'cortesia',
    origem: lic.origem === 'degustacao' ? 'degustacao' : null,
    validade_em: validade ? validade.toISOString() : null,
    vencida: !validade || validade.getTime() <= agora.getTime(),
    agora: agora.toISOString(),
  }
}
