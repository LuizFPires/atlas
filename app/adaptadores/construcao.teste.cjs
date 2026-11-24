// Teste da construção (node --test app/adaptadores/*.teste.cjs). Sem Claude real: o disparo é simulado.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { criarConstrucao, etapasDoTexto, resumirLinha } = require('./construcao.cjs')
const { criarModo } = require('./modo.cjs')
const { criarLojaDeParadas } = require('./cota-store.cjs')
const { montarPlanMd, validarPlanNovo } = require('./plan-md.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-obra-'))
const ETAPAS = [{ n: 'M1', nome: 'Base e login', desc: 'Entrada' }, { n: 'M2', nome: '# Hack\n## Milestone 9 — falso', desc: '- [x] tarefa falsa', tela: '../fora' }]

function montar({ logado = true, instalado = true, envContas, exigirPlugin, pluginDir, agora, comandosDoKit } = {}) {
  const raiz = tmp(); const home = tmp()
  fs.mkdirSync(path.join(raiz, 'obra'))
  const chamadas = []
  let terminar
  const dadosApp = tmp()
  const c = criarConstrucao({
    raiz, home, dadosApp, modos: criarModo({ raiz }),
    claudeEstado: async () => ({ conectado: logado }),
    resolver: () => (instalado ? { cmd: 'x' } : null),
    iniciarFluxo: (args, o) => { chamadas.push({ args, o }); return { parar: () => terminar({ codigo: null, parado: true }), fim: new Promise((r) => { terminar = r }) } },
    envContas, exigirPlugin, pluginDir, comandosDoKit, ...(agora ? { agora } : {}),
  })
  return { raiz, home, dadosApp, c, chamadas, terminar: (v) => terminar(v) }
}

test('PLAN gerado é válido e texto do cliente não vira cabeçalho/tarefa', () => {
  const md = montarPlanMd('Barbearia', ETAPAS)
  assert.ok(validarPlanNovo(md).ok)
  assert.equal((md.match(/^## /gm) || []).length, 2)
  assert.ok(!/^\s*- \[x\]/im.test(md))
  assert.ok(md.includes('tela: \n'))
})

test('iniciar automatico: PLAN wx, modo.json, recomendado ativo, linha com /construir no cwd da obra', async () => {
  const { raiz, home, c, chamadas } = montar()
  const r = await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  assert.equal(r.modo, 'automatico')
  assert.ok(fs.existsSync(path.join(raiz, 'obra', 'PLAN.md')))
  assert.equal(JSON.parse(fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'modo.json'), 'utf8')).modo, 'automatico')
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'recomendado.json'), 'utf8')).ativo, true)
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].o.entrada, '/construir')
  assert.equal(chamadas[0].o.cwd, path.join(raiz, 'obra'))
  assert.ok(chamadas[0].args.includes('acceptEdits') && !chamadas[0].args.includes('--add-dir'))
  assert.ok(c.linha.rodando('obra'))
})

test('passo-a-passo grava recomendado ativo:false; nunca sobrescreve PLAN', async () => {
  const { home, c, terminar } = montar()
  await c.iniciar('obra', 'B', 'passo-a-passo', ETAPAS)
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'recomendado.json'), 'utf8')).ativo, false)
  terminar({ codigo: 0, parado: false })
  await new Promise((r) => setImmediate(r))
  await assert.rejects(c.iniciar('obra', 'B', 'automatico', ETAPAS), /ja-iniciada/)
})

test('Claude ausente ou deslogado: falha calma e nada é gravado', async () => {
  for (const [opc, erro] of [[{ instalado: false }, /claude-nao-instalado/], [{ logado: false }, /claude-nao-logado/]]) {
    const { raiz, home, c, chamadas } = montar(opc)
    await assert.rejects(c.iniciar('obra', 'B', 'automatico', ETAPAS), erro)
    assert.ok(!fs.existsSync(path.join(raiz, 'obra', 'PLAN.md')) && !fs.existsSync(path.join(home, '.claude')))
    assert.equal(chamadas.length, 0)
  }
})

