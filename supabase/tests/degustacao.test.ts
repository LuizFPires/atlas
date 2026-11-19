// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { lerEmailsAdmin } from '../functions/_shared/admin.ts'
import { sha256 } from '../functions/_shared/cripto.ts'
import { hashEmail } from '../functions/_shared/degustacao.ts'
import { type DepsDegustacao, normalizarEmail } from '../functions/_shared/degustacao.ts'
import { tratar } from '../functions/_shared/http.ts'
import { verificar } from '../functions/_shared/verificar.ts'
import { chamar, comDoisClientes, JWT_ANA } from './helpers-portal.ts'
import { H1, montar, TOKEN } from './helpers.ts'

const DIA = 24 * 3600_000
const JWT_LUIZ = 'jwt-luiz'

/** Servidor limpo (sem clientes) + admin + enviador de e-mail de fixture. */
function montarDegustacao() {
  const m = montar()
  m.store.clientes.length = 0
  m.store.licencas.length = 0
  const enviados: Array<{ email: string; token: string; dias: number }> = []
  const falha = { ligada: false }
  const degustacao: DepsDegustacao = {
    ...m.deps,
    enviarConfirmacaoDegustacao: async (email, d) => {
      if (falha.ligada) throw new Error('smtp')
      enviados.push({ email, token: d.token, dias: d.dias })
    },
  }
  const admin = { ...m.deps, autenticarPortal: async (jwt: string) => (jwt === JWT_LUIZ ? { auth_user_id: 'auth-luiz', email: 'luiz@atlas.com' } : null), emailsAdmin: lerEmailsAdmin('luiz@atlas.com') }
  const ctx = { deps: m.deps, degustacao, admin, carregarKit: async () => { throw new Error('x') }, autorizarServico: () => false }
  const postar = (rota: string, ip: string, corpo: object) =>
    tratar(ctx, new Request(`https://x.test${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(corpo) }))
  const pedirDe = (email: unknown, ip: string) => postar('/degustacao/pedir', ip, { email })
  const confirmar = (token: string, ip = '99.0.0.1') => postar('/degustacao/confirmar', ip, { token })
  const estado = () => postar('/degustacao/estado', '99.0.0.2', {})
  const config = (corpo: object) => chamar(ctx, '/admin/degustacao', JWT_LUIZ, corpo)
  return { ...m, enviados, falha, ctx, pedirDe, confirmar, estado, config, postar }
}
const ligada = async () => { const a = montarDegustacao(); await a.config({ ativa: true }); return a }
const erro = async (r: Response) => (await r.json()).erro

describe('degustação — liga/desliga', () => {
  it('nasce desligada: estado público ativa=false e pedido recusado, sem e-mail e sem registro', async () => {
    const a = montarDegustacao()
    expect(await (await a.estado()).json()).toMatchObject({ ativa: false })
    const r = await a.pedirDe('ana@exemplo.com', '2.2.2.2')
    expect(r.status).toBe(409)
    expect(await erro(r)).toBe('oferta_desligada')
    expect(a.enviados).toHaveLength(0)
    expect(a.store.degustacoes).toHaveLength(0)
  })

  it('só admin liga; ligar muda o estado público e fica registrado; dias de 1 a 30', async () => {
    const a = montarDegustacao()
    expect((await chamar(a.ctx, '/admin/degustacao', 'jwt-qualquer', { ativa: true })).status).toBe(401)
    expect((await chamar(a.ctx, '/admin/degustacao', null, { ativa: true })).status).toBe(401)
    expect(a.store.config.ativa).toBe(false)
    expect((await a.config({ ativa: true, dias: 7 })).status).toBe(200)
    expect(await (await a.estado()).json()).toMatchObject({ ativa: true, dias: 7 })
    expect(a.store.ocorrencias.some((o) => o.tipo === 'degustacao_config' && o.autor === 'luiz@atlas.com')).toBe(true)
    expect(await erro(await a.config({ dias: 0 }))).toBe('dias_invalidos')
    expect(await erro(await a.config({ dias: 31 }))).toBe('dias_invalidos')
    expect(await erro(await a.config({ ativa: 'sim' }))).toBe('config_invalida')
    expect(await (await a.config({})).json()).toMatchObject({ ativa: true, dias: 7 }) // leitura
  })

  it('cliente comum logado no portal não mexe na config', async () => {
    const m = await comDoisClientes()
    const admin = { ...m.deps, autenticarPortal: m.deps.autenticarPortal, emailsAdmin: lerEmailsAdmin('luiz@atlas.com') }
    expect((await chamar(m.ctx({ admin }), '/admin/degustacao', JWT_ANA, { ativa: true })).status).toBe(403)
  })

  it('desligar depois do pedido barra a confirmação', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '3.3.3.3')
    await a.config({ ativa: false })
    expect(await erro(await a.confirmar(a.enviados[0].token))).toBe('oferta_desligada')
    expect(a.store.licencas).toHaveLength(0)
  })
})

describe('degustação — pedido e confirmação', () => {
  it('pedido NÃO cria licença; só o clique cria teste de 5 dias (cortesia, sem gateway)', async () => {
    const a = await ligada()
    const r = await a.pedirDe('  Ana@Exemplo.COM ', '4.4.4.4')
    expect(r.status).toBe(200)
    expect(a.enviados).toHaveLength(1)
    expect(a.enviados[0]).toMatchObject({ email: 'ana@exemplo.com', dias: 5 })
    expect(a.store.licencas).toHaveLength(0)
    expect(a.store.clientes).toHaveLength(0)
    expect(JSON.stringify(a.store.degustacoes)).not.toContain(a.enviados[0].token) // só o hash

    const c = await a.confirmar(a.enviados[0].token)
    expect(c.status).toBe(200)
    const corpo = await c.json()
    expect(corpo).toMatchObject({ ok: true, dias: 5 })
    expect(typeof corpo.link_token).toBe('string')
    const lic = a.store.licencas[0]
    expect(lic).toMatchObject({ tipo: 'cortesia', status: 'ativa' })
    expect(lic.validade_em!.getTime()).toBe(a.deps.agora().getTime() + 5 * DIA)
    expect(lic.conta_gateway_id ?? null).toBeNull()
    expect(a.store.clientes[0].email_compra).toBe('ana@exemplo.com')
  })

  it('o link é de uso único e token inventado é recusado', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '4.4.4.4')
    const t = a.enviados[0].token
    expect((await a.confirmar(t)).status).toBe(200)
    expect(await erro(await a.confirmar(t))).toBe('link_usado')
    expect(a.store.licencas).toHaveLength(1)
    expect(await erro(await a.confirmar('x'.repeat(43)))).toBe('token_invalido')
    expect(await erro(await a.confirmar('curto'))).toBe('token_invalido')
  })

  it('o link vence em 48 h; pedir de novo renova e o link antigo morre', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '4.4.4.4')
    a.avancar(49 * 3600_000)
    expect(await erro(await a.confirmar(a.enviados[0].token))).toBe('link_expirado')
    expect(a.store.licencas).toHaveLength(0)
    await a.pedirDe('ana@exemplo.com', '4.4.4.4')
    expect(await erro(await a.confirmar(a.enviados[0].token))).toBe('token_invalido')
    expect((await a.confirmar(a.enviados[1].token)).status).toBe(200)
  })

  it('/verificar libera durante o teste (mesmo caminho de ativação) e barra após os 5 dias', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '4.4.4.4')
    const c = await (await a.confirmar(a.enviados[0].token)).json()
    expect(c.link_token).toBeTruthy()
    await a.store.inserirAtivacao(a.store.licencas[0].id, H1, a.deps.agora(), await sha256(TOKEN))
    const v = () => verificar(a.deps, { email: 'ana@exemplo.com', computador_hash: H1, token_dispositivo: TOKEN })
    expect(await v()).toMatchObject({ pode_construir: true, motivo: 'ok' })
    a.avancar(4 * DIA)
    expect(await v()).toMatchObject({ pode_construir: true })
    a.avancar(DIA + 1000)
    expect(await v()).toMatchObject({ pode_construir: false, motivo: 'cortesia_expirada' })
    expect(a.store.licencas[0].status).toBe('cancelada')
  })

  it('quem já tem licença (paga ou cortesia) não ganha outra', async () => {
    const a = await ligada()
    a.store.clientes.push({ id: 'cp', email_compra: 'paga@x.com', nome_tratamento: 'P' })
    a.store.licencas.push({ id: 'lp', cliente_id: 'cp', status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, tipo: 'paga' })
    const r = await a.pedirDe('paga@x.com', '5.5.5.5')
    expect(r.status).toBe(409)
    expect(await erro(r)).toBe('ja_tem_conta')
    expect(a.enviados).toHaveLength(0)
    // pedido feito ANTES de a pessoa ganhar cortesia do gestor: a confirmação não cria segunda licença
    await a.pedirDe('cort@x.com', '5.5.5.6')
    await a.store.criarCortesia({ email: 'cort@x.com', nome: 'C', validade_em: new Date(a.deps.agora().getTime() + 10 * DIA), agora: a.deps.agora() })
    const antes = a.store.licencas.length
    expect(await erro(await a.confirmar(a.enviados[0].token))).toBe('ja_tem_conta')
    expect(a.store.licencas).toHaveLength(antes)
  })

  it('falha no envio do e-mail é erro honesto (502)', async () => {
    const a = await ligada()
    a.falha.ligada = true
    expect((await a.pedirDe('ana@exemplo.com', '6.6.6.6')).status).toBe(502)
    expect(a.store.licencas).toHaveLength(0)
  })

  it('e-mail inválido (regex, tipo, tamanho)', async () => {
    const a = await ligada()
    for (const e of ['sem-arroba', 42, null, `${'a'.repeat(250)}@x.com`]) {
      const r = await a.pedirDe(e, '7.7.7.7')
      expect(r.status).toBe(400)
      expect(await erro(r)).toBe('email_invalido')
    }
  })
})

describe('degustação — anti-abuso', () => {
  it('normaliza gmail: pontos e +tag contam como o mesmo; outros provedores só lower/trim', () => {
    expect(normalizarEmail('voce+1@gmail.com')).toBe('voce@gmail.com')
    expect(normalizarEmail('v.o.ce@GMAIL.com')).toBe('voce@gmail.com')
    expect(normalizarEmail('v.o.ce+x@googlemail.com')).toBe('voce@gmail.com')
    expect(normalizarEmail(' A.B+c@Empresa.com.br ')).toBe('a.b+c@empresa.com.br')
  })

  it('1 degustação por pessoa: +tag e pontos no gmail não dão outra depois da confirmada', async () => {
    const a = await ligada()
    await a.pedirDe('voce@gmail.com', '8.8.8.1')
    expect((await a.confirmar(a.enviados[0].token)).status).toBe(200)
    for (const [i, e] of ['voce+1@gmail.com', 'v.o.ce@gmail.com', 'VOCE@googlemail.com', 'voce@gmail.com'].entries()) {
      a.avancar(61 * 60_000) // fora da janela do limite por e-mail: aqui o freio testado é o de 1 por pessoa
      const r = await a.pedirDe(e, `8.8.8.${10 + i}`)
      expect(r.status, e).toBe(409)
      expect(['ja_usou_degustacao', 'ja_tem_conta']).toContain(await erro(r))
    }
    expect(a.enviados).toHaveLength(1)
    expect(a.store.licencas).toHaveLength(1)
  })

  it('variações do mesmo gmail antes de confirmar dividem UM pedido; só o último link vale e só 1 licença nasce', async () => {
    const a = await ligada()
    await a.pedirDe('voce+1@gmail.com', '8.8.9.1')
    await a.pedirDe('v.o.ce@gmail.com', '8.8.9.2')
    expect(a.store.degustacoes).toHaveLength(1)
    expect(await erro(await a.confirmar(a.enviados[0].token))).toBe('token_invalido')
    expect((await a.confirmar(a.enviados[1].token)).status).toBe(200)
    expect(a.store.licencas).toHaveLength(1)
  })

  it('domínio descartável é recusado (lista base, subdomínio e lista extensível), com recado calmo', async () => {
    const a = await ligada()
    for (const e of ['x@mailinator.com', 'x@GuerrillaMail.com', 'x@10minutemail.com', 'x@sub.yopmail.com']) {
      const r = await a.pedirDe(e, '9.9.9.1')
      expect(r.status, e).toBe(400)
      const c = await r.json()
      expect(c.erro).toBe('dominio_descartavel')
      expect(c.mensagem).not.toMatch(/fraude|abuso|bloquead/i)
    }
    a.store.dominiosExtras.add('lixo-novo.xyz')
    expect(await erro(await a.pedirDe('x@lixo-novo.xyz', '9.9.9.1'))).toBe('dominio_descartavel')
    expect(a.enviados).toHaveLength(0)
    expect((await a.pedirDe('x@empresa.com.br', '9.9.9.2')).status).toBe(200)
  })

  it('rate limit por IP no pedido (5/h) e por e-mail (3/h); outro IP segue livre', async () => {
    const a = await ligada()
    for (let i = 0; i < 5; i++) expect((await a.pedirDe(`pessoa${i}@exemplo.com`, '10.0.0.1')).status).toBe(200)
    expect((await a.pedirDe('pessoa9@exemplo.com', '10.0.0.1')).status).toBe(429)
    expect((await a.pedirDe('pessoa9@exemplo.com', '10.0.0.2')).status).toBe(200)
    for (let i = 0; i < 3; i++) expect((await a.pedirDe('mesma@exemplo.com', `10.0.1.${i}`)).status).toBe(200)
    expect((await a.pedirDe('mesma@exemplo.com', '10.0.1.9')).status).toBe(429)
    a.avancar(61 * 60_000)
    expect((await a.pedirDe('mesma@exemplo.com', '10.0.1.9')).status).toBe(200)
  })

  it('rate limit por IP na confirmação (adivinhar token)', async () => {
    const a = await ligada()
    for (let i = 0; i < 20; i++) expect((await a.confirmar('z'.repeat(43), '11.0.0.1')).status).toBe(404)
    expect((await a.confirmar('z'.repeat(43), '11.0.0.1')).status).toBe(429)
  })

  it('a ativação continua 1 computador por licença: o teste não ativa em dois computadores', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '12.0.0.1')
    await a.confirmar(a.enviados[0].token)
    const lic = a.store.licencas[0]
    await a.store.inserirAtivacao(lic.id, H1, a.deps.agora(), 'h')
    await expect(a.store.inserirAtivacao(lic.id, 'c'.repeat(64), a.deps.agora(), 'h2')).rejects.toThrow()
  })
})

describe('degustação — LGPD e corrida (migration 0017)', () => {
  it('o dedup guarda só o hash do e-mail normalizado (sem texto cru do normalizado)', async () => {
    const a = await ligada()
    await a.pedirDe('Voce.X+1@gmail.com', '13.0.0.1')
    const linha = a.store.degustacoes[0]
    expect(linha.email_hash).toBe(await hashEmail('segredo-de-teste', 'vocex@gmail.com'))
    expect(JSON.stringify(linha)).not.toContain('vocex@gmail.com')
  })

  it('confirmada nunca é reaberta por novo pedido (token e estado intactos)', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '13.0.0.2')
    await a.confirmar(a.enviados[0].token)
    const antes = { ...a.store.degustacoes[0] }
    a.avancar(61 * 60_000)
    expect((await a.pedirDe('ana@exemplo.com', '13.0.0.3')).status).toBe(409)
    expect(a.store.degustacoes[0]).toEqual(antes)
    expect(a.enviados).toHaveLength(1)
  })

  it('excluir a conta zera e-mail e ip da degustação, invalida o token e mantém o anti-repetição', async () => {
    const a = await ligada()
    await a.pedirDe('ana@exemplo.com', '13.0.0.4')
    const token = a.enviados[0].token
    await a.confirmar(token)
    await a.store.excluirConta(a.store.clientes[0].id, a.deps.agora())
    expect(a.store.degustacoes[0]).toMatchObject({ email: null, ip: null, status: 'confirmada' })
    expect(a.store.degustacoes[0].email_hash).toBe(await hashEmail('segredo-de-teste', 'ana@exemplo.com'))
    a.avancar(61 * 60_000)
    expect(await erro(await a.pedirDe('ana@exemplo.com', '13.0.0.5'))).toBe('ja_usou_degustacao')
    // pendente + exclusão: token morre
    await a.pedirDe('bia@exemplo.com', '13.0.0.6')
    a.store.clientes.push({ id: 'cb', email_compra: 'bia@exemplo.com', nome_tratamento: 'B' })
    await a.store.excluirConta('cb', a.deps.agora())
    expect(await erro(await a.confirmar(a.enviados[1].token))).toBe('token_invalido')
  })

  it('limpeza periódica zera só o ip de linhas antigas e exige segredo de serviço', async () => {
    const a = await ligada()
    await a.pedirDe('velha@exemplo.com', '13.0.1.1')
    a.avancar(31 * DIA)
    await a.pedirDe('nova@exemplo.com', '13.0.1.2')
    expect((await a.postar('/degustacao/limpar-ips', '1.1.1.1', {})).status).toBe(401)
    expect(await a.store.limparIpsDegustacao(a.deps.agora(), 30)).toBe(1)
    const ips = a.store.degustacoes.map((d) => d.ip)
    expect(ips).toEqual([null, '13.0.1.2'])
    const comServico = { ...a.ctx, autorizarServico: () => true }
    const r = await tratar(comServico, new Request('https://x.test/degustacao/limpar-ips', { method: 'POST', body: '{}' }))
    expect(await r.json()).toMatchObject({ ok: true, limpos: 0 })
  })
})

describe('degustação — hash com chave e conta existente normalizada', () => {
  it('o hash depende do segredo do servidor e é separado por domínio', async () => {
    const h = await hashEmail('segredo-de-teste', 'vocex@gmail.com')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toBe(await sha256('vocex@gmail.com'))
    expect(h).not.toBe(await hashEmail('outro-segredo', 'vocex@gmail.com'))
  })

  it('quem já tem conta em voce@gmail.com não fura com voce+1@gmail.com', async () => {
    const a = await ligada()
    a.store.clientes.push({ id: 'cg', email_compra: 'voce@gmail.com', nome_tratamento: 'V' })
    a.store.licencas.push({ id: 'lg', cliente_id: 'cg', status: 'ativa', pausa_prevista_em: null, troca_liberada_em: null, tipo: 'paga' })
    const r = await a.pedirDe('voce+1@gmail.com', '14.0.0.1')
    expect(r.status).toBe(409)
    expect(await erro(r)).toBe('ja_tem_conta')
    expect(a.enviados).toHaveLength(0)
  })
})
