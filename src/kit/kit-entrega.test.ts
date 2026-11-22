// @vitest-environment node
// Trava da entrega (decisão do Luiz, 22/11/2026): produção só pela skill /entregar; travada, a tarefa vira ocorrência com data.
// (Sem @types/node no projeto: módulos do Node entram por nome em variável.)
const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
let construir = ''

beforeAll(async () => {
  const fs = (await mod('node:fs')) as { readFileSync(p: string, e: string): string }
  const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string): string }
  const path = (await mod('node:path')) as { resolve(...p: string[]): string }
  construir = fs.readFileSync(path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '.claude', 'skills', 'construir', 'SKILL.md'), 'utf8')
})

test('o /construir só publica em produção pela skill /entregar e respeita a trava', () => {
  expect(construir).toMatch(/Produção só pela skill `entregar`/)
  expect(construir).toMatch(/Entregar — ainda travado/)
  expect(construir).toMatch(/entrega em produção travada/)
})
