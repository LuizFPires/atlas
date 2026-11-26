import { cabecalhoDispositivo, CHAVE_COFRE, criarAtivacaoApi, criarAtivacaoFixture, jaAtivado, lerAtivacao } from './ativacao-api'
import { criarCofreMemoria, criarPonteFixture } from './ponte'

const resp = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status })
const HASH = 'a'.repeat(64)
const cfg = { api: 'https://api.atlas.test', linkToken: 'link-123' }

const montar = (f: typeof fetch, linkToken = cfg.linkToken) => {
  const cofre = criarCofreMemoria()
  const ponte = { cofre, hashComputador: async () => HASH }
  return { cofre, api: criarAtivacaoApi(ponte, { ...cfg, linkToken }, f) }
}

test('pede o código ao servidor com o e-mail normalizado', async () => {
  const f = vi.fn(async () => resp({ ok: true }))
  const { api } = montar(f as never)
  expect(await api.pedirCodigo('  Ze@X.com.br ')).toEqual({ ok: true })
  expect(f).toHaveBeenCalledWith('https://api.atlas.test/ativar/solicitar-codigo', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ze@x.com.br' }) }))
})

test('e-mail torto nem sai do computador', async () => {
  const f = vi.fn()
  const { api } = montar(f as never)
  expect((await api.pedirCodigo('ze')).ok).toBe(false)
  expect(f).not.toHaveBeenCalled()
})

test('confirmar registra o computador (hash) e guarda o token SÓ no cofre', async () => {
  const f = vi.fn(async () => resp({ licenca_id: 'l1', nome_tratamento: 'Zé', token_dispositivo: 'segredo-do-dispositivo' }))
  const { api, cofre } = montar(f as never)
  localStorage.clear(); sessionStorage.clear()
  expect(await api.confirmar('ze@x.com.br', '482 071')).toEqual({ ok: true, nome: 'Zé', idioma: 'pt' })
  const corpo = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)
  expect(corpo).toEqual({ email: 'ze@x.com.br', codigo: '482071', token: 'link-123', computador_hash: HASH })
  expect(await jaAtivado(cofre)).toBe(true)
  expect((await lerAtivacao(cofre))?.token).toBe('segredo-do-dispositivo')
  // o segredo não vaza para armazenamento do navegador
  expect(JSON.stringify({ ...localStorage })).not.toContain('segredo-do-dispositivo')
  expect(JSON.stringify({ ...sessionStorage })).not.toContain('segredo-do-dispositivo')
  // as chamadas seguintes usam o cabeçalho X-Atlas-Dispositivo
  expect(await cabecalhoDispositivo(cofre)).toEqual({ 'X-Atlas-Dispositivo': 'segredo-do-dispositivo' })
})

test('erro do servidor (código errado, outro computador) vira recado e não guarda nada', async () => {
  const { api, cofre } = montar((async () => resp({ erro: 'outro_computador', mensagem: 'Essa licença já está em outro computador.' }, 409)) as never)
  expect(await api.confirmar('ze@x.com.br', '482071')).toEqual({ ok: false, mensagem: 'Essa licença já está em outro computador.' })
  expect(await jaAtivado(cofre)).toBe(false)
  expect(await cabecalhoDispositivo(cofre)).toEqual({})
})

test('sem o link de instalação ou sem rede, falha com recado amigo', async () => {
  expect((await montar(vi.fn() as never, '').api.confirmar('ze@x.com.br', '482071')).ok).toBe(false)
  const r = await montar((async () => { throw new Error('rede') }) as never).api.confirmar('ze@x.com.br', '482071')
  expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining('internet') })
})

test('código com menos de 6 números nem chama o servidor', async () => {
  const f = vi.fn()
  expect((await montar(f as never).api.confirmar('ze@x.com.br', '123')).ok).toBe(false)
  expect(f).not.toHaveBeenCalled()
})

test('sem servidor configurado a ativação diz que ainda não está aberta', async () => {
  const api = criarAtivacaoApi(criarPonteFixture(), null)
  expect(await api.pedirCodigo('ze@x.com.br')).toMatchObject({ ok: false, mensagem: expect.stringContaining('ainda não está aberta') })
})

test('fixture: código 482071 ativa, outro não; token no cofre', async () => {
  const ponte = criarPonteFixture()
  const api = criarAtivacaoFixture(ponte)
  expect((await api.confirmar('ze@x.com.br', '111111')).ok).toBe(false)
  expect((await api.confirmar('ze@x.com.br', '482071')).ok).toBe(true)
  expect(await ponte.cofre.ler(CHAVE_COFRE)).toContain('fixture-token')
})

// Pedido do Luiz (22/11/2026): com o link do e-mail, o app manda o código sozinho; a pessoa não digita o e-mail de novo.
test('pelo link: pede o código só com o token e mostra o e-mail mascarado', async () => {
  const f = vi.fn(async () => resp({ ok: true, email_mascarado: 'a***@gmail.com' }))
  const { api } = montar(f as never)
  expect(api.pedirCodigoPeloLink).toBeTypeOf('function')
  expect(await api.pedirCodigoPeloLink!()).toEqual({ ok: true, emailMascarado: 'a***@gmail.com' })
  const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }]
  expect(url).toBe('https://api.atlas.test/ativar/solicitar-codigo-link')
  expect(JSON.parse(init.body)).toEqual({ token: 'link-123' })
})

test('pelo link: sem token não existe; link vencido vira recado', async () => {
  expect(montar(vi.fn() as never, '').api.pedirCodigoPeloLink).toBeUndefined()
  const r = await montar((async () => resp({ erro: 'link_expirado', mensagem: 'Esse link venceu. Peça outro.' }, 410)) as never).api.pedirCodigoPeloLink!()
  expect(r).toEqual({ ok: false, mensagem: 'Esse link venceu. Peça outro.' })
})

test('pelo link: confirma sem e-mail e guarda o e-mail que o servidor devolve', async () => {
  const f = vi.fn(async () => resp({ licenca_id: 'l1', nome_tratamento: 'Zé', email: 'appbomdia@gmail.com', token_dispositivo: 'seg' }))
  const { api, cofre } = montar(f as never)
  expect(await api.confirmar('', '482071')).toEqual({ ok: true, nome: 'Zé', idioma: 'pt' })
  expect(JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toMatchObject({ email: '', token: 'link-123' })
  expect((await lerAtivacao(cofre))?.email).toBe('appbomdia@gmail.com')
})

test('M31: a ativação traz o idioma da licença e ele fica guardado junto da ativação', async () => {
  const { criarAtivacaoApi, lerAtivacao } = await import('./ativacao-api')
  const guardado = new Map<string, string>()
  const ponte = { cofre: { guardar: async (k: string, v: string) => { guardado.set(k, v) }, ler: async (k: string) => guardado.get(k) ?? null, apagar: async (k: string) => { guardado.delete(k) } }, hashComputador: async () => 'a'.repeat(64) }
  const f = vi.fn(async () => new Response(JSON.stringify({ token_dispositivo: 'tok', nome_tratamento: 'John', email: 'john@shop.com', idioma: 'en' }), { status: 200 }))
  const api = criarAtivacaoApi(ponte as never, { api: 'https://api.test', linkToken: 'L'.repeat(40) }, f as unknown as typeof fetch)
  expect(await api.confirmar('', '482071')).toEqual({ ok: true, nome: 'John', idioma: 'en' })
  expect((await lerAtivacao(ponte.cofre as never))?.idioma).toBe('en')
})
