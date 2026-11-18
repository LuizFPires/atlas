// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { processarAtrasos } from '../functions/_shared/pagamento/atraso.ts'
import { processarWebhook } from '../functions/_shared/pagamento/webhook.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { assinarStripe, CONTA, evento, montarPag } from './helpers-pagamento.ts'
import { H1, TOKEN } from './helpers.ts'

const DIA = 24 * 3600_000
type M = ReturnType<typeof montarPag>
async function enviar(m: M, ev: object) {
  const corpo = JSON.stringify(ev)
  return processarWebhook(m.deps, CONTA, corpo, await assinarStripe(corpo, undefined, Math.floor(m.deps.agora().getTime() / 1000)))
}
const fatura = (id: string) => ({ id, customer: 'cus_1', subscription: 'sub_1', amount_paid: 20000, amount_due: 20000, payment_intent: `pi_${id}` })
const lic = (m: M) => m.store.licencas[0]

/** Licença fixture l1 já ligada à conta e ativada num computador. */
async function cenario() {
  const m = montarPag()
  Object.assign(lic(m), { conta_gateway_id: CONTA, gateway_cliente_ref: 'cus_1', gateway_assinatura_ref: 'sub_1', avisos_atraso: 0 })
  await m.ativar(H1)
  const pode = async () => (await verificar(m.deps, { email: 'ana@loja.com', computador_hash: H1, token_dispositivo: TOKEN })).pode_construir
  return { m, pode }
}

describe('atraso: aviso e pausa em 7 dias', () => {
  it('falha de cobrança abre carência de 7 dias, manda o aviso 1 e o pipeline segue funcionando', async () => {
    const { m, pode } = await cenario()
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    expect(lic(m)).toMatchObject({ status: 'atrasada', avisos_atraso: 1 })
    expect(lic(m).pausa_prevista_em).toEqual(new Date(m.deps.agora().getTime() + 7 * DIA))
    expect(m.avisos).toHaveLength(1)
    expect(m.avisos[0]).toMatchObject({ email: 'ana@loja.com', aviso: { n: 1, nome: 'Ana' } })
    expect(m.store.pagamentos[0]).toMatchObject({ tipo: 'mensalidade', status: 'falhou' })
    expect(await pode()).toBe(true) // dentro da carência
  })

  it('retentativas da Stripe não estendem o prazo nem repetem o aviso 1', async () => {
    const { m } = await cenario()
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    const prazo = lic(m).pausa_prevista_em
    m.avancar(2 * DIA)
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    expect(lic(m).pausa_prevista_em).toEqual(prazo)
    expect(m.avisos).toHaveLength(1)
  })

  it('o job manda os avisos 2 (dia 3) e 3 (dia 6) uma vez só e pausa no dia 7, bloqueando o pipeline', async () => {
    const { m, pode } = await cenario()
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    m.avancar(1 * DIA)
    expect(await processarAtrasos(m.deps)).toEqual({ avisos: 0, pausadas: 0, erros: 0, encerradas: 0 })
    m.avancar(2 * DIA) // dia 3
    expect(await processarAtrasos(m.deps)).toMatchObject({ avisos: 1 })
    expect(await processarAtrasos(m.deps)).toMatchObject({ avisos: 0 }) // rodar de novo não repete
    m.avancar(3 * DIA) // dia 6
    expect(await processarAtrasos(m.deps)).toMatchObject({ avisos: 1 })
    expect(m.avisos.map((a) => a.aviso.n)).toEqual([1, 2, 3])
    expect(lic(m).status).toBe('atrasada')
    expect(await pode()).toBe(true)
    m.avancar(1 * DIA + 1000) // passou dos 7 dias
    expect(await processarAtrasos(m.deps)).toMatchObject({ pausadas: 1 })
    expect(lic(m).status).toBe('pausada')
    expect(m.store.ocorrencias.at(-1)?.tipo).toBe('licenca_pausada')
    expect(await pode()).toBe(false)
    expect(m.avisos).toHaveLength(3)
  })

  it('pagar durante a carência volta tudo ao normal; pagar depois da pausa também libera', async () => {
    const { m, pode } = await cenario()
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    m.avancar(2 * DIA)
    await enviar(m, evento('invoice.paid', fatura('in_1')))
    expect(lic(m)).toMatchObject({ status: 'ativa', pausa_prevista_em: null, avisos_atraso: 0 })
    expect(m.store.pagamentos[0].status).toBe('pago')
    expect(await processarAtrasos(m.deps)).toEqual({ avisos: 0, pausadas: 0, erros: 0, encerradas: 0 })

    await enviar(m, evento('invoice.payment_failed', fatura('in_2')))
    m.avancar(8 * DIA)
    await processarAtrasos(m.deps)
    expect(await pode()).toBe(false)
    await enviar(m, evento('invoice.paid', fatura('in_2')))
    expect(lic(m).status).toBe('ativa')
    expect(await pode()).toBe(true)
  })

  it('falha de e-mail não derruba o webhook; o job reenvia depois', async () => {
    const { m } = await cenario()
    const ok = m.deps.enviarAvisoAtraso
    m.deps.enviarAvisoAtraso = async () => { throw new Error('smtp fora') }
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    expect(lic(m)).toMatchObject({ status: 'atrasada', avisos_atraso: 0 })
    m.deps.enviarAvisoAtraso = ok
    expect(await processarAtrasos(m.deps)).toMatchObject({ avisos: 1 })
    expect(m.avisos[0].aviso.n).toBe(1)
  })

  it('licença cancelada não entra em atraso; reentrega de falha antiga já paga é ignorada', async () => {
    const { m } = await cenario()
    await enviar(m, evento('invoice.paid', fatura('in_1')))
    await enviar(m, evento('invoice.payment_failed', fatura('in_1')))
    expect(lic(m).status).toBe('ativa')
    lic(m).status = 'cancelada'
    await enviar(m, evento('invoice.payment_failed', fatura('in_9')))
    expect(lic(m).status).toBe('cancelada')
  })

  it('rota do job exige credencial de serviço', async () => {
    const { m } = await cenario()
    const c = { deps: m.deps, pagamento: m.deps, carregarKit: async () => [], autorizarServico: (r: Request) => r.headers.get('Authorization') === 'Bearer s' }
    const u = 'https://x.test/functions/v1/admin/processar-atrasos'
    expect((await tratar(c, new Request(u, { method: 'POST' }))).status).toBe(401)
    const r = await tratar(c, new Request(u, { method: 'POST', headers: { Authorization: 'Bearer s' } }))
    expect(await r.json()).toMatchObject({ pausadas: 0 })
  })
})
