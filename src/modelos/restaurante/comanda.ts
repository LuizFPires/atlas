// App-modelo RESTAURANTE — comanda da cozinha. Aqui só se decide o TEXTO da comanda.
// A IMPRESSÃO real (impressora térmica ou tela de cozinha, KDS) é uma PORTA: hoje só existe o adaptador fixture,
// que NÃO imprime nada de verdade. Pendência da impressão real: app/PENDENTE-ENTREGAR.md.
import type { Pedido, Resp } from './dados'

export function textoDaComanda(p: Pedido): string {
  return [`COMANDA — ${p.rotulo}`, ...p.linhas.map((l) => `${l.qtd}x ${l.nome}`)].join('\n')
}

export interface PortaComanda { imprimir(p: Pedido): Promise<Resp<{ deVerdade: boolean }>> }

/** Fixture: guarda o texto só na memória e diz com honestidade que não imprimiu de verdade. */
export function criarComandaFixture(): PortaComanda & { impressas: string[] } {
  const impressas: string[] = []
  return {
    impressas,
    async imprimir(p) {
      impressas.push(textoDaComanda(p))
      return { ok: true, valor: { deVerdade: false } }
    },
  }
}
