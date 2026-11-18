// Porta entre o app e o celular do cliente (app do Claude). O computador é o canteiro: a sessão do Claude Code roda nele
// e o cliente acompanha pelo app do Claude no celular, com a MESMA conta dele. O Atlas não guarda senha nem token.
// Como o Claude Code liga a sessão ao app do celular (Remote Control) o protótipo marca como "a confirmar na implementação":
// por isso a conexão real fica atrás desta porta. O adaptador real é pendência de /entregar (app/PENDENTE-ENTREGAR.md).

export interface PonteCelular {
  /** Endereço de onde se baixa o app do Claude no celular (vira o QR). Fixo dentro do adaptador, nunca vem de dado. */
  enderecoApp(): string
}

export type CelularFixture = PonteCelular

export function criarCelularFixture(): CelularFixture {
  return {
    enderecoApp: () => 'https://claude.ai/download',
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que o celular está ligado. */
export const celularIndisponivel: PonteCelular = {
  enderecoApp: () => 'https://claude.ai/download',
}
