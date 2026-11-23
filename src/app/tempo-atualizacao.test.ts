import { descreverDownload } from './tempo-atualizacao'

const MB = 1024 * 1024

test('no comecinho, sem dado para estimar: diz que está calculando', () => {
  expect(descreverDownload({ baixados: 0, total: 100 * MB, inicio: 1000, agora: 1500 })).toEqual({ pct: 0, falta: 'calculando o tempo…' })
})

test('na metade em 30 s: 50% e falta cerca de 1 minuto (inclui uns 20 s de instalação)', () => {
  expect(descreverDownload({ baixados: 50 * MB, total: 100 * MB, inicio: 0, agora: 30_000 })).toEqual({ pct: 50, falta: 'falta cerca de 1 minuto' })
})

test('perto do fim: menos de 1 minuto; devagar: arredonda em minutos', () => {
  expect(descreverDownload({ baixados: 95 * MB, total: 100 * MB, inicio: 0, agora: 60_000 }).falta).toBe('falta menos de 1 minuto')
  expect(descreverDownload({ baixados: 10 * MB, total: 100 * MB, inicio: 0, agora: 30_000 })).toEqual({ pct: 10, falta: 'falta cerca de 5 minutos' })
})

test('dado estranho não quebra a barra', () => {
  expect(descreverDownload({ baixados: 200, total: 100, inicio: 0, agora: 10_000 }).pct).toBe(100)
  expect(descreverDownload({ baixados: 10, total: 0, inicio: 0, agora: 10_000 }).pct).toBe(0)
})
