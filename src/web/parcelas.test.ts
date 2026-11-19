// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { planoImplantacao as frente, opcoesParcelas } from './parcelas'
import { planoImplantacao as servidor, VALOR_IMPLANTACAO } from '../../supabase/functions/_shared/pagamento/config.ts'

describe('parcelamento da implantação', () => {
  it('frontend e servidor calculam exatamente o mesmo preço (1 a 10x)', () => {
    for (let n = 1; n <= 10; n++) {
      const f = frente(n)
      const s = servidor(n)
      expect(f.total).toBe(s.total)
      expect(f.parcela).toBe(s.parcela)
      expect(f.temJuros).toBe(s.temJuros)
    }
  })

  it('1x a 3x: sem juros, total R$ 4.800', () => {
    for (const n of [1, 2, 3]) {
      const p = servidor(n)
      expect(p.temJuros).toBe(false)
      expect(p.total).toBe(VALOR_IMPLANTACAO)
      expect(p.parcela).toBeCloseTo(VALOR_IMPLANTACAO / n, 2)
    }
  })

  it('4x a 10x: com juros de 2% a.m. (PMT), total cresce com o número de parcelas', () => {
    expect(servidor(4).temJuros).toBe(true)
    // PMT(4800, 2% a.m., 4) ≈ 1260,60 → total ≈ 5042,40
    expect(servidor(4).parcela).toBeCloseTo(1260.6, 1)
    expect(servidor(4).total).toBeGreaterThan(VALOR_IMPLANTACAO)
    // PMT(4800, 2% a.m., 10) ≈ 534,37 → total ≈ 5343,70
    expect(servidor(10).parcela).toBeCloseTo(534.37, 1)
    let anterior = 0
    for (let n = 4; n <= 10; n++) {
      expect(servidor(n).total).toBeGreaterThan(anterior)
      anterior = servidor(n).total
    }
  })

  it('clampa fora do intervalo: 0 e 99 viram 1x e 10x', () => {
    expect(servidor(0).parcelas).toBe(1)
    expect(servidor(99).parcelas).toBe(10)
    expect(opcoesParcelas()).toHaveLength(10)
  })
})
