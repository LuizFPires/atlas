// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { entregarKit, marcaDagua, temAvisoNoTopo, type CarregarKit } from '../functions/_shared/kit.ts'
import { H1, H2, montar, TOKEN } from './helpers.ts'

const fixture: CarregarKit = async () => [
  { caminho: '.claude/agents/arquiteto.md', conteudo: '# Arquiteto' },
  { caminho: '.claude/hooks/x.cjs', conteudo: 'module.exports = 1' },
  { caminho: '.claude/settings.json', conteudo: '{"a":1}' },
]
const email = 'ana@loja.com'

describe('/entregar-kit', () => {
  it('marca todos os arquivos, registra a entrega e proíbe cache', async () => {
    const m = montar()
    await m.ativar()
    const r = await entregarKit(m.deps, fixture, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'obra-1' })
    expect(r.marca_dagua).toBe(await marcaDagua(m.deps, 'l1'))
    for (const f of r.arquivos) expect(f.conteudo).toContain(r.marca_dagua)
    expect(r.arquivos[0].conteudo).toContain('licenciado a Ana')
    expect(r.arquivos[0].conteudo).toContain('Lei 9.609/98')
    expect(r.arquivos[1].conteudo.startsWith('// Software proprietário')).toBe(true)
    expect(JSON.parse(r.arquivos[2].conteudo)._marca).toBe(r.marca_dagua)
    expect(r.cabecalhos['Cache-Control']).toBe('no-store')
    expect(m.store.entregas).toEqual([expect.objectContaining({ licenca_id: 'l1', obra_id: 'obra-1', marca_dagua: r.marca_dagua })])
  })
  it('marca é por cliente e a entrega não guarda o conteúdo', async () => {
    const m = montar()
    const outra = await marcaDagua({ ...m.deps, segredo: 'outro' }, 'l1')
    expect(outra).not.toBe(await marcaDagua(m.deps, 'l1'))
    expect(await marcaDagua(m.deps, 'l2')).not.toBe(await marcaDagua(m.deps, 'l1'))
    await m.ativar()
    await entregarKit(m.deps, fixture, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'o' })
    expect(JSON.stringify(m.store.entregas)).not.toContain('Arquiteto')
  })
  it('JSON que não é objeto não sai sem marca: falha', async () => {
    const m = montar()
    await m.ativar()
    for (const conteudo of ['[1,2]', '{quebrado', '"texto"']) {
      const k: CarregarKit = async () => [{ caminho: 'x.json', conteudo }]
      await expect(entregarKit(m.deps, k, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'o' })).rejects.toMatchObject({ codigo: 'kit_invalido' })
    }
    expect(m.store.entregas).toHaveLength(0)
  })
  it('sem a credencial da ativação não entrega, sem detalhe do motivo', async () => {
    const m = montar()
    await m.ativar()
    await expect(entregarKit(m.deps, fixture, { email, computador_hash: H1, token_dispositivo: 'errado', obra_id: 'o' })).rejects.toMatchObject({ codigo: 'negado', status: 403 })
    await expect(entregarKit(m.deps, fixture, { email, computador_hash: H1, token_dispositivo: '', obra_id: 'o' })).rejects.toMatchObject({ codigo: 'negado' })
    expect(m.store.entregas).toHaveLength(0)
  })
  it('nega sem licença liberada ou em outro computador, e obra inválida', async () => {
    const m = montar()
    await m.ativar()
    await expect(entregarKit(m.deps, fixture, { email, computador_hash: H2, token_dispositivo: TOKEN, obra_id: 'o' })).rejects.toMatchObject({ status: 403 })
    await expect(entregarKit(m.deps, fixture, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: '../x' })).rejects.toMatchObject({ codigo: 'obra_invalida' })
    const p = montar('pausada')
    await p.ativar()
    await expect(entregarKit(p.deps, fixture, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'o' })).rejects.toMatchObject({ codigo: 'negado', status: 403 })
    expect(p.store.entregas).toHaveLength(0)
  })
})

