import { faseDaObra, nomeDaPasta } from './fase-obra'

const sit = (p: Partial<{ estilo: boolean; prototipo: boolean; marca: boolean; plano: boolean }> = {}) => ({ estilo: false, prototipo: false, marca: false, plano: false, ...p })

test('cada etapa do projeto leva o "Continuar" ao ponto certo', () => {
  expect(faseDaObra(sit(), null)).toMatchObject({ etapa: 'estilo', concluida: false, rotulo: 'Parou em: escolher o estilo' })
  expect(faseDaObra(sit({ estilo: true }), null)).toMatchObject({ etapa: 'telas', rotulo: 'Parou em: desenhar as telas' })
  expect(faseDaObra(sit({ estilo: true, prototipo: true }), null)).toMatchObject({ etapa: 'telas', rotulo: 'Parou em: as telas (já começadas)' })
  expect(faseDaObra(sit({ estilo: true, prototipo: true, marca: true }), null)).toMatchObject({ etapa: 'aprovar', rotulo: 'Parou em: aprovar e começar a construção' })
})

test('construção começada: painel da obra com o %; 100% = concluída', () => {
  expect(faseDaObra(sit({ estilo: true, prototipo: true, marca: true, plano: true }), 62)).toEqual({ etapa: 'obra', concluida: false, rotulo: 'Construindo · 62% pronto', pct: 62 })
  expect(faseDaObra(sit({ plano: true }), 100)).toEqual({ etapa: 'obra', concluida: true, rotulo: 'Obra pronta', pct: 100 })
  expect(faseDaObra(sit({ plano: true }), null)).toMatchObject({ etapa: 'obra', concluida: false, rotulo: 'Construindo' })
})

test('protótipo trazido de outra IA (sem estilo escolhido) continua nas telas', () => {
  expect(faseDaObra(sit({ prototipo: true }), null)).toMatchObject({ etapa: 'telas' })
})

test('nome para mostrar vem da pasta: com espaços, primeira letra maiúscula e no máximo 60 letras', () => {
  expect(nomeDaPasta('agenda-da-barbearia')).toBe('Agenda da barbearia')
  const longo = nomeDaPasta('o-meu-sistema-vai-chamar-cartao-de-ponto-e-o-problema-e-automatizar-o-registro')
  expect(longo.length).toBeLessThanOrEqual(60)
  expect(longo.endsWith('…')).toBe(true)
})
