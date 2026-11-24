// Porta das fichas de trava (app/adaptadores/travas-acoes.cjs). A tela diz só o TIPO da trava; o endereço é fixo no processo principal.
import type { Retangulo } from './ponte-navegador'
import type { TipoTrava } from './travas'

export interface PonteTravas {
  /** Abre o site da trava ao lado, dentro do Atlas. */
  site(tipo: TipoTrava, onde: Retangulo): Promise<void>
  /** Plano B: no navegador do computador. */
  siteFora(tipo: TipoTrava): Promise<void>
  /** Só com a trava do GitHub aberta e depois da confirmação; volta para privado sozinho quando o GitHub libera. */
  deixarPublico(pasta: string): Promise<{ ok: true }>
  ehPublico(pasta: string): Promise<boolean>
}

export function criarTravasFixture(): PonteTravas & { abertos: string[]; publicas: string[] } {
  const abertos: string[] = []
  const publicas: string[] = []
  return {
    abertos, publicas,
    async site(t) { abertos.push(t) },
    async siteFora(t) { abertos.push(`fora:${t}`) },
    async deixarPublico(p) { publicas.push(p); return { ok: true } },
    async ehPublico(p) { return publicas.includes(p) },
  }
}
