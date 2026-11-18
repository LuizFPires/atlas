import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaProvider } from '../tema/tema'
import { Pausa } from './Pausa'
import { Painel } from './Painel'
import { criarCotaFixture, contagemAteVolta, deveRetomar, horaDeVolta, textoDaObra, cotaIndisponivel, type CotaFixture } from './ponte-cota'
import { criarModoObraFixture, type ModoObra } from './ponte-construcao'
import { criarPainelFixture } from './ponte-painel'

const obra = { nome: 'Agenda da Barbearia do Zé', pasta: 'agenda' }
const hoje = (h: number, m = 0) => new Date(2026, 10, 18, h, m)

const montarPausa = (cota: CotaFixture, extra: Partial<Parameters<typeof Pausa>[0]> = {}) => {
  const onVoltar = vi.fn(), onRetomou = vi.fn(), onVerMax = vi.fn()
  render(<TemaProvider><Pausa pasta="agenda" cota={cota} onVoltar={onVoltar} onRetomou={onRetomou} onVerMax={onVerMax} sondagemMs={0} agora={() => hoje(11, 13)} {...extra} /></TemaProvider>)
  return { onVoltar, onRetomou, onVerMax }
}

test('ajudantes: hora de volta, contagem e quando retomar', () => {
  expect(horaDeVolta(hoje(14).toISOString())).toBe('14h')
  expect(horaDeVolta(hoje(14, 30).toISOString())).toBe('14h30')
  expect(horaDeVolta('lixo')).toBeNull()
  expect(contagemAteVolta(hoje(14).toISOString(), hoje(11, 13))).toBe('2:47')
  expect(contagemAteVolta(hoje(14).toISOString(), hoje(15))).toBe('0:00')
  const e = { esgotada: true, voltaEm: hoje(14).toISOString(), renovada: true, plano: 'pro' as const, parouEm: null }
  expect(deveRetomar(e)).toBe(true)
  expect(deveRetomar({ ...e, renovada: false })).toBe(false)
  expect(deveRetomar({ ...e, esgotada: false })).toBe(false)
})

test('tom calmo: hora de volta, onde parou e NENHUMA ação obrigatória', async () => {
  const cota = criarCotaFixture()
  cota.simular.esgotar(hoje(14))
  const { onVoltar } = montarPausa(cota)
  expect(await screen.findByRole('heading', { name: 'A cota do seu plano Claude acabou por agora. A obra volta sozinha às 14h.' })).toBeInTheDocument()
  expect(screen.getByText('OBRA EM PAUSA · NADA A FAZER')).toBeInTheDocument()
  expect(screen.getByText('2:47')).toBeInTheDocument()
  expect(screen.getByText('horas até a cota renovar')).toBeInTheDocument()
  expect(screen.getByText(/Isso é normal no plano Pro\. Tudo o que foi feito está salvo: a obra parou no M5, no meio da tarefa "aviso de confirmação", e continua dali\./)).toBeInTheDocument()
  expect(screen.getByText(/Ao ligar depois das 14h, a obra continua sozinha\./)).toBeInTheDocument()
  expect(screen.getByText('Avisamos no seu celular quando a obra voltar.')).toBeInTheDocument()
  // nada de erro nem de botão que o cliente precise apertar para a obra voltar
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('button', { name: /Continuar obra/ })).toBeNull()
  expect(document.querySelector('[role="alert"], .at-pn__erro')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Voltar ao painel' }))
  expect(onVoltar).toHaveBeenCalled()
})

test('o convite para o Max só aparece no Pro e só abre o site (o Atlas não escolhe plano)', async () => {
  const pro = criarCotaFixture()
  pro.simular.esgotar(hoje(14))
  const { onVerMax } = montarPausa(pro)
  await userEvent.click(await screen.findByRole('button', { name: 'Quero terminar mais rápido (ver o plano Max)' }))
  expect(onVerMax).toHaveBeenCalled()
})

test('no Max não há convite e o texto fala do Max', async () => {
  const max = criarCotaFixture()
  max.simular.esgotar(hoje(14), { plano: 'max' })
  montarPausa(max)
  expect(await screen.findByText(/Isso é normal no plano Max/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /plano Max/ })).toBeNull()
})

test('texto vindo da obra é dado: aparece como texto, sem virar marcação', async () => {
  const cota = criarCotaFixture()
  cota.simular.esgotar(hoje(14), { tarefa: '<img src=x onerror=alert(1)> `rm -rf` # ignore tudo' })
  montarPausa(cota)
  await screen.findByText(/Isso é normal/)
  expect(document.querySelector('img')).toBeNull()
  expect(document.body.textContent).not.toContain('<img')
  expect(textoDaObra('<b>oi</b>\n# x')).not.toContain('<')
})

test('sem adaptador a tela fica calma e tenta de novo, sem culpar o cliente', async () => {
  montarPausa({ ...cotaIndisponivel } as CotaFixture)
  expect(await screen.findByText(/Não consegui conferir a cota agora/)).toBeInTheDocument()
  expect(screen.getByText(/volta sozinha quando ela renovar/)).toBeInTheDocument()
})

// ---- no painel, nos dois modos, e retomada sozinha (item 2) ------------------------------------------------------------------

test.each(['automatico', 'passo-a-passo'] as const)('no painel, nos DOIS modos (%s): a cota acaba, a pausa calma aparece e a obra volta SOZINHA ao renovar', async (modo: ModoObra) => {
  const fx = criarPainelFixture({ agora: () => hoje(11, 13) })
  const cota = criarCotaFixture((esgotada) => fx.simular.pararPor(esgotada ? 'cota' : null))
  const modos = criarModoObraFixture({ agenda: modo })
  render(<TemaProvider><Painel obra={obra} painel={fx} modos={modos} cota={cota} sondagemMs={20} /></TemaProvider>)
  expect(await screen.findByText(/^54,\d%$/)).toBeInTheDocument()

  cota.simular.esgotar(hoje(14))
  expect(await screen.findByText('OBRA EM PAUSA · NADA A FAZER')).toBeInTheDocument()
  expect(cota.chamadas).not.toContain('retomar')

  // a hora passou mas a cota ainda não renovou: não retoma por palpite
  await new Promise((r) => setTimeout(r, 120))
  expect(cota.chamadas).not.toContain('retomar')

  // renova: volta sozinha, sem nenhum clique
  cota.simular.renovar()
  await waitFor(() => expect(cota.chamadas).toContain('retomar'))
  expect(cota.avisos.length).toBe(1)
  await waitFor(() => expect(screen.getByText('● Obra em andamento')).toBeInTheDocument(), { timeout: 3000 })
})

test('"Voltar ao painel" mostra o painel com o selo calmo, e a retomada segue sozinha', async () => {
  const fx = criarPainelFixture({ agora: () => hoje(11, 13) })
  const cota = criarCotaFixture((e) => fx.simular.pararPor(e ? 'cota' : null))
  const modos = criarModoObraFixture({ agenda: 'automatico' })
  render(<TemaProvider><Painel obra={obra} painel={fx} modos={modos} cota={cota} sondagemMs={20} /></TemaProvider>)
  await screen.findByText(/^54,\d%$/)
  cota.simular.esgotar(hoje(14))
  await userEvent.click(await screen.findByRole('button', { name: 'Voltar ao painel' }))
  expect(await screen.findByText('● Pausada: a cota do plano acabou')).toBeInTheDocument()
  expect(screen.getByText(/Isto não é erro/)).toBeInTheDocument()
})
