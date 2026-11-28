// M33 — o notebook executando os pedidos que vêm do celular (o Claude é sempre o do cliente, aqui no computador).
import { criarExecutorRemoto, criarMemoriaRemotoFixture, type CanalRemoto, type PedidoRemoto, type ProjetoRemoto } from './celular-remoto'
import { criarObrasFixture } from './ponte-obras'
import { criarPrototipoFixture } from './ponte-prototipo'
import { criarEstiloFixture } from './ponte-estilo'
import { criarBatismoFixture } from './ponte-batismo'
import { criarConstrucaoFixture, criarModoObraFixture } from './ponte-construcao'
import { criarPainelFixture } from './ponte-painel'
import { criarArquivosFixture } from './ponte-arquivos'
import type { ObraStatus } from '../web/obras-status'
import { criarTestarFixture } from './ponte-testar'
import type { ResumoTesteCelular } from './teste-celular'

const JPG = 'data:image/jpeg;base64,/9j/4AAQ'
const relato = 'Tenho uma barbearia com 3 cadeiras e a agenda vive dando horário duplicado no caderno.'

function montar(fila: PedidoRemoto[][] = []) {
  const respostas: Array<{ id: string; estado: string; mensagem: string }> = []
  const projetos: Array<{ obra: string; p: ProjetoRemoto; documento?: string }> = []
  const status: ObraStatus[][] = []
  const sinais: Array<string | null> = []
  const canal: CanalRemoto = {
    async sinal(ocupado) { sinais.push(ocupado); return fila.shift() ?? [] },
    async responder(id, estado, mensagem) { respostas.push({ id, estado, mensagem }) },
    async projeto(obra, p, documento) { projetos.push({ obra, p: structuredClone(p), documento }) },
    async referencia() { return JPG },
    async status(obras) { status.push(obras) },
  }
  const modos = criarModoObraFixture()
  const imagens: Array<{ pasta: string; nome: string }> = []
  const arquivos = { ...criarArquivosFixture(), async guardarImagem(pasta: string, nome: string) { imagens.push({ pasta, nome }); return { nome: `${nome}.jpg`, caminho: 'x' } } }
  const pontes = {
    obras: criarObrasFixture(), prototipo: criarPrototipoFixture(), estilo: criarEstiloFixture(), batismo: criarBatismoFixture(),
    construcao: criarConstrucaoFixture(modos), modos, painel: criarPainelFixture(), arquivos,
  }
  const memoria = criarMemoriaRemotoFixture()
  const ex = criarExecutorRemoto(pontes, canal, memoria, { intervaloProgressoMs: 5 })
  return { ex, canal, respostas, projetos, status, sinais, pontes, memoria, imagens }
}

const pedido = (p: Partial<PedidoRemoto> & Pick<PedidoRemoto, 'tipo'>): PedidoRemoto => ({ id: 'a'.repeat(32), obra_id: 'c0123456789abcdef', dados: {}, criado_em: '2026-11-23T10:00:00Z', ...p })
const obraNova = (extra: Record<string, unknown> = {}) => pedido({ tipo: 'obra_nova', dados: { relato, visual: { modo: 'sugere', observacao: 'azul e dourado', cores: ['#10233B'], referencias: [] }, ...extra } })

