// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cadastrar, type BoasVindas, type DepsCadastro } from '../functions/_shared/cadastro.ts'
import { montarBoasVindas } from '../functions/_shared/emails.ts'
import { type Contexto, tratar } from '../functions/_shared/http.ts'
import { ErroRegra } from '../functions/_shared/tipos.ts'
import { sha256 } from '../functions/_shared/cripto.ts'
import { montarPag } from './helpers-pagamento.ts'

const SID = 'cs_test_a1B2c3D4e5'

function pronto(pago = true, sessaoPaga = true) {
  const m = montarPag()
  const enviados: Array<{ email: string; dados: BoasVindas }> = []
  const falha = { envio: false }
  const deps: DepsCadastro = {
    ...m.deps,
    enviarBoasVindas: async (email, dados) => {
      if (falha.envio) throw new Error('e-mail fora do ar')
      enviados.push({ email, dados })
    },
  }
  m.store.licencas[0].conta_gateway_id = 'conta-1'
  m.store.sessoes.push({ conta_gateway_id: 'conta-1', sessao_id: SID, email: 'ana@loja.com', paga: sessaoPaga })
  if (pago) m.store.pagamentos.push({ licenca_id: 'l1', conta_gateway_id: 'conta-1', tipo: 'implantacao', valor: 4800, status: 'pago', gateway_ref: 'pi_1', gateway_pi: 'pi_1', pago_em: m.deps.agora() })
  return { m, deps, enviados, falha }
}
const pedido = { session_id: SID, nome: ' Zé ', empresa: 'Barbearia do Zé', ramo: 'Barbearia: corte e barba', email: 'Ana@Loja.com' }

