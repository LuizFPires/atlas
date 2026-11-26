// @vitest-environment node
// O kit (.claude/agents e .claude/skills) pode ter o texto reescrito, mas a estrutura e os gatilhos não podem quebrar.
// (Sem @types/node no projeto: módulos do Node entram por nome em variável.)
const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
interface Fs { readdirSync(p: string): string[]; readFileSync(p: string, e: string): string; existsSync(p: string): boolean }
let fs: Fs, raiz: string

beforeAll(async () => {
  fs = (await mod('node:fs')) as Fs
  const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string): string }
  const path = (await mod('node:path')) as { resolve(...p: string[]): string }
  raiz = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '.claude')
})

function frontmatter(t: string): Record<string, string> {
  const m = t.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) throw new Error('sem frontmatter')
  const o: Record<string, string> = {}
  for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return o
}

const AGENTES = ['corretor', 'designer', 'desempenho', 'despachante', 'escritor', 'implantador', 'implementador', 'incorporador', 'plantonista', 'qa', 'revisor', 'seguranca', 'sindico', 'vistoriador']
const SKILLS = ['adotar', 'briefing', 'canteiro', 'construir', 'documentar', 'entregar', 'linha', 'prototipo', 'stop-recomendado', 'login-usuarios', 'notificacoes', 'pagamento-cliente', 'lgpd-basico']

test.each(AGENTES)('agente %s mantém nome e descrição (gatilho)', (a) => {
  const f = frontmatter(fs.readFileSync(`${raiz}/agents/${a}.md`, 'utf8'))
  expect(f.name).toBe(a)
  expect(f.description.length).toBeGreaterThan(40)
  expect(f.tools).toBeTruthy()
})

test.each(SKILLS)('skill %s mantém nome e descrição (gatilho)', (s) => {
  const f = frontmatter(fs.readFileSync(`${raiz}/skills/${s}/SKILL.md`, 'utf8'))
  expect(f.name).toBe(s)
  expect(f.description.length).toBeGreaterThan(30)
})

test('os gatilhos principais continuam nas descrições', () => {
  const d = (s: string) => frontmatter(fs.readFileSync(`${raiz}/skills/${s}/SKILL.md`, 'utf8')).description
  expect(d('construir')).toContain('/construir')
  expect(d('entregar')).toContain('/entregar')
  expect(d('adotar')).toContain('/adotar')
  expect(d('canteiro')).toContain('/canteiro')
  expect(d('linha')).toContain('/linha')
  expect(d('stop-recomendado')).toContain('/stop-recomendado')
})

test('o roteiro de passos das skills continua no lugar', () => {
  const t = (s: string) => fs.readFileSync(`${raiz}/skills/${s}/SKILL.md`, 'utf8')
  for (const h of ['## 1. Vistoria', '## 2. Hooks do painel', '## 3. Cronograma', '## 4. Protótipo', '## 6. GitHub', '## 7. Encerrar']) expect(t('adotar')).toContain(h)
  for (const h of ['## 0. Antes de começar', '## 3. Vistoria final', '## 4. Produção web', '## 5. Lojas', '## 6. Entrega das chaves']) expect(t('entregar')).toContain(h)
  for (const h of ['### Etapa 1', '### Etapa 2', '### Etapa 3', '### Etapa 4']) expect(t('construir')).toContain(h)
})

test('o formato do PLAN que o escritor ensina continua intacto', () => {
  const t = fs.readFileSync(`${raiz}/agents/escritor.md`, 'utf8')
  for (const c of ['## Milestone 1 — <título curto>', 'peso: 1', 'spec: S1, S3', 'tela: prototipo/index.html#tela-x', '- [ ] Tarefa verificável', 'Notas:']) expect(t).toContain(c)
})