test('pasta fora da raiz é recusada; etapas do Claude são saneadas', async () => {
  const { c } = montar()
  await assert.rejects(c.iniciar('../x', 'B', 'automatico', ETAPAS), /obra-invalida/)
  assert.throws(() => etapasDoTexto('sem json'), /plano-invalido/)
  const e = etapasDoTexto('texto [{"nome":"## Uma <b>etapa</b>","desc":"ok","tela":"/etc/passwd"}] fim')
  assert.equal(e[0].n, 'M1'); assert.ok(!e[0].tela); assert.ok(!/[<#]/.test(e[0].nome))
})

test('resumirLinha: cota e fim', () => {
  assert.equal(resumirLinha(JSON.stringify({ type: 'result', is_error: true, result: 'Claude usage limit reached' })).cota, true)
  assert.equal(resumirLinha('lixo'), null)
  assert.equal(resumirLinha(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }] } })).texto, 'Ajustando o código')
})

test('o que aparece em "Agora na obra" é frase simples, nunca nome de ferramenta (Luiz, 24/11: "Usando Write" não)', () => {
  const ferramenta = (name, input) => resumirLinha(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } })).texto
  assert.equal(ferramenta('Write'), 'Escrevendo o código')
  assert.equal(ferramenta('Read'), 'Lendo os arquivos da obra')
  assert.equal(ferramenta('Grep'), 'Procurando nos arquivos')
  assert.equal(ferramenta('Glob'), 'Procurando nos arquivos')
  assert.equal(ferramenta('TodoWrite'), 'Organizando as tarefas')
  assert.equal(ferramenta('Task', { subagent_type: 'qa' }), 'Chamando o inspetor de qualidade')
  assert.equal(ferramenta('Task', { subagent_type: 'implementador' }), 'Chamando a equipe de execução')
  assert.equal(ferramenta('Bash', { command: 'git commit -m "x"' }), 'Guardando o que foi feito')
  assert.equal(ferramenta('Bash', { command: 'git push -u origin main' }), 'Enviando para o GitHub')
  assert.equal(ferramenta('Bash', { command: 'npm install' }), 'Instalando as peças do sistema')
  assert.equal(ferramenta('Bash', { command: 'npm test' }), 'Testando o que foi feito')
  assert.equal(ferramenta('Bash', { command: 'npm run build' }), 'Montando o sistema')
  assert.equal(ferramenta('Bash', { command: 'gh pr create --title x' }), 'Pedindo a revisão do que foi feito')
  assert.equal(ferramenta('Bash', { command: 'node "C:/kit/hooks/progresso.cjs" --curto' }), 'Conferindo o avanço da obra')
  assert.equal(ferramenta('Bash', { command: 'vercel deploy' }), 'Publicando o sistema')
  assert.equal(ferramenta('Bash', { command: 'algo-estranho' }), 'Trabalhando na obra')
  assert.equal(ferramenta('FerramentaNova'), 'Trabalhando na obra')
})

test('Claude da obra: subcomandos exatos, ignora config de projeto, env mínimo', async () => {
  const { c, chamadas } = montar()
  await c.iniciar('obra', 'A', 'automatico', ETAPAS)
  const a = chamadas[0].args
  const val = (f) => a[a.indexOf(f) + 1]
  assert.equal(val('--setting-sources'), 'user')
  const permitidas = val('--allowedTools'); const negadas = val('--disallowedTools')
  for (const curinga of ['Bash(git:*)', 'Bash(gh:*)', 'Bash(npm:*)', 'Bash(npx:*)']) assert.ok(!permitidas.split(',').includes(curinga))
  for (const n of ['Bash(git -c:*)', 'Bash(git config:*)', 'Bash(node -e:*)', 'Bash(curl:*)', 'Bash(powershell:*)', 'Write(.claude/**)', 'Edit(CLAUDE.md)']) assert.ok(negadas.split(',').includes(n), n)
  assert.ok(!('ANTHROPIC_API_KEY' in chamadas[0].o.env) && chamadas[0].o.env.CLAUDE_PROJECT_DIR)
})