describe('cadastro pós-pagamento', () => {
  it('compra de app pronto: devolve o segmento comprado (leva ao configurador)', async () => {
    const { m, deps } = pronto()
    m.store.pagamentos[0].segmento = 'academia'
    expect(await cadastrar(deps, pedido)).toMatchObject({ ok: true, segmento: 'academia' })
  })
  it('grava as 4 respostas, gera link de uso único e manda o acesso para o e-mail da COMPRA', async () => {
    const { m, deps, enviados } = pronto()
    expect(await cadastrar(deps, pedido)).toEqual({ ok: true, enviado_para: 'a***@loja.com', email_diferente: false, segmento: null })
    expect(m.store.clientes[0]).toMatchObject({ nome_tratamento: 'Zé', empresa: 'Barbearia do Zé', ramo: 'Barbearia: corte e barba' })
    expect(m.store.clientes[0].cadastro_em).toBeInstanceOf(Date)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].email).toBe('ana@loja.com')
    expect(m.store.links[0].token_hash).toBe(await sha256(enviados[0].dados.token))
    const { assunto, texto } = montarBoasVindas({ ...enviados[0].dados, link_instalacao: `https://atlas-ia.app.br/instalar?t=${enviados[0].dados.token}` })
    expect(assunto).toContain('Zé')
    expect(texto).toContain('Barbearia do Zé')
    expect(texto).toContain('Ajuda do Atlas')
    expect(texto).not.toMatch(/atendente|equipe de suporte|ligue/i)
  })
  it('guarda cidade + UF informadas (UF em maiúsculas); cadastro sem os dois campos continua valendo', async () => {
    const a = pronto()
    await cadastrar(a.deps, { ...pedido, cidade: ' São  Paulo ', uf: 'sp' })
    expect(a.m.store.clientes[0]).toMatchObject({ cidade: 'São Paulo', uf: 'SP' })
    const b = pronto()
    await cadastrar(b.deps, pedido)
    expect(b.m.store.clientes[0]).toMatchObject({ cidade: null, uf: null })
  })
  it('recusa UF fora das 27, cidade esquisita e cidade sem UF (e não grava nada)', async () => {
    for (const [extra, codigo] of [[{ cidade: 'Recife', uf: 'XX' }, 'uf_invalida'], [{ cidade: 'Rua <b>1</b>', uf: 'PE' }, 'cidade_invalida'], [{ cidade: 'Recife' }, 'uf_obrigatoria']] as const) {
      const a = pronto()
      await expect(cadastrar(a.deps, { ...pedido, ...extra })).rejects.toMatchObject({ codigo, status: 400 })
      expect(a.m.store.clientes[0].cadastro_em).toBeFalsy()
      expect(a.enviados).toHaveLength(0)
    }
  })
  it('e-mail digitado diferente é só informativo: o acesso vai para o e-mail da compra', async () => {
    const { deps, enviados } = pronto()
    const r = await cadastrar(deps, { ...pedido, email: 'atacante@evil.com' })
    expect(r).toMatchObject({ ok: true, email_diferente: true })
    expect(enviados[0].email).toBe('ana@loja.com')
  })
  it('sem session_id válido o cadastro é negado e nada é gravado nem enviado', async () => {
    const { m, deps, enviados } = pronto()
    for (const sid of [undefined, '', 42, 'cs_naoexiste12345', 'ana@loja.com', 'x'.repeat(500)]) {
      await expect(cadastrar(deps, { ...pedido, session_id: sid })).rejects.toMatchObject({ codigo: 'cadastro_indisponivel', status: 404 })
    }
    // só saber o e-mail da compra não basta
    await expect(cadastrar(deps, { nome: 'Zé', ramo: 'x', email: 'ana@loja.com' })).rejects.toMatchObject({ codigo: 'cadastro_indisponivel' })
    expect(enviados).toHaveLength(0)
    expect(m.store.clientes[0].cadastro_em).toBeFalsy()
  })
  it('sem prova, a resposta é a MESMA para estados diferentes (sem compra, cancelada, estornada, já cadastrado)', async () => {
    const ok = pronto()
    await cadastrar(ok.deps, pedido) // agora o e-mail "já se cadastrou"
    const cancelada = pronto()
    cancelada.m.store.licencas[0].status = 'cancelada'
    const estornada = pronto()
    estornada.m.store.pagamentos[0].status = 'estornado'
    const semProva = { ...pedido, session_id: 'cs_semprova12345' }
    const estados: Array<() => Promise<unknown>> = [
      () => cadastrar(ok.deps, semProva), // já cadastrado
      () => cadastrar(pronto(false).deps, semProva), // nunca pagou
      () => cadastrar(cancelada.deps, semProva),
      () => cadastrar(estornada.deps, semProva),
      () => cadastrar(ok.deps, { ...pedido, session_id: undefined }),
    ]
    const respostas = await Promise.all(estados.map((f) => f().then(() => null, (e: ErroRegra) => ({ codigo: e.codigo, status: e.status, mensagem: e.message }))))
    expect(new Set(respostas.map((r) => JSON.stringify(r))).size).toBe(1)
    expect(respostas[0]).toMatchObject({ codigo: 'cadastro_indisponivel' })
    // mesmo com uma prova cuja compra foi cancelada/estornada, não revela o motivo
    await expect(cadastrar(cancelada.deps, pedido)).rejects.toMatchObject({ codigo: 'cadastro_indisponivel' })
    await expect(cadastrar(estornada.deps, pedido)).rejects.toMatchObject({ codigo: 'cadastro_indisponivel' })
  })
  it('com prova válida e Pix pendente responde "espere" e não cadastra; sem a prova isso não aparece', async () => {
    const { m, deps, enviados } = pronto(false, false)
    expect(await cadastrar(deps, pedido)).toMatchObject({ ok: false, pendente: true })
    expect(enviados).toHaveLength(0)
    expect(m.store.clientes[0].cadastro_em).toBeFalsy()
    await expect(cadastrar(deps, { ...pedido, session_id: 'cs_semprova12345' })).rejects.toMatchObject({ codigo: 'cadastro_indisponivel' })
  })
  it('só vale uma vez (com a prova): o segundo envio não manda outro acesso', async () => {
    const { deps, enviados } = pronto()
    await cadastrar(deps, pedido)
    await expect(cadastrar(deps, { ...pedido, nome: 'Outro' })).rejects.toMatchObject({ codigo: 'cadastro_feito', status: 409 })
    expect(enviados).toHaveLength(1)
  })
  it('dois envios ao mesmo tempo mandam um acesso só', async () => {
    const { deps, enviados } = pronto()
    const r = await Promise.allSettled([cadastrar(deps, pedido), cadastrar(deps, pedido)])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(enviados).toHaveLength(1)
  })
  it('valida as respostas (com a prova)', async () => {
    const { deps } = pronto()
    await expect(cadastrar(deps, { ...pedido, nome: '  ' })).rejects.toMatchObject({ codigo: 'nome_obrigatorio' })
    await expect(cadastrar(deps, { ...pedido, ramo: '' })).rejects.toMatchObject({ codigo: 'ramo_obrigatorio' })
    await expect(cadastrar(deps, { ...pedido, email: 'sem-arroba' })).rejects.toMatchObject({ codigo: 'email_invalido' })
    await expect(cadastrar(deps, { ...pedido, nome: 42 })).rejects.toBeInstanceOf(ErroRegra)
  })
  it('rejeita @, URL e muitos dígitos em nome, empresa e ramo (anti-phishing no e-mail)', async () => {
    const { deps, enviados } = pronto()
    for (const campo of ['nome', 'empresa', 'ramo'] as const) {
      for (const ruim of ['Pague em https://evil.test/x', 'fale com x@evil.com', 'acesse evil.com.br agora', 'www.evil.net', 'ligue 11999998888']) {
        await expect(cadastrar(deps, { ...pedido, [campo]: ruim })).rejects.toMatchObject({ codigo: 'texto_invalido' })
      }
    }
    expect(enviados).toHaveLength(0)
    await expect(cadastrar(deps, pedido)).resolves.toMatchObject({ ok: true }) // texto honesto passa
  })
  it('o e-mail de boas-vindas neutraliza URL/@ e limita o assunto a letras e espaços', () => {
    const d = { nome: 'Zé <b>1234</b> http://evil.test', empresa: 'Loja https://evil.test/x', ramo: 'vende e liga em x@evil.com ou evil.com.br', link_instalacao: 'https://atlas-ia.app.br/instalar?t=abc', expira_em: new Date('2026-01-01T12:00:00Z') }
    const { assunto, texto } = montarBoasVindas(d)
    expect(assunto).toMatch(/^[\p{L} ]+, o seu Atlas chegou$/u)
    const semLink = texto.replace('https://atlas-ia.app.br/instalar?t=abc', '')
    expect(semLink).not.toMatch(/evil|https?:|@/i)
    expect(montarBoasVindas({ ...d, nome: '1234 !!!' }).assunto).toBe('O seu Atlas chegou')
  })
  it('se o e-mail não sai, o cadastro é reaberto e os links antigos deixam de valer', async () => {
    const { m, deps, enviados, falha } = pronto()
    falha.envio = true
    await expect(cadastrar(deps, pedido)).rejects.toMatchObject({ codigo: 'email_nao_enviado', status: 502 })
    expect(m.store.clientes[0].cadastro_em).toBeFalsy()
    expect(m.store.links.every((l) => l.usado_em)).toBe(true)
    falha.envio = false
    await cadastrar(deps, pedido)
    expect(enviados).toHaveLength(1)
    expect(m.store.links.filter((l) => !l.usado_em)).toHaveLength(1) // só o novo vale
  })
  it('limita por cliente (não só por IP): reemissões em excesso são barradas', async () => {
    const { deps, falha } = pronto()
    falha.envio = true
    for (let i = 0; i < 5; i++) await expect(cadastrar(deps, pedido)).rejects.toMatchObject({ codigo: 'email_nao_enviado' })
    await expect(cadastrar(deps, pedido)).rejects.toMatchObject({ codigo: 'muitas_solicitacoes', status: 429 })
  })
})

