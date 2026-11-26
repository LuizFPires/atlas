import { expect, test } from 'vitest'
import { documentoBR, mascaraDocumento } from './documento'

test('CPF e CNPJ válidos (com ou sem pontuação); inválidos e repetidos não', () => {
  expect(documentoBR('529.982.247-25')).toEqual({ tipo: 'cpf', digitos: '52998224725' })
  expect(documentoBR('52998224725')).toEqual({ tipo: 'cpf', digitos: '52998224725' })
  expect(documentoBR('11.222.333/0001-81')).toEqual({ tipo: 'cnpj', digitos: '11222333000181' })
  expect(documentoBR('529.982.247-24')).toBeNull()
  expect(documentoBR('111.111.111-11')).toBeNull()
  expect(documentoBR('11.222.333/0001-80')).toBeNull()
  expect(documentoBR('123')).toBeNull()
  expect(documentoBR('')).toBeNull()
})

test('máscara enquanto digita (ou fala): CPF até 11 números, depois CNPJ', () => {
  expect(mascaraDocumento('52998224725')).toBe('529.982.247-25')
  expect(mascaraDocumento('5299')).toBe('529.9')
  expect(mascaraDocumento('11222333000181')).toBe('11.222.333/0001-81')
  expect(mascaraDocumento('cinco dois nove')).toBe('529')
})
