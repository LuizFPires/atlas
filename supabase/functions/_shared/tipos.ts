// Tipos do domínio de licenças (espelham supabase/migrations/0001).
export type StatusLicenca = 'ativa' | 'atrasada' | 'pausada' | 'cancelada'
export type Finalidade = 'ativacao' | 'troca'

export interface Cliente {
  id: string
  email_compra: string
  nome_tratamento: string
  // M4 (cadastro pós-pagamento). Opcionais para não quebrar quem monta clientes sem cadastro.
  empresa?: string | null
  ramo?: string | null
  /** Quando as 4 respostas foram gravadas (nulo = cadastro ainda não feito). */
  cadastro_em?: Date | null
}
export interface Licenca {
  id: string
  cliente_id: string
  status: StatusLicenca
  pausa_prevista_em: Date | null
  troca_liberada_em: Date | null
  // M3 (pagamento). Opcionais para não quebrar quem monta licenças sem cobrança.
  /** Quando a implantação foi paga (início dos 7 dias de arrependimento). */
  comprada_em?: Date | null
  /** Quantos avisos de atraso já foram enviados no ciclo atual (0 a 3). */
  avisos_atraso?: number
  conta_gateway_id?: string | null
  gateway_cliente_ref?: string | null
  gateway_assinatura_ref?: string | null
  /** Mensalidade cancelada: a licença segue até aqui e então vira 'cancelada'. */
  mensalidade_encerra_em?: Date | null
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
export type TipoPagamento = 'implantacao' | 'mensalidade'
export type StatusPagamento = 'pendente' | 'pago' | 'falhou' | 'estornado'
export interface Pagamento {
  licenca_id: string
  /** Conta do cliente dona deste pagamento. A chave natural é (conta_gateway_id, gateway_ref). */
  conta_gateway_id: string
  tipo: TipoPagamento
  valor: number
  status: StatusPagamento
  /** Referência do gateway DO CLIENTE (pi_… da implantação, in_… da fatura). Nunca dados de cartão. */
  gateway_ref: string
  /** payment_intent usado para estornar (fatura → pi_…). */
  gateway_pi: string | null
  pago_em: Date | null
}
/** Conta de pagamento do cliente. Guarda só a REFERÊNCIA dos segredos (nome no cofre/ambiente), nunca o valor. */
export interface ContaGateway {
  id: string
  conta_stripe_id: string
  segredo_ref: string
  modo: 'teste' | 'ao_vivo'
  /** Origem https do site do cliente para onde a Stripe devolve o comprador (nunca vem da requisição). */
  base_retorno?: string | null
}
/** Condição do UPDATE condicional da licença (todas as informadas valem juntas, como um WHERE ... AND ...). */
export interface CondicaoLicenca {
  status?: StatusLicenca
  status_diferente?: StatusLicenca
  avisos_atraso?: number
  /** pausa_prevista_em <= este instante */
  pausa_prevista_ate?: Date
  /** mensalidade_encerra_em <= este instante */
  encerra_ate?: Date
}
export interface NovaCompra {
  email: string
  nome: string
  valor: number
  conta_gateway_id: string
  gateway_cliente_ref: string | null
  agora: Date
}
export interface Troca { licenca_id: string; de_hash: string; para_hash: string; feita_em: Date; por_admin: boolean }
/** Sessão do Stripe Checkout (prova da compra). O id `cs_…` é impossível de adivinhar e só volta ao comprador na URL de sucesso. */
export interface SessaoCheckout { conta_gateway_id: string; sessao_id: string; email: string; paga: boolean }
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
  /** Atômico: UPDATE licencas SET <campos de `set`> WHERE id AND <cond>. false = 0 linhas (outro processo mudou antes). */
  atualizarLicencaSe(id: string, set: Partial<Omit<Licenca, 'id' | 'cliente_id'>>, cond: CondicaoLicenca): Promise<boolean>
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

  // ── M3: pagamento (a conta Stripe é do cliente; aqui só ficam referências) ──
  contaGateway(id: string): Promise<ContaGateway | null>
  /** Atômico (INSERT ... ON CONFLICT DO NOTHING). false = evento já visto (idempotência do webhook). */
  registrarEventoGateway(contaId: string, eventoId: string): Promise<boolean>
  /** Desfaz o registro quando o processamento falhou, para o gateway poder reenviar. */
  liberarEventoGateway(contaId: string, eventoId: string): Promise<void>
  licencaPorGateway(contaId: string, ref: { cliente?: string | null; assinatura?: string | null }): Promise<Licenca | null>
  /** Cria cliente+licença da compra paga; se o e-mail já tem licença, devolve a existente (idempotente). */
  criarCompra(c: NovaCompra): Promise<{ licenca: Licenca; nova: boolean }>
  /** Upsert atômico por (conta_gateway_id, gateway_ref), condicional a status <> 'estornado' (estorno nunca é sobrescrito).
   *  Devolve o status anterior lido na própria operação (null = não existia; 'estornado' = nada foi aplicado). */
  gravarPagamento(p: Pagamento): Promise<StatusPagamento | null>
  pagamentoPorRef(contaId: string, ref: string): Promise<Pagamento | null>
  pagamentosPorPi(contaId: string, pi: string): Promise<Pagamento[]>
  pagamentosDa(licencaId: string): Promise<Pagamento[]>
  atualizarStatusPagamento(contaId: string, ref: string, status: StatusPagamento): Promise<void>
  licencasAtrasadas(): Promise<Licenca[]>
  /** Mensalidade cancelada cujo período pago já acabou (mensalidade_encerra_em <= agora) e ainda não 'cancelada'. */
  licencasEncerramentoVencido(agora: Date): Promise<Licenca[]>
  clientePorId(id: string): Promise<Cliente | null>

  // ── M4: cadastro pós-pagamento ──
  /** Atômico: UPDATE clientes SET nome_tratamento, empresa, ramo, cadastro_em WHERE id AND cadastro_em IS NULL. false = já cadastrado. */
  salvarCadastro(clienteId: string, c: { nome: string; empresa: string; ramo: string }, quando: Date): Promise<boolean>
  /** Guarda a sessão do checkout criada (ainda não paga). Idempotente. */
  registrarSessao(contaId: string, sessaoId: string, email: string): Promise<void>
  /** Marca a sessão como paga (upsert: cria se o webhook chegar sem registro prévio). */
  marcarSessaoPaga(contaId: string, sessaoId: string, email: string): Promise<void>
  sessaoPorId(sessaoId: string): Promise<SessaoCheckout | null>
  /** Invalida (usado_em) os links de instalação ainda abertos do cliente. */
  invalidarLinks(clienteId: string, quando: Date): Promise<void>
  /** Desfaz o cadastro quando o e-mail de boas-vindas não saiu, para o cliente poder tentar de novo. */
  reabrirCadastro(clienteId: string): Promise<void>
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
