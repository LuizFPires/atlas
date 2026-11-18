// @vitest-environment node
// O % do painel do app precisa ser IGUAL ao do painel do canteiro (.claude/hooks/plano.cjs).
// (Sem @types/node no projeto: os módulos do Node entram por nome em variável, só neste teste.)
import { ETAPAS_EXEMPLO, montarPlanMd } from './ponte-construcao'
import { criarPainelFixture, enderecoCanteiroSeguro, estadoDoPlano, lerPlanoDoTexto, planoDeExemplo, situacaoDaObra, textoPrevisao, textoRestante } from './ponte-painel'

interface Fs { mkdtempSync(p: string): string; writeFileSync(p: string, t: string): void; rmSync(p: string, o: { recursive: boolean; force: boolean }): void }
interface Leitor { lerPlano(raiz: string): { milestones: unknown[]; tarefas: number; feitas: number; pct: number; proximo: number | null } | null }
const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)

let fs: Fs, tmp: string, sep: string, leitor: Leitor
beforeAll(async () => {
  fs = (await mod('node:fs')) as Fs
  tmp = ((await mod('node:os')) as { tmpdir(): string }).tmpdir()
  sep = ((await mod('node:path')) as { sep: string }).sep
  const { createRequire } = (await mod('node:module')) as { createRequire(u: string): (m: string) => unknown }
  leitor = createRequire(import.meta.url)('../../.claude/hooks/plano.cjs') as Leitor
})

const doHook = (md: string) => {
  const raiz = fs.mkdtempSync(`${tmp}${sep}atlas-painel-`)
  try { fs.writeFileSync(`${raiz}${sep}PLAN.md`, md); return leitor.lerPlano(raiz)! } finally { fs.rmSync(raiz, { recursive: true, force: true }) }
}

test('o % ponderado do app é o mesmo do plano.cjs, em planos de formatos variados', () => {
  const casos = [
    montarPlanMd('Obra', ETAPAS_EXEMPLO),
    planoDeExemplo(),
    planoDeExemplo().replace(/\[ \]/g, '[x]'),
    '## M1: um\npeso: 3\n- [x] a\n- [ ] b\n\n## Milestone 2 — dois\npeso: 1,5\n* [X] c\n\n## Outro\n- [ ] solta\n',
    '# sem milestones\n',
  ]
  for (const md of casos) {
    const meu = lerPlanoDoTexto(md)
    const dele = doHook(md)
    expect(meu.pct).toBe(dele.pct)
    expect(meu.tarefas).toBe(dele.tarefas)
    expect(meu.feitas).toBe(dele.feitas)
    expect(meu.proximo).toBe(dele.proximo)
    expect(meu.milestones).toHaveLength(dele.milestones.length)
  }
})

test('o plano de exemplo tem 4 etapas prontas e a 5ª a meio caminho', () => {
  const e = estadoDoPlano(planoDeExemplo())
  expect(e.etapas).toHaveLength(8)
  expect(e.etapa).toEqual({ n: 5, nome: 'Confirmação por WhatsApp' })
  expect(e.pct).toBeGreaterThan(50)
  expect(e.pct).toBeLessThan(60)
})

test('a regra do modo: automático nunca pede OK; passo a passo pede; paradas reais valem nos dois', () => {
  const base = { pct: 40, parada: null, pausadaPorVoce: false, etapaPronta: { n: 2, nome: 'x' } } as const
  expect(situacaoDaObra('automatico', base)).toBe('andando')
  expect(situacaoDaObra('passo-a-passo', base)).toBe('espera-ok')
  for (const modo of ['automatico', 'passo-a-passo'] as const) {
    expect(situacaoDaObra(modo, { ...base, parada: 'cota' })).toBe('cota')
    expect(situacaoDaObra(modo, { ...base, parada: 'voce' })).toBe('precisa-de-voce')
    expect(situacaoDaObra(modo, { ...base, parada: 'billing' })).toBe('billing')
    expect(situacaoDaObra(modo, { ...base, pausadaPorVoce: true })).toBe('pausada')
    expect(situacaoDaObra(modo, { ...base, pct: 100 })).toBe('concluida')
  }
})

test('prazo em palavras de leigo', () => {
  expect(textoRestante(200)).toBe('≈ 3 h 20')
  expect(textoRestante(45)).toBe('≈ 45 min')
  expect(textoRestante(120)).toBe('≈ 2 h')
  expect(textoPrevisao(new Date(2026, 10, 18, 14, 40), 200)).toBe('Hoje, ~18h')
  expect(textoPrevisao(new Date(2026, 10, 18, 22, 0), 300)).toBe('Amanhã, ~3h')
})

test('só aceita o canteiro local do kit (127.0.0.1)', () => {
  expect(enderecoCanteiroSeguro('http://127.0.0.1:4747/?obra=abc')).toBe('http://127.0.0.1:4747/?obra=abc')
  for (const ruim of ['https://127.0.0.1:4747/', 'http://localhost:4747/', 'http://evil.com/', 'javascript:alert(1)', 'http://127.0.0.1:4747@evil.com/', 'http://127.0.0.1:4747/<x>', null, undefined, '']) {
    expect(enderecoCanteiroSeguro(ruim)).toBeNull()
  }
})

test('o fixture simula etapa pronta, cota e obra concluída', async () => {
  const p = criarPainelFixture({ agora: () => new Date(2026, 10, 18, 14, 40) })
  let e = await p.ler('x')
  expect(e.etapaPronta).toBeNull()
  expect(e.restante).toMatch(/^≈/)
  p.simular.concluirEtapa()
  e = await p.ler('x')
  expect(e.etapaPronta?.n).toBe(5)
  expect(e.etapa?.n).toBe(6)
  await p.aprovarEtapa('x')
  expect((await p.ler('x')).etapaPronta).toBeNull()
  p.simular.pararPor('cota')
  expect((await p.ler('x')).parada).toBe('cota')
  p.simular.concluirObra()
  e = await p.ler('x')
  expect(e.pct).toBe(100)
  expect(e.parada).toBeNull()
  await expect(p.aplicarModo('x', 'lixo' as never)).rejects.toThrow('modo-invalido')
})
