// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { abrirLink, AVISO_ABRA_NO_COMPUTADOR, ehCelular, reenviarParaComputador } from '../functions/_shared/abertura.ts'
import type { BoasVindas, DepsCadastro } from '../functions/_shared/cadastro.ts'
import { gerarLink, VALIDADE_LINK_MS } from '../functions/_shared/links.ts'
import { montarPag } from './helpers-pagamento.ts'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

function pronto() {
  const m = montarPag()
  m.store.clientes[0].empresa = 'Loja da Ana'
  m.store.clientes[0].ramo = 'roupas'
  const enviados: Array<{ email: string; dados: BoasVindas }> = []
  const falha = { envio: false }
  const deps: DepsCadastro = { ...m.deps, enviarBoasVindas: async (email, dados) => { if (falha.envio) throw new Error('fora'); enviados.push({ email, dados }) } }
  return { m, deps, enviados, falha }
}

describe('detecção de celular', () => {
  it('user-agent móvel ou tela estreita = celular; computador não', () => {
    expect(ehCelular(IPHONE)).toBe(true)
    expect(ehCelular('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36')).toBe(true)
    expect(ehCelular(WINDOWS)).toBe(false)
    expect(ehCelular(WINDOWS, 390)).toBe(true) // iPad/modo desktop: a tela entrega
    expect(ehCelular(WINDOWS, 1440)).toBe(false)
    expect(ehCelular(null, null)).toBe(false)
  })
})

describe('abrir o link de instalação', () => {
  it('no celular mostra o aviso e NÃO consome o link; no computador abre sem aviso', async () => {
    const { m, deps } = pronto()
    const { token } = await gerarLink(deps, 'ana@loja.com')
    const cel = await abrirLink(deps, { token, user_agent: IPHONE })
    expect(cel).toMatchObject({ celular: true, aviso: AVISO_ABRA_NO_COMPUTADOR, pode_reenviar: true })
    expect(cel.aviso).toContain('computador onde você vai construir')
    expect(m.store.links[0].usado_em).toBeFalsy()
    expect(await abrirLink(deps, { token, user_agent: WINDOWS, largura: 1440 })).toMatchObject({ celular: false, aviso: null })
  })
  it('link vencido, usado ou desconhecido dá erro claro', async () => {
    const { m, deps } = pronto()
    const { token } = await gerarLink(deps, 'ana@loja.com')
    m.avancar(VALIDADE_LINK_MS + 1)
    await expect(abrirLink(deps, { token })).rejects.toMatchObject({ codigo: 'link_expirado' })
    await expect(abrirLink(deps, { token: 'nada' })).rejects.toMatchObject({ codigo: 'link_invalido' })
  })
})

describe('Enviar para o meu computador', () => {
  it('manda link novo ao e-mail da compra e o link do celular deixa de valer', async () => {
    const { m, deps, enviados } = pronto()
    const { token } = await gerarLink(deps, 'ana@loja.com')
    await reenviarParaComputador(deps, { token })
    expect(enviados).toHaveLength(1)
    expect(enviados[0].email).toBe('ana@loja.com')
    expect(enviados[0].dados.token).not.toBe(token)
    await expect(abrirLink(deps, { token })).rejects.toMatchObject({ codigo: 'link_usado' })
    await expect(abrirLink(deps, { token: enviados[0].dados.token })).resolves.toMatchObject({ valido: true })
    expect(m.store.links.filter((l) => !l.usado_em)).toHaveLength(1)
  })
  it('limita pedidos e, se o e-mail não sai, não deixa link solto', async () => {
    const { m, deps, enviados, falha } = pronto()
    let token = (await gerarLink(deps, 'ana@loja.com')).token
    falha.envio = true
    await expect(reenviarParaComputador(deps, { token })).rejects.toMatchObject({ codigo: 'email_nao_enviado', status: 502 })
    expect(m.store.links.every((l) => l.usado_em)).toBe(true)
    falha.envio = false
    token = (await gerarLink(deps, 'ana@loja.com')).token
    await reenviarParaComputador(deps, { token })
    token = enviados[0].dados.token
    await reenviarParaComputador(deps, { token })
    token = enviados[1].dados.token
    await expect(reenviarParaComputador(deps, { token })).rejects.toMatchObject({ codigo: 'muitas_solicitacoes', status: 429 })
  })
})
