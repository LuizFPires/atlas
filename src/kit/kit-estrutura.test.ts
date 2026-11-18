// @vitest-environment node
// O kit (.claude/agents e .claude/skills) pode ter o texto reescrito, mas a estrutura e os gatilhos não podem quebrar.
// (Sem @types/node no projeto: módulos do Node entram por nome em variável.)
const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
interface Fs { readdirSync(p: string): string[]; readFileSync(p: string, e: string): string; existsSync(p: string): boolean }
let fs: Fs, raiz: string

beforeAll(async () => {
  fs = (await mod('node:fs')) as Fs
  const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string): string }
  const path = (await mod('node:path')) as { resolve(...p: string[]): string }
  raiz = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '.claude')
})

function frontmatter(t: string): Record<string, string> {
  const m = t.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) throw new Error('sem frontmatter')
  const o: Record<string, string> = {}
  for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return o
}

const AGENTES = ['corretor', 'designer', 'despachante', 'escritor', 'implantador', 'implementador', 'plantonista', 'qa', 'revisor', 'vistoriador']
const SKILLS = ['adotar', 'briefing', 'canteiro', 'construir', 'documentar', 'entregar', 'linha', 'prototipo', 'stop-recomendado']

test.each(AGENTES)('agente %s mantém nome e descrição (gatilho)', (a) => {
  const f = frontmatter(fs.readFileSync(`${raiz}/agents/${a}.md`, 'utf8'))
  expect(f.name).toBe(a)
  expect(f.description.length).toBeGreaterThan(40)
  expect(f.tools).toBeTruthy()
})

test.each(SKILLS)('skill %s mantém nome e descrição (gatilho)', (s) => {
  const f = frontmatter(fs.readFileSync(`${raiz}/skills/${s}/SKILL.md`, 'utf8'))
  expect(f.name).toBe(s)
  expect(f.description.length).toBeGreaterThan(30)
})

test('os gatilhos principais continuam nas descrições', () => {
  const d = (s: string) => frontmatter(fs.readFileSync(`${raiz}/skills/${s}/SKILL.md`, 'utf8')).description
  expect(d('construir')).toContain('/construir')
  expect(d('entregar')).toContain('/entregar')
  expect(d('adotar')).toContain('/adotar')
  expect(d('canteiro')).toContain('/canteiro')
  expect(d('linha')).toContain('/linha')
  expect(d('stop-recomendado')).toContain('/stop-recomendado')
})

test('o roteiro de passos das skills continua no lugar', () => {
  const t = (s: string) => fs.readFileSync(`${raiz}/skills/${s}/SKILL.md`, 'utf8')
  for (const h of ['## 1. Vistoria', '## 2. Hooks do painel', '## 3. Cronograma', '## 4. Protótipo', '## 6. GitHub', '## 7. Encerrar']) expect(t('adotar')).toContain(h)
  for (const h of ['## 0. Antes de começar', '## 3. Vistoria final', '## 4. Produção web', '## 5. Lojas', '## 6. Entrega das chaves']) expect(t('entregar')).toContain(h)
  for (const h of ['### Etapa 1', '### Etapa 2', '### Etapa 3', '### Etapa 4']) expect(t('construir')).toContain(h)
})

test('o formato do PLAN que o escritor ensina continua intacto', () => {
  const t = fs.readFileSync(`${raiz}/agents/escritor.md`, 'utf8')
  for (const c of ['## Milestone 1 — <título curto>', 'peso: 1', 'spec: S1, S3', 'tela: prototipo/index.html#tela-x', '- [ ] Tarefa verificável', 'Notas:']) expect(t).toContain(c)
})
