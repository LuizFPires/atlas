import fs from 'node:fs'
import path from 'node:path'
// @ts-expect-error script .mjs sem tipos
import { lerKitDoRepositorio, montarModulo } from '../../scripts/gerar-kit-embutido.mjs'

test('o kit embutido na função está igual ao .claude/ do repositório (rode: node scripts/gerar-kit-embutido.mjs)', () => {
  const atual = fs.readFileSync(path.resolve(__dirname, '../functions/_shared/kit-embutido.ts'), 'utf8')
  expect(atual).toBe(montarModulo(lerKitDoRepositorio()))
})

test('o kit embutido tem agentes, skills e hooks, todos sob .claude/', async () => {
  const { KIT_EMBUTIDO } = await import('../functions/_shared/kit-embutido.ts')
  expect(KIT_EMBUTIDO.length).toBeGreaterThan(20)
  for (const a of KIT_EMBUTIDO) expect(a.caminho).toMatch(/^\.claude\/(agents|skills|hooks|commands)\//)
  expect(KIT_EMBUTIDO.some((a) => a.caminho === '.claude/agents/implementador.md')).toBe(true)
})

test('juntarKit: o kit embutido é a base; o que veio do Storage acrescenta ou substitui pelo mesmo caminho', async () => {
  const { juntarKit } = await import('../functions/_shared/kit.ts')
  const r = juntarKit([{ caminho: '.claude/agents/a.md', conteudo: 'A' }, { caminho: '.claude/agents/b.md', conteudo: 'B' }], [{ caminho: '.claude/agents/b.md', conteudo: 'B2' }, { caminho: '.claude/skills/c/SKILL.md', conteudo: 'C' }])
  expect(r).toEqual([{ caminho: '.claude/agents/a.md', conteudo: 'A' }, { caminho: '.claude/agents/b.md', conteudo: 'B2' }, { caminho: '.claude/skills/c/SKILL.md', conteudo: 'C' }])
})
