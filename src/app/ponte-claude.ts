// Porta entre o app e o Claude Code do cliente. O Atlas NUNCA faz o login do Claude: quem entra é o cliente,
// no claude.ai dele (regra da Anthropic: sem OAuth de assinatura em app de terceiros). O Atlas só guia e DETECTA.
// O adaptador real (rodar o CLI do Claude e ler conta/plano) fica para /entregar (app/PENDENTE-ENTREGAR.md).

export type Plano = 'pro' | 'max'

export interface EstadoClaude {
  conectado: boolean
  /** E-mail da conta conectada (só para mostrar na tela). */
  conta?: string
  /** Plano detectado. O Atlas não escolhe nem troca plano. */
  plano?: Plano
  /** Assinatura como o Claude informa (ex.: 'ultra'), só para mostrar no menu. */
  assinatura?: string
}

export type SiteClaude = 'criar-conta' | 'planos'

export interface PonteClaude {
  /** Abre o claude.ai no navegador do cliente para ele entrar. Não recebe nem guarda senha, código ou token. */
  abrirLogin(): Promise<void>
  /** Abre uma página do site do Claude (criar conta ou ver planos). O upgrade é feito lá, nunca no Atlas. */
  abrirSite(alvo: SiteClaude): Promise<void>
  /** Lê o estado atual (leve, pode ser chamado de tempos em tempos). */
  estado(): Promise<EstadoClaude>
  /** Renova a conexão com o Claude Code para ele refletir um plano novo (quando só muda após reentrar). */
  renovarConexao(): Promise<EstadoClaude>
}

/** Claude de mentirinha (modo fixture e testes). Nunca roda o CLI de verdade. */
export interface ClaudeFixture extends PonteClaude {
  /** Simula o cliente terminando o login no navegador. */
  simularLogin(conta?: string, plano?: Plano): void
  /** Simula o cliente trocando o plano no site do Claude. `refletidoSoAoRenovar`: o Claude Code só enxerga depois de reentrar. */
  simularUpgrade(plano?: Plano, refletidoSoAoRenovar?: boolean): void
  readonly abertos: string[]
}

export function criarClaudeFixture(inicial: EstadoClaude = { conectado: false }, opcoes: { loginAutomatico?: boolean } = {}): ClaudeFixture {
  let visivel: EstadoClaude = { ...inicial }
  let real: EstadoClaude = { ...inicial }
  const abertos: string[] = []
  return {
    abertos,
    async abrirLogin() {
      abertos.push('login')
      if (opcoes.loginAutomatico) { real = { conectado: true, conta: 'zé@barbeariadoze.com.br', plano: 'pro' }; visivel = real }
    },
    async abrirSite(alvo) { abertos.push(alvo) },
    async estado() { return { ...visivel } },
    async renovarConexao() { visivel = { ...real }; return { ...visivel } },
    simularLogin(conta = 'zé@barbeariadoze.com.br', plano = 'pro') { real = { conectado: true, conta, plano }; visivel = real },
    simularUpgrade(plano = 'max', refletidoSoAoRenovar = false) {
      real = { ...real, plano }
      if (!refletidoSoAoRenovar) visivel = real
    },
  }
}

/** Sem adaptador real e fora do modo fixture: nada de fingir conexão. A tela avisa com calma. */
export const claudeIndisponivel: PonteClaude = {
  async abrirLogin() { throw new Error('indisponivel') },
  async abrirSite() { throw new Error('indisponivel') },
  async estado() { return { conectado: false } },
  async renovarConexao() { return { conectado: false } },
}
