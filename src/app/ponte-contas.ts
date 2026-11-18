// Porta entre o app e as contas do cliente (GitHub, Supabase, Vercel). As contas são do PRÓPRIO cliente:
// o Atlas NÃO cria conta, NÃO digita credencial, NÃO faz OAuth de assinatura e NÃO guarda senha ou token.
// Ele só abre o site oficial (URL fixa, dentro do adaptador) e DETECTA quando a conta ficou pronta.
// O adaptador real (olhar se a conta/projeto existe) fica para /entregar (app/PENDENTE-ENTREGAR.md).

export type ContaObrigatoria = 'github' | 'supabase' | 'hosp'
export const CONTAS_OBRIGATORIAS: ContaObrigatoria[] = ['github', 'supabase', 'hosp']

export interface PonteContas {
  /** Abre o site oficial da conta no navegador do cliente. A URL é fixa dentro do adaptador, nunca vem de dado. */
  abrirSite(conta: ContaObrigatoria): Promise<void>
  /** Leve, pode ser chamado de tempos em tempos: a conta já está pronta? */
  pronta(conta: ContaObrigatoria): Promise<boolean>
}

export interface ContasFixture extends PonteContas {
  /** Simula o cliente terminando a conta no site. */
  simularPronta(conta: ContaObrigatoria): void
  readonly abertos: string[]
}

export function criarContasFixture(prontas: ContaObrigatoria[] = []): ContasFixture {
  const feitas = new Set<ContaObrigatoria>(prontas)
  const abertos: string[] = []
  return {
    abertos,
    async abrirSite(c) { abertos.push(c) },
    async pronta(c) { return feitas.has(c) },
    simularPronta(c) { feitas.add(c) },
  }
}

/** Sem adaptador real e fora do modo fixture: nada de fingir que a conta está pronta. */
export const contasIndisponivel: PonteContas = {
  async abrirSite() { throw new Error('indisponivel') },
  async pronta() { return false },
}
