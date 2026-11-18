// Tipos do domínio de licenças (espelham supabase/migrations/0001).
export type StatusLicenca = 'ativa' | 'atrasada' | 'pausada' | 'cancelada'
export type Finalidade = 'ativacao' | 'troca'

export interface Cliente { id: string; email_compra: string; nome_tratamento: string }
export interface Licenca {
  id: string
  cliente_id: string
  status: StatusLicenca
  pausa_prevista_em: Date | null
  troca_liberada_em: Date | null
}
export interface Ativacao { id: string; licenca_id: string; computador_hash: string; ativo: boolean; ativado_em: Date; desativado_em: Date | null }
export interface Troca { licenca_id: string; de_hash: string; para_hash: string; feita_em: Date; por_admin: boolean }
export interface Link { id: string; cliente_id: string; token_hash: string; expira_em: Date; usado_em: Date | null }
export interface Codigo { id: string; cliente_id: string; finalidade: Finalidade; codigo_hash: string; tentativas: number; expira_em: Date; usado_em: Date | null }
export interface Entrega { licenca_id: string; obra_id: string; marca_dagua: string; baixado_em: Date }
export interface Ocorrencia { cliente_id: string | null; tipo: string; descricao: string }

// Porta de acesso aos dados. Produção: adaptador Supabase (etapa /entregar). Testes: memória.
export interface Store {
  clientePorEmail(email: string): Promise<Cliente | null>
  licencaDoCliente(clienteId: string): Promise<Licenca | null>
  licencaPorId(id: string): Promise<Licenca | null>
  salvarLicenca(l: Licenca): Promise<void>
  inserirLink(l: Omit<Link, 'id' | 'usado_em'>): Promise<void>
  linkPorHash(hash: string): Promise<Link | null>
  marcarLinkUsado(id: string, quando: Date): Promise<void>
  inserirCodigo(c: Omit<Codigo, 'id' | 'tentativas' | 'usado_em'>): Promise<void>
  codigoAberto(clienteId: string, f: Finalidade): Promise<Codigo | null>
  salvarCodigo(c: Codigo): Promise<void>
  ativacaoAtiva(licencaId: string): Promise<Ativacao | null>
  inserirAtivacao(licencaId: string, hash: string, quando: Date): Promise<void>
  desativarAtivacao(id: string, quando: Date): Promise<void>
  trocasDa(licencaId: string): Promise<Troca[]>
  inserirTroca(t: Troca): Promise<void>
  inserirEntrega(e: Entrega): Promise<void>
  inserirOcorrencia(o: Ocorrencia): Promise<void>
}

export interface Deps {
  store: Store
  agora: () => Date
  enviarCodigoPorEmail: (email: string, codigo: string) => Promise<void>
  /** Segredo de assinatura vem do ambiente do servidor, nunca de arquivo. */
  segredo: string
}

export class ErroRegra extends Error {
  codigo: string
  status: number
  constructor(codigo: string, mensagem: string, status = 400) {
    super(mensagem)
    this.codigo = codigo
    this.status = status
  }
}

export const HASH_RE = /^[0-9a-f]{64}$/
