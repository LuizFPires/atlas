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

// Domínio dos e-mails pela Vercel (Luiz, 28/11/2026, aba 3 aprovada): o Atlas cria os registros do Resend na Vercel do cliente.
function comVercel({ saidaLs = '', ns = {}, falhaAdd = null } = {}) {
  const m = montar()
  const cli = []
  const vercel = async (args) => {
    cli.push(args.join(' '))
    if (args[0] === 'domains' && args[1] === 'ls') return { codigo: 0, saida: saidaLs }
    if (args[0] === 'dns' && args[1] === 'add') { if (falhaAdd && args.includes(falhaAdd)) return { codigo: 1, saida: falhaAdd === 'existe' ? 'Error: A record with that name already exists' : 'Error: Not authorized' }; return { codigo: 0, saida: 'Success!' } }
    return { codigo: 1, saida: '' }
  }
  const resolvedor = () => ({ resolveNs: async (d) => { if (ns[d]) return ns[d]; throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' }) } })
  const rdapCom = async (n) => (n === 'barbeariadoze.com' ? 404 : 200)
  const r = criarResend({ cofre: m.cofre, dados: m.dados, pedir: async (o) => m.r && (await (async () => {
    const chave = `${o.metodo} ${o.caminho}`
    if (chave === 'GET /domains') return { status: 200, corpo: JSON.stringify({ data: [] }) }
    if (chave === 'POST /domains' || chave.startsWith('GET /domains/')) return { status: 200, corpo: JSON.stringify({ id: DOM, name: 'x', status: 'pending', records: [{ type: 'TXT', name: 'resend._domainkey', value: 'p=MIG', status: 'pending' }, { type: 'MX', name: 'send', value: 'feedback-smtp.sa-east-1.amazonses.com', priority: 10, status: 'pending' }, { type: 'TXT', name: 'send', value: 'v=spf1 include:amazonses.com ~all', status: 'pending' }] }) }
    return { status: 200, corpo: '{}' }
  })()), vercel, resolvedor, rdapCom })
  return { r, cli, cofre: m.cofre }
}

test('domínios na Vercel: lê a lista da conta, ignora .vercel.app e diz quais usam os servidores da Vercel', async () => {
  const saidaLs = `Vercel CLI 39.1.0\n> 3 Domains found under gui\n\n  Domain               Registrar           Nameservers   Expiration Date   Creator   Age\n  pontoampla.com       Vercel              Vercel        Nov 28 2027       gui       2d\n  amplaconstrutora.com.br  Third Party     Third Party   -                 gui       90d\n  ponto-sistema.vercel.app  -  -  -  gui  1d\n`
  const { r } = comVercel({ saidaLs, ns: { 'pontoampla.com': ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'], 'amplaconstrutora.com.br': ['a.auto.dns.br', 'b.auto.dns.br'] } })
  assert.deepEqual(await r.dominiosNaVercel(), [{ dominio: 'pontoampla.com', servidoresVercel: true }, { dominio: 'amplaconstrutora.com.br', servidoresVercel: false }])
})

test('ligar pela Vercel: cadastra no Resend e cria cada registro na Vercel (MX com prioridade); registro que já existe não é erro', async () => {
  const { r, cli } = comVercel({ falhaAdd: 'existe' })
  await r.guardarChave(K)
  const s = await r.ligarPelaVercel('pontoampla.com')
  assert.equal(s.dominio, 'pontoampla.com')
  assert.deepEqual(cli.filter((c) => c.startsWith('dns add')), [
    'dns add pontoampla.com resend._domainkey TXT p=MIG',
    'dns add pontoampla.com send MX feedback-smtp.sa-east-1.amazonses.com 10',
    'dns add pontoampla.com send TXT v=spf1 include:amazonses.com ~all',
  ])
  assert.equal(s.pelaVercel, true)
})

test('ligar pela Vercel: a Vercel recusar vira erro explicado; domínio torto nem chega à Vercel', async () => {
  const { r, cli } = comVercel({ falhaAdd: 'resend._domainkey' })
  await r.guardarChave(K)
  await assert.rejects(r.ligarPelaVercel('pontoampla.com'), /vercel-dns-recusou/)
  await assert.rejects(r.ligarPelaVercel('x;rm -rf'), /dominio-invalido/)
  assert.ok(!cli.some((c) => c.includes('rm -rf')))
})

test('nome livre para comprar: só .com, pelo RDAP oficial; o resto é "incerto"', async () => {
  const { r } = comVercel()
  assert.equal(await r.nomeLivre('barbeariadoze.com'), 'livre')
  assert.equal(await r.nomeLivre('google.com'), 'ocupado')
  assert.equal(await r.nomeLivre('x.shop'), 'incerto')
  assert.equal(await r.nomeLivre('a b.com'), 'invalido')
})
