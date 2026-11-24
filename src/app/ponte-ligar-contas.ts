// Porta entre a tela "Ligar as contas a este computador" (prototipo/caminho-novo/C1Contas) e o processo principal
// (app/adaptadores/contas-cli.cjs). A tela recebe só o código para mostrar e o estado; nunca endereço, nem chave de volta.
import type { Retangulo } from './ponte-navegador'

export type ContaLigavel = 'github' | 'supabase' | 'hosp'
export type EstadoLigacao = 'pendente' | 'esperando' | 'ligado' | 'erro'
export type SituacaoContas = Record<ContaLigavel, { ligado: boolean; usuario: string | null }>
export type ResultadoChave = { ok: true } | { ok: false; motivo: 'formato' | 'recusada' }

export interface PonteLigarContas {
  situacao(): Promise<SituacaoContas>
  estado(conta: ContaLigavel): Promise<EstadoLigacao>
  /** GitHub e Vercel: começa o login; devolve o código que a pessoa cola no site (o site abre ao lado, pelo processo principal). */
  ligar(conta: 'github' | 'hosp', onde: Retangulo): Promise<{ codigo: string }>
  /** Plano B: abre o site no navegador do computador. */
  siteFora(conta: ContaLigavel): Promise<void>
  /** Supabase: abre a página de chaves ao lado. */
  abrirChaves(onde: Retangulo): Promise<void>
  /** Supabase: o Atlas testa a chave e guarda no cofre. */
  chaveSupabase(chave: string): Promise<ResultadoChave>
  cancelar(conta: ContaLigavel): Promise<void>
}

export interface LigarContasFixture extends PonteLigarContas {
  /** Simula a pessoa confirmando no site. */
  confirmar(conta: ContaLigavel): void
  falhar(conta: ContaLigavel): void
}

const vazia = (): SituacaoContas => ({ github: { ligado: false, usuario: null }, supabase: { ligado: false, usuario: null }, hosp: { ligado: false, usuario: null } })

export function criarLigarContasFixture(ligadas: ContaLigavel[] = []): LigarContasFixture {
  const est: Record<ContaLigavel, EstadoLigacao> = { github: 'pendente', supabase: 'pendente', hosp: 'pendente' }
  for (const c of ligadas) est[c] = 'ligado'
  return {
    async situacao() {
      const s = vazia()
      for (const c of Object.keys(est) as ContaLigavel[]) if (est[c] === 'ligado') s[c] = { ligado: true, usuario: c === 'supabase' ? null : 'ze-barbearia' }
      return s
    },
    async estado(c) { return est[c] },
    async ligar(c) { est[c] = 'esperando'; return { codigo: c === 'github' ? '4F2A-9C1B' : 'WXKD-TPLM' } },
    async siteFora() {},
    async abrirChaves() {},
    async chaveSupabase(chave) {
      if (!/^sbp_[a-z0-9]{40}$/i.test(chave.trim())) return { ok: false, motivo: 'formato' }
      est.supabase = 'ligado'
      return { ok: true }
    },
    async cancelar(c) { if (est[c] === 'esperando') est[c] = 'pendente' },
    confirmar(c) { est[c] = 'ligado' },
    falhar(c) { est[c] = 'erro' },
  }
}
