// Teste da entrega do kit por obra (node --test app/adaptadores/*.teste.cjs). Sem rede, sem Electron, sem Claude.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarKit, validarResposta, destinoNoPlugin, avisoNoTopo, LEI } = require('./kit.cjs')
const { criarConstrucao } = require('./construcao.cjs')
const { criarModo } = require('./modo.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-kit-'))
const MARCA = 'abcdef0123456789abcdef01'
const AVISO = `Software proprietário do Atlas, licenciado a Zé (marca ${MARCA}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`
const KIT = () => ({
  marca_dagua: MARCA,
  arquivos: [
    { caminho: '.claude/agents/implementador.md', conteudo: `---\n# ${AVISO}\nname: implementador\n---\nTexto\n` },
    { caminho: '.claude/skills/construir/SKILL.md', conteudo: `---\n# ${AVISO}\nname: construir\n---\nTexto\n` },
    { caminho: '.claude/hooks/progresso.cjs', conteudo: `// ${AVISO}\nconst ATLAS_LICENCA = '${MARCA}'\n` },
    { caminho: '.claude/hooks/hooks.json', conteudo: JSON.stringify({ _licenca: AVISO, _marca: MARCA, hooks: {} }) },
  ],
})
const cofreAtivo = { ler: async () => JSON.stringify({ token: 'tok-secreto-xyz', email: 'a@b.com' }) }

function montar({ resposta = KIT(), status = 200, cofre = cofreAtivo, api = 'https://api.atlas.test/' } = {}) {
  const dados = tmp()
  const vistos = []
  const buscar = async (url, init) => {
    vistos.push({ url, init })
    const corpo = typeof resposta === 'function' ? resposta() : resposta
    return { ok: status >= 200 && status < 300, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) }
  }
  const kit = criarKit({ dadosApp: dados, cofre, hashComputador: async () => 'h'.repeat(64), api, buscar })
  return { dados, vistos, kit }
}
const arvore = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arvore(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')])).sort()

test('entrega: monta o plugin FORA da obra, com o token só no cabeçalho, e a tela não recebe caminho nem arquivos', async () => {
  const { kit, dados, vistos } = montar()
  const r = await kit.entregar('minha-obra')
  assert.deepEqual(r, { ok: true, obraId: 'minha-obra', marca: MARCA })
  assert.equal(vistos[0].url, 'https://api.atlas.test/entregar-kit')
  assert.equal(vistos[0].init.redirect, 'error')
  assert.equal(vistos[0].init.headers['X-Atlas-Dispositivo'], 'tok-secreto-xyz')
  assert.ok(!vistos[0].init.body.includes('tok-secreto'))
  assert.equal(JSON.parse(vistos[0].init.body).obra_id, 'minha-obra')
  const dir = kit.diretorio('minha-obra')
  assert.ok(dir.startsWith(path.join(dados, 'kit-temp')))
  assert.deepEqual(arvore(dir), ['.claude-plugin/plugin.json', 'agents/implementador.md', 'hooks/hooks.json', 'hooks/progresso.cjs', 'skills/construir/SKILL.md'])
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).name, 'atlas-kit')
  assert.ok(fs.readFileSync(path.join(dir, 'agents', 'implementador.md'), 'utf8').includes(MARCA))
  assert.equal(kit.diretorio('outra'), null)
})

test('descartar apaga a pasta; descartarTudo também limpa sobra de queda anterior', async () => {
  const { kit, dados } = montar()
  await kit.entregar('a'); await kit.entregar('b')
  const da = kit.diretorio('a')
  kit.descartar('a')
  assert.equal(kit.diretorio('a'), null); assert.ok(!fs.existsSync(da)); assert.ok(kit.diretorio('b'))
  fs.mkdirSync(path.join(dados, 'kit-temp', 'sobra-de-queda'), { recursive: true })
  kit.descartarTudo()
  assert.ok(!fs.existsSync(path.join(dados, 'kit-temp'))); assert.equal(kit.diretorio('b'), null)
  kit.descartarTudo() // idempotente
})

test('refaz: entregar de novo substitui a pasta (sem restos do arquivo antigo)', async () => {
  let n = 0
  const { kit } = montar({ resposta: () => { const k = KIT(); if (n++ === 0) k.arquivos.push({ caminho: '.claude/agents/velho.md', conteudo: `---\n# ${AVISO}\n---\n` }); return k } })
  await kit.entregar('a')
  assert.ok(arvore(kit.diretorio('a')).includes('agents/velho.md'))
  await kit.entregar('a')
  assert.ok(!arvore(kit.diretorio('a')).includes('agents/velho.md'))
})

