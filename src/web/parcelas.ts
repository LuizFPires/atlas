// Parcelamento da implantação no cartão (espelho de supabase/functions/_shared/pagamento/config.ts).
// Regra: até 10x; 1–3x sem juros; 4x+ com juros de 2% a.m. (PMT). A mensalidade (R$ 200) é cobrada à parte.
// O preço de verdade é calculado no servidor; aqui é só para mostrar as opções. Um teste garante que batem.

export const VALOR_IMPLANTACAO = 4800
export const VALOR_PRATELEIRA = 7300
export type TipoProduto = 'implantacao' | 'prateleira'
export const MAX_PARCELAS = 10
export const PARCELAS_SEM_JUROS = 3
export const JUROS_PARCELA_AM = 0.02

const c2 = (v: number) => Math.round(v * 100) / 100

export interface PlanoParcela { parcelas: number; parcela: number; total: number; temJuros: boolean }

/** Mecânica única (1–3x sem juros; 4x+ PMT a 2% a.m.) para qualquer valor-base. */
export function planoParcelado(valor: number, parcelas: number): PlanoParcela {
  const n = Math.min(MAX_PARCELAS, Math.max(1, Math.round(Number(parcelas) || 1)))
  if (n <= PARCELAS_SEM_JUROS) return { parcelas: n, parcela: c2(valor / n), total: valor, temJuros: false }
  const i = JUROS_PARCELA_AM
  const parcela = c2((valor * i) / (1 - Math.pow(1 + i, -n)))
  return { parcelas: n, parcela, total: c2(parcela * n), temJuros: true }
}

export const planoImplantacao = (parcelas: number): PlanoParcela => planoParcelado(VALOR_IMPLANTACAO, parcelas)
export const planoPrateleira = (parcelas: number): PlanoParcela => planoParcelado(VALOR_PRATELEIRA, parcelas)
export const planoDoTipo = (tipo: TipoProduto, parcelas: number): PlanoParcela => (tipo === 'prateleira' ? planoPrateleira(parcelas) : planoImplantacao(parcelas))

/** Todas as opções de 1 a 10x, para o seletor. */
export function opcoesParcelas(tipo: TipoProduto = 'implantacao'): PlanoParcela[] {
  return Array.from({ length: MAX_PARCELAS }, (_, k) => planoDoTipo(tipo, k + 1))
}

export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Texto da opção no seletor, ex.: "3x de R$ 1.600,00 (sem juros)" ou "4x de R$ 1.260,60 (com juros)". */
export function rotuloParcela(p: PlanoParcela): string {
  if (p.parcelas === 1) return `À vista — ${reais(p.total)}`
  return `${p.parcelas}x de ${reais(p.parcela)} ${p.temJuros ? '(com juros)' : '(sem juros)'}`
}
