// @vitest-environment node
import { avisosCedo, escolherCaminhoLoja, traduzirPassoTecnico } from './publicacao'

const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
interface Fs { readFileSync(p: string | URL, e: string): string }

test('PWA é o padrão; TWA só Android; Expo+EAS quando exige iOS ou nativo', () => {
  expect(escolherCaminhoLoja({ lojas: [] })).toBe('pwa')
  expect(escolherCaminhoLoja({ lojas: ['android'] })).toBe('twa')
  expect(escolherCaminhoLoja({ lojas: ['ios'] })).toBe('expo-eas')
  expect(escolherCaminhoLoja({ lojas: ['ios', 'android'] })).toBe('expo-eas')
  expect(escolherCaminhoLoja({ lojas: [], precisaNativo: true })).toBe('expo-eas')
})

test('D-U-N-S e os 12 testadores aparecem cedo, e PWA não assusta com nada', () => {
  expect(avisosCedo('pwa', [])).toEqual([])
  expect(avisosCedo('expo-eas', ['ios', 'android']).join(' ')).toMatch(/D-U-N-S[\s\S]*12 testadores/)
  expect(avisosCedo('twa', ['android']).join(' ')).not.toMatch(/D-U-N-S/)
})

test('passos técnicos do corretor viram palavras de gente', () => {
  const t = traduzirPassoTecnico('Rode eas build e depois envie ao TestFlight com o bundleIdentifier')
  expect(t).not.toMatch(/eas build|TestFlight|bundleIdentifier/i)
  expect(t).toContain('montar o pacote')
})

test('o guia do domínio e o corretor/entregar do kit refletem a decisão de 18/11', async () => {
  const fs = (await mod('node:fs')) as Fs
  const ler = (p: string) => fs.readFileSync(new URL(`../../.claude/${p}`, import.meta.url), 'utf8')
  const guia = ler('skills/entregar/guia-dominio.md')
  expect(guia).toContain('Registro.br')
  expect(guia).toContain('Pix')
  for (const f of ['skills/entregar/SKILL.md', 'agents/corretor.md']) {
    const t = ler(f)
    expect(t).toMatch(/PWA/)
    expect(t).toMatch(/TWA/)
    expect(t).toMatch(/Expo/)
  }
  expect(ler('skills/entregar/SKILL.md')).toContain('guia-dominio.md')
})