test('falha fechada: arquivo sem aviso, marca diferente, caminho fora do lugar ou repetido derrubam tudo e não deixam nada em disco', async () => {
  const ruins = [
    (k) => { k.arquivos[0].conteudo = '---\nname: x\n---\n' },
    (k) => { k.arquivos[2].conteudo = `// ${AVISO.replace(MARCA, 'outra-marca-0000')}\n` },
    (k) => { k.arquivos[3].conteudo = JSON.stringify({ hooks: {}, _licenca: AVISO, _marca: MARCA }) },
    (k) => { k.arquivos[0].caminho = '.claude/agents/../../fora.md' },
    (k) => { k.arquivos[0].caminho = '../fora.md' },
    (k) => { k.arquivos[0].caminho = '/etc/passwd' },
    (k) => { k.arquivos[0].caminho = 'C:/x.md' },
    (k) => { k.arquivos[0].caminho = '.claude\\agents\\x.md' },
    (k) => { k.arquivos[0].caminho = 'CLAUDE.md' },
    (k) => { k.arquivos[0].caminho = '.claude/settings.json' },
    (k) => { k.arquivos[0].caminho = '.claude/agents/CON.md' },
    (k) => { k.arquivos[0].caminho = '.claude/agents/a:b.md' },
    (k) => { k.arquivos[0].caminho = '.claude/agents/x.md.' },
    (k) => { k.arquivos.push({ ...k.arquivos[0], caminho: '.claude/agents/IMPLEMENTADOR.md' }) },
    (k) => { k.arquivos.push({ caminho: '.claude/agents/implementador.md/x.md', conteudo: k.arquivos[0].conteudo }) },
    (k) => { k.arquivos[0].conteudo = 5 },
    (k) => { k.marca_dagua = 'curta' },
    (k) => { k.arquivos = [] },
    (k) => { k.arquivos[0].conteudo += 'x'.repeat(1_100_000) },
  ]
  for (const [i, muda] of ruins.entries()) {
    const k = KIT(); muda(k)
    const { kit, dados } = montar({ resposta: k })
    const r = await kit.entregar('a')
    assert.equal(r.ok, false, `caso ${i}`)
    assert.match(r.mensagem, /incompleto/)
    assert.equal(kit.diretorio('a'), null)
    const base = path.join(dados, 'kit-temp')
    assert.ok(!fs.existsSync(base) || fs.readdirSync(base).length === 0, `caso ${i}: sobrou arquivo`)
  }
})

test('sem API, sem ativação, servidor negando, rede fora, resposta gigante: mensagens calmas, nada gravado', async () => {
  assert.match((await montar({ api: null }).kit.entregar('a')).mensagem, /ainda não está aberta/)
  assert.match((await montar({ api: 'http://inseguro.test' }).kit.entregar('a')).mensagem, /ainda não está aberta/)
  assert.match((await montar({ cofre: { ler: async () => null } }).kit.entregar('a')).mensagem, /Ative este computador/)
  assert.match((await montar({ cofre: { ler: async () => { throw new Error('cofre-indisponivel') } } }).kit.entregar('a')).mensagem, /Ative este computador/)
  const neg = montar({ resposta: { mensagem: 'Licença em pausa.' }, status: 403 })
  assert.deepEqual(await neg.kit.entregar('a'), { ok: false, mensagem: 'Licença em pausa.' })
  const sem = criarKit({ dadosApp: tmp(), cofre: cofreAtivo, hashComputador: async () => 'h', api: 'https://x.test', buscar: async () => { throw new Error('rede') } })
  assert.match((await sem.entregar('a')).mensagem, /Sem internet/)
  const grande = montar({ resposta: 'x'.repeat(12_000_001) })
  assert.match((await grande.kit.entregar('a')).mensagem, /incompleto/)
  for (const ruim of ['../x', 'a/b', '', 'a b', 'x'.repeat(81), 7, null]) assert.equal((await montar().kit.entregar(ruim)).ok, false, String(ruim))
})

test('entrega: servidor do Atlas que pisca (sem internet por um instante ou erro 5xx) tenta de novo sozinho antes de desistir', async () => {
  let vezes = 0
  const kit = criarKit({ dadosApp: tmp(), cofre: cofreAtivo, hashComputador: async () => 'h', api: 'https://x.test', esperar: async () => {}, buscar: async () => {
    vezes++
    if (vezes === 1) throw new Error('rede')
    if (vezes === 2) return { ok: false, status: 503, text: async () => 'Service Unavailable' }
    return { ok: true, status: 200, text: async () => JSON.stringify(KIT()) }
  } })
  assert.equal((await kit.entregar('a')).ok, true)
  assert.equal(vezes, 3)
  // licença negada (403) não é instabilidade: não repete
  let negado = 0
  const neg = criarKit({ dadosApp: tmp(), cofre: cofreAtivo, hashComputador: async () => 'h', api: 'https://x.test', esperar: async () => {}, buscar: async () => { negado++; return { ok: false, status: 403, text: async () => '{"mensagem":"Licença em pausa."}' } } })
  assert.equal((await neg.entregar('a')).mensagem, 'Licença em pausa.')
  assert.equal(negado, 1)
})

