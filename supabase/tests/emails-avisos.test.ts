// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { montarAvisoAtraso, montarCodigoAtivacao } from '../functions/_shared/emails-avisos.ts'
import { montarBoasVindas } from '../functions/_shared/emails.ts'

const semHumano = (s: string) => expect(s).not.toMatch(/whatsapp|telefone|ligue|nossa equipe|atendente|\p{Extended_Pictographic}/iu)

describe('e-mail do código de ativação', () => {
  it('mostra o código, a validade e a Ajuda do Atlas', () => {
    const e = montarCodigoAtivacao({ nome: 'Ana Souza', codigo: '123456' })
    expect(e.assunto).toBe('123456 é o seu código do Atlas')
    expect(e.html).toContain('>123456<')
    expect(e.html).toContain('10 minutos')
    expect(e.html).not.toMatch(/<img\b|<svg\b/i) // sem ícones: e-mail com cara de aviso (22/11/2026)
    expect(e.texto).toContain('123456')
    expect(e.texto).toContain('Ajuda do Atlas')
    semHumano(e.html + e.texto)
  })
  it('só dígitos entram no código; nome malicioso é escapado; troca muda o título', () => {
    const e = montarCodigoAtivacao({ nome: '<script>x</script> http://evil.test', codigo: '12<b>34' })
    expect(e.html).not.toMatch(/<script|evil|<b>34/)
    expect(e.assunto).toBe('1234 é o seu código do Atlas')
    expect(montarCodigoAtivacao({ codigo: '111111', finalidade: 'troca' }).html).toContain('trocar de computador')
  })
})

describe('e-mail de aviso de atraso', () => {
  const agora = new Date('2026-11-18T12:00:00Z')
  const pausa = new Date('2026-11-25T12:00:00Z')
  it('aviso 1 e 2: avisa a data da pausa, diz que volta sozinho e que as obras continuam do cliente', () => {
    const e = montarAvisoAtraso({ n: 1, pausa_em: pausa, nome: 'Ana', link_pagamento: 'https://pagar.exemplo/abc' }, agora)
    expect(e.assunto).toBe('A mensalidade do Atlas precisa de um acerto')
    expect(e.html).toContain('25/11')
    expect(e.html).toContain('em 7 dias')
    expect(e.html).toContain('href="https://pagar.exemplo/abc"')
    expect(e.texto).toContain('volta sozinho')
    expect(e.html).toContain('seu GitHub')
    semHumano(e.html + e.texto)
  })
  it('aviso 3 é a última chamada e "até amanhã" quando falta um dia', () => {
    const e = montarAvisoAtraso({ n: 3, pausa_em: new Date('2026-11-19T12:00:00Z'), nome: 'Ana' }, agora)
    expect(e.assunto).toContain('Última chamada')
    expect(e.html).toContain('até amanhã')
    expect(e.html).not.toContain('Acertar a mensalidade') // sem link, sem botão quebrado
  })
  it('link perigoso não vira botão', () => {
    expect(montarAvisoAtraso({ n: 1, pausa_em: pausa, nome: 'Ana', link_pagamento: 'javascript:alert(1)' }, agora).html).not.toContain('javascript:')
  })
})

describe('bordas de texto vazio (revisão M5)', () => {
  it('código sem dígitos é recusado', () => {
    expect(() => montarCodigoAtivacao({ codigo: '' })).toThrow('codigo_vazio')
    expect(() => montarCodigoAtivacao({ codigo: 'abc' })).toThrow('codigo_vazio')
  })
  it('boas-vindas sem empresa ou ramo não deixa pontuação solta', () => {
    const base = { nome: 'Ana', expira_em: new Date('2026-01-03T12:00:00Z'), link_instalacao: 'https://atlas-ia.app.br/instalar?t=x' }
    for (const [empresa, ramo] of [['', ''], ['Loja', ''], ['', 'roupas']]) {
      const e = montarBoasVindas({ ...base, empresa, ramo })
      expect(e.html).not.toMatch(/: \.|\(\)/)
      expect(e.texto).not.toMatch(/: \.|\(\)/)
    }
  })
})
