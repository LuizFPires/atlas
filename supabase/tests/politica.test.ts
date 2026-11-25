// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { entregarKit } from '../functions/_shared/kit.ts'
import { decidirPolitica, painelPolitica, pedirAnalise, registrarPolitica, situacaoDaObra, situacaoPolitica } from '../functions/_shared/politica.ts'
import { H1, H2, montar, TOKEN } from './helpers.ts'

const email = 'ana@loja.com'
const auth = { email, computador_hash: H1, token_dispositivo: TOKEN }
const kit = async () => [{ caminho: '.claude/agents/a.md', conteudo: '# A' }]

function comAdmin(m: ReturnType<typeof montar>) {
  return { ...m.deps, emailsAdmin: ['luiz@atlas.com'], autenticarPortal: async (jwt: string) => (jwt === 'jwt-luiz' ? { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' } : null) } as never
}

describe('política: o Atlas não constrói outro Atlas', () => {
  it('1º bloqueio só registra; o 2º da MESMA obra embarga só aquela obra', async () => {
    const m = montar(); await m.ativar()
    expect((await registrarPolitica(m.deps, { ...auth, obra_id: 'tarefas', onde: 'ideia', texto: 'robôs que constroem apps' })).situacao).toBe('livre')
    expect((await registrarPolitica(m.deps, { ...auth, obra_id: 'outra', onde: 'ideia', texto: 'x' })).situacao).toBe('livre')
    expect((await registrarPolitica(m.deps, { ...auth, obra_id: 'tarefas', onde: 'posobra', texto: 'agentes que programam' })).situacao).toBe('embargada')
    expect((await situacaoPolitica(m.deps, { ...auth, obra_id: 'outra' })).situacao).toBe('livre')
  })

  it('obra embargada não recebe o kit (as outras recebem)', async () => {
    const m = montar(); await m.ativar()
    await registrarPolitica(m.deps, { ...auth, obra_id: 'tarefas', onde: 'ideia', texto: 'a' })
    await registrarPolitica(m.deps, { ...auth, obra_id: 'tarefas', onde: 'ideia', texto: 'b' })
    await expect(entregarKit(m.deps, kit, { ...auth, obra_id: 'tarefas' })).rejects.toMatchObject({ codigo: 'obra_embargada', status: 423 })
    await expect(entregarKit(m.deps, kit, { ...auth, obra_id: 'barbearia' })).resolves.toBeTruthy()
  })

  it('pedido de análise não conta como bloqueio e vai ao painel', async () => {
    const m = montar(); await m.ativar()
    await registrarPolitica(m.deps, { ...auth, obra_id: 'escola', onde: 'ideia', texto: 'gerador de folhas' })
    await pedirAnalise(m.deps, { ...auth, obra_id: 'escola', texto: 'É para a minha escola, não constrói software.' })
    expect((await situacaoPolitica(m.deps, { ...auth, obra_id: 'escola' })).situacao).toBe('livre')
    const p = await painelPolitica(comAdmin(m), 'jwt-luiz')
    expect(p.casos[0]).toMatchObject({ obra_id: 'escola', bloqueios: 1, analise: 'É para a minha escola, não constrói software.' })
  })

  it('a equipe decide: liberar zera a contagem; recusar fecha a licença inteira', async () => {
    const m = montar(); await m.ativar()
    for (const t of ['a', 'b']) await registrarPolitica(m.deps, { ...auth, obra_id: 'tarefas', onde: 'ideia', texto: t })
    const adm = comAdmin(m)
    await decidirPolitica(adm, 'jwt-luiz', { licenca_id: 'l1', obra_id: 'tarefas', decisao: 'liberar' })
    m.avancar(1000)
    expect((await registrarPolitica(m.deps, { ...auth, obra_id: 'tarefas', onde: 'posobra', texto: 'c' })).situacao).toBe('livre')
    await decidirPolitica(adm, 'jwt-luiz', { licenca_id: 'l1', obra_id: 'tarefas', decisao: 'recusar' })
    await expect(entregarKit(m.deps, kit, { ...auth, obra_id: 'outra-obra' })).rejects.toMatchObject({ codigo: 'uso_recusado' })
    await expect(decidirPolitica(adm, 'jwt-falso', { licenca_id: 'l1', obra_id: 'tarefas', decisao: 'liberar' })).rejects.toBeTruthy()
    await expect(decidirPolitica(adm, 'jwt-luiz', { licenca_id: 'l1', obra_id: 'tarefas', decisao: 'apagar' })).rejects.toMatchObject({ codigo: 'decisao_invalida' })
  })

  it('só o computador ativo registra; texto com segredo é limpo; obra/onde inválidos são recusados', async () => {
    const m = montar(); await m.ativar()
    await expect(registrarPolitica(m.deps, { ...auth, computador_hash: H2, obra_id: 'x', onde: 'ideia', texto: 'a' })).rejects.toMatchObject({ codigo: 'nao_autorizado' })
    await expect(registrarPolitica(m.deps, { ...auth, obra_id: '../x', onde: 'ideia', texto: 'a' })).rejects.toMatchObject({ codigo: 'obra_invalida' })
    await expect(registrarPolitica(m.deps, { ...auth, obra_id: 'x', onde: 'engano', texto: 'a' })).rejects.toMatchObject({ codigo: 'politica_invalida' })
    await registrarPolitica(m.deps, { ...auth, obra_id: 'x', onde: 'ideia', texto: 'minha chave sk_live_abcdefghijk123' })
    expect(m.store.eventosDaPolitica[0].texto).not.toContain('sk_live_abcdefghijk123')
  })

  it('situacaoDaObra: recusa da licença vence; mantida continua embargada', () => {
    const s = (obra_id: string, situacao: 'embargada' | 'liberada' | 'mantida' | 'recusada') => ({ licenca_id: 'l1', obra_id, situacao, desde: new Date(), decidido_por: null })
    expect(situacaoDaObra([s('a', 'mantida')], 'a')).toBe('embargada')
    expect(situacaoDaObra([s('a', 'liberada')], 'a')).toBe('livre')
    expect(situacaoDaObra([s('*', 'recusada')], 'b')).toBe('recusada')
  })
})
