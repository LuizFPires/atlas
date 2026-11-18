// Capacidades do pipeline que as OBRAS do cliente podem usar (login, avisos, pagamento na conta do cliente, LGPD básico).
// Aqui ficam as regras testáveis e os "fixtures"; as instruções para o agente vivem nas skills do kit (.claude/skills/<id>).
// Nada aqui guarda segredo: chaves vêm do ambiente do servidor do CLIENTE e nunca de arquivo.

export type CapacidadeId = 'login-usuarios' | 'notificacoes' | 'pagamento-cliente' | 'lgpd-basico'

export interface Capacidade {
  id: CapacidadeId
  nome: string
  /** Em uma frase que um leigo entende. */
  resumo: string
  /** Capacidades que precisam vir junto. */
  exige: CapacidadeId[]
}

export const CAPACIDADES: readonly Capacidade[] = [
  { id: 'login-usuarios', nome: 'Entrada das pessoas', resumo: 'Cada pessoa entra com a sua chave e só vê o que é dela.', exige: ['lgpd-basico'] },
  { id: 'notificacoes', nome: 'Avisos', resumo: 'Recados no celular ou no e-mail, só para quem aceitou receber.', exige: ['lgpd-basico'] },
  { id: 'pagamento-cliente', nome: 'Pagamento online', resumo: 'O dinheiro cai direto na conta do dono do negócio.', exige: ['login-usuarios', 'lgpd-basico'] },
  { id: 'lgpd-basico', nome: 'Privacidade (LGPD)', resumo: 'Pedir só o necessário, avisar para quê e apagar quando a pessoa pedir.', exige: [] },
]

/** Pedido de capacidades + tudo o que elas exigem (sem repetir, na ordem do catálogo). Ids desconhecidos são ignorados. */
export function comDependencias(pedidas: readonly string[]): CapacidadeId[] {
  const mapa = new Map(CAPACIDADES.map((c) => [c.id, c]))
  const ok = new Set<CapacidadeId>()
  const visitar = (id: string) => {
    const c = mapa.get(id as CapacidadeId)
    if (!c || ok.has(c.id)) return
    ok.add(c.id)
    c.exige.forEach(visitar)
  }
  pedidas.forEach(visitar)
  return CAPACIDADES.map((c) => c.id).filter((id) => ok.has(id))
}

// ---- Pagamento: sempre a conta do CLIENTE -----------------------------------------------------------------------------------

export interface ContaGateway {
  /** Quem é o dono da conta do gateway. Só 'cliente' é aceito. */
  dono: string
  gateway: string
  /** Nome da variável de ambiente que guarda a chave secreta (nunca o valor). */
  chaveSecretaEnv: string
}

const NOME_DE_VARIAVEL = /^[A-Z][A-Z0-9_]{2,60}$/

/** Valida a configuração de pagamento de uma obra. Falha fechado: qualquer dúvida vira recusa. */
export function validarContaGateway(c: ContaGateway): { ok: true } | { ok: false; motivo: string } {
  if (c.dono !== 'cliente') return { ok: false, motivo: 'O pagamento tem de cair na conta do próprio cliente, nunca na do Atlas.' }
  if (!c.gateway.trim()) return { ok: false, motivo: 'Falta dizer qual é o gateway do cliente.' }
  // Só aceita um NOME de variável. Se colaram o valor da chave aqui, recusa (e não repete o valor na mensagem).
  if (!NOME_DE_VARIAVEL.test(c.chaveSecretaEnv)) {
    return { ok: false, motivo: 'Aqui vai só o nome da variável da chave, nunca a chave em si.' }
  }
  return { ok: true }
}

// ---- LGPD básico (fixture em memória) ---------------------------------------------------------------------------------------

export interface Consentimento { pessoa: string; textoVersao: string; aceitoEm: string; finalidades: string[] }

export interface ArmazemLgpd {
  registrarConsentimento(c: Omit<Consentimento, 'aceitoEm'>): Consentimento
  consentimentoDe(pessoa: string): Consentimento | null
  /** Exclusão de conta: apaga a pessoa e o que o app guarda sobre ela. */
  excluirConta(pessoa: string): boolean
  /** "Pedir os próprios dados". */
  exportar(pessoa: string): { pessoa: string; consentimento: Consentimento | null }
}

export function criarLgpdFixture(agora: () => string = () => new Date().toISOString()): ArmazemLgpd {
  const dados = new Map<string, Consentimento>()
  return {
    registrarConsentimento(c) {
      if (!c.finalidades.length) throw new Error('sem-finalidade')
      const reg = { ...c, finalidades: [...c.finalidades], aceitoEm: agora() }
      dados.set(c.pessoa, reg)
      return reg
    },
    consentimentoDe: (p) => dados.get(p) ?? null,
    excluirConta: (p) => dados.delete(p),
    exportar: (p) => ({ pessoa: p, consentimento: dados.get(p) ?? null }),
  }
}

// ---- Avisos (fixture): um enviador falso que só anota -------------------------------------------------------------------------

export type Canal = 'email' | 'whatsapp' | 'push'
export interface Aviso { para: string; canal: Canal; texto: string }

export interface Avisos {
  darPermissao(pessoa: string, canal: Canal): void
  pararDeReceber(pessoa: string, canal: Canal): void
  /** Só envia a quem deu permissão. Devolve se enviou. */
  enviar(a: Aviso): boolean
  readonly enviados: readonly Aviso[]
}

export function criarAvisosFixture(): Avisos {
  const permitido = new Set<string>()
  const enviados: Aviso[] = []
  const chave = (p: string, c: Canal) => `${p}|${c}`
  return {
    darPermissao: (p, c) => { permitido.add(chave(p, c)) },
    pararDeReceber: (p, c) => { permitido.delete(chave(p, c)) },
    enviar(a) {
      if (!permitido.has(chave(a.para, a.canal))) return false
      enviados.push({ ...a })
      return true
    },
    enviados,
  }
}
