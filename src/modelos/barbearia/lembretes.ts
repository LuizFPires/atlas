// App-modelo BARBEARIA — lembrete de horário. Aqui só se decide QUAIS lembretes sairiam e com que texto.
// O ENVIO real (WhatsApp, push ou e-mail) é uma PORTA: hoje só existe o adaptador fixture, que NÃO envia nada.
// Pendência do envio real: app/PENDENTE-ENTREGAR.md.
import type { Cliente, Horario, Resp } from './dados'

export interface Lembrete { horarioId: string; clienteId: string; telefone: string; mensagem: string }

export function mensagemDoLembrete(nomeNegocio: string, cliente: Cliente, h: Horario): string {
  const primeiro = cliente.nome.trim().split(/\s+/)[0]
  return `Oi, ${primeiro}! Passando para lembrar do seu ${h.servico.toLowerCase()} hoje às ${h.hora} na ${nomeNegocio}. Se não puder vir, é só avisar.`
}

/** Só horários marcados e com lembrete ligado entram. Cancelado ou já feito nunca. */
export function lembretesQueSairiam(nomeNegocio: string, horarios: Horario[], clientes: Cliente[]): Lembrete[] {
  const out: Lembrete[] = []
  for (const h of horarios) {
    if (h.estado !== 'marcado' || !h.lembrete) continue
    const c = clientes.find((x) => x.id === h.clienteId)
    if (!c) continue
    out.push({ horarioId: h.id, clienteId: c.id, telefone: c.telefone, mensagem: mensagemDoLembrete(nomeNegocio, c, h) })
  }
  return out.sort((a, b) => a.horarioId.localeCompare(b.horarioId))
}

export interface PortaEnvio { enviar(l: Lembrete[]): Promise<Resp<{ enviados: number; deVerdade: boolean }>> }

/** Fixture: guarda o que "saiu" só na memória e diz com honestidade que não foi enviado de verdade. */
export function criarEnvioFixture(): PortaEnvio & { enviados: Lembrete[] } {
  const enviados: Lembrete[] = []
  return {
    enviados,
    async enviar(l) {
      enviados.push(...l)
      return { ok: true, valor: { enviados: l.length, deVerdade: false } }
    },
  }
}
