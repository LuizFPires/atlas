// @vitest-environment node
// O Atlas é autoexplicativo: todo código de trava que o processo principal pode lançar tem explicação na tela.
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { explicarTrava, temExplicacao, textoDaTrava } from './explicar-trava'

function codigosLancados(): string[] {
  const dir = path.join(__dirname, '..', '..', 'app')
  const arquivos = [path.join(dir, 'main.cjs'), ...fs.readdirSync(path.join(dir, 'adaptadores')).filter((f) => f.endsWith('.cjs') && !f.endsWith('.teste.cjs')).map((f) => path.join(dir, 'adaptadores', f))]
  const achados = new Set<string>()
  for (const a of arquivos) for (const m of fs.readFileSync(a, 'utf8').matchAll(/new Error\(['`]([a-z][a-z0-9-]*)['`]/g)) achados.add(m[1])
  return [...achados].sort()
}

test('todo código que o app lança tem explicação (o que houve + o que fazer)', () => {
  const lancados = codigosLancados()
  expect(lancados.length).toBeGreaterThan(100)
  expect(lancados.filter((c) => !temExplicacao(c))).toEqual([])
})

test('explicação nunca vem vazia e sempre diz o que fazer', () => {
  for (const c of [...codigosLancados(), 'supabase-500', 'supabase-404', 'http-502', 'vercel-qualquer', 'codigo-novo', '']) {
    const x = explicarTrava(c)
    expect(x.houve.length).toBeGreaterThan(10)
    expect(x.fazer.length).toBeGreaterThan(10)
  }
})

test('textoDaTrava junta o que falhou, o porquê, o que fazer e o código', () => {
  expect(textoDaTrava(new Error('supabase-limite-gratis'), 'Não consegui criar o banco.')).toBe('Não consegui criar o banco. A sua conta grátis do Supabase já tem 2 bancos ativos, que é o limite do plano grátis. No site do Supabase, pause ou apague um projeto que você não usa (ou mude para o plano pago) e toque em Tentar de novo. (código: supabase-limite-gratis)')
  expect(textoDaTrava(new Error('codigo-novo'))).toMatch(/ainda não sabe explicar.*Falar com o Atlas.*\(código: codigo-novo\)/)
})

test('Falar com o Atlas recebe o código já explicado (e texto livre continua como veio)', async () => {
  const { detalheExplicado } = await import('./explicar-trava')
  expect(detalheExplicado('supabase-limite-gratis')).toMatch(/^supabase-limite-gratis — A sua conta grátis do Supabase já tem 2 bancos ativos/)
  expect(detalheExplicado('A tela ficou branca')).toBe('A tela ficou branca')
  expect(detalheExplicado(undefined)).toBeUndefined()
})
