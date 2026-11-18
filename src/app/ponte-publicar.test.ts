import { HOSTS_OFICIAIS, SITES_OFICIAIS, criarPublicarFixture, dominioValido, enderecoOficial, publicarIndisponivel, registroDnsValido, slugDaObra } from './ponte-publicar'

test('todo destino fixo aponta para um host oficial (https, sem porta nem usuário)', () => {
  for (const url of Object.values(SITES_OFICIAIS)) expect(enderecoOficial(url)).toBe(true)
  expect(HOSTS_OFICIAIS).toContain('registro.br')
})

test('recusa host que não é oficial, http, porta, usuário e truques de nome (SSRF)', () => {
  for (const ruim of ['http://registro.br/', 'https://registro.br.evil.com/', 'https://evilregistro.br/', 'https://user@registro.br/', 'https://registro.br:8080/', 'https://127.0.0.1/', 'https://localhost/', 'file:///etc/passwd', 'javascript:alert(1)', 'nao-e-url']) {
    expect(enderecoOficial(ruim)).toBe(false)
  }
})

test('domínio só .com.br simples; nada de IP, caminho, porta ou barra', () => {
  expect(dominioValido('cadeira1.com.br')).toBe(true)
  expect(dominioValido('meu-site.com.br')).toBe(true)
  for (const ruim of ['', 'cadeira1.com', 'a/b.com.br', '127.0.0.1', 'x.com.br/../', 'cadeira1.com.br:80', '-a.com.br', 'a b.com.br', 'EVIL.com.br', 'a.com.br\nb']) expect(dominioValido(ruim)).toBe(false)
})

test('slug da obra: sem acento, só letras e números', () => {
  expect(slugDaObra('Cadeira 1')).toBe('cadeira1')
  expect(slugDaObra('Açaí do Zé!')).toBe('acaidoze')
  expect(slugDaObra('???')).toBe('meusistema')
})

test('registro de DNS que vem de fora é dado: só A com IP e CNAME com nome de máquina', () => {
  expect(registroDnsValido({ tipo: 'A', nome: '@', valor: '76.76.21.21' })).toBe(true)
  expect(registroDnsValido({ tipo: 'CNAME', nome: 'www', valor: 'cname.vercel-dns.com' })).toBe(true)
  expect(registroDnsValido({ tipo: 'A', nome: '@', valor: '999.1.1.1' })).toBe(false)
  expect(registroDnsValido({ tipo: 'CNAME', nome: 'www', valor: 'x.com; rm -rf' })).toBe(false)
  expect(registroDnsValido({ tipo: 'TXT' as 'A', nome: '@', valor: '1.1.1.1' })).toBe(false)
})

test('fixture: recusa domínio inválido e filtra registros estranhos', async () => {
  const f = criarPublicarFixture({ dns: [{ tipo: 'A', nome: '@', valor: '1.2.3.4' }, { tipo: 'A', nome: '@', valor: 'drop table' }] })
  await expect(f.abrirSite('registro', 'http://evil')).rejects.toThrow()
  await expect(f.lerDns('x/y')).rejects.toThrow()
  expect(await f.lerDns('ok.com.br')).toEqual([{ tipo: 'A', nome: '@', valor: '1.2.3.4' }])
  expect(await f.nomeLivre('lixo')).toBe('incerto')
})

test('produção sem adaptador não finge: não publica, não lê DNS e não diz que está no ar', async () => {
  await expect(publicarIndisponivel.publicarNoAr('x')).rejects.toThrow()
  await expect(publicarIndisponivel.lerDns('a.com.br')).rejects.toThrow()
  expect(await publicarIndisponivel.dnsNoAr('a.com.br', [])).toBe(false)
  expect(await publicarIndisponivel.nomeLivre('a.com.br')).toBe('incerto')
})
