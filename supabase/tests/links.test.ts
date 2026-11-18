// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { gerarLink, validarLink, VALIDADE_LINK_MS } from '../functions/_shared/links.ts'
import { montar } from './helpers.ts'

describe('link de instalação', () => {
  it('gera token que expira em 48 h e guarda só o hash', async () => {
    const { deps, store } = montar()
    const r = await gerarLink(deps, ' Ana@Loja.com ')
    expect(r.expira_em.getTime() - deps.agora().getTime()).toBe(VALIDADE_LINK_MS)
    expect(store.links[0].token_hash).not.toContain(r.token)
    await expect(validarLink(deps, r.token)).resolves.toBeTruthy()
  })
  it('expira após 48 h', async () => {
    const { deps, avancar } = montar()
    const r = await gerarLink(deps, 'ana@loja.com')
    avancar(VALIDADE_LINK_MS + 1)
    await expect(validarLink(deps, r.token)).rejects.toMatchObject({ codigo: 'link_expirado' })
  })
  it('recusa token desconhecido, link usado e compra cancelada', async () => {
    const { deps, store } = montar()
    await expect(validarLink(deps, 'x')).rejects.toMatchObject({ codigo: 'link_invalido' })
    const r = await gerarLink(deps, 'ana@loja.com')
    store.links[0].usado_em = new Date()
    await expect(validarLink(deps, r.token)).rejects.toMatchObject({ codigo: 'link_usado' })
    const c = montar('cancelada')
    await expect(gerarLink(c.deps, 'ana@loja.com')).rejects.toMatchObject({ codigo: 'sem_licenca' })
  })
})
