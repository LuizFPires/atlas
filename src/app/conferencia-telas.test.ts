import { conferirTelas } from './conferencia-telas'

const t = (id: string, nome: string, html: string, aparelho: 'celular' | 'computador' = 'celular') => ({ id, nome, html, aparelho })

test('acha botão que leva a tela que não existe, largura fixa maior que o aparelho e letra miúda', () => {
  const r = conferirTelas([
    t('inicio', 'Início', '<a href="#tela-agenda">ok</a><a href="#tela-estoque">Estoque</a><a href="#tela-relatorio">Relatório</a><div style="width:520px">x</div><p style="font-size:9px">miúda</p>'),
    t('agenda', 'Agenda', '<a href="#tela-inicio">Voltar</a>'),
    t('painel', 'Painel', '<div style="width:1100px">cabe</div>', 'computador'),
  ])
  expect(r.map((p) => p.tipo)).toEqual(['sem-destino', 'largura', 'letra'])
  expect(r[0]).toMatchObject({ tela: 'Início', texto: 'Botões que ainda não levam a nada: Estoque, Relatório.' })
  expect(r[1].texto).toMatch(/mais larga que o celular/)
})

test('tudo certo: nenhum ponto', () => {
  expect(conferirTelas([t('a', 'A', '<a href="#tela-a">a</a><p style="font-size:14px">ok</p>')])).toEqual([])
})