describe('/entregar-kit com o kit de verdade (.claude)', () => {
  const mod = (n: string): Promise<unknown> => import(/* @vite-ignore */ n)
  interface Fs { readdirSync(p: string, o: { recursive: true }): string[]; readFileSync(p: string, e: string): string; statSync(p: string): { isFile(): boolean } }

  async function kitReal(): Promise<CarregarKit> {
    const fs = (await mod('node:fs')) as Fs
    const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string | URL): string }
    const raiz = fileURLToPath(new URL('../../.claude', import.meta.url))
    const sl = String.fromCharCode(92)
    const norm = (f: string) => f.split(sl).join('/')
    const alvo = (f: string) => ((f.startsWith('agents/') || f.startsWith('skills/')) && f.endsWith('.md')) || (f.startsWith('hooks/') && f.endsWith('.cjs'))
    return async () => fs.readdirSync(raiz, { recursive: true }).map(norm)
      .filter((f) => alvo(f) && fs.statSync(`${raiz}/${f}`).isFile())
      .map((f) => ({ caminho: `.claude/${f}`, conteudo: fs.readFileSync(`${raiz}/${f}`, 'utf8') }))
  }

  it('todo agente, skill e hook sai com a marca do cliente e o aviso (Lei 9.609/98) no topo', async () => {
    const m = montar()
    await m.ativar()
    const r = await entregarKit(m.deps, await kitReal(), { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'obra-real' })
    expect(r.arquivos.length).toBeGreaterThan(20)
    for (const f of r.arquivos) {
      expect(temAvisoNoTopo(f, r.marca_dagua), f.caminho).toBe(true)
      expect(f.conteudo).toContain('licenciado a Ana')
    }
  })

  it('agentes e skills continuam começando em "---" (frontmatter válido) e hooks mantêm o #! na 1ª linha', async () => {
    const m = montar()
    await m.ativar()
    const r = await entregarKit(m.deps, await kitReal(), { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'obra-real' })
    for (const f of r.arquivos.filter((x) => x.caminho.startsWith('.claude/agents/') || x.caminho.endsWith('/SKILL.md'))) {
      expect(f.conteudo.startsWith('---\n') || f.conteudo.startsWith('---\r\n'), f.caminho).toBe(true)
      expect(f.conteudo.split(/\r?\n/)[1].startsWith('# Software proprietário'), f.caminho).toBe(true)
    }
    for (const f of r.arquivos.filter((x) => x.caminho.endsWith('.cjs'))) {
      if (f.conteudo.includes('#!/usr/bin/env')) expect(f.conteudo.startsWith('#!'), f.caminho).toBe(true)
    }
  })

  it('shebang continua na 1ª linha e o aviso vem logo abaixo', async () => {
    const m = montar()
    await m.ativar()
    const k: CarregarKit = async () => [{ caminho: '.claude/hooks/x.cjs', conteudo: '#!/usr/bin/env node\nconsole.log(1)\n' }]
    const r = await entregarKit(m.deps, k, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'o' })
    const l = r.arquivos[0].conteudo.split('\n')
    expect(l[0]).toBe('#!/usr/bin/env node')
    expect(l[1]).toContain('Lei 9.609/98')
  })

  it('temAvisoNoTopo recusa arquivo sem aviso, com a marca de outro cliente ou com o aviso só no fim', async () => {
    const m = montar()
    const marca = await marcaDagua(m.deps, 'l1')
    expect(temAvisoNoTopo({ caminho: 'a.md', conteudo: '# Arquiteto' }, marca)).toBe(false)
    expect(temAvisoNoTopo({ caminho: 'a.md', conteudo: `<!-- Lei 9.609/98 ${await marcaDagua(m.deps, 'l2')} -->\nx` }, marca)).toBe(false)
    expect(temAvisoNoTopo({ caminho: 'a.md', conteudo: `1\n2\n3\n4\n<!-- Lei 9.609/98 ${marca} -->` }, marca)).toBe(false)
    expect(temAvisoNoTopo({ caminho: 'a.json', conteudo: JSON.stringify({ a: 1, _licenca: 'Lei 9.609/98', _marca: marca }) }, marca)).toBe(false)
  })
})