test('garantir: reaproveita o que existe; baixa de novo se faltar; sem API devolve null; com API e falha lança', async () => {
  const { kit, vistos } = montar()
  const d1 = await kit.garantir('a')
  assert.equal(await kit.garantir('a'), d1)
  assert.equal(vistos.length, 1)
  kit.descartarTudo()
  assert.ok(await kit.garantir('a')); assert.equal(vistos.length, 2)
  assert.equal(await montar({ api: null }).kit.garantir('a'), null)
  await assert.rejects(montar({ status: 500, resposta: {} }).kit.garantir('a'), /kit-indisponivel/)
})

test('o validador não deixa o caminho do kit sair do plugin', () => {
  assert.deepEqual(destinoNoPlugin('.claude/skills/x/SKILL.md'), ['skills', 'x', 'SKILL.md'])
  for (const c of ['.claude/x.md', '.claude/agents', '.claude/other/x.md', '.claude/agents//x.md', '.claude/agents/./x.md', '.claude/agents/..x/y', '', null, '.claude/agents/' + 'a'.repeat(101)]) assert.equal(destinoNoPlugin(c), null, String(c))
  assert.equal(avisoNoTopo('a.md', `x\n${AVISO}`, MARCA), true)
  assert.equal(avisoNoTopo('a.md', 'x\n\n\n\n' + AVISO, MARCA), false) // aviso depois da 4ª linha não vale
  assert.throws(() => validarResposta({ marca_dagua: MARCA, arquivos: 'x' }), /kit-invalido/)
})

test('PARIDADE: avisoNoTopo e caminhos == TypeScript (src/kit/entrega-kit.ts)', (t) => {
  let TS
  try {
    const ts = require('typescript')
    const arq = path.join(__dirname, '..', '..', 'src', 'kit', 'entrega-kit.ts')
    const js = ts.transpileModule(fs.readFileSync(arq, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const m = { exports: {} }
    require('node:vm').compileFunction(js, ['exports', 'require', 'module'])(m.exports, (s) => (s.startsWith('.') ? {} : require(s)), m)
    TS = m.exports
  } catch (e) { t.skip(`typescript indisponível: ${e.message}`); return }
  assert.equal(TS.LEI, LEI)
  const casos = [['a.md', `x\n${AVISO}`], ['a.md', 'sem aviso'], ['a.md', `\n\n\n\n${AVISO}`], ['a.json', JSON.stringify({ _licenca: AVISO, _marca: MARCA })], ['a.json', JSON.stringify({ x: 1, _licenca: AVISO, _marca: MARCA })], ['a.json', 'quebrado'], ['a.cjs', `// ${AVISO}`]]
  for (const [caminho, conteudo] of casos) assert.equal(avisoNoTopo(caminho, conteudo, MARCA), TS.avisoNoTopo({ caminho, conteudo }, MARCA), `${caminho} ${conteudo}`)
  // o que o TS aceita como caminho seguro e o plugin recusa é só questão de lugar; o que o TS recusa, o plugin também recusa
  for (const c of ['../x', '/x', 'C:/x', 'a/../b', '.claude/agents/../x']) { assert.equal(TS.caminhoSeguro(c), false); assert.equal(destinoNoPlugin(c), null, c) }
})

test('a linha de produção recebe --plugin-dir do kit da obra (função), e nada é gravado na obra', async () => {
  const raiz = tmp(); const home = tmp(); const dados = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const kit = criarKit({ dadosApp: dados, cofre: cofreAtivo, hashComputador: async () => 'h', api: 'https://x.test', buscar: async () => ({ ok: true, text: async () => JSON.stringify(KIT()) }) })
  await kit.garantir('obra')
  let args
  const c = criarConstrucao({
    raiz, home, dadosApp: dados, modos: criarModo({ raiz }), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }),
    pluginDir: (pasta) => kit.diretorio(pasta),
    iniciarFluxo: (a) => { args = a; return { parar: () => {}, fim: new Promise(() => {}) } },
  })
  await c.iniciar('obra', 'Barbearia', 'automatico', [{ n: 'M1', nome: 'Base', desc: 'a' }])
  assert.equal(args[args.indexOf('--plugin-dir') + 1], kit.diretorio('obra'))
  assert.ok(!fs.existsSync(path.join(raiz, 'obra', '.claude')), 'o kit não pode ir para a pasta da obra')
  assert.ok(!fs.existsSync(path.join(raiz, 'obra', 'agents')))
  // sem kit para a obra: a linha roda sem --plugin-dir (modo antigo), nunca com caminho inventado
  const c2 = criarConstrucao({ raiz, home, dadosApp: dados, modos: criarModo({ raiz }), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }), pluginDir: () => null, iniciarFluxo: (a) => { args = a; return { parar: () => {}, fim: new Promise(() => {}) } } })
  fs.mkdirSync(path.join(raiz, 'outra'))
  await c2.iniciar('outra', 'Outra', 'automatico', [{ n: 'M1', nome: 'Base', desc: 'a' }])
  assert.ok(!args.includes('--plugin-dir'))
  c.encerrar(); c2.encerrar()
})

