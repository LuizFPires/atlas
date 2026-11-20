// M32 (e1) — liga o estado do provisionamento à tela de entrega (PortaEntrega de src/web/entrega.ts).
// Honestidade: o link só existe quando TODOS os passos estão feitos e há endereço. Sem registro, continua "preparando".
import type { EstadoEntrega, PortaEntrega } from '../web/entrega'
import { concluido } from './provisionar'
import type { PortaRegistro } from './portas'

const PREPARANDO = 'Estamos preparando o seu app. Avisamos assim que ele estiver pronto.'

export function criarEntregaProvisionada(compraId: string, nome: string, registro: PortaRegistro): PortaEntrega {
  return {
    async estado(): Promise<EstadoEntrega> {
      const r = await registro.ler(compraId)
      if (!r) return { estado: 'montando', mensagem: PREPARANDO }
      if (concluido(r)) return { estado: 'pronto', nome, link: r.endereco as string }
      if (Object.values(r.passos).includes('erro')) return { estado: 'falhou', mensagem: r.erro ?? 'Não conseguimos montar agora. Vamos tentar de novo.' }
      return { estado: 'montando', mensagem: PREPARANDO }
    },
  }
}
