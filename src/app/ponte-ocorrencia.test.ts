// @vitest-environment node
// A tela lê uma entrada REAL do livro de ocorrências do kit (.claude/hooks/ocorrencias.cjs) e a fecha com o mesmo comando do kit.
// (Sem @types/node no projeto: os módulos do Node entram por nome em variável, só neste teste.)
import { ocorrenciaDoKit, type EntradaDoKit } from './ponte-ocorrencia'

const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)

test('lê uma entrada real do livro do kit e a resolve com o comando do kit', async () => {
  const fs = (await mod('node:fs')) as { mkdtempSync(p: string): string; readFileSync(p: string, e: string): string; rmSync(p: string, o: { recursive: boolean; force: boolean }): void }
  const tmp = ((await mod('node:os')) as { tmpdir(): string }).tmpdir()
  const { sep } = (await mod('node:path')) as { sep: string }
  const { execFileSync } = (await mod('node:child_process')) as { execFileSync(c: string, a: string[], o: { env: Record<string, string | undefined>; encoding: string }): string }
  const env = (await mod('node:process')) as { env: Record<string, string | undefined> }
  const raiz = fs.mkdtempSync(`${tmp}${sep}atlas-oc-`)
  try {
    const cli = (...a: string[]) => execFileSync('node', ['.claude/hooks/ocorrencias.cjs', ...a], { env: { ...env.env, CLAUDE_PROJECT_DIR: raiz }, encoding: 'utf8' })
    cli('abrir', '--servico', 'Meta Business', '--motivo', 'Falta a chave do WhatsApp', '--acao', 'Criar a chave de acesso e colar no Atlas', '--bloqueia', 'M5:2')
    const livro = () => JSON.parse(fs.readFileSync(`${raiz}${sep}docs${sep}ocorrencias.json`, 'utf8')) as { ocorrencias: EntradaDoKit[] }
    const o = ocorrenciaDoKit(livro().ocorrencias[0])!
    expect(o.titulo).toBe('Meta Business: precisa de você')
    expect(o.motivo).toBe('Falta a chave do WhatsApp')
    expect(o.passos).toEqual([{ titulo: 'Criar a chave de acesso e colar no Atlas', desc: '', print: undefined }])
    cli('resolver', String(o.id), '--nota', 'cliente colou a chave')
    expect(ocorrenciaDoKit(livro().ocorrencias[0])).toBeNull()
  } finally { fs.rmSync(raiz, { recursive: true, force: true }) }
})

test('entrada estranha não vira tela: só ocorrência aberta com id inteiro; textos limitados e sem marcação', () => {
  expect(ocorrenciaDoKit({ id: 1, status: 'resolvida' })).toBeNull()
  expect(ocorrenciaDoKit({ id: 1.5, status: 'aberta' })).toBeNull()
  const o = ocorrenciaDoKit({ id: 3, status: 'aberta', servico: 'x'.repeat(500), motivo: '<b>oi</b>', minutos: 99999, passos: Array.from({ length: 50 }, (_, i) => ({ titulo: `p${i}` })) })!
  expect(o.titulo.length).toBeLessThan(90)
  expect(o.motivo).toBe('‹b›oi‹/b›')
  expect(o.minutos).toBe(240)
  expect(o.passos).toHaveLength(12)
})