test('obra com .claude ou CLAUDE.md: não roda e não grava', async () => {
  for (const nome of ['.claude', 'CLAUDE.md']) {
    const { raiz, home, c, chamadas } = montar()
    fs.mkdirSync(path.join(raiz, 'obra', nome))
    await assert.rejects(c.iniciar('obra', 'A', 'automatico', ETAPAS), /obra-com-config-suspeita/)
    await assert.rejects(c.planejar('obra', 'A'), /obra-com-config-suspeita/)
    assert.equal(chamadas.length, 0)
    assert.ok(!fs.existsSync(path.join(raiz, 'obra', 'PLAN.md')) && !fs.existsSync(path.join(home, '.claude')))
  }
})

test('duas iniciar concorrentes: só uma roda; falha ao religar desfaz PLAN e modo', async () => {
  const { raiz, c, chamadas } = montar()
  fs.mkdirSync(path.join(raiz, 'outra'))
  const r = await Promise.allSettled([c.iniciar('obra', 'A', 'automatico', ETAPAS), c.iniciar('outra', 'B', 'automatico', ETAPAS)])
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1)
  assert.equal(chamadas.length, 1)
  const raiz2 = tmp(); const home2 = tmp(); fs.mkdirSync(path.join(raiz2, 'obra'))
  const c2 = criarConstrucao({ raiz: raiz2, home: home2, modos: criarModo({ raiz: raiz2 }), claudeEstado: async () => ({ conectado: true }), resolver: () => ({ cmd: 'x' }), iniciarFluxo: () => { throw new Error('spawn-falhou') } })
  await assert.rejects(c2.iniciar('obra', 'A', 'automatico', ETAPAS), /spawn-falhou/)
  assert.ok(!fs.existsSync(path.join(raiz2, 'obra', 'PLAN.md')) && !fs.existsSync(path.join(raiz2, 'obra', '.atlas', 'modo.json')) && !fs.existsSync(path.join(home2, '.claude', 'recomendado.json')))
})

test('RE_COTA não casa cotação', () => {
  const { RE_COTA } = require('./construcao.cjs')
  assert.ok(!RE_COTA.test('Pedido de cotação do fornecedor') && !RE_COTA.test('quotation'))
  assert.ok(RE_COTA.test('Você atingiu a cota') && RE_COTA.test('Claude usage limit reached'))
})

test('git isolado: env do Claude com config de sistema/global controlada, sem hooks; .git negado', async () => {
  const { c, chamadas } = montar()
  await c.iniciar('obra', 'A', 'automatico', ETAPAS)
  const env = chamadas[0].o.env
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1')
  assert.ok(env.GIT_CONFIG_SYSTEM === 'NUL' || env.GIT_CONFIG_SYSTEM === '/dev/null')
  const conf = fs.readFileSync(env.GIT_CONFIG_GLOBAL, 'utf8')
  assert.match(conf, /hooksPath = ".*git-vazio"/)
  assert.match(conf, /fsmonitor = false/)
  assert.ok(!/token|password|secret|key/i.test(conf))
  assert.equal(fs.readdirSync(path.join(path.dirname(env.GIT_CONFIG_GLOBAL), 'git-vazio')).length, 0)
  const par = {}
  for (let i = 0; i < Number(env.GIT_CONFIG_COUNT); i++) par[env[`GIT_CONFIG_KEY_${i}`]] = env[`GIT_CONFIG_VALUE_${i}`]
  for (const k of ['core.hooksPath', 'core.fsmonitor', 'core.sshCommand', 'core.pager', 'diff.external']) assert.ok(k in par, k)
  assert.match(par['core.hooksPath'], /git-vazio$/)
  assert.equal(par['core.fsmonitor'], 'false'); assert.equal(par['core.sshCommand'], ''); assert.equal(par['diff.external'], '')
  const negadas = chamadas[0].args[chamadas[0].args.indexOf('--disallowedTools') + 1].split(',')
  for (const n of ['Write(.git/**)', 'Edit(.git/**)']) assert.ok(negadas.includes(n), n)
})

