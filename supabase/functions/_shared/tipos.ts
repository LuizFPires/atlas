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
  /** M6: usuário do Supabase Auth ligado a este cliente (login do portal). Nunca sai para o navegador. */
  auth_user_id?: string | null
  /** LGPD: quando a conta foi excluída (dados pessoais anonimizados). */
  excluido_em?: Date | null
  /** Cidade e UF que o cliente informou no cadastro (0026). Nunca derivadas de IP. Nulos em cadastros antigos. */
  cidade?: string | null
  uf?: string | null
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
  /** Cortesia manual do gestor. Ausente = 'paga' (caminho de sempre). */
  tipo?: 'paga' | 'cortesia'
  /** 'degustacao' = teste grátis self-service (1 por computador na ativação). Ausente/nulo = compra ou cortesia manual do gestor. */
  origem?: 'degustacao' | null
  /** Cortesia: até quando vale (obrigatório nela). Nulo = sem prazo. */
  validade_em?: Date | null
  /** Quando o cancelamento foi pedido/ocorreu (0027). Nulo = nunca ou antes da migration. Alimenta "Cancelamentos no mês" do painel. */
  cancelada_em?: Date | null
  /** M31 (0034): idioma da licença, decidido na compra e fixo depois. Ausente = 'pt'. */
  idioma?: 'pt' | 'en'
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
  /** App pronto comprado na prateleira (M32). Ausente/nulo = implantação do zero ou mensalidade. */
  segmento?: string | null
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
export interface Troca { licenca_id: string; de_hash: string; /** nulo = computador liberado pelo portal, ainda sem o novo ativado */ para_hash: string | null; feita_em: Date; por_admin: boolean }
/** Sessão do Stripe Checkout (prova da compra). O id `cs_…` é impossível de adivinhar e só volta ao comprador na URL de sucesso. */
export interface SessaoCheckout { conta_gateway_id: string; sessao_id: string; email: string; paga: boolean }
export interface Link { id: string; cliente_id: string; token_hash: string; expira_em: Date; usado_em: Date | null }
export interface Codigo { id: string; cliente_id: string; finalidade: Finalidade; codigo_hash: string; tentativas: number; expira_em: Date; usado_em: Date | null }
export interface Entrega { licenca_id: string; obra_id: string; marca_dagua: string; baixado_em: Date }
export type EstadoObra = 'construindo' | 'pausada' | 'aguardando_aprovacao' | 'pronta' | 'no_ar'

/** Resumo de uma obra (M30 relay). Nunca código, caminho de arquivo nem segredo. */
export interface StatusObraLinha {
  obra_id: string
  nome: string
  segmento: string | null
  etapa_atual_numero: number
  etapa_atual_rotulo: string
  total_etapas: number
  percentual: number
  estado: EstadoObra
  ativa_agora: boolean
  ultima_noticia: string
  ultima_noticia_em: Date
}

/** Personalização do app pronto (M32 b). Cores sempre #RRGGBB. */
export interface Personalizacao {
  nome_negocio: string
  logo_url: string | null
  cor_principal: string
  cor_apoio: string
}

export interface Ocorrencia {
  cliente_id: string | null
  tipo: string
  descricao: string
  /** M7: quem causou (e-mail do admin nas ações do painel; nulo = o próprio sistema). */
  autor?: string | null
  /** M7: já nasce resolvida (registro de auditoria que não precisa de atenção). Padrão: aberta. */
  resolvida?: boolean
  criada_em?: Date
  /** Bloco C: identifica "o mesmo alerta". Só pode haver 1 ocorrência ABERTA por chave (índice único parcial); repetida = ignorada. */
  chave?: string | null
}
/** M7: ocorrencias_admin como o painel lê. */
export interface OcorrenciaAdmin {
  id: string
  cliente_id: string | null
  tipo: string
  descricao: string
  autor: string | null
  resolvida: boolean
  criada_em: Date
  resolvida_por: string | null
  resolvida_em: Date | null
  chave?: string | null
}

