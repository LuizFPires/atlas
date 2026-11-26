import { dinheiro, idiomaDaPagina } from './idioma'

describe('idioma da página (M31)', () => {
  test('a escolha guardada (cookie) vence o endereço', () => {
    expect(idiomaDaPagina({ caminho: '/', host: 'atlas-ia.app.br', cookie: 'en' })).toBe('en')
    expect(idiomaDaPagina({ caminho: '/en', host: 'atlas-ia.app.br', cookie: 'pt' })).toBe('pt')
    expect(idiomaDaPagina({ caminho: '/', host: 'www.use-atlas-ai.com', cookie: 'pt' })).toBe('pt')
  })
  test('sem escolha: /en e o domínio de fora abrem em inglês; o resto em português', () => {
    expect(idiomaDaPagina({ caminho: '/en', host: 'atlas-ia.app.br', cookie: null })).toBe('en')
    expect(idiomaDaPagina({ caminho: '/en/', host: 'localhost', cookie: null })).toBe('en')
    expect(idiomaDaPagina({ caminho: '/', host: 'www.use-atlas-ai.com', cookie: null })).toBe('en')
    expect(idiomaDaPagina({ caminho: '/', host: 'use-atlas-ai.com', cookie: null })).toBe('en')
    expect(idiomaDaPagina({ caminho: '/', host: 'atlas-ia.app.br', cookie: null })).toBe('pt')
    expect(idiomaDaPagina({ caminho: '/entrar', host: 'atlas-ia.app.br', cookie: null })).toBe('pt')
    expect(idiomaDaPagina({ caminho: '/', host: 'fake-use-atlas-ai.com.evil.io', cookie: 'xx' })).toBe('pt')
  })
  test('dinheiro no formato de cada país', () => {
    expect(dinheiro(480000, 'pt')).toBe('R$ 4.800')
    expect(dinheiro(20000, 'pt')).toBe('R$ 200')
    expect(dinheiro(170000, 'en')).toBe('$1,700')
    expect(dinheiro(7000, 'en')).toBe('$70')
    expect(dinheiro(240000, 'en')).toBe('$2,400')
  })
})
