import { montarNavegavel } from './ponte-prototipo'

const telas = [
  { id: 'inicio', nome: 'Início', html: '<a href="#tela-agenda">Agenda</a><a href="#tela-exportar">Exportar</a><a href="#">Nada</a><a href="https://x.test">fora</a>' },
  { id: 'agenda', nome: 'Agenda', html: '<a href="#tela-inicio">Voltar</a>' },
]

test('botão para uma tela que ainda não foi desenhada leva a um aviso (em vez de não fazer nada)', () => {
  const doc = montarNavegavel(telas, 'inicio')!
  expect(doc).toContain('<section id="tela-falta"')
  expect(doc).toContain('Esta parte ainda não foi desenhada')
  expect(doc).toContain('href="#tela-falta">Exportar')
  expect(doc).toContain('href="#tela-falta">Nada')
  expect(doc).toContain('href="#tela-falta">fora')
  expect(doc).toContain('href="#tela-agenda">Agenda')
})

test('"Onde dá para tocar?": acende tudo que leva a outra tela, dentro de cada tela', () => {
  const sem = montarNavegavel(telas, 'inicio')!
  const com = montarNavegavel(telas, 'inicio', { realce: true })!
  expect(sem).not.toContain('outline: 3px solid')
  expect(com.match(/outline: 3px solid #C6F135/g)?.length).toBe(2) // um <style> em cada tela (o CSS não atravessa o shadow root)
})
