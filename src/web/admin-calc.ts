// Contas puras do painel do administrador (sem rede): filtro de clientes, fluxo de caixa e indicadores gerenciais.
import type { FluxoCaixa, IndicadoresAdmin, LinhaCliente, MesCaixa } from './admin-api'

export type FiltroConta = 'todas' | 'ativas' | 'ativando' | 'inadimplentes' | 'canceladas' | 'travados' | 'cortesias'
export const FILTROS: { id: FiltroConta; nome: string }[] = [
  { id: 'todas', nome: 'Todas' },
  { id: 'ativas', nome: 'Ativas (em dia)' },
  { id: 'ativando', nome: 'Ativando agora' },
  { id: 'inadimplentes', nome: 'Inadimplentes (atrasadas e pausadas)' },
  { id: 'canceladas', nome: 'Canceladas' },
  { id: 'travados', nome: 'Travados (parados no cadastro ou na instalação)' },
  { id: 'cortesias', nome: 'Cortesias' },
]

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Filtra por situação e busca por nome/empresa (sem ligar para maiúscula ou acento). */
export function filtrarClientes(lista: LinhaCliente[], filtro: FiltroConta, busca: string): LinhaCliente[] {
  const q = semAcento(busca.trim())
  return lista.filter((c) => {
    const passa =
      filtro === 'todas' ? true
      : filtro === 'ativas' ? c.situacao === 'em_dia' && c.tipo !== 'cortesia'
      : filtro === 'ativando' ? c.situacao === 'ativando'
      : filtro === 'inadimplentes' ? c.situacao === 'atrasada' || c.situacao === 'pausada'
      : filtro === 'canceladas' ? c.situacao === 'cancelada'
      : filtro === 'travados' ? c.travado_em !== null
      : c.tipo === 'cortesia'
    return passa && (!q || semAcento(`${c.nome} ${c.empresa}`).includes(q))
  })
}

export const totalMes = (m: Pick<MesCaixa, 'implantacoes' | 'prateleira' | 'mensalidades'>) => m.implantacoes + m.prateleira + m.mensalidades

/** Meses em ordem do mais antigo ao mais novo, cada um com o total somado. Fica com os últimos `n`. */
export function fluxoPorMes(f: FluxoCaixa, n = 6): (MesCaixa & { total: number })[] {
  return [...f.meses].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-n).map((m) => ({ ...m, total: totalMes(m) }))
}

export interface Gerenciais { mrr: number; ticketMedio: number | null; cancelamentosNoMes: number | null }
/** MRR = receita recorrente; ticket médio = MRR / clientes ativos; cancelamentos só se o servidor informar (nunca inventa). */
export function indicadoresGerenciais(i: IndicadoresAdmin): Gerenciais {
  return {
    mrr: i.receita.recorrente_mensal,
    ticketMedio: i.clientes_ativos > 0 ? i.receita.recorrente_mensal / i.clientes_ativos : null,
    cancelamentosNoMes: typeof i.cancelamentos_no_mes === 'number' ? i.cancelamentos_no_mes : null,
  }
}
