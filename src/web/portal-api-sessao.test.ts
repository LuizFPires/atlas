// M52 (Luiz, 25/11/2026: "toda hora desconecta"): no app do celular o login fica no aparelho e se renova sozinho.
import { CHAVE_SESSAO_LONGA, criarPortalApi, type ConfigPortal } from './portal-api'

const cfg: ConfigPortal = { api: 'https://srv.test/api', authUrl: 'https://srv.test/auth/v1', anonKey: 'anon' }
type Resp = { status: number; corpo: object }
function servidorFalso(respostas: Record<string, Resp[]>) {
  const chamadas: { url: string; corpo: Record<string, unknown>; auth?: string }[] = []
  const f = (async (url: string, init: RequestInit) => {
    const chave = Object.keys(respostas).find((k) => url.includes(k))!
    const r = respostas[chave].length > 1 ? respostas[chave].shift()! : respostas[chave][0]
    chamadas.push({ url, corpo: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization })
    return new Response(JSON.stringify(r.corpo), { status: r.status })
  }) as unknown as typeof fetch
  return { f, chamadas }
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

test('o login do celular sobrevive a fechar o app (fica guardado no aparelho)', async () => {
  const { f } = servidorFalso({ '/verify': [{ status: 200, corpo: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } }] })
  const a = criarPortalApi(cfg, f, { lembrar: true })
  expect((await a.entrar('ana@loja.com', '123456')).ok).toBe(true)
  expect(JSON.parse(localStorage.getItem(CHAVE_SESSAO_LONGA)!).renovar).toBe('R1')
  sessionStorage.clear() // o iPhone fechou o app
  expect(criarPortalApi(cfg, f, { lembrar: true }).logado()).toBe(true)
})

test('acesso perto de vencer: renova sozinho antes de chamar o servidor, e guarda a chave nova', async () => {
  let agora = 0
  const { f, chamadas } = servidorFalso({
    '/verify': [{ status: 200, corpo: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } }],
    '/token?grant_type=refresh_token': [{ status: 200, corpo: { access_token: 'A2', refresh_token: 'R2', expires_in: 3600 } }],
    '/portal/eu': [{ status: 200, corpo: { nome: 'Ana' } }],
  })
  const a = criarPortalApi(cfg, f, { lembrar: true, agora: () => agora })
  await a.entrar('ana@loja.com', '123456')
  agora = 3600_000 - 30_000 // faltam 30 s
  expect((await a.eu()).ok).toBe(true)
  expect(chamadas.map((c) => c.url.replace('https://srv.test', ''))).toEqual(['/auth/v1/verify', '/auth/v1/token?grant_type=refresh_token', '/api/portal/eu'])
  expect(chamadas[1].corpo).toEqual({ refresh_token: 'R1' })
  expect(chamadas[2].auth).toBe('Bearer A2')
  expect(JSON.parse(localStorage.getItem(CHAVE_SESSAO_LONGA)!).renovar).toBe('R2')
})

test('401 do servidor: renova uma vez e repete; renovação recusada volta para o login', async () => {
  const { f } = servidorFalso({
    '/verify': [{ status: 200, corpo: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } }],
    '/token?grant_type=refresh_token': [{ status: 200, corpo: { access_token: 'A2', refresh_token: 'R2', expires_in: 3600 } }, { status: 400, corpo: {} }],
    '/portal/eu': [{ status: 401, corpo: {} }, { status: 200, corpo: { nome: 'Ana' } }, { status: 401, corpo: {} }],
  })
  const a = criarPortalApi(cfg, f, { lembrar: true })
  await a.entrar('ana@loja.com', '123456')
  expect((await a.eu()).ok).toBe(true)
  expect(a.logado()).toBe(true)
  expect((await a.eu()).ok).toBe(false) // 401 de novo e a renovação agora é recusada
  expect(a.logado()).toBe(false)
  expect(localStorage.getItem(CHAVE_SESSAO_LONGA)).toBeNull()
})

test('sem internet na renovação: não derruba o login', async () => {
  const { f } = servidorFalso({ '/verify': [{ status: 200, corpo: { access_token: 'A1', refresh_token: 'R1', expires_in: 1 } }] })
  let agora = 0
  const a = criarPortalApi(cfg, (async (url: string, init: RequestInit) => (url.includes('/token') || url.includes('/portal') ? Promise.reject(new Error('rede')) : f(url, init))) as unknown as typeof fetch, { lembrar: true, agora: () => agora })
  await a.entrar('ana@loja.com', '123456')
  agora = 10_000
  expect((await a.eu()).ok).toBe(false)
  expect(a.logado()).toBe(true)
})

test('Portal web (sem lembrar): continua só enquanto a aba está aberta', async () => {
  const { f } = servidorFalso({ '/verify': [{ status: 200, corpo: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } }] })
  const a = criarPortalApi(cfg, f)
  await a.entrar('ana@loja.com', '123456')
  expect(localStorage.getItem(CHAVE_SESSAO_LONGA)).toBeNull()
  a.sair()
  expect(a.logado()).toBe(false)
})