test('config suspeita ampliada: CLAUDE.local.md, aninhado e .git de fora (obra nova); .git da própria linha ao religar', async () => {
  const casos = [['CLAUDE.local.md', 'f'], ['sub/.claude', 'd'], ['sub/a/CLAUDE.md', 'f'], ['.git', 'd']]
  for (const [rel, tipo] of casos) {
    const { raiz, c, chamadas } = montar()
    const alvo = path.join(raiz, 'obra', rel)
    fs.mkdirSync(tipo === 'd' ? alvo : path.dirname(alvo), { recursive: true })
    if (tipo === 'f') fs.writeFileSync(alvo, 'x')
    await assert.rejects(c.iniciar('obra', 'A', 'automatico', ETAPAS), /obra-com-config-suspeita/, rel)
    await assert.rejects(c.planejar('obra', 'A'), /obra-com-config-suspeita/, rel)
    assert.equal(chamadas.length, 0)
  }
  // node_modules é ignorado na varredura; .git criado pela linha (religar) é aceito
  const { raiz, c, chamadas } = montar()
  fs.mkdirSync(path.join(raiz, 'obra', 'node_modules', 'x'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'obra', 'node_modules', 'x', 'CLAUDE.md'), 'x')
  await c.iniciar('obra', 'A', 'automatico', ETAPAS)
  c.linha.parar('obra')
  fs.mkdirSync(path.join(raiz, 'obra', '.git'))
  c.linha.religar('obra')
  assert.equal(chamadas.length, 2)
})

test('integração: GIT_CONFIG_COUNT vence o .git/config local', (t) => {
  const { spawnSync } = require('node:child_process')
  if (spawnSync('git', ['--version']).status !== 0) return t.skip('git indisponível')
  const { envGitIsolado } = require('./construcao.cjs')
  const repo = tmp(); const dados = tmp()
  spawnSync('git', ['init', '-q'], { cwd: repo })
  spawnSync('git', ['config', 'core.hooksPath', 'MAL'], { cwd: repo })
  spawnSync('git', ['config', 'core.sshCommand', 'MAL'], { cwd: repo })
  const env = { ...process.env, ...envGitIsolado(dados) }
  const ler = (k) => spawnSync('git', ['config', '--get', k], { cwd: repo, env, encoding: 'utf8' }).stdout.trim()
  assert.match(ler('core.hooksPath'), /git-vazio$/)
  assert.equal(ler('core.sshCommand'), '')
})

