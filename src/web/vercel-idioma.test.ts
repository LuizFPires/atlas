// M31: a localização só decide na primeira visita, só na página de vendas, nunca para robôs de busca, e a escolha
// guardada (cookie atlas_idioma) sempre vence.
import { readFileSync } from 'node:fs'

type Cond = { type: string; key?: string; value?: string }
type Regra = { source: string; has?: Cond[]; missing?: Cond[]; destination: string; permanent: boolean }
const cfg = JSON.parse(readFileSync(`${process.cwd()}/vercel.json`, 'utf8')) as { redirects: Regra[] }

test('só duas regras, as duas na página de vendas e temporárias', () => {
  expect(cfg.redirects).toHaveLength(2)
  for (const r of cfg.redirects) { expect(r.source).toBe('/'); expect(r.permanent).toBe(false) }
})

test('a escolha guardada e os robôs de busca nunca são redirecionados', () => {
  for (const r of cfg.redirects) {
    expect(r.missing).toEqual(expect.arrayContaining([{ type: 'cookie', key: 'atlas_idioma' }]))
    const bot = r.missing?.find((c) => c.key === 'user-agent')
    expect(new RegExp(bot!.value!).test('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(new RegExp(bot!.value!).test('Mozilla/5.0 (Windows NT 10.0) Chrome/130')).toBe(false)
  }
})

test('fora do Brasil no .app.br vai para o .com; no Brasil pelo .com vai para o .app.br', () => {
  const [fora, dentro] = cfg.redirects
  expect(fora.destination).toBe('https://www.use-atlas-ai.com/')
  expect(fora.missing).toEqual(expect.arrayContaining([{ type: 'header', key: 'x-vercel-ip-country', value: 'BR' }]))
  expect(dentro.destination).toBe('https://atlas-ia.app.br/')
  expect(dentro.has).toEqual(expect.arrayContaining([{ type: 'header', key: 'x-vercel-ip-country', value: 'BR' }]))
})

test('quem veio pela bandeira do .com (?idioma=pt) não volta para o .com', () => {
  expect(cfg.redirects[0].missing).toEqual(expect.arrayContaining([{ type: 'query', key: 'idioma' }]))
})