test('obra nova: cria a pasta, escolhe o estilo, desenha a partir do relato e publica as telas navegáveis', async () => {
  const { ex, respostas, projetos, memoria, pontes } = montar([[obraNova()]])
  await ex.batida()
  await ex.ocioso()
  const ligada = memoria.ler()['c0123456789abcdef']
  expect(ligada.pasta).toBeTruthy()
  expect((await pontes.prototipo.estado(ligada.pasta)).versoes).toHaveLength(1)
  const fases = projetos.map((p) => p.p.fase)
  expect(fases[0]).toBe('desenhando')
  expect(fases[fases.length - 1]).toBe('telas_prontas')
  const final = projetos[projetos.length - 1]
  expect(final.documento).toMatch(/^<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'/)
  expect(final.p.progresso.telas.every((t) => t.pronta)).toBe(true)
  expect(respostas).toEqual([{ id: 'a'.repeat(32), estado: 'feito', mensagem: '' }])
})

test('obra nova com fotos do celular: baixa cada foto para a pasta da obra antes de pedir o estilo', async () => {
  const { ex, imagens, respostas } = montar([[obraNova({ visual: { modo: 'prints', observacao: 'gostei da agenda', cores: [], referencias: ['b'.repeat(32), 'c'.repeat(32)] } })]])
  await ex.batida(); await ex.ocioso()
  expect(imagens.map((i) => i.nome)).toEqual(['celular-1', 'celular-2'])
  expect(respostas[0].estado).toBe('feito')
})

test('ajuste falado vira versão nova; aprovar as telas traz 3 nomes; o nome escolhido batiza; construir começa a obra', async () => {
  const id = (n: number) => String(n).repeat(32)
  const { ex, respostas, projetos, pontes, memoria } = montar([
    [obraNova()],
    [pedido({ id: id(1), tipo: 'ajuste', dados: { texto: 'deixa o botão de marcar maior' } })],
    [pedido({ id: id(2), tipo: 'aprovar_telas' })],
    [pedido({ id: id(3), tipo: 'nome', dados: { nome: 'Navalha' } })],
    [pedido({ id: id(4), tipo: 'construir', dados: { modo: 'auto' } })],
  ])
  for (let i = 0; i < 5; i++) { await ex.batida(); await ex.ocioso() }
  expect(respostas.map((r) => r.estado)).toEqual(['feito', 'feito', 'feito', 'feito', 'feito'])
  const pasta = memoria.ler()['c0123456789abcdef'].pasta
  expect((await pontes.prototipo.estado(pasta)).versoes).toHaveLength(2)
  const comNomes = projetos.find((p) => p.p.fase === 'nomes_prontos')!
  expect(comNomes.p.nomes).toHaveLength(3)
  expect(projetos.some((p) => p.p.fase === 'pronto_para_construir' && p.p.nome === 'Navalha')).toBe(true)
  expect(projetos[projetos.length - 1].p.fase).toBe('construindo')
  expect(await pontes.modos.ler(pasta)).toBe('automatico')
})

test('pausar e continuar a obra pelo celular', async () => {
  const id = (n: number) => String(n).repeat(32)
  const { ex, respostas, pontes, memoria } = montar([[pedido({ id: id(5), tipo: 'pausar' })], [pedido({ id: id(6), tipo: 'continuar' })]])
  memoria.gravar({ c0123456789abcdef: { pasta: 'barbearia', nome: 'Barbearia' } })
  await ex.batida(); await ex.ocioso(); await ex.batida(); await ex.ocioso()
  expect(respostas.map((r) => r.estado)).toEqual(['feito', 'feito'])
  expect(pontes.painel.chamadas).toEqual(['pausar', 'continuar'])
})

// Achado em 26/11/2026 (Eduardo): obra criada no notebook aparece no celular com o id = nome da pasta. "Pausar" pelo celular
// caía em "não está neste notebook" e a obra continuava trabalhando, sem aviso.
test('pausar e continuar pelo celular uma obra criada no notebook (o id é a pasta)', async () => {
  const id = (n: number) => String(n).repeat(32)
  const { ex, respostas, pontes } = montar([[pedido({ id: id(5), tipo: 'pausar', obra_id: 'orcamento-de-obra' })], [pedido({ id: id(6), tipo: 'continuar', obra_id: 'orcamento-de-obra' })]])
  await pontes.obras.criarSubpasta('orcamento de obra')
  await ex.batida(); await ex.ocioso(); await ex.batida(); await ex.ocioso()
  expect(respostas.map((r) => r.estado)).toEqual(['feito', 'feito'])
  expect(pontes.painel.chamadas).toEqual(['pausar', 'continuar'])
})

test('o celular recebe o andamento logo que muda (a cada 30 s), sem reenviar o que não mudou', async () => {
  const { STATUS_MS } = await import('./celular-remoto')
  expect(STATUS_MS).toBeLessThanOrEqual(30_000)
  const { ex, status, pontes } = montar()
  await pontes.obras.criarSubpasta('barbearia')
  await ex.publicarStatus()
  await ex.publicarStatus()
  expect(status.length).toBe(1)
})

test('o andamento vai para o celular com 2 casas decimais (igual ao notebook)', async () => {
  const { ex, status, pontes } = montar()
  await pontes.obras.criarSubpasta('barbearia')
  const ler = pontes.painel.ler.bind(pontes.painel)
  pontes.painel.ler = async (pasta: string) => ({ ...(await ler(pasta)), pct: 2.7234 })
  await ex.publicarStatus()
  expect(status[0][0].percentual).toBe(2.72)
})

test('pedido de uma obra que este notebook não conhece: responde erro em palavras simples, sem travar a fila', async () => {
  const { ex, respostas } = montar([[pedido({ id: '1'.repeat(32), tipo: 'ajuste', obra_id: 'c9999999999999999', dados: { texto: 'x' } }), pedido({ id: '2'.repeat(32), tipo: 'pausar', obra_id: 'c9999999999999999' })]])
  await ex.batida(); await ex.ocioso()
  expect(respostas).toEqual([
    { id: '1'.repeat(32), estado: 'erro', mensagem: expect.stringContaining('não está neste notebook') },
    { id: '2'.repeat(32), estado: 'erro', mensagem: expect.stringContaining('não está neste notebook') },
  ])
})

test('o mesmo pedido entregue de novo (reentrega do servidor) não roda duas vezes', async () => {
  const p = obraNova()
  const { ex, respostas } = montar([[p], [p]])
  await ex.batida(); await ex.batida(); await ex.ocioso()
  expect(respostas).toHaveLength(1)
})

test('enquanto trabalha, o sinal avisa o celular do que está fazendo', async () => {
  const { ex, sinais } = montar([[obraNova()]])
  await ex.batida()
  await ex.batida()
  await ex.ocioso()
  await ex.batida()
  expect(sinais[0]).toBeNull()
  expect(sinais[1]).toBe('Desenhando as telas')
  expect(sinais[2]).toBeNull()
})

test('status das obras: publica um resumo de cada obra com PLAN (sem caminho nem código)', async () => {
  const { ex, status, memoria, pontes } = montar()
  const { pasta } = await pontes.obras.criarSubpasta('Agenda da Barbearia')
  memoria.gravar({ c0123456789abcdef: { pasta, nome: 'Navalha' } })
  await ex.publicarStatus()
  expect(status).toHaveLength(1)
  const o = status[0][0]
  expect(o).toMatchObject({ id: 'c0123456789abcdef', nome: 'Navalha', estado: expect.stringMatching(/construindo|pausada|aguardando_aprovacao|pronta/) })
  expect(o.percentual).toBeGreaterThanOrEqual(0)
  expect(JSON.stringify(o)).not.toMatch(/Users|\\\\|Obras/)
})

// Achado em 26/11/2026 (Eduardo): entre uma parte e outra, por um instante, ninguém está trabalhando, e o celular dizia "Parada"
// com "Continuar a obra" enquanto o notebook seguia sozinho. "Parada" é só quando a pessoa pausou.
test('ninguém trabalhando por um instante (o Atlas religa sozinho): o celular vê "construindo", não "parada"', async () => {
  const { ex, status, pontes } = montar()
  await pontes.obras.criarSubpasta('barbearia')
  pontes.painel.simular.semNinguem()
  await ex.publicarStatus()
  expect(status[0][0]).toMatchObject({ estado: 'construindo', ativa_agora: false })
  expect(status[0][0].ultima_noticia).toMatch(/religa sozinho/)
})

test('pausada pela pessoa: aí sim o celular vê "pausada"', async () => {
  const { ex, status, pontes } = montar()
  await pontes.obras.criarSubpasta('barbearia')
  await pontes.painel.pausar('barbearia')
  await ex.publicarStatus()
  expect(status[0][0].estado).toBe('pausada')
})

// M58: a foto do celular para a Ajuda: o notebook baixa a foto e entrega à Ajuda; o pedido responde "feito".
test('foto_ajuda: baixa a foto e entrega à Ajuda do notebook', async () => {
  const { ex, respostas, pontes } = montar([[pedido({ tipo: 'foto_ajuda', obra_id: 'ajuda', dados: { referencia: 'b'.repeat(32) } })]])
  const recebidas: string[] = []
  ;(pontes as { aoFotoAjuda?: (d: string) => void }).aoFotoAjuda = (d) => { recebidas.push(d) }
  await ex.batida()
  await ex.ocioso()
  await new Promise((r) => setTimeout(r, 20))
  expect(recebidas).toEqual([JPG])
  expect(respostas.at(-1)).toEqual(expect.objectContaining({ estado: 'feito' }))
})

// Testar a ideia pelo celular (Luiz, 28/11/2026).
describe('testar a ideia pelo celular', () => {
  async function comTeste(fila: PedidoRemoto[][]) {
    const m = montar(fila)
    const testar = criarTestarFixture()
    const testes: Array<{ obra: string; r: ResumoTesteCelular }> = []
    m.canal.teste = async (obra, r) => { testes.push({ obra, r: structuredClone(r) }) }
    const pasta = (await m.pontes.obras.criarSubpasta('Ponto')).pasta
    const ex = criarExecutorRemoto({ ...m.pontes, testar }, m.canal, m.memoria, { intervaloProgressoMs: 5 })
    return { ...m, ex, testar, testes, pasta }
  }

  test('testar: começa o teste na obra do computador com os mesmos agentes do último e publica o resumo', async () => {
    const t = await comTeste([])
    const ini = vi.spyOn(t.testar, 'iniciar')
    const ex = criarExecutorRemoto({ ...t.pontes, testar: t.testar }, { ...t.canal, sinal: (() => { let v = true; return async () => (v ? (v = false, [pedido({ tipo: 'testar', obra_id: t.pasta, dados: { quantidade: 250, mesmos: true } })]) : []) })() }, t.memoria)
    await ex.batida(); await ex.ocioso()
    expect(ini).toHaveBeenCalledWith(t.pasta, { quantidade: 250, mesmosDe: 1, versao: null })
    expect(t.respostas).toEqual([{ id: 'a'.repeat(32), estado: 'feito', mensagem: '' }])
    expect(t.testes.at(-1)!.obra).toBe(t.pasta)
    expect(t.testes.at(-1)!.r.testes.map((x) => x.n)).toEqual([2, 1])
  })

  test('testar com um teste já rodando (dois toques ou reentrega): não começa outro', async () => {
    const t = await comTeste([])
    await t.testar.iniciar(t.pasta, { quantidade: 100 })
    const ini = vi.spyOn(t.testar, 'iniciar')
    const ex = criarExecutorRemoto({ ...t.pontes, testar: t.testar }, { ...t.canal, sinal: async () => [pedido({ tipo: 'testar', obra_id: t.pasta, dados: { quantidade: 500, mesmos: false } })] }, t.memoria)
    await ex.batida(); await ex.ocioso()
    expect(ini).not.toHaveBeenCalled()
  })

  test('entrevistar: pergunta ao agente, publica a resposta e deixa a batida rápida por uns minutos', async () => {
    const t = await comTeste([])
    const ex = criarExecutorRemoto({ ...t.pontes, testar: t.testar }, { ...t.canal, sinal: (() => { let v = true; return async () => (v ? (v = false, [pedido({ tipo: 'entrevistar', obra_id: t.pasta, dados: { teste: 1, agente: 'a3', pergunta: 'Por que não usaria?' } })]) : []) })() }, t.memoria)
    expect(ex.rapido()).toBe(false)
    await ex.batida(); await ex.ocioso()
    expect(ex.rapido()).toBe(true)
    const ultimo = t.testes.at(-1)!.r
    expect(ultimo.entrevistas['1'].a3.map((m) => m.de)).toEqual(['voce', 'agente'])
    expect(ultimo.cenas['1'].agentes.some((a) => a.id === 'a3')).toBe(true) // quem foi entrevistado sempre vai na amostra
  })

  test('sem o teste neste notebook: responde com frase de leigo', async () => {
    const m = montar([[pedido({ tipo: 'testar', obra_id: 'ponto', dados: { quantidade: 100 } })]])
    await m.ex.batida(); await m.ex.ocioso()
    expect(m.respostas[0]).toEqual({ id: 'a'.repeat(32), estado: 'erro', mensagem: 'Este notebook ainda não tem o teste da ideia. Atualize o Atlas no computador.' })
  })

  test('ideias do teste numa obra do computador: só cria a versão nova do protótipo e responde com ela', async () => {
    const t = await comTeste([])
    await t.pontes.prototipo.desenhar(t.pasta, 'Ponto', null, 'relato')
    const ex = criarExecutorRemoto({ ...t.pontes, testar: t.testar }, { ...t.canal, sinal: (() => { let v = true; return async () => (v ? (v = false, [pedido({ tipo: 'ajuste', obra_id: t.pasta, dados: { texto: '- Bater ponto sem internet' } })]) : []) })() }, t.memoria)
    await ex.batida(); await ex.ocioso()
    expect(t.respostas.at(-1)).toEqual({ id: 'a'.repeat(32), estado: 'feito', mensagem: 'versao:2' })
    expect(t.projetos).toEqual([]) // obra do computador não vira "projeto" no celular
  })

  test('publicarTestes: sobe só as obras com teste e não repete o que não mudou', async () => {
    const t = await comTeste([])
    await t.ex.publicarTestes()
    await t.ex.publicarTestes()
    expect(t.testes.map((x) => x.obra)).toEqual([t.pasta])
  })
})

test('entrevista que falha no notebook (cota do Claude): o celular recebe o código para explicar do mesmo jeito do computador', async () => {
  const m = montar([[pedido({ tipo: 'entrevistar', obra_id: 'ponto', dados: { teste: 1, agente: 'a3', pergunta: 'oi' } })]])
  const testar = { ...criarTestarFixture(), entrevistar: async () => { throw new Error('claude-cota') } }
  await m.pontes.obras.criarSubpasta('ponto')
  const ex = criarExecutorRemoto({ ...m.pontes, testar }, m.canal, m.memoria)
  await ex.batida(); await ex.ocioso()
  expect(m.respostas[0]).toEqual({ id: 'a'.repeat(32), estado: 'erro', mensagem: 'codigo:claude-cota' })
})
