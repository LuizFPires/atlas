// Teste do hook do kit que escolhe os revisores da etapa 3 (node --test app/adaptadores/revisores.teste.cjs).
// Decisão do Luiz (24/11/2026): o qa sempre; seguranca e desempenho só quando o milestone mexe no que eles revisam.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { revisoresPara } = require('../../.claude/hooks/revisores.cjs')

test('só tela e estilo: só o qa', () => {
  assert.deepEqual(revisoresPara(['src/pages/Inicio.tsx', 'src/components/Botao.tsx', 'src/styles/tema.css']), ['qa'])
})

test('só documentação e testes: só o qa (mesmo com nome que lembra segurança)', () => {
  assert.deepEqual(revisoresPara(['docs/login.md', 'PLAN.md', 'src/auth/login.test.tsx']), ['qa'])
})

test('login, banco ou dependência nova: chama o seguranca', () => {
  assert.ok(revisoresPara(['src/pages/Login.tsx']).includes('seguranca'))
  assert.ok(revisoresPara(['package.json']).includes('seguranca'))
  assert.ok(revisoresPara(['src/lib/pagamento.ts']).includes('seguranca'))
})

test('banco, listas e imagens: chama o desempenho', () => {
  assert.deepEqual(revisoresPara(['supabase/migrations/0003_agenda.sql']), ['qa', 'seguranca', 'desempenho'])
  assert.ok(revisoresPara(['src/pages/ListaDeClientes.tsx']).includes('desempenho'))
  assert.ok(revisoresPara(['public/fundo.jpg']).includes('desempenho'))
  assert.ok(!revisoresPara(['src/pages/ListaDeClientes.tsx']).includes('seguranca'))
})

test('nada mudou (lista vazia): só o qa', () => {
  assert.deepEqual(revisoresPara([]), ['qa'])
})
