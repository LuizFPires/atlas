// Resend, o carteiro (28/11/2026): chave conferida, domínio criado em São Paulo, verificação e chave só de envio para o Supabase.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarResend, caminhoPermitido, CHAVE, CHAVE_ENVIO } = require('./resend.cjs')
const { criarCofreMemoria } = require('../cofre.cjs')

const K = 're_' + 'A'.repeat(30)
const DOM = '4ef9a417-02e9-4d39-ad75-9611e0fcc33c'
function montar({ status = 'pending', respostas = {} } = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-resend-'))
  const cofre = criarCofreMemoria()
  const pedidos = []
  let st = status
  const pedir = async ({ host, metodo, caminho, corpo, cabecalhos }) => {
    pedidos.push({ host, metodo, caminho, corpo, auth: cabecalhos.Authorization })
    const chave = `${metodo} ${caminho}`
    if (respostas[chave]) return respostas[chave]
    if (chave === 'GET /domains') return { status: 200, corpo: JSON.stringify({ data: [] }) }
    if (chave === 'POST /domains' || chave === `GET /domains/${DOM}`) return { status: 200, corpo: JSON.stringify({ id: DOM, name: 'ampla.com.br', status: st, records: [{ record: 'DKIM', type: 'TXT', name: 'resend._domainkey', value: 'p=MIG', status: st === 'verified' ? 'verified' : 'pending' }, { record: 'SPF', type: 'MX', name: 'send', value: 'feedback-smtp.sa-east-1.amazonses.com', priority: 10, status: 'verified' }] }) }
    if (chave === `POST /domains/${DOM}/verify`) return { status: 200, corpo: '{}' }
    if (chave === 'POST /api-keys') return { status: 201, corpo: JSON.stringify({ id: 'k1', token: 're_' + 'E'.repeat(30) }) }
    return { status: 404, corpo: '{}' }
  }
  const r = criarResend({ cofre, dados, pedir })
  return { r, cofre, dados, pedidos, verificar: () => { st = 'verified' } }
}

test('chave: formato, recusada, só de envio (sem permissão) e boa (vai para o cofre, só para api.resend.com)', async () => {
  const m = montar({ respostas: {} })
  assert.deepEqual(await m.r.guardarChave('abc'), { ok: false, motivo: 'formato' })
  const recusa = montar({ respostas: { 'GET /domains': { status: 401, corpo: '{}' } } })
  assert.deepEqual(await recusa.r.guardarChave(K), { ok: false, motivo: 'recusada' })
  const envio = montar({ respostas: { 'GET /domains': { status: 403, corpo: '{"name":"restricted_api_key"}' } } })
  assert.deepEqual(await envio.r.guardarChave(K), { ok: false, motivo: 'sem-permissao' })
  assert.deepEqual(await m.r.guardarChave(`  ${K} `), { ok: true })
  assert.equal(await m.cofre.ler(CHAVE), K)
  assert.ok(m.pedidos.every((p) => p.host === 'api.resend.com' && p.auth === `Bearer ${K}`))
  assert.equal((await m.r.situacao()).ligado, true)
})

test('domínio: cria em São Paulo, pede a verificação, guarda só domínio/id/registros (nada de chave em arquivo)', async () => {
  const m = montar()
  await m.r.guardarChave(K)
  await assert.rejects(m.r.escolherDominio('ponto-sistema.vercel.app'), /dominio-invalido/)
  const s = await m.r.escolherDominio('https://www.Ampla.com.br/')
  assert.equal(s.dominio, 'ampla.com.br')
  assert.equal(s.estado, 'esperando')
  assert.equal(s.remetente, 'nao-responda@ampla.com.br')
  assert.deepEqual(s.registros[1], { tipo: 'MX', nome: 'send', valor: 'feedback-smtp.sa-east-1.amazonses.com', prioridade: 10, estado: 'ok' })
  assert.deepEqual(m.pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/domains').corpo, { name: 'ampla.com.br', region: 'sa-east-1' })
  assert.ok(m.pedidos.some((p) => p.caminho === `/domains/${DOM}/verify`))
  const arq = fs.readFileSync(path.join(m.dados, 'resend.json'), 'utf8')
  assert.ok(!arq.includes('re_'), 'nenhuma chave em arquivo')
  assert.equal(await m.r.paraSupabase(), null, 'ainda não verificado')
})

test('conferir: verificado => cria a chave só de envio do domínio (uma vez) e paraSupabase entrega domínio e senha', async () => {
  const m = montar()
  await m.r.guardarChave(K)
  await m.r.escolherDominio('ampla.com.br')
  let s = await m.r.conferir()
  assert.equal(s.estado, 'esperando'); assert.equal(s.virouVerificado, false)
  m.verificar()
  s = await m.r.conferir()
  assert.equal(s.estado, 'verificado'); assert.equal(s.virouVerificado, true)
  assert.deepEqual(m.pedidos.find((p) => p.caminho === '/api-keys').corpo, { name: 'Atlas · e-mails do sistema (ampla.com.br)', permission: 'sending_access', domain_id: DOM })
  assert.deepEqual(await m.r.paraSupabase(), { dominio: 'ampla.com.br', senha: 're_' + 'E'.repeat(30) })
  s = await m.r.conferir()
  assert.equal(s.virouVerificado, false)
  assert.equal(m.pedidos.filter((p) => p.caminho === '/api-keys').length, 1)
  assert.equal(await m.cofre.ler(CHAVE_ENVIO), 're_' + 'E'.repeat(30))
})

test('domínio que já existe na conta do Resend: reaproveita, não cria outro', async () => {
  const m = montar({ respostas: { 'GET /domains': { status: 200, corpo: JSON.stringify({ data: [{ id: DOM, name: 'ampla.com.br' }] }) } } })
  await m.r.guardarChave(K)
  await m.r.escolherDominio('ampla.com.br')
  assert.ok(!m.pedidos.some((p) => p.metodo === 'POST' && p.caminho === '/domains'))
})

test('só os caminhos do Resend que o Atlas usa', () => {
  assert.ok(caminhoPermitido('POST', '/api-keys'))
  assert.ok(!caminhoPermitido('DELETE', `/domains/${DOM}`))
  assert.ok(!caminhoPermitido('POST', '/emails'))
  assert.ok(!caminhoPermitido('GET', '/api-keys'))
})
