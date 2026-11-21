import { describe, expect, it } from 'vitest'
import { filtrarClientes, fluxoPorMes, indicadoresGerenciais } from './admin-calc'
import type { LinhaCliente } from './admin-api'

const l = (nome: string, empresa: string, situacao: LinhaCliente['situacao'], extra: Partial<LinhaCliente> = {}): LinhaCliente =>
  ({ licenca_id: nome, nome, empresa, ramo: '', situacao, obras: 0, ultimo_sinal_em: null, travado_em: null, ...extra })
const lista = [
  l('Ana', 'Padaria Ótima', 'em_dia'), l('Beto', 'Barbearia', 'atrasada'), l('Caio', 'Café', 'pausada'),
  l('Dora', 'Doces', 'cancelada'), l('Eva', '', 'em_dia', { tipo: 'cortesia' }), l('Fred', 'Frete', 'ativando'), l('Gil', 'Gráfica', 'ativando', { travado_em: 'cadastro' }),
]

describe('filtro de contas', () => {
  const nomes = (f: Parameters<typeof filtrarClientes>[1], b = '') => filtrarClientes(lista, f, b).map((c) => c.nome)
  it('filtra por situação', () => {
    expect(nomes('todas')).toHaveLength(7)
    expect(nomes('ativas')).toEqual(['Ana'])
    expect(nomes('inadimplentes')).toEqual(['Beto', 'Caio'])
    expect(nomes('canceladas')).toEqual(['Dora'])
    expect(nomes('ativando')).toEqual(['Fred', 'Gil'])
    expect(nomes('travados')).toEqual(['Gil'])
    expect(nomes('cortesias')).toEqual(['Eva'])
  })
  it('busca por nome ou empresa, sem ligar para acento e maiúscula', () => {
    expect(nomes('todas', 'otima')).toEqual(['Ana'])
    expect(nomes('todas', 'CAIO')).toEqual(['Caio'])
    expect(nomes('canceladas', 'do')).toEqual(['Dora'])
  })
})

describe('fluxo de caixa', () => {
  it('soma por mês e fica com os últimos meses em ordem', () => {
    const meses = Array.from({ length: 8 }, (_, n) => ({ mes: `2026-0${8 - n}`, implantacoes: 100, prateleira: 10 * (n + 1), mensalidades: 1 }))
    const r = fluxoPorMes({ meses }, 6)
    expect(r).toHaveLength(6)
    expect(r[0].mes < r[5].mes).toBe(true)
    expect(r[5]).toMatchObject({ mes: '2026-08', total: 100 + 10 + 1 })
  })
})

describe('indicadores gerenciais', () => {
  const base = { clientes_ativos: 5, receita: { recorrente_mensal: 985, recebida_no_mes: 0, implantacoes_recebidas_no_mes: 0 }, ativacoes: { no_mes: 0, meta: 0, computadores_ativos: 0 }, inadimplencia: { atrasadas: 0, pausadas: 0, valor_em_aberto: 0 }, travados: 0 }
  it('calcula ticket médio e não inventa cancelamentos', () => {
    expect(indicadoresGerenciais(base)).toEqual({ mrr: 985, ticketMedio: 197, cancelamentosNoMes: null })
    expect(indicadoresGerenciais({ ...base, cancelamentos_no_mes: 2 }).cancelamentosNoMes).toBe(2)
    expect(indicadoresGerenciais({ ...base, clientes_ativos: 0 }).ticketMedio).toBeNull()
  })
})
