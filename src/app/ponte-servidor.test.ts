import { criarAtivacaoApi } from './ativacao-api'
import { fetchPelaPonte, type PonteServidor } from './ponte-servidor'
import type { Cofre } from './ponte'

const API = 'https://servidor.test/functions/v1/api'

function ponteFalsa(resposta: { status: number; corpo: string }) {
  const chamadas: Array<{ rota: string; corpo: object; cabecalhos: Record<string, string> }> = []
  const servidor: PonteServidor = { postar: async (rota, corpo, cabecalhos) => { chamadas.push({ rota, corpo, cabecalhos }); return resposta } }
  return { servidor, chamadas }
}

test('a chamada da tela vai pelo processo principal: rota, corpo e só o cabeçalho do dispositivo', async () => {
  const { servidor, chamadas } = ponteFalsa({ status: 200, corpo: '{"pode_construir":true}' })
  const f = fetchPelaPonte(servidor, API)
  const r = await f(`${API}/verificar`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Atlas-Dispositivo': 'tok-1' }, body: JSON.stringify({ email: 'a@b.com' }) })
  expect(chamadas).toEqual([{ rota: '/verificar', corpo: { email: 'a@b.com' }, cabecalhos: { 'X-Atlas-Dispositivo': 'tok-1' } }])
  expect(r.ok).toBe(true)
  expect(await r.json()).toEqual({ pode_construir: true })
})

test('status de erro do servidor chega inteiro à tela (ex.: 429 com o recado)', async () => {
  const { servidor } = ponteFalsa({ status: 429, corpo: '{"mensagem":"Espere uns minutos."}' })
  const r = await fetchPelaPonte(servidor, API)(`${API}/ativar/solicitar-codigo`, { method: 'POST', body: '{}' })
  expect(r.status).toBe(429)
  expect(await r.json()).toEqual({ mensagem: 'Espere uns minutos.' })
})

test('endereço fora do servidor do Atlas nunca é chamado', async () => {
  const { servidor, chamadas } = ponteFalsa({ status: 200, corpo: '{}' })
  await expect(fetchPelaPonte(servidor, API)('https://outro.test/verificar', { method: 'POST', body: '{}' })).rejects.toThrow()
  expect(chamadas).toHaveLength(0)
})

test('ativação de ponta a ponta pela ponte: pede o código e guarda o token no cofre', async () => {
  const guardado = new Map<string, string>()
  const cofre: Cofre = { guardar: async (c, v) => { guardado.set(c, v) }, ler: async (c) => guardado.get(c) ?? null, apagar: async (c) => { guardado.delete(c) } }
  const rotas: string[] = []
  const servidor: PonteServidor = {
    postar: async (rota) => { rotas.push(rota); return rota === '/ativar/confirmar' ? { status: 200, corpo: '{"token_dispositivo":"tok-9","nome_tratamento":"Ana"}' } : { status: 200, corpo: '{}' } },
  }
  const api = criarAtivacaoApi({ cofre, hashComputador: async () => 'a'.repeat(64) }, { api: API, linkToken: 'link-1' }, fetchPelaPonte(servidor, API))
  expect(await api.pedirCodigo('ana@loja.com')).toEqual({ ok: true })
  expect(await api.confirmar('ana@loja.com', '123456')).toEqual({ ok: true, nome: 'Ana', idioma: 'pt' })
  expect(rotas).toEqual(['/ativar/solicitar-codigo', '/ativar/confirmar'])
  expect(JSON.parse(guardado.get('atlas/dispositivo')!)).toMatchObject({ token: 'tok-9' })
})
