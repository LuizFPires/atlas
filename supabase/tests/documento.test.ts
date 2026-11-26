// @vitest-environment node
import { expect, test } from 'vitest'
import { documentoBR } from '../functions/_shared/documento.ts'

test('servidor: CPF e CNPJ conferidos pelos dígitos verificadores', () => {
  expect(documentoBR('529.982.247-25')).toEqual({ tipo: 'cpf', digitos: '52998224725' })
  expect(documentoBR('11222333000181')).toEqual({ tipo: 'cnpj', digitos: '11222333000181' })
  expect(documentoBR('52998224724')).toBeNull()
  expect(documentoBR('00000000000000')).toBeNull()
  expect(documentoBR(undefined)).toBeNull()
})
