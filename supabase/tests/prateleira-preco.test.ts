import { describe, expect, it } from 'vitest'
import { planoDoTipo, planoImplantacao, planoPrateleira, VALOR_MENSALIDADE, VALOR_PRATELEIRA } from '../functions/_shared/pagamento/config.ts'

describe('prateleira — preço (M32)', () => {
  it('à vista e até 3x: R$ 7.300 sem juros', () => {
    expect(VALOR_PRATELEIRA).toBe(7300)
    expect(planoPrateleira(1)).toEqual({ parcelas: 1, parcela: 7300, total: 7300, temJuros: false })
    expect(planoPrateleira(2)).toMatchObject({ parcela: 3650, total: 7300, temJuros: false })
    expect(planoPrateleira(3)).toMatchObject({ parcela: 2433.33, total: 7300, temJuros: false })
  })
  it('4x a 10x: PMT a 2% a.m., total maior que o preço', () => {
    const p4 = planoPrateleira(4)
    expect(p4.temJuros).toBe(true)
    expect(p4.parcela).toBe(Math.round(((7300 * 0.02) / (1 - Math.pow(1.02, -4))) * 100) / 100)
    for (let n = 4; n <= 10; n++) expect(planoPrateleira(n).total).toBeGreaterThan(7300)
  })
  it('limita em 10x e nunca passa disso', () => {
    expect(planoPrateleira(99).parcelas).toBe(10)
    expect(planoPrateleira(0).parcelas).toBe(1)
  })
  it('mensalidade segue R$ 200 à parte e o tipo escolhe o preço certo', () => {
    expect(VALOR_MENSALIDADE).toBe(200)
    expect(planoDoTipo('prateleira', 1).total).toBe(7300)
    expect(planoDoTipo('implantacao', 1).total).toBe(4800)
    expect(planoImplantacao(5).total).toBeLessThan(planoPrateleira(5).total)
  })
})
