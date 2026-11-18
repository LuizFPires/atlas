// Porta entre o app e o celular do cliente (app do Claude). O computador é o canteiro: a sessão do Claude Code roda nele
// e o cliente acompanha pelo app do Claude no celular, com a MESMA conta dele. O Atlas não guarda senha nem token.
// Como o Claude Code liga a sessão ao app do celular (Remote Control) o protótipo marca como "a confirmar na implementação":
// por isso a conexão real fica atrás desta porta. O adaptador real é pendência de /entregar (app/PENDENTE-ENTREGAR.md).

export type Frequencia = '30m' | '1h' | '3h' | 'etapa'
export type IdAviso = 'precisa' | 'etapa' | 'fim'

/** Preferências de notícias ao celular. Não são segredo: podem ficar num JSON de configuração do app. */
export interface PrefsCelular {
  frequencia: Frequencia
  avisos: Record<IdAviso, boolean>
}

export const PREFS_PADRAO: PrefsCelular = { frequencia: '1h', avisos: { precisa: true, etapa: true, fim: true } }

export interface PonteCelular {
  /** Endereço de onde se baixa o app do Claude no celular (vira o QR). Fixo dentro do adaptador, nunca vem de dado. */
  enderecoApp(): string
  /** Passa as preferências para a sessão do computador (frequência das notícias e quais avisos mandar). */
  aplicar(prefs: PrefsCelular): Promise<void>
}

export interface CelularFixture extends PonteCelular {
  /** Cada conjunto de preferências que o app mandou para a sessão. */
  readonly aplicadas: PrefsCelular[]
}

export function criarCelularFixture(): CelularFixture {
  const aplicadas: PrefsCelular[] = []
  return {
    aplicadas,
    enderecoApp: () => 'https://claude.ai/download',
    async aplicar(p) { aplicadas.push(structuredClone(p)) },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que o celular está ligado. */
export const celularIndisponivel: PonteCelular = {
  enderecoApp: () => 'https://claude.ai/download',
  async aplicar() { throw new Error('indisponivel') },
}

// ---- Onde as preferências ficam guardadas ----
/** Armazém das preferências. Escolha: JSON de configuração do app (localStorage do próprio app); frequência e avisos não são segredo. */
export interface ArmazemPrefs {
  ler(): PrefsCelular
  guardar(p: PrefsCelular): void
}

const CHAVE = 'atlas.celular.prefs'
const FREQS: Frequencia[] = ['30m', '1h', '3h', 'etapa']

/** Aceita só o que conhecemos: lixo ou versão antiga volta para o padrão, sem quebrar a tela. */
export function prefsValidas(x: unknown): PrefsCelular {
  const o = (x ?? {}) as Partial<PrefsCelular>
  const a = (o.avisos ?? {}) as Partial<Record<IdAviso, unknown>>
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : true)
  return {
    frequencia: FREQS.includes(o.frequencia as Frequencia) ? (o.frequencia as Frequencia) : PREFS_PADRAO.frequencia,
    avisos: { precisa: bool(a.precisa), etapa: bool(a.etapa), fim: bool(a.fim) },
  }
}

export function criarArmazemLocal(storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): ArmazemPrefs {
  let memoria: PrefsCelular | null = null
  return {
    ler() {
      try { const t = storage?.getItem(CHAVE); if (t) return prefsValidas(JSON.parse(t)) } catch { /* cai no padrão */ }
      return memoria ?? structuredClone(PREFS_PADRAO)
    },
    guardar(p) {
      memoria = structuredClone(p)
      try { storage?.setItem(CHAVE, JSON.stringify(p)) } catch { /* sem disco: fica só na memória */ }
    },
  }
}