describe('POST /cadastro (http)', () => {
  const montarCtx = (pago = true, sessaoPaga = true) => {
    const p = pronto(pago, sessaoPaga)
    return { p, c: <Contexto>{ deps: p.m.deps, carregarKit: async () => [], autorizarServico: () => false, cadastro: p.deps, origemWeb: 'https://atlas-ia.app.br' } }
  }
  const post = (c: ReturnType<typeof montarCtx>['c'], corpo: object, h: Record<string, string> = {}) =>
    tratar(c, new Request('https://x.test/functions/v1/cadastro', { method: 'POST', headers: h, body: JSON.stringify(corpo) }))

  it('é pública, responde 200 e libera CORS só para o site do Luiz', async () => {
    const { c, p } = montarCtx()
    const r = await post(c, { session_id: SID, nome: 'Zé', empresa: '', ramo: 'barbearia', email: 'ana@loja.com' }, { Origin: 'https://atlas-ia.app.br' })
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://atlas-ia.app.br')
    expect(p.enviados).toHaveLength(1)
    const estranho = await post(c, { email: 'x@y.com' }, { Origin: 'https://outro.site' })
    expect(estranho.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
  it('sem prova: 404 genérico; com prova e Pix pendente: 202', async () => {
    const { c } = montarCtx()
    const r = await post(c, { nome: 'Zé', ramo: 'x', email: 'ana@loja.com' })
    expect(r.status).toBe(404)
    expect((await r.json()).erro).toBe('cadastro_indisponivel')
    const pend = montarCtx(false, false)
    const r2 = await post(pend.c, { session_id: SID, nome: 'Zé', ramo: 'x' })
    expect(r2.status).toBe(202)
    expect(pend.p.enviados).toHaveLength(0)
  })
  it('preflight: 204 para o site, 403 para os outros', async () => {
    const { c } = montarCtx()
    const pre = (origin: string) => tratar(c, new Request('https://x.test/functions/v1/cadastro', { method: 'OPTIONS', headers: { Origin: origin } }))
    expect((await pre('https://atlas-ia.app.br')).status).toBe(204)
    expect((await pre('https://outro.site')).status).toBe(403)
  })
  it('limita por IP e responde 503 sem configuração', async () => {
    const { c } = montarCtx()
    const h = { 'x-forwarded-for': '1.2.3.4' }
    for (let i = 0; i < 10; i++) await post(c, { email: 'nao@existe.com', nome: 'a', ramo: 'b' }, h)
    expect((await post(c, { email: 'nao@existe.com', nome: 'a', ramo: 'b' }, h)).status).toBe(429)
    expect((await post({ ...c, cadastro: undefined }, {})).status).toBe(503)
  })
})

describe('cadastro de quem comprou em dólar (M31)', () => {
  it('licença em inglês: o e-mail de acesso sai em inglês; em português, sem idioma', async () => {
    const pt = pronto()
    await cadastrar(pt.deps, pedido)
    expect(pt.enviados[0].dados.idioma).toBeUndefined()
    const en = pronto()
    await en.m.store.definirIdiomaLicenca(en.m.store.licencas[0].id, 'en')
    await cadastrar(en.deps, pedido)
    expect(en.enviados[0].dados.idioma).toBe('en')
  })
})
