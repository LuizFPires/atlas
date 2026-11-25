// M46: o Atlas roda no Mac. As telas dizem as palavras do computador do cliente (Finder ou Explorador, Lixeira, cofre…).
import { afterEach, expect, test } from 'vitest'
import { ehMac, palavras } from './plataforma'

afterEach(() => { delete (window as unknown as { atlasDesktop?: unknown }).atlasDesktop })

test('sem dizer nada (ou no Windows), as palavras são as do Windows', () => {
  expect(ehMac()).toBe(false)
  expect(palavras().cofre).toMatch(/Windows/)
})

test('no Mac, as palavras são as do Mac e a tampa não tem ajuste (só o aviso)', () => {
  ;(window as unknown as { atlasDesktop: { plataforma: string } }).atlasDesktop = { plataforma: 'mac' }
  expect(ehMac()).toBe(true)
  const p = palavras()
  expect(p.cofre).toMatch(/Mac/)
  expect(p.lixeira).toBe('a Lixeira')
  expect(p.abrirComOSistema).toMatch(/Itens de Início/)
  expect(p.ajustaTampa).toBe(false)
})
