// @vitest-environment node
// Achados da revisão de segurança do M2: limite de código, atomicidade, credencial e fail-closed.
import { describe, expect, it } from 'vitest'
import { confirmarAtivacao, consumirCodigo, JANELA_LIMITE_MS, MAX_EMISSOES, MAX_TENTATIVAS, MAX_TENTATIVAS_JANELA, solicitarCodigo } from '../functions/_shared/ativacao.ts'
import { gerarLink } from '../functions/_shared/links.ts'
import { trocarComputador } from '../functions/_shared/troca.ts'
import { H1, H2, montar } from './helpers.ts'

const email = 'ana@loja.com'
const H3 = 'c'.repeat(64)

describe('limite de emissão de código', () => {
  it('3 a cada 15 min por cliente (neutro) e por IP (429); libera depois da janela', async () => {
    const m = montar()
    for (let i = 0; i < MAX_EMISSOES; i++) await solicitarCodigo(m.deps, email, 'troca', `ip${i}`)
    expect(m.emails).toHaveLength(3)
    await expect(solicitarCodigo(m.deps, email, 'troca', 'ip9')).resolves.toEqual({ ok: true }) // não vaza o limite
    expect(m.emails).toHaveLength(3)
    m.avancar(JANELA_LIMITE_MS + 1)
    await solicitarCodigo(m.deps, email, 'troca', 'ip9')
    expect(m.emails).toHaveLength(4)
    const n = montar()
    for (let i = 0; i < MAX_EMISSOES; i++) await solicitarCodigo(n.deps, `x${i}@y.com`, 'ativacao', 'mesmo-ip')
    await expect(solicitarCodigo(n.deps, email, 'ativacao', 'mesmo-ip')).rejects.toMatchObject({ status: 429, codigo: 'muitas_solicitacoes' })
  })
  it('código novo invalida os abertos anteriores (no store, não só em memória)', async () => {
    const m = montar()
    await solicitarCodigo(m.deps, email, 'troca', 'a')
    await solicitarCodigo(m.deps, email, 'troca', 'b')
    expect(m.store.codigos.filter((c) => !c.usado_em)).toHaveLength(1)
    // o código antigo não serve mais
    await expect(consumirCodigo(m.deps, 'c1', 'troca', m.emails[0])).rejects.toMatchObject({ codigo: 'codigo_invalido' })
  })
  it('guarda HMAC do código (não o sha256 simples)', async () => {
    const m = montar()
    await solicitarCodigo(m.deps, email)
    const { sha256 } = await import('../functions/_shared/cripto.ts')
    expect(m.store.codigos[0].codigo_hash).not.toBe(await sha256(`c1:${m.emails[0]}`))
  })
})

describe('força bruta', () => {
  it('na troca: bloqueia com 429 após N falhas, mesmo pedindo códigos novos', async () => {
    const m = montar()
    await m.ativar()
    await solicitarCodigo(m.deps, email, 'troca', 'a')
    const certo = m.emails[0]
    const errado = certo === '000000' ? '111111' : '000000'
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      await expect(trocarComputador(m.deps, { email, codigo: errado, novo_hash: H2 })).rejects.toMatchObject({ codigo: 'codigo_invalido', status: 400 })
    }
    await expect(trocarComputador(m.deps, { email, codigo: certo, novo_hash: H2 })).rejects.toMatchObject({ status: 429, codigo: 'codigo_bloqueado' })
    // novo código zera o contador do código, mas a janela por cliente+finalidade continua contando
    await solicitarCodigo(m.deps, email, 'troca', 'b')
    const novo = m.emails[1]
    const err2 = novo === '000000' ? '111111' : '000000'
    for (let i = MAX_TENTATIVAS + 1; i < MAX_TENTATIVAS_JANELA; i++) {
      await expect(trocarComputador(m.deps, { email, codigo: err2, novo_hash: H2 })).rejects.toMatchObject({ codigo: 'codigo_invalido' })
    }
    await expect(trocarComputador(m.deps, { email, codigo: novo, novo_hash: H2 })).rejects.toMatchObject({ status: 429, codigo: 'muitas_tentativas' })
    expect(m.store.ativacoes.filter((a) => a.ativo)[0].computador_hash).toBe(H1)
  })
})

describe('concorrência (UPDATE atômico)', () => {
  it('incrementar tentativa em paralelo nunca passa de MAX', async () => {
    const m = montar()
    await solicitarCodigo(m.deps, email)
    const id = m.store.codigos[0].id
    const r = await Promise.all(Array.from({ length: 30 }, () => m.store.incrementarTentativa(id, MAX_TENTATIVAS, m.deps.agora())))
    expect(r.filter(Boolean)).toHaveLength(MAX_TENTATIVAS)
    expect(m.store.codigos[0].tentativas).toBe(MAX_TENTATIVAS)
  })
  it('consumir código em paralelo: só um vence', async () => {
    const m = montar()
    await solicitarCodigo(m.deps, email)
    const id = m.store.codigos[0].id
    const r = await Promise.all(Array.from({ length: 30 }, () => m.store.consumirCodigo(id, MAX_TENTATIVAS, m.deps.agora())))
    expect(r.filter(Boolean)).toHaveLength(1)
  })
  it('confirmar ativação em paralelo com o mesmo código: uma ativação só', async () => {
    const m = montar()
    const { token } = await gerarLink(m.deps, email)
    await solicitarCodigo(m.deps, email)
    const a = { email, codigo: m.emails[0], token, computador_hash: H1 }
    const r = await Promise.allSettled(Array.from({ length: 10 }, () => confirmarAtivacao(m.deps, a)))
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(m.store.ativacoes).toHaveLength(1)
  })
  it('trocas paralelas com o mesmo código: só uma passa e sobra 1 ativo', async () => {
    const m = montar()
    await m.ativar()
    await solicitarCodigo(m.deps, email, 'troca', 'a')
    const r = await Promise.allSettled([H2, H3, H2, H3].map((h) => trocarComputador(m.deps, { email, codigo: m.emails[0], novo_hash: h })))
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(m.store.ativacoes.filter((a) => a.ativo)).toHaveLength(1)
    expect(m.store.trocas).toHaveLength(1)
  })
  it('tentarEvento em paralelo respeita o teto', async () => {
    const m = montar()
    const r = await Promise.all(Array.from({ length: 20 }, () => m.store.tentarEvento('k', 3, 1000, m.deps.agora())))
    expect(r.filter(Boolean)).toHaveLength(3)
  })
})