// Pedido do Luiz (22/11/2026): a entrega em produção só libera depois dos 7 dias de arrependimento (CDC art. 49).
// Paga: a partir de comprada_em + 7 dias. Teste grátis: nunca. Cortesia do gestor: na hora.
describe('/entregar-kit: entrega em produção só depois do 8º dia', () => {
  const kitComEntrega: CarregarKit = async () => [
    { caminho: '.claude/skills/construir/SKILL.md', conteudo: '---\nname: construir\ndescription: Constrói.\n---\n# Construir' },
    { caminho: '.claude/skills/entregar/SKILL.md', conteudo: '---\nname: entregar\ndescription: Entrega /entregar.\n---\n# Entregar de verdade' },
    { caminho: '.claude/skills/entregar/extra.md', conteudo: '# passo a passo do deploy' },
    { caminho: '.claude/agents/implantador.md', conteudo: '---\nname: implantador\ndescription: Põe no ar.\ntools: Bash\n---\n# Implantador' },
    { caminho: '.claude/agents/corretor.md', conteudo: '---\nname: corretor\ndescription: Lojas.\ntools: Bash\n---\n# Corretor' },
    { caminho: '.claude/agents/qa.md', conteudo: '---\nname: qa\ndescription: Revisa.\ntools: Read\n---\n# QA' },
  ]
  const DIA = 24 * 3600_000
  const pedir = (m: ReturnType<typeof montar>) => entregarKit(m.deps, kitComEntrega, { email, computador_hash: H1, token_dispositivo: TOKEN, obra_id: 'obra-1' })
  const caminhos = (r: Awaited<ReturnType<typeof pedir>>) => r.arquivos.map((f) => f.caminho)
  const ENTREGA_REAL = ['.claude/skills/entregar/extra.md', '.claude/agents/implantador.md', '.claude/agents/corretor.md']

  it('paga, dentro dos 7 dias: sai sem implantador, corretor e entrega real; a skill entregar avisa a data', async () => {
    const m = montar()
    Object.assign(m.store.licencas[0], { tipo: 'paga', comprada_em: new Date('2026-11-18T12:00:00Z') })
    await m.ativar()
    m.avancar(6 * DIA)
    const r = await pedir(m)
    for (const c of ENTREGA_REAL) expect(caminhos(r)).not.toContain(c)
    expect(caminhos(r)).toContain('.claude/agents/qa.md')
    expect(caminhos(r)).toContain('.claude/skills/construir/SKILL.md')
    const ent = r.arquivos.find((f) => f.caminho === '.claude/skills/entregar/SKILL.md')!
    expect(ent.conteudo).not.toContain('Entregar de verdade')
    expect(ent.conteudo).toMatch(/name: entregar/)
    expect(ent.conteudo).toContain('/entregar')
    expect(ent.conteudo).toContain('25/11/2026')
    expect(temAvisoNoTopo(ent, r.marca_dagua)).toBe(true)
    expect(r.entrega).toEqual({ liberada: false, libera_em: '2026-11-25T12:00:00.000Z', motivo: 'arrependimento' })
  })

  it('paga, a partir do 8º dia: sai completo', async () => {
    const m = montar()
    Object.assign(m.store.licencas[0], { tipo: 'paga', comprada_em: new Date('2026-11-18T12:00:00Z') })
    await m.ativar()
    m.avancar(7 * DIA)
    const r = await pedir(m)
    for (const c of ENTREGA_REAL) expect(caminhos(r)).toContain(c)
    expect(r.arquivos.find((f) => f.caminho === '.claude/skills/entregar/SKILL.md')!.conteudo).toContain('Entregar de verdade')
    expect(r.entrega).toEqual({ liberada: true, libera_em: '2026-11-25T12:00:00.000Z', motivo: 'paga' })
  })

  it('teste grátis: nunca entrega em produção', async () => {
    const m = montar()
    Object.assign(m.store.licencas[0], { tipo: 'cortesia', origem: 'degustacao', validade_em: new Date('2026-12-30T12:00:00Z') })
    await m.ativar()
    const r = await pedir(m)
    for (const c of ENTREGA_REAL) expect(caminhos(r)).not.toContain(c)
    const ent = r.arquivos.find((f) => f.caminho === '.claude/skills/entregar/SKILL.md')!
    expect(ent.conteudo).toMatch(/teste grátis/i)
    expect(r.entrega).toEqual({ liberada: false, libera_em: null, motivo: 'degustacao' })
  })

  it('cortesia do gestor: libera na hora', async () => {
    const m = montar()
    Object.assign(m.store.licencas[0], { tipo: 'cortesia', origem: null, validade_em: new Date('2026-12-30T12:00:00Z') })
    await m.ativar()
    const r = await pedir(m)
    for (const c of ENTREGA_REAL) expect(caminhos(r)).toContain(c)
    expect(r.entrega).toEqual({ liberada: true, libera_em: null, motivo: 'cortesia' })
  })

  it('paga sem data de compra gravada (licença antiga): não trava quem já pagou', async () => {
    const m = montar()
    await m.ativar()
    const r = await pedir(m)
    for (const c of ENTREGA_REAL) expect(caminhos(r)).toContain(c)
    expect(r.entrega).toEqual({ liberada: true, libera_em: null, motivo: 'paga' })
  })
})
