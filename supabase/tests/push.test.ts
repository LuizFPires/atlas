// @vitest-environment node
// M41 — aviso no celular (Luiz, 24/11/2026: "não pode ficar no escuro"). O celular do dono aceita receber avisos (Web Push) e o
// notebook avisa quando a cota volta ou quando a obra para. A chave privada só existe nos segredos do Supabase.
import { describe, expect, it } from 'vitest'
import { tratar } from '../functions/_shared/http.ts'
import { criarCanalPushMemoria } from '../functions/_shared/memoria.ts'
import type { AssinaturaPush, EnvioPush } from '../functions/_shared/push.ts'
import { TOKEN } from './helpers.ts'
import { chamar, comDoisClientes, JWT_ANA, JWT_BETO } from './helpers-portal.ts'

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'q'.repeat(22) } }

async function preparar(o: { chave?: string | null; envio?: EnvioPush } = {}) {
  const m = await comDoisClientes()
  const push = criarCanalPushMemoria()
  const enviados: { sub: AssinaturaPush; corpo: unknown }[] = []
  const envio: EnvioPush = o.envio ?? (async (sub, corpo) => { enviados.push({ sub, corpo: JSON.parse(corpo) }); return 'ok' })
  const c = m.ctx({ push, enviarPush: envio, chavePublicaPush: o.chave === undefined ? 'BPUBLICA' : o.chave ?? undefined })
  const pc = (rota: string, corpo: object = {}) =>
    tratar(c, new Request(`https://x.test/functions/v1/api${rota}`, { method: 'POST', headers: { 'X-Atlas-Dispositivo': TOKEN }, body: JSON.stringify({ email: 'ana@loja.com', computador_hash: 'a'.repeat(64), ...corpo }) }))
  const cel = (rota: string, corpo: object = {}, jwt = JWT_ANA) => chamar(c, rota, jwt, corpo)
  return { push, enviados, pc, cel }
}

describe('aviso no celular (Web Push)', () => {
  it('o celular pega a chave pública e assina; o notebook avisa e o aviso chega só no celular do dono', async () => {
    const { enviados, pc, cel } = await preparar()
    const k = await cel('/portal/celular/push/chave')
    expect(await k.json()).toEqual({ chave: 'BPUBLICA' })
    expect((await cel('/portal/celular/push/assinar', { assinatura: SUB })).status).toBe(200)
    const r = await pc('/celular/avisar', { titulo: 'A obra voltou', texto: 'A cota do Claude renovou. A obra Barbearia voltou a trabalhar.', obra_id: 'barbearia' })
    expect(await r.json()).toEqual({ enviados: 1 })
    expect(enviados).toHaveLength(1)
    expect(enviados[0].sub.endpoint).toBe(SUB.endpoint)
    expect(enviados[0].corpo).toEqual({ titulo: 'A obra voltou', texto: 'A cota do Claude renovou. A obra Barbearia voltou a trabalhar.', url: '/app' })
  })

  it('sem chave configurada: avisa com calma que ainda não dá (503), nunca quebra', async () => {
    const { cel } = await preparar({ chave: null })
    const r = await cel('/portal/celular/push/chave')
    expect(r.status).toBe(503)
  })

  it('assinatura de fora dos serviços de aviso conhecidos, ou malformada, é recusada', async () => {
    const { cel, push } = await preparar()
    for (const assinatura of [{ ...SUB, endpoint: 'https://evil.test/x' }, { ...SUB, endpoint: 'http://fcm.googleapis.com/x' }, { endpoint: SUB.endpoint, keys: { p256dh: '<script>', auth: 'x' } }, null]) {
      expect((await cel('/portal/celular/push/assinar', { assinatura })).status).toBe(400)
    }
    expect(await push.listar('l1')).toEqual([])
  })

  it('o aviso de um não chega no celular do outro; assinatura vencida (410) é apagada', async () => {
    const enviados: string[] = []
    const { pc, cel, push } = await preparar({ envio: async (sub) => { enviados.push(sub.endpoint); return sub.endpoint.endsWith('velha') ? 'fim' : 'ok' } })
    await cel('/portal/celular/push/assinar', { assinatura: { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/beto' } }, JWT_BETO)
    await cel('/portal/celular/push/assinar', { assinatura: SUB })
    await cel('/portal/celular/push/assinar', { assinatura: { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/velha' } })
    expect(await (await pc('/celular/avisar', { titulo: 'x', texto: 'y' })).json()).toEqual({ enviados: 1 })
    expect(enviados).not.toContain('https://fcm.googleapis.com/fcm/send/beto')
    expect((await push.listar('l1')).map((s) => s.endpoint)).toEqual([SUB.endpoint])
  })

  it('sem licença ou sem o computador confirmado: não envia nada', async () => {
    const { enviados, cel } = await preparar()
    expect((await cel('/portal/celular/push/assinar', { assinatura: SUB }, 'jwt-invalido')).status).toBeGreaterThanOrEqual(400)
    const { tratar: t } = await import('../functions/_shared/http.ts')
    void t
    expect(enviados).toHaveLength(0)
  })
})