/** Liberação pelo portal: desativa o computador atual sem ativar outro (o novo ativa depois, pelo link). */
export interface LiberacaoAtomica {
  licenca_id: string
  ativacao_atual_id: string
  de_hash: string
  quando: Date
  por_admin: boolean
  intervalo_ms: number
}

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
  /** HMAC do computador novo, só quando a licença é teste grátis (cortesia + origem degustacao): a RPC confere/grava o ledger. */
  dispositivo_hmac?: string | null
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
  /** Este computador já ativou (ativa ou não) OUTRA licença de degustação? Base do freio "1 degustação por computador". */
  /** Ledger durável (degustacoes_dispositivos, 0019): outro teste já usou este computador? Recebe o HMAC, nunca o hash cru. Sobrevive ao excluir-conta. */
  computadorJaTestou(dispositivoHmac: string, licencaIdAtual: string): Promise<boolean>
  /** Grava o computador no ledger (atômico). false = outro teste já é dono dele. */
  registrarDispositivoTeste(dispositivoHmac: string, licencaId: string, quando: Date): Promise<boolean>
  rotacionarToken(ativacaoId: string, tokenHash: string): Promise<void>
  /** RPC transacional: desativa a atual + insere a nova + registra a troca (+ zera o override). false = a atual mudou/limite. */
  trocarAtivacao(p: TrocaAtomica): Promise<boolean>
  trocasDa(licencaId: string): Promise<Troca[]>
  /** RPC transacional (liberar_computador): desativa a atual e registra a troca (para_hash nulo). Mesmas regras de limite/override de trocarAtivacao. */
  liberarAtivacao(p: LiberacaoAtomica): Promise<boolean>
  inserirEntrega(e: Entrega): Promise<void>
  inserirOcorrencia(o: Ocorrencia): Promise<void>

  // ── M30: relay do status das obras ──
  /** RPC substituir_status_obras (0022): atômico; o conjunto da licença passa a ser exatamente `obras` (upsert + remove as que sumiram). */
  substituirStatusObras(licencaId: string, obras: StatusObraLinha[], agora: Date): Promise<void>
  /** SELECT status_obras WHERE licenca_id (sempre filtrado pela licença do dono). */
  statusObrasDaLicenca(licencaId: string): Promise<StatusObraLinha[]>

  // ── M32 (b): personalização do app pronto, uma por licença ──
  /** UPSERT personalizacao_app (0024) pela licença. */
  salvarPersonalizacao(licencaId: string, p: Personalizacao, agora: Date): Promise<void>
  /** SELECT personalizacao_app WHERE licenca_id (sempre pela licença do dono). */
  personalizacaoDaLicenca(licencaId: string): Promise<Personalizacao | null>

  // ── M3: pagamento (a conta Stripe é do cliente; aqui só ficam referências) ──
  contaGateway(id: string): Promise<ContaGateway | null>
  /** Atômico (INSERT ... ON CONFLICT DO NOTHING). false = evento já visto (idempotência do webhook). */
  registrarEventoGateway(contaId: string, eventoId: string): Promise<boolean>
  /** Desfaz o registro quando o processamento falhou, para o gateway poder reenviar. */
  liberarEventoGateway(contaId: string, eventoId: string): Promise<void>
  licencaPorGateway(contaId: string, ref: { cliente?: string | null; assinatura?: string | null }): Promise<Licenca | null>
  /** Cria cliente+licença da compra paga; se o e-mail já tem licença, devolve a existente (idempotente). */
  criarCompra(c: NovaCompra): Promise<{ licenca: Licenca; nova: boolean }>
  /** M31: grava o idioma da licença (só na compra em dólar). */
  definirIdiomaLicenca(licencaId: string, idioma: 'pt' | 'en'): Promise<void>
  /** M31: idioma da licença ('pt' quando não houver). */
  idiomaDaLicenca(licencaId: string): Promise<'pt' | 'en'>
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
  /** RPC criar_cortesia (0013): acha/cria o cliente e cria/renova a licença de cortesia. 'ja_tem_paga' = nada foi alterado. */
  criarCortesia(c: { email: string; nome: string; validade_em: Date; agora: Date }): Promise<{ resultado: 'criada' | 'atualizada' | 'ja_tem_paga'; licenca: Licenca }>

  // ── Bloco B: degustação self-service (0016) ──
  /** config_degustacao (1 linha). Nasce desligada. */
  configDegustacao(): Promise<ConfigDegustacao>
  /** Só o painel admin chama. `dias` ausente = mantém. */
  definirConfigDegustacao(c: { ativa: boolean; dias?: number; por: string; agora: Date }): Promise<ConfigDegustacao>
  /** dominios_bloqueados (lista extensível, além da lista base em código). `dominio` já em minúsculas. */
  dominioBloqueado(dominio: string): Promise<boolean>
  /** RPC pedir_degustacao: grava/renova o pedido PENDENTE (não cria licença). 'ja_usada' = esse e-mail normalizado já confirmou. */
  pedirDegustacao(p: { email: string; email_hash: string; token_hash: string; ip: string; expira_em: Date; agora: Date }): Promise<'criado' | 'reenviado' | 'ja_usada'>
  /** RPC limpar_ips_degustacao (0017): zera o ip de pedidos com mais de `dias` dias. Devolve quantas linhas. */
  limparIpsDegustacao(agora: Date, dias: number): Promise<number>
  /** dominios_bloqueados (bloco C): lista, adiciona (false = já existia) e remove (false = não existia). `dominio` já normalizado. */
  listarDominiosBloqueados(): Promise<Array<{ dominio: string; motivo: string; criado_em: Date }>>
  adicionarDominioBloqueado(dominio: string, motivo: string, agora: Date): Promise<boolean>
  removerDominioBloqueado(dominio: string): Promise<boolean>
  /** RPC auditar_degustacao (0020): varre a atividade desde `desde`, abre ocorrências 'auditoria_degustacao' (sem repetir alerta aberto). Devolve quantas NOVAS. */
  auditarDegustacao(agora: Date, desde: Date): Promise<number>
  /** RPC registrar_barrada_dispositivo (0020): conta uma tentativa barrada do computador (HMAC) que já usou outro teste. */
  registrarBarradaDispositivo(hmac: string, quando: Date): Promise<void>
  /** RPC criar_degustacao: o token confirmado vira licença de teste (cortesia), com o mesmo lock por e-mail de criar_compra/criar_cortesia. */
  criarDegustacao(p: { token_hash: string; dias: number; agora: Date }): Promise<{ resultado: 'criada' | 'token_invalido' | 'expirada' | 'ja_usada' | 'ja_tem_licenca'; email?: string; licenca?: Licenca }>

  // ── M6: portal do cliente (login próprio via Supabase Auth) ──
  clientePorAuthUser(authUserId: string): Promise<Cliente | null>
  /** Atômico: UPDATE clientes SET auth_user_id WHERE id AND auth_user_id IS NULL. false = já ligado a alguém. */
  vincularAuthUser(clienteId: string, authUserId: string): Promise<boolean>

  // ── M4: cadastro pós-pagamento ──
  /** Atômico: UPDATE clientes SET nome_tratamento, empresa, ramo, cadastro_em WHERE id AND cadastro_em IS NULL. false = já cadastrado. */
  salvarCadastro(clienteId: string, c: { nome: string; empresa: string; ramo: string; cidade?: string | null; uf?: string | null }, quando: Date): Promise<boolean>
  /** Guarda a sessão do checkout criada (ainda não paga). Idempotente. */
  registrarSessao(contaId: string, sessaoId: string, email: string): Promise<void>
  /** Marca a sessão como paga (upsert: cria se o webhook chegar sem registro prévio). */
  marcarSessaoPaga(contaId: string, sessaoId: string, email: string): Promise<void>
  sessaoPorId(sessaoId: string): Promise<SessaoCheckout | null>
  /** LGPD: grava o aceite dos Termos/Política (versão + quando) para o e-mail da compra. Falhou = lança (a compra não segue sem o registro). */
  registrarConsentimento(email: string, versao: string, origem: 'checkout', quando: Date): Promise<void>
  /** LGPD: apaga/anonimiza os dados pessoais do cliente de forma atômica (RPC excluir_conta). false = cliente não encontrado. */
  excluirConta(clienteId: string, quando: Date): Promise<boolean>
  /** Invalida (usado_em) os links de instalação ainda abertos do cliente. */
  invalidarLinks(clienteId: string, quando: Date): Promise<void>
  /** Atômico: invalida os links abertos do cliente e insere o novo na mesma operação (sempre sobra um só válido). */
  trocarLinks(l: Omit<Link, 'id' | 'usado_em'>, quando: Date): Promise<void>
  /** Desfaz o cadastro quando o e-mail de boas-vindas não saiu, para o cliente poder tentar de novo. */
  reabrirCadastro(clienteId: string): Promise<void>

  // ── M7: painel do administrador (só leitura agregada + resolver ocorrência) ──
  // Adaptador real (/entregar): service_role, SELECT só das colunas abaixo (nunca token_hash, gateway_*, conta_gateway_id).
  // Com ~1.200 clientes/ano as listas cabem na memória do painel; se crescer, trocar por RPC de agregação/paginação.
  listarClientes(): Promise<Cliente[]>
  listarLicencas(): Promise<Licenca[]>
  listarPagamentos(): Promise<Pagamento[]>
  listarAtivacoes(): Promise<Ativacao[]>
  listarTrocas(): Promise<Troca[]>
  /** ocorrencias_admin WHERE NOT resolvida ORDER BY criada_em DESC LIMIT n. */
  ocorrenciasAbertas(limite: number): Promise<OcorrenciaAdmin[]>
  /** Atômico: UPDATE ocorrencias_admin SET resolvida=true, resolvida_por, resolvida_em WHERE id AND NOT resolvida. false = 0 linhas. */
  resolverOcorrencia(id: string, por: string, quando: Date): Promise<boolean>
  /** entregas_kit ORDER BY baixado_em DESC LIMIT n. */
  entregasRecentes(limite: number): Promise<Entrega[]>
  entregasDaLicenca(licencaId: string, limite: number): Promise<Entrega[]>
  /** entregas_kit WHERE marca_dagua = $1 (índice já existe): rastrear de quem veio um arquivo vazado. */
  entregasPorMarca(marca: string): Promise<Entrega[]>

  // ── M33: Radar de pirataria (só avisa; nada aqui mexe em licença) ──
  /** INSERT radar_eventos. */
  registrarEventoRadar(e: EventoRadar): Promise<void>
  /** radar_eventos WHERE criado_em >= desde. */
  eventosRadar(desde: Date): Promise<EventoRadar[]>
  /** Ledger do teste grátis: computadores com ao menos `minimo` barradas e a última em/depois de `desde`. */
  barradasDeTeste(desde: Date, minimo: number): Promise<BarradaTeste[]>
  /** radar_baixas: sinal_id -> quando foi dada a baixa. */
  baixasRadar(): Promise<Array<{ sinal_id: string; resolvida_em: Date }>>
  /** UPSERT radar_baixas (a baixa mais nova vale). */
  baixarSinalRadar(sinalId: string, por: string, quando: Date): Promise<void>
  /** DELETE radar_eventos WHERE criado_em < antes (retenção). Devolve quantas linhas. */
  limparEventosRadar(antes: Date): Promise<number>

  // ── M65: política (o Atlas não constrói outro Atlas) ──
  /** INSERT politica_eventos. */
  registrarEventoPolitica(e: EventoPolitica): Promise<void>
  /** politica_eventos WHERE licenca_id AND obra_id AND criado_em >= desde (desde = última liberação). */
  eventosPoliticaDaObra(licencaId: string, obraId: string, desde: Date): Promise<EventoPolitica[]>
  /** politica_eventos WHERE criado_em >= desde ORDER BY criado_em DESC LIMIT n (painel). */
  eventosPoliticaRecentes(desde: Date, limite: number): Promise<EventoPolitica[]>
  /** politica_obras da licença (inclui a linha '*' da licença inteira). */
  situacoesPolitica(licencaId: string): Promise<SituacaoPolitica[]>
  /** politica_obras WHERE situacao IN ('embargada','recusada') (painel). */
  situacoesPoliticaAbertas(): Promise<SituacaoPolitica[]>
  /** UPSERT politica_obras (licenca_id, obra_id). */
  definirSituacaoPolitica(s: SituacaoPolitica): Promise<void>
  /** M59: convite dos testadores do Google (um por obra) e quem entrou pela página do Atlas. */
  salvarConviteTeste(c: ConviteTeste): Promise<void>
  conviteTestePorCodigo(codigo: string): Promise<ConviteTeste | null>
  conviteTesteDaObra(licencaId: string, obraId: string): Promise<ConviteTeste | null>
  registrarTestador(t: Testador): Promise<void>
  testadoresDoConvite(codigo: string): Promise<Testador[]>
}