test('fim por cota grava o registro no store do APP (fora da obra); pausa e religar o apagam', async () => {
  const { raiz, dadosApp, c, chamadas, terminar } = montar()
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  const loja = criarLojaDeParadas({ raiz, dadosApp })
  chamadas[0].o.onLinha(JSON.stringify({ type: 'result', is_error: true, result: 'Claude AI usage limit reached|' + Math.floor(Date.now() / 1000 + 3600) }))
  terminar({ codigo: 1, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  assert.ok(loja.obter('obra'))
  assert.ok(loja.obter('obra').voltaEm)
  assert.ok(fs.existsSync(path.join(dadosApp, 'cota', 'paradas.json')))
  assert.ok(!fs.existsSync(path.join(raiz, 'obra', '.atlas', 'paradas.json'))) // nada disso na pasta da obra
  c.linha.religar('obra') // religou: registro apagado
  assert.equal(loja.obter('obra'), null)
  chamadas[1].o.onLinha(JSON.stringify({ type: 'result', is_error: true, result: 'Claude AI usage limit reached|' + Math.floor(Date.now() / 1000 + 3600) }))
  terminar({ codigo: 1, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  assert.ok(loja.obter('obra'))
  c.linha.parar('obra') // pausa do cliente
  assert.equal(loja.obter('obra'), null)
})

test('fim que não é cota não deixa registro', async () => {
  const { raiz, dadosApp, c, terminar } = montar()
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  terminar({ codigo: 1, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(criarLojaDeParadas({ raiz, dadosApp }).obter('obra'), null)
})

test('caminho completo: a linha pode preparar o projeto (npm install, git init, repositório no GitHub) sem abrir nada perigoso', () => {
  const { FERRAMENTAS_LINHA, FERRAMENTAS_NEGADAS } = require('./construcao.cjs')
  const ok = require('./construcao.cjs').FERRAMENTAS_LINHA.split(',')
  for (const f of ['Bash(npm install)', 'Bash(npm install:*)', 'Bash(npm ci)', 'Bash(git init:*)', 'Bash(git remote:*)', 'Bash(git branch:*)', 'Bash(git fetch:*)', 'Bash(git pull:*)', 'Bash(git rev-parse:*)', 'Bash(gh auth status)', 'Bash(gh repo create:*)', 'Bash(gh repo view:*)']) {
    assert.ok(ok.includes(f), `falta ${f}`)
  }
  // nada que mostre ou troque a credencial, nem execução solta
  assert.ok(!ok.some((f) => /gh auth (login|token|refresh|logout)|gh api(?! rate_limit\))|npm exec|Bash\(\*\)/.test(f)))
  for (const f of ['Bash(node -e:*)', 'Bash(git config:*)', 'Bash(curl:*)']) assert.ok(FERRAMENTAS_NEGADAS.split(',').includes(f))
  assert.ok(!ok.includes('Bash(npx:*)')) // npx solto nunca: só as ferramentas oficiais listadas
})

test('git isolado: os commits têm autor e o push para o GitHub usa o login do gh (sem senha guardada)', (t) => {
  const { spawnSync } = require('node:child_process')
  if (spawnSync('git', ['--version']).status !== 0) return t.skip('git indisponível')
  const { envGitIsolado } = require('./construcao.cjs')
  const repo = tmp(); const dados = tmp()
  const env = { ...process.env, ...envGitIsolado(dados) }
  spawnSync('git', ['init', '-q'], { cwd: repo, env })
  const ler = (k) => spawnSync('git', ['config', '--get-all', k], { cwd: repo, env, encoding: 'utf8' }).stdout.trim()
  assert.equal(ler('user.name'), 'Atlas')
  assert.match(ler('user.email'), /@/)
  assert.match(ler('credential.https://github.com.helper'), /gh(\.exe)?"? auth git-credential$/)
  assert.equal(ler('init.defaultBranch'), 'main')
  const conf = fs.readFileSync(path.join(dados, 'gitconfig-atlas'), 'utf8')
  assert.ok(!/token|password|senha/i.test(conf))
})

test('Git Bash: no Windows, aponta CLAUDE_CODE_GIT_BASH_PATH para a instalação padrão do Git quando existe', () => {
  const { caminhoGitBash } = require('./construcao.cjs')
  const env = { ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\M\\AppData\\Local' }
  const existe = (p) => p === path.win32.join('C:\\Program Files', 'Git', 'bin', 'bash.exe')
  assert.equal(caminhoGitBash(env, existe, 'win32'), 'C:\\Program Files\\Git\\bin\\bash.exe')
  assert.equal(caminhoGitBash({ ...env, CLAUDE_CODE_GIT_BASH_PATH: 'D:\\x\\bash.exe' }, existe, 'win32'), null) // o do usuário vale
  assert.equal(caminhoGitBash(env, () => false, 'win32'), null)
  assert.equal(caminhoGitBash(env, existe, 'linux'), null)
})

test('contas ligadas: a linha recebe as ferramentas do Atlas no PATH e a chave do Supabase pelo ambiente (nunca nos argumentos)', async () => {
  const { c, chamadas } = montar({ envContas: () => ({ PATH: '/ferramentas/bin:/usr/bin', SUPABASE_ACCESS_TOKEN: 'sbp_' + 'a'.repeat(40) }) })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  const { args, o } = chamadas[0]
  assert.equal(o.env.SUPABASE_ACCESS_TOKEN, 'sbp_' + 'a'.repeat(40))
  assert.equal(o.env.PATH, '/ferramentas/bin:/usr/bin')
  assert.equal(o.env.ATLAS_APP, '1') // os agentes sabem que é obra do Atlas: nunca pedem comando ao usuário
  assert.ok(!args.join(' ').includes('sbp_'))
  const ok = args[args.indexOf('--allowedTools') + 1].split(',')
  for (const f of ['Bash(vercel:*)', 'Bash(supabase:*)']) assert.ok(ok.includes(f), f)
  const negadas = args[args.indexOf('--disallowedTools') + 1].split(',')
  for (const f of ['Bash(vercel logout:*)', 'Bash(vercel remove:*)', 'Bash(vercel rm:*)', 'Bash(vercel tokens:*)', 'Bash(supabase logout:*)', 'Bash(supabase projects delete:*)', 'Bash(supabase orgs:*)']) assert.ok(negadas.includes(f), f)
})

// Bug de 24/11/2026 (obra do Guilherme): a linha religava SEM o kit (ele vive só na memória do app), o Claude não conhecia /construir,
// terminava em segundos com código 0 e o painel lia "concluiu"/"a obra está pronta" com 0%.
test('sem kit, a linha NÃO liga (nunca roda /construir sem as instruções)', async () => {
  const { raiz, c, chamadas } = montar({ exigirPlugin: true, pluginDir: () => null })
  await assert.rejects(c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS), /kit-faltando/)
  assert.equal(chamadas.length, 0)
  assert.ok(!fs.existsSync(path.join(raiz, 'obra', 'PLAN.md'))) // desfez o começo
})

test('fim com código 0 em pouco tempo e a obra por terminar = "sem-avanco" (parou, não acabou), com as últimas linhas para diagnóstico', async () => {
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const { raiz, c, chamadas, terminar } = montar({ agora: () => new Date(t) })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  chamadas[0].o.onLinha(JSON.stringify({ type: 'result', is_error: false, result: 'Unknown command: /construir' }))
  t += 20_000
  terminar({ codigo: 0, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  const l = JSON.parse(fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), 'utf8'))
  assert.equal(l.motivo, 'sem-avanco')
  assert.ok(Array.isArray(l.ultimas) && l.ultimas.length >= 1)
})

test('fim com código 0 depois de trabalhar de verdade (mais de 3 min) continua "concluiu"', async () => {
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const { raiz, c, terminar } = montar({ agora: () => new Date(t) })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  t += 20 * 60_000
  terminar({ codigo: 0, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(JSON.parse(fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), 'utf8')).motivo, 'concluiu')
})

test('a linha que para pedindo algo à pessoa (ex.: ligar o GitHub) vira "precisa-voce" e guarda o que ela disse', async () => {
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const { raiz, c, chamadas, terminar } = montar({ agora: () => new Date(t) })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  chamadas[0].o.onLinha(JSON.stringify({ type: 'result', is_error: false, result: 'Não consegui seguir.\nUSUÁRIO: Ligue o GitHub na tela As contas do Atlas (botão Ligar).' }))
  t += 40_000
  terminar({ codigo: 0, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  const l = JSON.parse(fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), 'utf8'))
  assert.equal(l.motivo, 'precisa-voce')
  assert.match(l.fala, /Ligue o GitHub na tela As contas do Atlas/)
})

// Obra do Guilherme (24/11): a linha parou dizendo "precisam de você… libere com /permissions… rode no terminal". A trava era do Atlas,
// e o cliente não tem como resolver. Isso não pode virar "precisa de você": fica "sem-avanço" para o vigia tentar de novo e, se não
// resolver, mostrar "com defeito".
test('pedido de permissão ou de terminal não vira "precisa de você" (a trava é do Atlas, não do cliente)', async () => {
  let t = Date.UTC(2026, 10, 24, 9, 0)
  const { raiz, c, chamadas, terminar } = montar({ agora: () => new Date(t) })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  chamadas[0].o.onLinha(JSON.stringify({ type: 'result', is_error: false, result: 'Parei: isso precisa de você. Só você pode liberar. Num terminal, rode gh auth setup-git. Libere o comando com /permissions.' }))
  t += 40_000
  terminar({ codigo: 0, parado: false })
  await new Promise((r) => setTimeout(r, 20))
  const l = JSON.parse(fs.readFileSync(path.join(raiz, 'obra', '.atlas', 'linha.json'), 'utf8'))
  assert.equal(l.motivo, 'sem-avanco')
})

test('a linha pode rodar as ferramentas do kit e os arquivos da obra; node -e e companhia continuam negados', async () => {
  const { c, chamadas } = montar({ comandosDoKit: () => ['Bash(node "C:/kit/obra/hooks/progresso.cjs":*)'] })
  await c.iniciar('obra', 'Barbearia', 'automatico', ETAPAS)
  const a = chamadas[0].args
  const permitidos = a[a.indexOf('--allowedTools') + 1]
  const negados = a[a.indexOf('--disallowedTools') + 1]
  assert.ok(permitidos.includes('Bash(node "C:/kit/obra/hooks/progresso.cjs":*)'))
  assert.ok(!negados.split(',').includes('Bash(node:*)'))
  for (const n of ['Bash(node -e:*)', 'Bash(node --eval:*)', 'Bash(node -p:*)', 'Bash(node --print:*)', 'Bash(node -r:*)', 'Bash(node --require:*)', 'Bash(node -i:*)']) assert.ok(negados.split(',').includes(n), n)
})

test('o despachante consegue conferir git e gh (antes "git --version" era negado e ele mandava reinstalar o Atlas)', () => {
  const ok = require('./construcao.cjs').FERRAMENTAS_LINHA.split(',')
  for (const f of ['Bash(git --version)', 'Bash(gh --version)', 'Bash(gh pr list:*)']) assert.ok(ok.includes(f), f)
})

// Obra do Guilherme: o PLAN manda ler regras.md e telas.md, mas no caminho novo só existem o relato e o protótipo. O mestre de obras
// não achava a especificação e parava. Antes de ligar, o Atlas gera os dois a partir do protótipo aprovado (sem nunca sobrescrever).
test('antes de ligar, a obra ganha telas.md e regras.md gerados do protótipo aprovado (e os que já existem ficam)', async () => {
  const { raiz, c } = montar()
  const obra = path.join(raiz, 'obra')
  const v = path.join(obra, 'prototipo', 'versoes', 'v002')
  fs.mkdirSync(path.join(v, 'telas'), { recursive: true })
  fs.writeFileSync(path.join(v, 'telas', 'inicio.html'), '<div>oi</div>')
  fs.writeFileSync(path.join(v, 'telas', 'ponto.html'), '<div>ponto</div>')
  fs.writeFileSync(path.join(v, 'versao.json'), JSON.stringify({ versao: 1, numero: 2, resumo: 'x', telas: [{ id: 'inicio', nome: 'Início', aparelho: 'celular' }, { id: 'ponto', nome: 'Bater ponto', aparelho: 'celular' }] }))
  fs.writeFileSync(path.join(obra, 'prototipo', 'atual.json'), JSON.stringify({ versao: 1, atual: 2 }))
  fs.writeFileSync(path.join(obra, 'prototipo', 'relato.md'), 'Quero bater ponto na obra.')
  await c.iniciar('obra', 'Ponto', 'automatico', ETAPAS)
  const telas = fs.readFileSync(path.join(obra, 'telas.md'), 'utf8')
  assert.match(telas, /prototipo\/versoes\/v002\/telas\/inicio\.html/)
  assert.match(telas, /Bater ponto/)
  const regras = fs.readFileSync(path.join(obra, 'regras.md'), 'utf8')
  assert.match(regras, /prototipo\/relato\.md/)
  assert.match(regras, /design-system\.md/)
  // não sobrescreve
  fs.writeFileSync(path.join(obra, 'regras.md'), 'MINHAS REGRAS')
  c.linha.parar('obra'); c.linha.religar('obra')
  assert.equal(fs.readFileSync(path.join(obra, 'regras.md'), 'utf8'), 'MINHAS REGRAS')
})

// Obra do Guilherme (24/11): o gh fica em "C:/Program Files/...". No arquivo de config do git, aspas soltas são removidas na leitura,
// então o git rodava "C:/Program" e o push falhava sempre. As aspas precisam ir escapadas (\") para chegar ao shell.
test('git isolado: o caminho do gh com espaço chega ao git com as aspas (push funciona no Windows)', (t) => {
  const { spawnSync } = require('node:child_process')
  if (spawnSync('git', ['--version']).status !== 0) return t.skip('git indisponível')
  const { envGitIsolado } = require('./construcao.cjs')
  const dados = tmp()
  const env = envGitIsolado(dados, '"C:/Program Files/GitHub CLI/gh.exe"')
  const v = spawnSync('git', ['config', '-f', env.GIT_CONFIG_GLOBAL, '--get-all', 'credential.https://github.com.helper'], { encoding: 'utf8' }).stdout.trim().split('\n').pop()
  assert.equal(v, '!"C:/Program Files/GitHub CLI/gh.exe" auth git-credential')
})

// Obra do Guilherme (24/11): a revisão pediu ícones menores, o implementador criou "npm run icones" e a linha não podia rodá-lo.
// npm run executa só os scripts do package.json da obra, o mesmo nível de confiança do "npm test" que já é permitido.
test('a linha pode rodar os scripts da própria obra (npm run …)', () => {
  const ok = require('./construcao.cjs').FERRAMENTAS_LINHA.split(',')
  assert.ok(ok.includes('Bash(npm run:*)'))
})

// "O Atlas tem que rodar liso" (24/11): toda ordem de comando que o próprio kit dá à linha precisa estar liberada.
// Este teste lê os agentes e as skills do kit e confere cada comando contra as regras, do jeito que o Claude Code casa:
// "Bash(x)" = exatamente x; "Bash(x:*)" = começa com x; negado vence liberado; comando com ; && || | vale por partes.
test('todo comando que o kit manda a linha rodar está liberado (nenhuma trava nossa no meio da obra)', () => {
  const { FERRAMENTAS_LINHA, FERRAMENTAS_NEGADAS } = require('./construcao.cjs')
  const regras = (s) => s.split(',').filter((r) => r.startsWith('Bash(')).map((r) => r.slice(5, -1))
  const casa = (cmd, r) => (r.endsWith(':*') ? cmd === r.slice(0, -2) || cmd.startsWith(r.slice(0, -2) + ' ') : cmd === r)
  const ok = regras(FERRAMENTAS_LINHA); const nao = regras(FERRAMENTAS_NEGADAS)
  // fora da obra do Atlas (o próprio texto do kit diz "fora do Atlas") ou trocados por ferramenta própria
  const FORA = [/^git config --global/, /^gh api user/, /^node \.claude\/canteiro\/server\.cjs/]
  const raizKit = path.join(__dirname, '..', '..', '.claude')
  const arquivos = []
  for (const d of ['agents', 'skills']) {
    const andar = (p) => { for (const n of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, n.name); if (n.isDirectory()) andar(f); else if (f.endsWith('.md')) arquivos.push(f) } }
    andar(path.join(raizKit, d))
  }
  const faltando = new Set()
  for (const f of arquivos) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/`((?:npm|npx|node|git|gh|vercel|supabase|pnpm) [^`]+)`/g)) {
      const cmd = m[1].replace(/<[^>]+>/g, 'X').replace(/"[^"]*"|'[^']*'/g, 'Q').replace(/\s+/g, ' ').trim()
      if (FORA.some((re) => re.test(cmd))) continue
      for (const parte of cmd.split(/\s*(?:&&|\|\||;|\|)\s*/)) {
        const p = parte.replace(/\s*2>&1$/, '').trim()
        if (!p || /^(head|tail|grep|wc|sort)\b/.test(p)) continue
        if (/^node \.claude\/hooks\//.test(p)) continue // reescrito para o kit da obra (kit.comandos)
        if (nao.some((r) => casa(p, r)) || !ok.some((r) => casa(p, r))) faltando.add(`${path.basename(path.dirname(f))}/${path.basename(f)}: ${p}`)
      }
    }
  }
  assert.deepEqual([...faltando], [])
})

// Visto no eventos.jsonl da obra do Guilherme: comandos comuns de trabalho que eram negados e faziam a linha girar em falso.
test('comandos comuns de trabalho na obra estão liberados (e os perigosos continuam negados)', () => {
  const { FERRAMENTAS_LINHA, FERRAMENTAS_NEGADAS } = require('./construcao.cjs')
  const ok = FERRAMENTAS_LINHA.split(','); const nao = FERRAMENTAS_NEGADAS.split(',')
  for (const f of ['Bash(cd:*)', 'Bash(node:*)', 'Bash(npm audit:*)', 'Bash(npm pkg:*)', 'Bash(git --no-pager diff:*)', 'Bash(git show:*)', 'Bash(git mv:*)', 'Bash(git rm:*)', 'Bash(git tag:*)', 'WebFetch']) assert.ok(ok.includes(f), `falta ${f}`)
  for (const f of ['Bash(git config:*)', 'Bash(git -c:*)', 'Bash(node -e:*)', 'Bash(curl:*)', 'Bash(gh auth setup-git:*)']) assert.ok(nao.includes(f), `devia negar ${f}`)
  assert.ok(!ok.some((f) => /^Bash\(git --no-pager:\*\)$|^Bash\(npx:\*\)$|gh api(?! rate_limit\))/.test(f)))
})
