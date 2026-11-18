// @vitest-environment node
// O PLAN.md das obras do cliente segue o formato do painel; o que sair dele é recusado (e o leitor do painel concorda).
import { ETAPAS_EXEMPLO, criarConstrucaoFixture, montarPlanMd } from '../app/ponte-construcao'
import { validarPlanNovo, validarPlanObra } from './plan-obra'

const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
interface Fs { mkdtempSync(p: string): string; writeFileSync(p: string, t: string): void; rmSync(p: string, o: { recursive: boolean; force: boolean }): void }
interface Leitor { lerPlano(raiz: string): { milestones: unknown[]; tarefas: number } | null }

test('o PLAN gerado pelo Atlas (montarPlanMd) passa na validação', () => {
  const r = validarPlanNovo(montarPlanMd('Agenda da Barbearia do Zé', ETAPAS_EXEMPLO))
  expect(r).toMatchObject({ ok: true, milestones: 8, tarefas: 24, erros: [] })
})

test('o validador e o leitor do painel concordam sobre quantos milestones e tarefas existem', async () => {
  const fs = (await mod('node:fs')) as Fs
  const tmp = ((await mod('node:os')) as { tmpdir(): string }).tmpdir()
  const sep = ((await mod('node:path')) as { sep: string }).sep
  const { createRequire } = (await mod('node:module')) as { createRequire(u: string): (m: string) => unknown }
  const leitor = createRequire(import.meta.url)('../../.claude/hooks/plano.cjs') as Leitor
  const md = montarPlanMd('Obra', ETAPAS_EXEMPLO.slice(0, 3))
  const raiz = fs.mkdtempSync(`${tmp}${sep}atlas-plan-`)
  try {
    fs.writeFileSync(`${raiz}${sep}PLAN.md`, md)
    const painel = leitor.lerPlano(raiz)!
    const v = validarPlanObra(md)
    expect(painel.milestones).toHaveLength(v.milestones)
    expect(painel.tarefas).toBe(v.tarefas)
  } finally { fs.rmSync(raiz, { recursive: true, force: true }) }
})

const BOM = montarPlanMd('Obra', ETAPAS_EXEMPLO.slice(0, 2))

test.each([
  ['sem título do PLAN', BOM.replace('# PLAN — Obra', 'Plano da obra')],
  ['sem fonte da verdade', BOM.replace('Fonte da verdade: prototipo/ (aprovado pelo cliente)', '')],
  ['milestone sem peso', BOM.replace(/^peso: 2\r?\n/m, '')],
  ['peso fora de 1 a 3', BOM.replace('peso: 2', 'peso: 9')],
  ['sem spec', BOM.replace('spec: regras.md, telas.md\n', '')],
  ['sem tela', BOM.replace('tela: \n', '')],
  ['sem Notas', BOM.replace('Notas:\n', '')],
  ['numeração fora de ordem', BOM.replace('## Milestone 2', '## Milestone 5')],
  ['tarefa sem caixinha', BOM.replace(/- \[ \] /g, '- ')],
  ['texto livre, sem milestone', '# PLAN — Obra\nFonte da verdade: prototipo/\n\nFazer o app e depois testar.\n'],
  ['vazio', ''],
])('recusa PLAN fora do formato: %s', (_nome, md) => {
  const r = validarPlanObra(md)
  expect(r.ok).toBe(false)
  expect(r.erros.length).toBeGreaterThan(0)
})

test('plano novo não pode vir com tarefa já marcada', () => {
  expect(validarPlanNovo(BOM.replace('- [ ] Construir', '- [x] Construir')).ok).toBe(false)
  expect(validarPlanObra(BOM.replace('- [ ] Construir', '- [x] Construir')).ok).toBe(true)
})

test('o início da obra (fixture) só aceita etapas que geram PLAN válido', async () => {
  const c = criarConstrucaoFixture()
  await c.iniciar('Zé', 'Obra', 'passo-a-passo', ETAPAS_EXEMPLO.map((e) => ({ ...e })))
  expect(validarPlanNovo(c.iniciadas[0].plan).ok).toBe(true)
})