export type OndePolitica = 'ideia' | 'prototipo' | 'planilha' | 'posobra' | 'codigo' | 'engano'
export interface ConviteTeste { codigo: string; licenca_id: string; obra_id: string; app_nome: string; grupo_url: string; optin_url: string; criado_em: Date }
export interface Testador { codigo: string; nome: string; entrou_em: Date }
export interface EventoPolitica { licenca_id: string; obra_id: string; onde: OndePolitica; texto: string; criado_em: Date }
export interface SituacaoPolitica { licenca_id: string; obra_id: string; situacao: 'embargada' | 'liberada' | 'mantida' | 'recusada'; desde: Date; decidido_por: string | null }

/** Radar de pirataria (0028). NUNCA IP: só a UF derivada do acesso e o id CURTO do dispositivo (8 hex). */
export interface EventoRadar { licenca_id: string; tipo: 'instancia_recusada' | 'acesso'; uf: string | null; dispositivo: string | null; criado_em: Date }
/** Computador que o ledger do teste grátis já barrou (degustacoes_dispositivos). `dispositivo` = 8 primeiros caracteres do HMAC. */
export interface BarradaTeste { dispositivo: string; licenca_id: string; barradas: number; ultima_em: Date }

export interface ConfigDegustacao { ativa: boolean; dias: number }

export interface Deps {
  store: Store
  agora: () => Date
  enviarCodigoPorEmail: (email: string, codigo: string, idioma?: 'pt' | 'en') => Promise<void>
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
