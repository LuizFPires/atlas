// @vitest-environment node
// O Atlas é autoexplicativo: todo código de trava que o processo principal pode lançar tem explicação na tela.
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { explicarTrava, temExplicacao, textoDaTrava } from './explicar-trava'

function codigosLancados(): string[] {
  // Todo .cjs do app (main, preload, seguro e adaptadores), menos os testes.
  const dir = path.join(__dirname, '..', '..', 'app')
  const todos = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : todos(path.join(d, e.name))) : e.name.endsWith('.cjs') && !e.name.endsWith('.teste.cjs') ? [path.join(d, e.name)] : []))
  const achados = new Set<string>()
  for (const a of todos(dir)) {
    const txt = fs.readFileSync(a, 'utf8')
    for (const m of txt.matchAll(/new Error\(['`]([a-z][a-z0-9-]*)['`]/g)) achados.add(m[1])
    // Código escolhido na hora (new Error(cond ? 'a' : 'b')): achado em 26/11/2026, 'claude-cota' passava sem explicação.
    for (const m of txt.matchAll(/new Error\(([^'`)][^\n]*)/g)) for (const c of m[1].matchAll(/\?\s*'([a-z][a-z0-9]*(?:-[a-z0-9]+)+)'|:\s*'([a-z][a-z0-9]*(?:-[a-z0-9]+)+)'/g)) achados.add(c[1] ?? c[2])
  }
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

test('a Ajuda aberta por um erro já começa dizendo o que houve e o que fazer (nada de "me conta o que você estava fazendo")', async () => {
  const { saudacaoAjuda } = await import('./ponte-ajuda')
  const { detalheExplicado } = await import('./explicar-trava')
  const s = saudacaoAjuda({ origem: 'erro', onde: 'colocar no ar', erro: { titulo: 'Colocar no ar', detalhe: detalheExplicado('supabase-migrations') } }, 'Ana')
  expect(s).toMatch(/^Oi, Ana\. Vi que colocar no ar parou: o banco foi criado, mas as tabelas do sistema não subiram\. Toque em Corrigir e continuar/)
  expect(s).not.toMatch(/Me conta o que você estava fazendo/)
  // sem código conhecido, continua perguntando
  expect(saudacaoAjuda({ origem: 'erro', onde: 'a obra' })).toMatch(/Me conta o que você estava fazendo/)
})

test('os novos motivos (conexão com o banco e build na Vercel) têm explicação', () => {
  expect(explicarTrava('supabase-conexao').houve).toMatch(/banco/)
  expect(explicarTrava('vercel-build').fazer).toMatch(/Corrigir e continuar/)
  expect(explicarTrava('supabase-migrations').fazer).toMatch(/Corrigir e continuar/)
  expect(explicarTrava('supabase-funcoes').fazer).toMatch(/Corrigir e continuar/)
})
