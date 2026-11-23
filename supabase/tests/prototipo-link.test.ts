// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { publicarPrototipo, verPrototipo, VALIDADE_LINK_PROTOTIPO_MS, type ArmazemPrototipos } from '../functions/_shared/prototipo-link.ts'
import { H1, H2, montar, TOKEN } from './helpers.ts'

const email = 'ana@loja.com'
const DOC = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><section id="tela-inicio">oi</section>'
function armazem(): ArmazemPrototipos & { guardados: Map<string, unknown> } {
  const guardados = new Map<string, unknown>()
  return { guardados, guardar: async (t, v) => { guardados.set(t, v) }, ler: async (t) => (guardados.get(t) as never) ?? null }
}
const ORIGEM = 'https://atlas-ia.app.br'

describe('link do protótipo para o celular', () => {
  it('computador com licença: guarda as telas e devolve um link secreto do site, que vale 7 dias', async () => {
    const m = montar(); await m.ativar()
    const a = armazem()
    const r = await publicarPrototipo(m.deps, a, ORIGEM, { email, computador_hash: H1, token_dispositivo: TOKEN, nome: 'Colore', documento: DOC })
    expect(r.url).toMatch(/^https:\/\/atlas-ia\.app\.br\/p\/[A-Za-z0-9_-]{40,}$/)
    expect(new Date(r.expira_em).getTime() - m.deps.agora().getTime()).toBe(VALIDADE_LINK_PROTOTIPO_MS)
    const token = r.url.split('/p/')[1]
    expect(await verPrototipo(m.deps, a, token)).toMatchObject({ nome: 'Colore', documento: DOC })
  })
  it('sem licença ativada neste computador: negado, nada guardado', async () => {
    const m = montar(); await m.ativar()
    const a = armazem()
    await expect(publicarPrototipo(m.deps, a, ORIGEM, { email, computador_hash: H2, token_dispositivo: TOKEN, nome: 'x', documento: DOC })).rejects.toMatchObject({ codigo: 'negado' })
    expect(a.guardados.size).toBe(0)
  })
  it('documento que não é o protótipo do Atlas (sem a proteção) ou grande demais é recusado', async () => {
    const m = montar(); await m.ativar()
    for (const documento of ['<script>alert(1)</script>', `${DOC}${'x'.repeat(2_000_000)}`]) {
      await expect(publicarPrototipo(m.deps, armazem(), ORIGEM, { email, computador_hash: H1, token_dispositivo: TOKEN, nome: 'x', documento })).rejects.toMatchObject({ codigo: 'prototipo_invalido' })
    }
  })
  it('link vencido, inexistente ou malformado: recado claro, nunca o conteúdo', async () => {
    const m = montar(); await m.ativar()
    const a = armazem()
    const r = await publicarPrototipo(m.deps, a, ORIGEM, { email, computador_hash: H1, token_dispositivo: TOKEN, nome: 'Colore', documento: DOC })
    const token = r.url.split('/p/')[1]
    const depois = { ...m.deps, agora: () => new Date(m.deps.agora().getTime() + VALIDADE_LINK_PROTOTIPO_MS + 1000) }
    await expect(verPrototipo(depois, a, token)).rejects.toMatchObject({ codigo: 'link_vencido', status: 410 })
    await expect(verPrototipo(m.deps, a, 'A'.repeat(43))).rejects.toMatchObject({ codigo: 'link_invalido', status: 404 })
    await expect(verPrototipo(m.deps, a, '../x')).rejects.toMatchObject({ codigo: 'link_invalido' })
  })
})
