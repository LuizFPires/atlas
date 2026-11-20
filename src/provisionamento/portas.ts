// M32 (e1) — PORTAS do provisionamento da prateleira. O Atlas monta o app NA CONTA DE NUVEM DO CLIENTE
// (GitHub + Supabase + Vercel dele). Aqui só existem as interfaces; adaptadores reais vêm na fatia (e3).

export type Segmento = 'barbearia' | 'restaurante' | 'mercearia' | 'academia'

/** Personalização já persistida (M32 b). */
export interface PersonalizacaoApp {
  nome_negocio: string
  logo_url: string | null
  cor_principal: string
  cor_apoio: string
}

/** Licença do comprador (só o que o app entregue precisa para o guardião). */
export interface LicencaComprador {
  id: string
  email: string
}

export interface Compra {
  /** Uma compra = um registro de provisionamento. */
  id: string
  segmento: Segmento
  personalizacao: PersonalizacaoApp
  licenca: LicencaComprador
}

/**
 * Credenciais do CLIENTE, passadas EFEMERAMENTE a cada chamada.
 * REGRA: nenhuma porta, orquestrador ou registro pode gravar, logar, devolver ou colocar em mensagem de erro
 * qualquer um destes valores. Vivem só na memória durante a chamada.
 */
export interface Credenciais {
  github: string
  supabase: string
  vercel: string
}

export interface ContextoPasso {
  compra: Compra
  credenciais: Credenciais
}

export interface RepoCriado {
  /** Ex.: "dono/barbearia-do-ze". Nunca contém credencial. */
  repo: string
  url: string
}
export interface BancoCriado {
  /** Referência do projeto do cliente (id) e URL pública do banco. */
  projeto: string
  url: string
}
export interface DeployFeito {
  /** Endereço público real do app. */
  endereco: string
}

export interface PortaCodigo {
  /** Já existe o repo desta compra? (idempotência) */
  existe(ctx: ContextoPasso): Promise<RepoCriado | null>
  /** Cria o repo do cliente a partir do app-modelo do segmento, com marca d'água + aviso de licença (invariante M26). */
  criar(ctx: ContextoPasso): Promise<RepoCriado>
}

export interface PortaBanco {
  existe(ctx: ContextoPasso): Promise<BancoCriado | null>
  /** Cria/usa o projeto do cliente e aplica as migrations do segmento. */
  criarEMigrar(ctx: ContextoPasso): Promise<BancoCriado>
}

export interface PortaHospedagem {
  existe(ctx: ContextoPasso): Promise<DeployFeito | null>
  /** Deploy do repo apontando ao banco; devolve o endereço público. */
  deploy(ctx: ContextoPasso, repo: RepoCriado, banco: BancoCriado): Promise<DeployFeito>
}

export interface PortaGuardiao {
  /** Já está amarrado? */
  amarrado(ctx: ContextoPasso): Promise<boolean>
  /** Grava no app entregue o vínculo licença↔instância (sem guardar segredo no repo). */
  amarrar(ctx: ContextoPasso, endereco: string): Promise<void>
}

export type NomePasso = 'repo' | 'banco' | 'deploy' | 'guardiao' | 'publicar'
export const ORDEM_PASSOS: readonly NomePasso[] = ['repo', 'banco', 'deploy', 'guardiao', 'publicar']

export type EstadoPasso = 'pendente' | 'fazendo' | 'feito' | 'erro'

/** Registro PERSISTIDO, um por compra. Não tem campo para credencial, de propósito. */
export interface RegistroProvisionamento {
  compra_id: string
  passos: Record<NomePasso, EstadoPasso>
  repo: RepoCriado | null
  banco: BancoCriado | null
  endereco: string | null
  /** Mensagem em português para o dono, sem detalhe técnico nem credencial. */
  erro: string | null
}

export interface PortaRegistro {
  ler(compraId: string): Promise<RegistroProvisionamento | null>
  gravar(r: RegistroProvisionamento): Promise<void>
}

export interface PortasProvisionamento {
  codigo: PortaCodigo
  banco: PortaBanco
  hospedagem: PortaHospedagem
  guardiao: PortaGuardiao
  registro: PortaRegistro
}
