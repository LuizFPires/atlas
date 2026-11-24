// Teste do hook do kit que espera o CI em silêncio (node --test app/adaptadores/esperar-ci.teste.cjs).
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { resumoDosChecks, esperar } = require('../../.claude/hooks/esperar-ci.cjs')

test('verde, vermelho, ausente e cobrança do GitHub viram uma linha só', () => {
  assert.deepEqual(resumoDosChecks([{ name: 'build', bucket: 'pass' }, { name: 'e2e', bucket: 'skipping' }]), { fim: true, texto: 'CI verde: 2 checks.' })
  assert.match(resumoDosChecks([{ name: 'build', bucket: 'fail' }, { name: 'lint', bucket: 'pass' }]).texto, /^CI vermelho: build \(falhou\)/)
  assert.equal(resumoDosChecks([]).texto, 'CI ausente: nenhum check neste PR.')
  assert.match(resumoDosChecks([{ name: 'build', bucket: 'fail', description: 'The job was not started because recent account payments have failed' }]).texto, /cobrança do GitHub/)
  assert.equal(resumoDosChecks([{ name: 'build', bucket: 'pending' }]).fim, false)
})

test('espera calada até terminar e devolve só o resultado final', async () => {
  const respostas = [[{ name: 'build', bucket: 'pending' }], [{ name: 'build', bucket: 'pending' }], [{ name: 'build', bucket: 'pass' }]]
  let i = 0
  const t = await esperar({ pr: 7, consultar: () => respostas[Math.min(i++, 2)], dormir: async () => {}, intervaloMs: 0 })
  assert.equal(t, 'CI verde: 1 check.')
  assert.equal(i, 3)
})

test('passou do tempo máximo: diz que ainda está rodando (não finge verde)', async () => {
  const t = await esperar({ pr: 7, maxMin: 0, consultar: () => [{ name: 'build', bucket: 'pending' }], dormir: async () => {} })
  assert.match(t, /^CI ainda rodando depois de 0 min: build/)
})
