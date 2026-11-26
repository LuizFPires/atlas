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

test('"Onde dá para tocar?": bolinha piscando só no que leva a uma tela que existe, dentro de cada tela', () => {
  const sem = montarNavegavel(telas, 'inicio')!
  const com = montarNavegavel(telas, 'inicio', { realce: true })!
  expect(sem).not.toContain('@keyframes at-toque')
  expect(com.match(/@keyframes at-toque/g)?.length).toBe(2) // um <style> em cada tela (o CSS não atravessa o shadow root)
  expect(com).toContain(':not([href="#tela-falta"])::after') // o que ainda não foi desenhado fica sem bolinha
})

// Luiz, 24/11/2026: o protótipo cresce além de 40 telas e "não pode travar, em hipótese alguma". Antes, o navegável parava em ~1 MB
// (umas 35-40 telas premium) e a navegação sumia com "tela grande demais".
test('protótipo grande (120 telas de 30 KB) continua navegável', async () => {
  const { MAX_NAVEGAVEL } = await import('./ponte-prototipo')
  const grande = Array.from({ length: 120 }, (_, i) => ({ id: `t${i}`, nome: `T${i}`, html: `<main><a href="#tela-t${(i + 1) % 120}">próxima</a>${'x'.repeat(30_000)}</main>` }))
  const doc = montarNavegavel(grande, 't0')
  expect(doc).not.toBeNull()
  expect(doc!).toContain('id="tela-t119"')
  expect(MAX_NAVEGAVEL).toBeGreaterThanOrEqual(30_000_000)
})

// M35 (P1Computador): "Voltar" e o caminho (Início › Equipe) acima da prévia. O documento só conta ao Atlas qual tela está aberta;
// o script é o NOSSO, com nonce sorteado a cada montagem: o HTML das telas continua sem poder rodar script nenhum.
describe('prévia que avisa a tela aberta (Voltar e caminho)', () => {
  test('sem aviso: nada de script, CSP igual', () => {
    const doc = montarNavegavel(telas, 'inicio')!
    expect(doc).not.toContain('<script')
    expect(doc).not.toContain('script-src')
  })
  test('com aviso: um script só, com o nonce, antes das telas; a CSP só libera esse nonce', () => {
    const doc = montarNavegavel(telas, 'inicio', { avisar: 'abcDEF0123456789xyz' })!
    expect(doc).toContain("script-src 'nonce-abcDEF0123456789xyz'")
    expect(doc.match(/<script/g)?.length).toBe(1)
    expect(doc.indexOf('<script nonce="abcDEF0123456789xyz">')).toBeLessThan(doc.indexOf('<section'))
    expect(doc).toContain("tipo:'atlas:tela'")
    expect(doc).toContain('["inicio","agenda"]')
  })
  test('script das telas continua bloqueado: nonce inválido é recusado e o HTML da tela não ganha o nonce', () => {
    expect(() => montarNavegavel(telas, 'inicio', { avisar: 'x"><script>' })).toThrow('nonce-invalido')
    const mal = [{ id: 'inicio', nome: 'Início', html: '<script>alert(1)</script>' }]
    const doc = montarNavegavel(mal, 'inicio', { avisar: 'abcDEF0123456789xyz' })!
    expect(doc).toContain('<script>alert(1)</script>') // sem nonce: a CSP barra
    expect(doc.match(/nonce="/g)?.length).toBe(1)
  })
})
