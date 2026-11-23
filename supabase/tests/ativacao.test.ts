// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { confirmarAtivacao, mascararEmail, MAX_TENTATIVAS, solicitarCodigo, solicitarCodigoPeloLink, VALIDADE_CODIGO_MS } from '../functions/_shared/ativacao.ts'
import { gerarLink } from '../functions/_shared/links.ts'
import { H1, H2, montar } from './helpers.ts'

async function preparar() {
  const m = montar()
  const { token } = await gerarLink(m.deps, 'ana@loja.com')
  await solicitarCodigo(m.deps, 'ana@loja.com')
  return { ...m, token, codigo: m.emails[0] }
}

describe('ativação', () => {
  it('envia código de 6 dígitos e ativa o computador', async () => {
    const { deps, store, token, codigo } = await preparar()
    expect(codigo).toMatch(/^\d{6}$/)
    const r = await confirmarAtivacao(deps, { email: 'ana@loja.com', codigo, token, computador_hash: H1 })
    expect(r.licenca_id).toBe('l1')
    expect(store.ativacoes).toHaveLength(1)
    expect(store.links[0].usado_em).not.toBeNull()
  })
  it('não revela e-mail inexistente e não envia nada', async () => {
    const { deps, emails } = montar()
    await expect(solicitarCodigo(deps, 'x@y.com')).resolves.toEqual({ ok: true })
    expect(emails).toHaveLength(0)
  })
  it('link só vale uma vez', async () => {
    const { deps, token, codigo } = await preparar()
    await confirmarAtivacao(deps, { email: 'ana@loja.com', codigo, token, computador_hash: H1 })
    await expect(confirmarAtivacao(deps, { email: 'ana@loja.com', codigo, token, computador_hash: H1 })).rejects.toMatchObject({ codigo: 'link_usado' })
  })
  it('recusa segundo computador com a licença ocupada', async () => {
    const { deps, store, token, codigo } = await preparar()
    await confirmarAtivacao(deps, { email: 'ana@loja.com', codigo, token, computador_hash: H1 })
    const l2 = await gerarLink(deps, 'ana@loja.com')
    await solicitarCodigo(deps, 'ana@loja.com')
    await expect(confirmarAtivacao(deps, { email: 'ana@loja.com', codigo: '000000', token: l2.token, computador_hash: H2 })).rejects.toMatchObject({ codigo: 'outro_computador' })
    expect(store.ativacoes.filter((a) => a.ativo)).toHaveLength(1)
  })
  it('código errado, vencido e bloqueio por tentativas', async () => {
    const a = await preparar()
    const errado = a.codigo === '999999' ? '000000' : '999999'
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      await expect(confirmarAtivacao(a.deps, { email: 'ana@loja.com', codigo: errado, token: a.token, computador_hash: H1 })).rejects.toMatchObject({ codigo: 'codigo_invalido' })
    }
    await expect(confirmarAtivacao(a.deps, { email: 'ana@loja.com', codigo: a.codigo, token: a.token, computador_hash: H1 })).rejects.toMatchObject({ codigo: 'codigo_bloqueado' })
    const b = await preparar()
    b.avancar(VALIDADE_CODIGO_MS + 1)
    await expect(confirmarAtivacao(b.deps, { email: 'ana@loja.com', codigo: b.codigo, token: b.token, computador_hash: H1 })).rejects.toMatchObject({ codigo: 'codigo_invalido' })
  })
  it('rejeita hash de computador malformado', async () => {
    const { deps, token, codigo } = await preparar()
    await expect(confirmarAtivacao(deps, { email: 'ana@loja.com', codigo, token, computador_hash: 'abc' })).rejects.toMatchObject({ codigo: 'computador_invalido' })
  })
})

// Pedido do Luiz (22/11/2026): quem veio pelo link do e-mail não digita o e-mail de novo. O servidor sabe de quem é o link,
// manda o código sozinho e devolve só o e-mail mascarado. O código continua obrigatório (o instalador pode ter sido repassado).
describe('código automático pelo link do e-mail', () => {
  it('manda o código para o e-mail do link e devolve o e-mail mascarado', async () => {
    const m = montar()
    const { token } = await gerarLink(m.deps, 'ana@loja.com')
    const r = await solicitarCodigoPeloLink(m.deps, token, '1.2.3.4')
    expect(r).toEqual({ ok: true, email_mascarado: 'a***@loja.com' })
    expect(m.emails).toHaveLength(1)
    expect(m.emails[0]).toMatch(/^\d{6}$/)
  })

  it('confirma só com o código e o link (sem e-mail) e devolve o e-mail para o app guardar', async () => {
    const m = montar()
    const { token } = await gerarLink(m.deps, 'ana@loja.com')
    await solicitarCodigoPeloLink(m.deps, token, '1.2.3.4')
    const r = await confirmarAtivacao(m.deps, { email: '', codigo: m.emails[0], token, computador_hash: H1 })
    expect(r).toMatchObject({ licenca_id: 'l1', email: 'ana@loja.com' })
    expect(m.store.links[0].usado_em).not.toBeNull()
  })

  it('link usado, vencido ou inexistente: não manda código', async () => {
    const m = montar()
    await expect(solicitarCodigoPeloLink(m.deps, 'x'.repeat(30), '1.2.3.4')).rejects.toMatchObject({ codigo: 'link_invalido' })
    const { token } = await gerarLink(m.deps, 'ana@loja.com')
    m.avancar(49 * 3600_000)
    await expect(solicitarCodigoPeloLink(m.deps, token, '1.2.3.4')).rejects.toMatchObject({ codigo: 'link_expirado' })
    expect(m.emails).toHaveLength(0)
  })

  it('respeita o limite de pedidos por IP', async () => {
    const m = montar()
    const { token } = await gerarLink(m.deps, 'ana@loja.com')
    let erro: unknown = null
    for (let i = 0; i < 20 && !erro; i++) await solicitarCodigoPeloLink(m.deps, token, '9.9.9.9').catch((e) => { erro = e })
    expect(erro).toMatchObject({ codigo: 'muitas_solicitacoes', status: 429 })
  })

  it('máscara do e-mail', () => {
    expect(mascararEmail('ana@loja.com')).toBe('a***@loja.com')
    expect(mascararEmail('appbomdia@gmail.com')).toBe('a***@gmail.com')
    expect(mascararEmail('x@y.com')).toBe('x***@y.com')
  })
})
