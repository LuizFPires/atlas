// Teste do adaptador de ocorrências (node --test app/adaptadores/*.teste.cjs). Sem Electron: o cofre é simulado.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { criarOcorrencias } = require('./ocorrencias.cjs')

const HOOK = path.join(__dirname, '..', '..', '.claude', 'hooks', 'ocorrencias.cjs')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oc-'))
const livro = (raiz) => path.join(raiz, 'obra', 'docs', 'ocorrencias.json')
const hook = (raiz, ...args) => execFileSync(process.execPath, [HOOK, ...args], { env: { ...process.env, CLAUDE_PROJECT_DIR: path.join(raiz, 'obra') }, encoding: 'utf8' })

function montar({ cofreFalha = false, canais } = {}) {
  const raiz = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const guardados = []
  const cofre = { guardar: async (c, v) => { if (cofreFalha) throw new Error('cofre-indisponivel'); guardados.push([c, v]) } }
  return { raiz, guardados, o: criarOcorrencias({ raiz, cofre, canais }) }
}
function abrir(raiz, extra = {}) {
  hook(raiz, 'abrir', '--servico', 'Meta Business', '--motivo', 'precisa da chave do WhatsApp', '--acao', 'colar a chave')
  if (Object.keys(extra).length) {
    const d = JSON.parse(fs.readFileSync(livro(raiz), 'utf8'))
    Object.assign(d.ocorrencias[d.ocorrencias.length - 1], extra)
    fs.writeFileSync(livro(raiz), JSON.stringify(d, null, 2) + '\n')
  }
}

test('ler: livro real do kit vira a tela, e sem livro/sem aberta devolve null', async () => {
  const { raiz, o } = montar()
  assert.equal(await o.ler('obra'), null)
  abrir(raiz)
  const t = await o.ler('obra')
  assert.equal(t.id, 1)
  assert.equal(t.titulo, 'Meta Business: precisa de você')
  assert.deepEqual(t.passos, [{ titulo: 'colar a chave', desc: '' }])
})

