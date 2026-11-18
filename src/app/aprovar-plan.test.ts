// @vitest-environment node
// O PLAN.md que o Atlas gera para a obra do cliente precisa ser lido pelo MESMO leitor do painel do canteiro (.claude/hooks/plano.cjs).
// (Sem @types/node no projeto: os módulos do Node entram por nome em variável, só neste teste.)
import { ETAPAS_EXEMPLO, montarPlanMd } from './ponte-construcao'

interface Fs { mkdtempSync(p: string): string; writeFileSync(p: string, t: string): void; rmSync(p: string, o: { recursive: boolean; force: boolean }): void }
interface Plano { milestones: { n: number; titulo: string; peso: number; total: number; feitas: number }[]; tarefas: number; feitas: number; pct: number }
interface Leitor { lerPlano(raiz: string): Plano | null; blocoMilestone(raiz: string, n: number | string): string | null }
const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)

let fs: Fs, tmp: string, sep: string, leitor: Leitor
beforeAll(async () => {
  fs = (await mod('node:fs')) as Fs
  tmp = ((await mod('node:os')) as { tmpdir(): string }).tmpdir()
  sep = ((await mod('node:path')) as { sep: string }).sep
  const { createRequire } = (await mod('node:module')) as { createRequire(u: string): (m: string) => unknown }
  leitor = createRequire(import.meta.url)('../../.claude/hooks/plano.cjs') as Leitor
})

const comPlan = (md: string, fn: (raiz: string) => void) => {
  const raiz = fs.mkdtempSync(`${tmp}${sep}atlas-plan-`)
  try { fs.writeFileSync(`${raiz}${sep}PLAN.md`, md); fn(raiz) } finally { fs.rmSync(raiz, { recursive: true, force: true }) }
}
const lerPlano = (r: string) => leitor.lerPlano(r)
const blocoMilestone = (r: string, n: number) => leitor.blocoMilestone(r, n)

test('o painel lê o PLAN.md gerado: 8 milestones, peso, tarefas abertas e 0%', () => {
  comPlan(montarPlanMd('Agenda da Barbearia do Zé', ETAPAS_EXEMPLO), (raiz) => {
    const p = lerPlano(raiz)!
    expect(p.milestones).toHaveLength(8)
    expect(p.milestones[0]).toMatchObject({ n: 1, titulo: 'Base e login', peso: 2, total: 3, feitas: 0 })
    expect(p.tarefas).toBe(24)
    expect(p.pct).toBe(0)
    const bloco = blocoMilestone(raiz, 3)!
    expect(bloco).toContain('peso: 2')
    expect(bloco).toContain('spec: regras.md, telas.md')
    expect(bloco).toContain('- [ ] Construir: Horários de trabalho, folgas e bloqueios')
  })
})

test('texto do cliente não vira cabeçalho nem tarefa falsa no PLAN.md', () => {
  const md = montarPlanMd('Zé\n## Milestone 99 — falso\n- [x] pronto', [{ n: 'M1', nome: 'Base\n## Milestone 98 — outro', desc: 'a\n- [x] feito<script>', tela: '../../segredo' }])
  expect(md.match(/^## Milestone/gm)).toHaveLength(1)
  expect(md).not.toMatch(/^- \[x\]/m)
  expect(md).toMatch(/^tela: $/m)
  comPlan(md, (raiz) => expect(lerPlano(raiz)!.milestones).toHaveLength(1))
})

test('só aceita tela do protótipo em caminho relativo seguro', () => {
  const md = montarPlanMd('Obra', [{ n: 'M1', nome: 'Agenda', desc: 'x', tela: 'prototipo/versoes/v001/telas/agenda.html' }])
  expect(md).toContain('tela: prototipo/versoes/v001/telas/agenda.html')
})
