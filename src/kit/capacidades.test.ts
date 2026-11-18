// @vitest-environment node
import { CAPACIDADES, comDependencias, criarAvisosFixture, criarLgpdFixture, validarContaGateway } from './capacidades'

const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
interface Fs { readFileSync(p: string | URL, e: string): string }

test('o catálogo tem as quatro capacidades e cada uma tem sua skill no kit', async () => {
  expect(CAPACIDADES.map((c) => c.id).sort()).toEqual(['lgpd-basico', 'login-usuarios', 'notificacoes', 'pagamento-cliente'])
  const fs = (await mod('node:fs')) as Fs
  for (const c of CAPACIDADES) {
    const t = fs.readFileSync(new URL(`../../.claude/skills/${c.id}/SKILL.md`, import.meta.url), 'utf8')
    expect(t).toMatch(new RegExp(`^---\\r?\\nname: ${c.id}\\r?\\n`))
    expect(t).toContain('Em palavras simples')
  }
})

test('quem pede pagamento leva login e LGPD junto', () => {
  expect(comDependencias(['pagamento-cliente'])).toEqual(['login-usuarios', 'pagamento-cliente', 'lgpd-basico'])
  expect(comDependencias(['nada', 'lgpd-basico', 'lgpd-basico'])).toEqual(['lgpd-basico'])
})

test('pagamento: só na conta do cliente e só o NOME da variável da chave', () => {
  expect(validarContaGateway({ dono: 'cliente', gateway: 'stripe', chaveSecretaEnv: 'STRIPE_SECRET_KEY' })).toEqual({ ok: true })
  expect(validarContaGateway({ dono: 'atlas', gateway: 'stripe', chaveSecretaEnv: 'STRIPE_SECRET_KEY' })).toMatchObject({ ok: false })
  expect(validarContaGateway({ dono: 'luiz', gateway: 'stripe', chaveSecretaEnv: 'STRIPE_SECRET_KEY' })).toMatchObject({ ok: false })
  const colou = validarContaGateway({ dono: 'cliente', gateway: 'stripe', chaveSecretaEnv: 'sk_live_abc123456789' })
  expect(colou).toMatchObject({ ok: false })
  expect(JSON.stringify(colou)).not.toContain('abc123')
})

test('LGPD: consentimento tem finalidade, dá para exportar e excluir a conta', () => {
  const l = criarLgpdFixture(() => '2026-11-18T10:00:00Z')
  expect(() => l.registrarConsentimento({ pessoa: 'ana', textoVersao: 'v1', finalidades: [] })).toThrow()
  l.registrarConsentimento({ pessoa: 'ana', textoVersao: 'v1', finalidades: ['agendar horário'] })
  expect(l.exportar('ana').consentimento).toMatchObject({ aceitoEm: '2026-11-18T10:00:00Z', textoVersao: 'v1' })
  expect(l.excluirConta('ana')).toBe(true)
  expect(l.consentimentoDe('ana')).toBeNull()
  expect(l.excluirConta('ana')).toBe(false)
})

test('avisos: sem permissão não envia, e dá para parar de receber', () => {
  const a = criarAvisosFixture()
  expect(a.enviar({ para: 'ana', canal: 'push', texto: 'Seu horário é amanhã' })).toBe(false)
  a.darPermissao('ana', 'push')
  expect(a.enviar({ para: 'ana', canal: 'push', texto: 'Seu horário é amanhã' })).toBe(true)
  expect(a.enviar({ para: 'ana', canal: 'email', texto: 'x' })).toBe(false)
  a.pararDeReceber('ana', 'push')
  expect(a.enviar({ para: 'ana', canal: 'push', texto: 'y' })).toBe(false)
  expect(a.enviados).toHaveLength(1)
})
