// Travas conhecidas de uma conta (prototipo/caminho-novo/T1Travas e TF1–TF5, aprovadas pelo Luiz em 24/11/2026).
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { tipoDaTrava, travaDaObra } = require('./travas.cjs')
const { paradaDeOcorrencias } = require('./painel.cjs')

const oc = (servico, motivo, extra = {}) => ({ id: extra.id ?? 1, status: 'aberta', servico, motivo, acao: 'x', liberar_em: null, bloqueia: [], tentativas: [], ...extra })

test('reconhece as travas conhecidas pelo serviço e pelo motivo', () => {
  assert.equal(tipoDaTrava(oc('GitHub', 'minutos do GitHub Actions acabaram (billing)')), 'github-minutos')
  assert.equal(tipoDaTrava(oc('GitHub', 'Recent account payments have failed or your spending limit needs to be increased')), 'github-minutos')
  assert.equal(tipoDaTrava(oc('Vercel', 'limite diário de deploys do plano grátis')), 'vercel-limite')
  assert.equal(tipoDaTrava(oc('Vercel', 'Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")')), 'vercel-limite')
  assert.equal(tipoDaTrava(oc('Supabase', 'projeto pausado por inatividade')), 'supabase-dormindo')
  assert.equal(tipoDaTrava(oc('GitHub', 'conta do GitHub desligada deste computador')), 'conta-desligada')
  assert.equal(tipoDaTrava(oc('Vercel', 'login vencido')), 'conta-desligada')
  assert.equal(tipoDaTrava(oc('Stripe', 'chave de teste faltando')), null)
  assert.equal(tipoDaTrava({ ...oc('Vercel', 'limite diário de deploys'), status: 'resolvida' }), null)
})

test('travaDaObra: a que precisa de você vem primeiro; devolve só dados limpos', () => {
  const livro = { ocorrencias: [
    oc('Vercel', 'limite diário de deploys', { id: 1, liberar_em: '2026-11-25T12:00:00.000Z' }),
    oc('Supabase', 'projeto pausado <b>por</b> inatividade', { id: 2 }),
  ] }
  assert.deepEqual(travaDaObra(livro), { id: 2, tipo: 'supabase-dormindo', servico: 'Supabase', liberaEm: null })
  assert.deepEqual(travaDaObra({ ocorrencias: [livro.ocorrencias[0]] }), { id: 1, tipo: 'vercel-limite', servico: 'Vercel', liberaEm: '2026-11-25T12:00:00.000Z' })
  assert.equal(travaDaObra({ ocorrencias: [oc('Stripe', 'x')] }), null)
  assert.equal(travaDaObra(null), null)
})

test('trava conhecida NÃO para a obra (ela segue com o que não depende): não vira "cobrança pendente" nem "cota"', () => {
  assert.equal(paradaDeOcorrencias({ ocorrencias: [oc('GitHub', 'minutos do GitHub Actions acabaram (billing)')] }), null)
  assert.equal(paradaDeOcorrencias({ ocorrencias: [oc('Vercel', 'rate limit: limite diário de deploys')] }), null)
  assert.equal(paradaDeOcorrencias({ ocorrencias: [oc('Supabase', 'projeto pausado')] }), null)
  // as outras continuam como antes
  assert.equal(paradaDeOcorrencias({ ocorrencias: [oc('Stripe', 'fatura em aberto')] }), 'billing')
  assert.equal(paradaDeOcorrencias({ ocorrencias: [oc('Claude', 'usage limit')] }), 'cota')
})
