import { render, screen, fireEvent } from '@testing-library/react'
import { PracaTeste } from './PracaTeste'
import { posicoes } from './praca-posicoes'
import type { AgenteNaCena } from './ponte-testar'

const ag = (id: string, prof: string, r: AgenteNaCena['r']): AgenteNaCena => ({ id, nome: id, idade: 30, tracos: { Profissão: prof }, r, fala: null })
const lista = [ag('a', 'Barbeiro', 'usaria'), ag('b', 'Barbeiro', 'nao'), ag('c', 'Estudante', 'usaria'), ag('d', 'Estudante', null)]

describe('PracaTeste', () => {
  test('conta quem usaria e quem não usaria na descrição da praça', () => {
    render(<PracaTeste agentes={lista} eventos={[]} fase="olhando" nome="Barbearia" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Praça: 4 agentes de IA olhando Barbearia. 2 usariam, 1 não usariam.')
  })

  test('liga e desliga o mapa de calor por grupo', () => {
    render(<PracaTeste agentes={lista} eventos={[]} fase="pronto" nome="Barbearia" />)
    const b = screen.getByRole('button', { name: 'Mapa de calor por grupo' })
    expect(b.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(b)
    expect(b.getAttribute('aria-pressed')).toBe('true')
  })

  test('cada grupo ocupa um setor e todo agente tem posição', () => {
    const { pos, grupos } = posicoes(lista, 'Profissão')
    expect(grupos).toEqual(['Barbeiro', 'Estudante'])
    expect(pos.size).toBe(4)
    expect(pos.get('a')!.grupo).toBe(0)
    expect(pos.get('c')!.grupo).toBe(1)
  })

  test('agente sem o traço do grupo cai no grupo "—"', () => {
    const { grupos } = posicoes([{ ...ag('x', 'X', null), tracos: {} }], 'Profissão')
    expect(grupos).toEqual(['—'])
  })
})
