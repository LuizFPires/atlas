// Ponte entre o front (React) e o app desktop (Electron). O front só conhece esta interface:
// a API do Electron fica atrás dela, então o CI (ubuntu) testa tudo sem empacotar nada.
import type { PonteServidor } from './ponte-servidor'
import type { PonteArquivos } from './ponte-arquivos'
import type { PonteClaude } from './ponte-claude'
import type { PonteObras } from './ponte-obras'
import type { PonteConstrucao, PonteModoObra } from './ponte-construcao'
import type { PontePainel } from './ponte-painel'
import type { PonteEstilo } from './ponte-estilo'
import type { PontePrototipo } from './ponte-prototipo'
import type { PonteBatismo, PonteNomes } from './ponte-batismo'
import type { PontePosObra } from './ponte-posobra'
import type { PonteRetomar } from './ponte-retomar'
import type { PonteCota } from './ponte-cota'
import type { PonteOcorrencias } from './ponte-ocorrencia'
import type { PonteCelular } from './ponte-celular'
import type { PonteImportar } from './ponte-importar'
import type { PonteAjuda } from './ponte-ajuda'
import type { PonteCasosAdmin } from './ponte-ajuda-casos'
import type { PontePublicar } from './ponte-publicar'
import type { PonteKit } from '../kit/entrega-kit'

/** Cofre do sistema (Windows Credential Manager / DPAPI). NUNCA grava segredo em arquivo. */
export interface Cofre {
  guardar(chave: string, valor: string): Promise<void>
  ler(chave: string): Promise<string | null>
  apagar(chave: string): Promise<void>
}

export interface PonteDesktop {
  /** Argumentos de linha de comando do app (ex.: --tela=F02). */
  argv: string[]
  cofre: Cofre
  /** Impressão digital do computador (SHA-256 hex, 64 caracteres). O id da máquina nunca sai em claro. */
  hashComputador(): Promise<string>
  /** Nome amigável do computador, só para mostrar na tela. */
  descricaoComputador(): Promise<string>
  /** Liga/desliga o bloqueio de suspensão (o computador é o canteiro). */
  impedirSono(ligado: boolean): Promise<void>
  /** Adaptadores reais injetados pelo preload (app/preload.cjs). Opcionais: o que faltar cai no *Indisponivel. */
  /** Avisa quando o código do link de instalação chega com o app já aberto (clique em "Liberar o Atlas" na página do e-mail). */
  aoReceberLink?: (aviso: (token: string) => void) => void
  /** Compra de dentro do app: abre no navegador do cliente a página de pagamento (o processo principal só aceita a da Stripe). */
  pagamento?: { abrir(url: string): Promise<void> }
  /** Chamadas ao servidor de licenças pelo processo principal (a tela, em file://, é barrada pelo CORS do servidor). */
  servidor?: PonteServidor
  arquivos?: PonteArquivos
  obras?: PonteObras
  claude?: PonteClaude
  modos?: PonteModoObra
  construcao?: PonteConstrucao
  painel?: PontePainel
  retomar?: PonteRetomar
  estilo?: PonteEstilo
  prototipo?: PontePrototipo
  batismo?: PonteBatismo
  nomes?: PonteNomes
  posobra?: PontePosObra
  cota?: PonteCota
  ocorrencias?: PonteOcorrencias
  celular?: PonteCelular
  importar?: PonteImportar
  ajuda?: PonteAjuda
  casos?: PonteCasosAdmin
  publicar?: PontePublicar
  /** Kit por obra (entrega-kit.ts): o processo principal guarda numa pasta temporária do app, fora da obra. */
  kit?: PonteKit
}

declare global {
  interface Window { atlasDesktop?: PonteDesktop }
}

/** Cofre em memória: usado nos testes e no modo fixture. Some quando o app fecha (de propósito: não vai a disco). */
export function criarCofreMemoria(inicial: Record<string, string> = {}): Cofre {
  const m = new Map(Object.entries(inicial))
  return {
    async guardar(c, v) { m.set(c, v) },
    async ler(c) { return m.get(c) ?? null },
    async apagar(c) { m.delete(c) },
  }
}

/** Ponte de mentirinha (modo fixture / navegador de desenvolvimento). */
export function criarPonteFixture(argv: string[] = [], cofre: Cofre = criarCofreMemoria()): PonteDesktop {
  return {
    argv,
    cofre,
    hashComputador: async () => 'f'.repeat(64),
    descricaoComputador: async () => 'DESKTOP-FIXTURE · Windows 11',
    impedirSono: async () => {},
  }
}

export const ponteDoAmbiente = (): PonteDesktop | null => (typeof window !== 'undefined' ? (window.atlasDesktop ?? null) : null)