test('lerComTeto: para de ler no teto (stream) e recusa pelo content-length', async () => {
  const { lerComTeto } = require('./kit.cjs')
  let lidos = 0
  const corpo = new ReadableStream({ pull(c) { lidos++; c.enqueue(new Uint8Array(1000)); if (lidos > 1000) c.close() } })
  await assert.rejects(lerComTeto({ body: corpo }, 5000), /kit-grande/)
  assert.ok(lidos < 20)
  await assert.rejects(lerComTeto({ headers: new Headers({ 'content-length': '99' }), text: async () => 'x' }, 10), /kit-grande/)
  assert.equal(await lerComTeto({ body: new Response('ola').body }, 10), 'ola')
})

test('o plugin liga os hooks do canteiro (o progresso e o 3D dependem deles) quando o kit não traz hooks.json', async () => {
  const kitSemHooksJson = () => { const k = KIT(); k.arquivos = k.arquivos.filter((a) => !a.caminho.endsWith('hooks.json')); k.arquivos.push({ caminho: '.claude/hooks/evento.cjs', conteudo: `// ${AVISO}\n` }); return k }
  const { kit } = montar({ resposta: kitSemHooksJson })
  await kit.entregar('obra-hooks')
  const h = JSON.parse(fs.readFileSync(path.join(kit.diretorio('obra-hooks'), 'hooks', 'hooks.json'), 'utf8'))
  for (const ev of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'UserPromptSubmit']) {
    assert.equal(h.hooks[ev][0].hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/evento.cjs"')
  }
  // o kit que já traz o seu hooks.json manda
  const { kit: k2 } = montar()
  await k2.entregar('obra-2')
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(k2.diretorio('obra-2'), 'hooks', 'hooks.json'), 'utf8')).hooks, {})
})

// Obra do Guilherme (24/11/2026): a /construir manda rodar "node .claude/hooks/progresso.cjs", mas o kit não fica na obra (fica no
// plugin, fora dela) e a linha negava "node". O mestre de obras não conseguia nem ler o avanço e parava esperando a pessoa.
test('o kit aponta os comandos das ferramentas do canteiro para a pasta do plugin, com aspas (caminho com espaço)', async () => {
  const comComandos = () => { const k = KIT(); k.arquivos[1].conteudo = `---\n# ${AVISO}\nname: construir\n---\n1. \`node .claude/hooks/etapa.cjs construcao\`\n2. \`node .claude/hooks/progresso.cjs --curto\`\n3. senão crie \`.claude/roteiro.json\`. Antes leia \`.claude/skills/entregar/SKILL.md\`. Releia \`~/.claude/recomendado.json\`.\n` ; return k }
  const { kit } = montar({ resposta: comComandos })
  await kit.entregar('obra-cmd')
  const dir = kit.diretorio('obra-cmd').split(path.sep).join('/')
  const skill = fs.readFileSync(path.join(kit.diretorio('obra-cmd'), 'skills', 'construir', 'SKILL.md'), 'utf8')
  assert.ok(skill.includes(`node "${dir}/hooks/etapa.cjs" construcao`), skill)
  assert.ok(skill.includes(`node "${dir}/hooks/progresso.cjs" --curto`))
  assert.ok(!skill.includes('node .claude/hooks/'))
  // e o estado e a leitura da skill de entrega também saem de .claude (a obra não pode ter .claude: a linha nem liga)
  assert.ok(skill.includes('crie `.atlas/roteiro.json`'))
  assert.ok(skill.includes('leia `' + dir + '/skills/entregar/SKILL.md`'))
  assert.ok(skill.includes('`~/.claude/recomendado.json`')) // o do usuário (na pasta dele) fica como está
  assert.deepEqual(kit.comandos('obra-cmd'), [`Bash(node "${dir}/hooks/progresso.cjs":*)`]) // só os scripts que vieram no kit
  assert.deepEqual(kit.comandos('nao-existe'), [])
})