// Pedido do Luiz (22/11/2026): toda etapa passa por revisão de segurança e de desempenho, além do qa.
describe('revisores de segurança e desempenho', () => {
  const agente = (a: string) => fs.readFileSync(`${raiz}/agents/${a}.md`, 'utf8')
  const construir = () => fs.readFileSync(`${raiz}/skills/construir/SKILL.md`, 'utf8')

  test('os dois só apontam: ferramentas de leitura, sem Edit/Write', () => {
    for (const a of ['seguranca', 'desempenho']) {
      const f = frontmatter(agente(a))
      expect(f.tools).not.toMatch(/Edit|Write/)
      expect(agente(a)).toMatch(/VEREDITO: aprovado \| reprovado/)
    }
  })

  test('segurança cobre ataque, vazamento, permissões, segredos e dependências', () => {
    const t = agente('seguranca').toLowerCase()
    for (const c of ['injeção', 'xss', 'rls', 'segredo', 'dependências', 'vazamento', 'senha']) expect(t).toContain(c)
  })

  test('desempenho cobre consultas, bundle, imagens e renderização', () => {
    const t = agente('desempenho').toLowerCase()
    for (const c of ['n+1', 'índice', 'bundle', 'imagens', 'paginação', 'render']) expect(t).toContain(c)
  })

  test('a etapa 3 do /construir chama qa, seguranca e desempenho juntos', () => {
    const e3 = construir().split('### Etapa 3')[1].split('### Etapa 4')[0]
    for (const a of ['`qa`', '`seguranca`', '`desempenho`']) expect(e3).toContain(a)
    expect(e3).toMatch(/em paralelo/)
  })

  test('a medição e o merge exigem todos os revisores chamados aprovados (Luiz, 24/11/2026: seguranca e desempenho só quando relevantes)', () => {
    const e3 = construir().split('### Etapa 3')[1].split('### Etapa 4')[0]
    expect(e3).toMatch(/hooks\/revisores\.cjs/)
    expect(e3).toMatch(/`qa` vale sempre/)
    const e4 = construir().split('### Etapa 4')[1].split('## Bloqueios externos')[0]
    expect(e4).toMatch(/aprovadas pelos revisores chamados/)
  })

  test('o canteiro 3D conhece os dois novos papéis', () => {
    const srv = fs.readFileSync(`${raiz}/canteiro/server.cjs`, 'utf8')
    const cena = fs.readFileSync(`${raiz}/canteiro/cena3d.js`, 'utf8')
    for (const a of ['seguranca', 'desempenho']) {
      expect(srv).toMatch(new RegExp(`PAPEIS = \\[[^\\]]*'${a}'`))
      expect(cena).toMatch(new RegExp(`\\n  ${a}: +\\{ nome:`))
    }
  })
})

// M63 (Luiz, 25/11/2026): "colocar um paisagismo no entorno ali do prédio ... e aí agora é venda ... fica mais lúdico". Sempre em 3D.
describe('canteiro 3D no fim da obra: jardim e stand de vendas', () => {
  const ler = (a: string) => fs.readFileSync(`${raiz}/canteiro/${a}`, 'utf8')
  test('o servidor do canteiro conta à cena a fase do lançamento (nada, obra, pronto)', () => {
    const srv = ler('server.cjs')
    expect(srv).toMatch(/function faseLancamento\(/)
    expect(srv).toMatch(/lancamento: faseLancamento\(RAIZ\)/)
    for (const a of ['incorporador', 'sindico']) expect(srv).toMatch(new RegExp(`PAPEIS = \\[[^\\]]*'${a}'`))
  })
  test('a cena tem o jardim (só com o prédio pronto) e o stand (obra → pronto, com a placa Vendas)', () => {
    const cena = ler('cena3d.js')
    expect(cena).toMatch(/const jardim = new THREE\.Group\(\)/)
    expect(cena).toMatch(/jardim\.visible = pctVisto >= 99\.9/)
    expect(cena).toMatch(/const stand = new THREE\.Group\(\)/)
    expect(cena).toMatch(/standObra\.visible = faseLanc === 'obra'/)
    expect(cena).toMatch(/standPronto\.visible = faseLanc === 'pronto'/)
    expect(cena).toMatch(/'VENDAS'/)
    for (const a of ['incorporador', 'sindico']) expect(cena).toMatch(new RegExp(`\\n  ${a}: +\\{ nome:`))
  })
})

// M37 (Luiz, 23/11/2026): o retrato do canteiro — a cena ganha vida com o mouse e guarda o retrato de quando o mouse sai.
describe('canteiro 3D: retrato para o cartão do Canteiro de obras', () => {
  test('a cena responde só a quem a embute com um retrato JPEG desenhado na hora', () => {
    const cena = fs.readFileSync(`${raiz}/canteiro/cena3d.js`, 'utf8')
    expect(cena).toMatch(/ev\.source !== window\.parent/)
    expect(cena).toMatch(/ev\.data\.tipo !== 'atlas:retrato'/)
    expect(cena).toMatch(/renderer\.render\(cena, camera\);\s*\n\s*const imagem = renderer\.domElement\.toDataURL\('image\/jpeg'/)
    expect(cena).toMatch(/removeEventListener\('message', aoPedirRetrato\)/)
  })
})
