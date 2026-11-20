// M32 (b) — porta da ENTREGA do app pronto. O provisionamento real (instanciar o app-modelo como obra do cliente:
// repo dele, deploy, marca d'água) ainda não existe: a tela constrói contra esta PORTA, com adaptador FIXTURE.
// Pendência registrada em app/PENDENTE-ENTREGAR.md ("M32 (b) — provisionamento real").

export type EstadoEntrega =
  | { estado: 'montando'; mensagem?: string }
  | { estado: 'pronto'; nome: string; link: string }
  | { estado: 'falhou'; mensagem: string }

export interface PortaEntrega {
  /** Estado do app da licença do dono logado. O servidor descobre a licença pelo login. */
  estado(): Promise<EstadoEntrega>
}

/** "Barbearia do Zé" -> "barbeariadoze" (só letras e números, sem acento). */
export function slugDoNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'meuapp'
}

/** Produção, enquanto o provisionamento real não existe: sempre "preparando". Nunca devolve app pronto nem link. */
export function criarEntregaProducao(): PortaEntrega {
  return {
    async estado() {
      return { estado: 'montando', mensagem: 'Estamos preparando o seu app. Avisamos assim que ele estiver pronto.' }
    },
  }
}

/** Fixture: devolve um app "pronto" com link de exemplo. NÃO é um app de verdade. */
export function criarEntregaFixture(nome = 'Barbearia do Zé', estado: EstadoEntrega['estado'] = 'pronto'): PortaEntrega {
  return {
    async estado() {
      if (estado === 'montando') return { estado: 'montando' }
      if (estado === 'falhou') return { estado: 'falhou', mensagem: 'Não conseguimos montar agora.' }
      return { estado: 'pronto', nome, link: `https://${slugDoNome(nome)}.atlas-ia.app.br` }
    },
  }
}
