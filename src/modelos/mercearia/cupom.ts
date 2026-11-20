// App-modelo MERCEARIA — cupom da venda. Aqui só se decide o TEXTO do cupom.
// A IMPRESSÃO real (impressora térmica / cupom fiscal) é uma PORTA: hoje só existe o adaptador fixture,
// que NÃO imprime nada de verdade. Pendência da impressão real: app/PENDENTE-ENTREGAR.md.
import { formatarPreco, type Resp, type Venda } from './dados'

export function textoDoCupom(v: Venda): string {
  return [
    'CUPOM (sem valor fiscal)',
    ...v.linhas.map((l) => `${l.qtd}x ${l.nome}  ${formatarPreco(l.precoCentavos * l.qtd)}`),
    `TOTAL ${formatarPreco(v.totalCentavos)}`,
  ].join('\n')
}

export interface PortaCupom { imprimir(v: Venda): Promise<Resp<{ deVerdade: boolean }>> }

/** Fixture: guarda o texto só na memória e diz com honestidade que não imprimiu de verdade. */
export function criarCupomFixture(): PortaCupom & { impressos: string[] } {
  const impressos: string[] = []
  return {
    impressos,
    async imprimir(v) {
      impressos.push(textoDoCupom(v))
      return { ok: true, valor: { deVerdade: false } }
    },
  }
}
