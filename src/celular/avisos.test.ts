import { ligarAvisos, situacaoDosAvisos } from './avisos'

// M41 — aviso no celular quando a cota volta ou a obra para (Luiz, 24/11/2026: "não pode ficar no escuro").
const chave = 'BEgqxOVo6YHskBhALNtMgaDLDmpZVM4DqB8cg-a8Ami4szNXncTmbEvSercIhdZZZQwgRGRs-NbS6BlUDKazaz0'

test('situação: sem suporte, iPhone fora da Tela de Início, bloqueado, ligado ou dá para ligar', () => {
  expect(situacaoDosAvisos({ suporta: false, permissao: 'default', iphone: false, instalado: false })).toBe('sem-suporte')
  expect(situacaoDosAvisos({ suporta: true, permissao: 'default', iphone: true, instalado: false })).toBe('iphone-tela-inicio')
  expect(situacaoDosAvisos({ suporta: true, permissao: 'denied', iphone: false, instalado: true })).toBe('bloqueado')
  expect(situacaoDosAvisos({ suporta: true, permissao: 'granted', iphone: false, instalado: true, assinado: true })).toBe('ligado')
  expect(situacaoDosAvisos({ suporta: true, permissao: 'default', iphone: false, instalado: true })).toBe('pode-ligar')
})

test('ligar: pede a permissão, assina com a chave pública do servidor e manda a assinatura', async () => {
  const assinados: unknown[] = []
  let usada: Uint8Array | null = null
  const r = await ligarAvisos({
    pedirPermissao: async () => 'granted',
    chave: async () => chave,
    assinar: async (opcoes) => { usada = opcoes.applicationServerKey; return { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } }) } },
    enviar: async (s) => { assinados.push(s) },
  })
  expect(r).toBe('ligado')
  expect(usada!.length).toBe(65)
  expect(assinados).toEqual([{ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } }])
})

test('ligar: a pessoa não deixou, nada é mandado', async () => {
  const enviar = vi.fn()
  expect(await ligarAvisos({ pedirPermissao: async () => 'denied', chave: async () => chave, assinar: vi.fn(), enviar })).toBe('bloqueado')
  expect(enviar).not.toHaveBeenCalled()
})
