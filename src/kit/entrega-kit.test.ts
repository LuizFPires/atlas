// @vitest-environment node
import { CHAVE_COFRE } from '../app/ativacao-api'
import type { Cofre } from '../app/ponte'
import { avisoNoTopo, caminhoSeguro, criarKitApi, criarKitFixture, montarKitDaObra } from './entrega-kit'

const MARCA = 'abcdef0123456789abcdef01'
const AV = `Software proprietário do Atlas, licenciado a Ana (marca ${MARCA}). Cópia, redistribuição ou revenda são proibidas (Lei 9.609/98).`
const bom = { caminho: '.claude/agents/a.md', conteudo: `---\n# ${AV}\nname: a\n---\n` }

function cofre(com = true): Cofre & { chamadas: string[] } {
  const chamadas: string[] = []
  return {
    chamadas,
    async guardar(k) { chamadas.push(`guardar:${k}`) },
    async ler(k) { chamadas.push(`ler:${k}`); return com && k === CHAVE_COFRE ? JSON.stringify({ token: 'TOK', email: 'ana@loja.com', nome: 'Ana' }) : null },
    async apagar() {},
  }
}
const ponte = (c: Cofre) => ({ cofre: c, hashComputador: async () => 'a'.repeat(64) })
const resposta = (corpo: object, status = 200) => (async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch

test('kit entregue fica só na memória e é descartado ao fim da obra', async () => {
  const r = await criarKitApi(ponte(cofre()), { api: 'https://x' }, resposta({ marca_dagua: MARCA, arquivos: [bom] })).entregar('obra-1')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.kit.arquivos()).toHaveLength(1)
  r.kit.descartar()
  expect(r.kit.arquivos()).toHaveLength(0)
})

test('manda o token só no cabeçalho do dispositivo e não grava nada no cofre', async () => {
  const c = cofre()
  let visto: RequestInit | undefined
  const f = (async (_u: string, i: RequestInit) => { visto = i; return new Response(JSON.stringify({ marca_dagua: MARCA, arquivos: [bom] })) }) as unknown as typeof fetch
  await criarKitApi(ponte(c), { api: 'https://x' }, f).entregar('obra-1')
  expect((visto!.headers as Record<string, string>)['X-Atlas-Dispositivo']).toBe('TOK')
  expect(String(visto!.body)).not.toContain('TOK')
  expect(c.chamadas.some((x) => x.startsWith('guardar'))).toBe(false)
})

test.each([
  ['arquivo sem aviso', [{ caminho: 'x.md', conteudo: '# Sem aviso' }]],
  ['aviso com marca de outro cliente', [{ caminho: 'x.md', conteudo: `<!-- ${AV.replace(MARCA, 'outra-marca-1234567890')} -->\n` }]],
  ['aviso só no fim do arquivo', [{ caminho: 'x.md', conteudo: `1\n2\n3\n4\n5\n<!-- ${AV} -->` }]],
  ['caminho fora da pasta', [{ ...bom, caminho: '../fora.md' }]],
  ['json sem aviso no topo', [{ caminho: 'x.json', conteudo: JSON.stringify({ a: 1, _licenca: AV, _marca: MARCA }) }]],
  ['sem arquivos', []],
])('recusa kit com defeito: %s', (_n, arquivos) => {
  expect(montarKitDaObra('o', { marca_dagua: MARCA, arquivos })).toMatchObject({ ok: false })
})

test('sem ativação ou com erro do servidor, não entrega e fala em português', async () => {
  const sem = await criarKitApi(ponte(cofre(false)), { api: 'https://x' }).entregar('o')
  expect(sem).toMatchObject({ ok: false, mensagem: expect.stringContaining('Ative') })
  const negado = await criarKitApi(ponte(cofre()), { api: 'https://x' }, resposta({ mensagem: 'Não foi possível liberar o kit.' }, 403)).entregar('o')
  expect(negado).toMatchObject({ ok: false })
  const off = await criarKitApi(ponte(cofre()), null).entregar('o')
  expect(off).toMatchObject({ ok: false })
})

test('fixture entrega kit com aviso no topo e caminhos seguros', async () => {
  const r = await criarKitFixture().entregar('obra-1')
  expect(r.ok).toBe(true)
  if (r.ok) for (const a of r.kit.arquivos()) expect(avisoNoTopo(a, r.kit.marca) && caminhoSeguro(a.caminho)).toBe(true)
})
