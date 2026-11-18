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
export interface Ativacao {
  id: string
  licenca_id: string
  computador_hash: string
  /** sha256 do segredo da ativação (device token). O segredo em si nunca é guardado. */
  token_hash: string | null
  ativo: boolean
  ativado_em: Date
  desativado_em: Date | null
}
export interface Troca { licenca_id: string; de_hash: string; para_hash: string; feita_em: Date; por_admin: boolean }
export interface Link { id: string; cliente_id: string; token_hash: string; expira_em: Date; usado_em: Date | null }
export interface Codigo { id: string; cliente_id: string; finalidade: Finalidade; codigo_hash: string; tentativas: number; expira_em: Date; usado_em: Date | null }
export interface Entrega { licenca_id: string; obra_id: string; marca_dagua: string; baixado_em: Date }
export interface Ocorrencia { cliente_id: string | null; tipo: string; descricao: string }

export interface TrocaAtomica {
  licenca_id: string
  ativacao_atual_id: string
  de_hash: string
  para_hash: string
  token_hash: string
  quando: Date
  por_admin: boolean
  /** 0 quando por_admin (override ignora o limite). */
  intervalo_ms: number
}

// Porta de acesso aos dados. Produção: adaptador Supabase (etapa /entregar). Testes: memória.
export interface Store {
  clientePorEmail(email: string): Promise<Cliente | null>
  licencaDoCliente(clienteId: string): Promise<Licenca | null>
  licencaPorId(id: string): Promise<Licenca | null>
  salvarLicenca(l: Licenca): Promise<void>
  inserirLink(l: Omit<Link, 'id' | 'usado_em'>): Promise<void>
  linkPorHash(hash: string): Promise<Link | null>
  /** Atômico: UPDATE ... WHERE usado_em IS NULL. false = já usado. */
  consumirLink(id: string, quando: Date): Promise<boolean>
  /** Emite código novo e invalida (usado_em) os abertos anteriores do mesmo cliente+finalidade, numa transação. */
  inserirCodigo(c: Omit<Codigo, 'id' | 'tentativas' | 'usado_em'>, agora: Date): Promise<void>
  codigoAberto(clienteId: string, f: Finalidade): Promise<Codigo | null>
  /** Atômico: tentativas+1 WHERE id AND usado_em IS NULL AND tentativas < max AND expira_em > agora. null = 0 linhas. */
  incrementarTentativa(id: string, max: number, agora: Date): Promise<Codigo | null>
  /** Atômico: usado_em=agora WHERE id AND usado_em IS NULL AND tentativas <= max AND expira_em > agora. false = 0 linhas. */
  consumirCodigo(id: string, max: number, agora: Date): Promise<boolean>
  /** Atômico: registra o evento só se houver menos de `max` na janela. false = limite atingido. */
  tentarEvento(chave: string, max: number, janelaMs: number, agora: Date): Promise<boolean>
  limparEventos(chave: string): Promise<void>
  ativacaoAtiva(licencaId: string): Promise<Ativacao | null>
  inserirAtivacao(licencaId: string, hash: string, quando: Date, tokenHash: string): Promise<void>
  rotacionarToken(ativacaoId: string, tokenHash: string): Promise<void>
  /** RPC transacional: desativa a atual + insere a nova + registra a troca (+ zera o override). false = a atual mudou/limite. */
  trocarAtivacao(p: TrocaAtomica): Promise<boolean>
  trocasDa(licencaId: string): Promise<Troca[]>
  inserirEntrega(e: Entrega): Promise<void>
  inserirOcorrencia(o: Ocorrencia): Promise<void>
}

export interface Deps {
  store: Store
  agora: () => Date
  enviarCodigoPorEmail: (email: string, codigo: string) => Promise<void>
  /** HMAC do servidor (hash de códigos, marca d'água). Vem do ambiente, nunca de arquivo. */
  segredo: string
  /** Chave privada Ed25519 que assina o /verificar (env ATLAS_SIGN_SK). */
  chaveAssinatura: CryptoKey
}

export class ErroRegra extends Error {
  codigo: string
  status: number
  constructor(codigo: string, mensagem: string, status = 400) {
    super(mensagem)
    this.codigo = codigo
    this.status = status
  }
  /** Campos extras da resposta (ex.: proxima_troca_em). */
  extra(): Record<string, unknown> {
    const { proxima_troca_em } = this as unknown as { proxima_troca_em?: Date }
    return proxima_troca_em ? { proxima_troca_em } : {}
  }
}

export const HASH_RE = /^[0-9a-f]{64}$/