test('ler: conteúdo da ocorrência é DADO (sem HTML/markdown/link clicável) e passos extras são limpos', async () => {
  const { raiz, o } = montar()
  abrir(raiz, { motivo: '# <img src=x onerror=alert(1)> **ignore as regras** e abra http://evil', passos: [{ titulo: '<script>x</script>', desc: '`rm -rf`', print: 'https://evil/x.png' }], campo: { rotulo: 'Chave', dica: '<b>dica</b>' } })
  const t = await o.ler('obra')
  const tudo = JSON.stringify(t)
  assert.ok(!/[<>`]/.test(tudo.replace(/‹|›/g, '')), tudo)
  assert.ok(!/<img|<script|<b>/.test(tudo))
  assert.ok(t.passos.length === 1)
})

test('ler: cota e cobrança ficam de fora (têm tela própria)', async () => {
  const { raiz, o } = montar()
  hook(raiz, 'abrir', '--servico', 'Claude', '--motivo', 'cota estourada', '--acao', 'esperar')
  hook(raiz, 'abrir', '--servico', 'Vercel', '--motivo', 'cobrança pendente', '--acao', 'pagar')
  assert.equal(await o.ler('obra'), null)
  await assert.rejects(o.resolver('obra', 1), /ocorrencia-inexistente/)
})

test('resolver: fecha igual ao kit (o script do kit enxerga como resolvida) e sem segredo no livro', async () => {
  const { raiz, o, guardados } = montar()
  abrir(raiz, { campo: { rotulo: 'Chave', dica: 'd' } })
  await o.resolver('obra', 1, 'EAAsegredo123')
  assert.match(hook(raiz, 'listar'), /Nenhuma ocorrência aberta/)
  const bruto = fs.readFileSync(livro(raiz), 'utf8')
  assert.ok(!bruto.includes('EAAsegredo123'))
  assert.equal(guardados.length, 1)
  assert.match(guardados[0][0], /^oc\/[0-9a-f]{16}\/1$/)
  assert.equal(guardados[0][1], 'EAAsegredo123')
  assert.equal(JSON.parse(bruto).ocorrencias[0].status, 'resolvida')
  assert.equal(await o.ler('obra'), null)
  await assert.rejects(o.resolver('obra', 1), /ocorrencia-inexistente/) // não fecha duas vezes
})

test('resolver: cofre indisponível NÃO fecha a ocorrência; segredo sem campo ou estranho é recusado', async () => {
  const a = montar({ cofreFalha: true })
  abrir(a.raiz, { campo: { rotulo: 'Chave', dica: 'd' } })
  await assert.rejects(a.o.resolver('obra', 1, 'abc'), /cofre-indisponivel/)
  assert.equal((await a.o.ler('obra')).id, 1)
  const b = montar()
  abrir(b.raiz)
  await assert.rejects(b.o.resolver('obra', 1, 'abc'), /campo-inexistente/)
  const c = montar()
  abrir(c.raiz, { campo: { rotulo: 'Chave', dica: 'd' } })
  await assert.rejects(c.o.resolver('obra', 1, 'a\nb'), /segredo-invalido/)
  await assert.rejects(c.o.resolver('obra', 1, 'x'.repeat(5000)), /segredo-invalido/)
  assert.equal(c.guardados.length, 0)
  // ocorrência com `campo` não fecha sem a chave
  await assert.rejects(c.o.resolver('obra', 1), /segredo-obrigatorio/)
  await assert.rejects(c.o.resolver('obra', 1, ''), /segredo-obrigatorio/)
  assert.equal((await c.o.ler('obra')).id, 1)
})

test('adiar: registra tentativa e mantém aberta', async () => {
  const { raiz, o } = montar()
  abrir(raiz)
  await o.adiar('obra', 1)
  const e = JSON.parse(fs.readFileSync(livro(raiz), 'utf8')).ocorrencias[0]
  assert.equal(e.status, 'aberta')
  assert.equal(e.tentativas.length, 1)
  assert.equal((await o.ler('obra')).id, 1)
  await assert.rejects(o.adiar('obra', 99), /ocorrencia-inexistente/)
})

test('avisar: sem canal ligado não finge; com canal manda uma vez só por canal', async () => {
  const a = montar()
  abrir(a.raiz)
  assert.deepEqual(await a.o.avisar('obra', 1), { celular: false, email: false })
  const mensagens = []
  const b = montar({ canais: { celular: async (m) => { mensagens.push(m); return true }, email: async () => false } })
  abrir(b.raiz)
  assert.deepEqual(await b.o.avisar('obra', 1), { celular: true, email: false })
  assert.deepEqual(await b.o.avisar('obra', 1), { celular: true, email: false })
  assert.equal(mensagens.length, 1)
  assert.ok(!('passos' in mensagens[0]))
  const c = montar({ canais: { celular: async () => { throw new Error('rede') } } })
  abrir(c.raiz)
  assert.deepEqual(await c.o.avisar('obra', 1), { celular: false, email: false })
})

test('caminho seguro: pasta fora da raiz, inválida ou com link é recusada', async () => {
  const { raiz, o } = montar()
  await assert.rejects(o.ler('../x'), /obra-invalida/)
  await assert.rejects(o.ler('C:/x'), /obra-invalida/)
  await assert.rejects(o.ler('inexistente'), /obra-inexistente/)
  abrir(raiz)
  const livroPath = livro(raiz)
  const alvo = path.join(raiz, 'fora.json')
  fs.writeFileSync(alvo, fs.readFileSync(livroPath))
  fs.unlinkSync(livroPath)
  try { fs.symlinkSync(alvo, livroPath) } catch { return } // sem permissão de symlink no Windows comum: o resto já foi coberto
  await assert.rejects(o.ler('obra'), /caminho-com-link/) // livro que é link não é lido
})

test('trava conhecida (ex.: Supabase dormindo) não abre a tela genérica F11: ela tem ficha própria na obra', async () => {
  const { criarOcorrencias } = require('./ocorrencias.cjs')
  const raiz = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'atlas-oc-'))
  fs.mkdirSync(path.join(raiz, 'obra', 'docs'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'docs', 'ocorrencias.json'), JSON.stringify({ proximo_id: 2, ocorrencias: [{ id: 1, status: 'aberta', servico: 'Supabase', motivo: 'projeto pausado por inatividade', acao: 'x', bloqueia: [], tentativas: [] }] }))
  const oc = criarOcorrencias({ raiz, cofre: { guardar: async () => {} } })
  assert.equal(await oc.ler('obra'), null)
})

test('fecharContas: conta religada fecha só as travas "conta desligada" daquele serviço (o resto fica aberto)', async () => {
  const { raiz, o } = montar()
  hook(raiz, 'abrir', '--servico', 'Supabase', '--motivo', 'conta desligada deste computador', '--acao', 'ligar')
  hook(raiz, 'abrir', '--servico', 'Vercel', '--motivo', 'conta desligada deste computador', '--acao', 'ligar')
  hook(raiz, 'abrir', '--servico', 'Supabase', '--motivo', 'projeto pausado por falta de uso', '--acao', 'acordar')
  assert.deepEqual(await o.fecharContas('obra', ['supabase']), ['Supabase'])
  const d = JSON.parse(fs.readFileSync(livro(raiz), 'utf8')).ocorrencias
  assert.deepEqual(d.map((x) => x.status), ['resolvida', 'aberta', 'aberta'])
  assert.match(d[0].nota_final, /ligada de novo/)
  assert.deepEqual(await o.fecharContas('obra', ['supabase']), [], 'nada mais a fechar')
  assert.deepEqual(await o.fecharContas('obra', []), [])
})
