// Navegador de verdade dentro do Atlas, na tela das contas (app/adaptadores/navegador.cjs). A tela só diz QUAL conta e ONDE
// desenhar; o endereço de cada site é fixo no processo principal. Só existe no Atlas instalado.
import type { IdConta } from './contas-passos'

export type Retangulo = { x: number; y: number; width: number; height: number }
export type IdGuiaSite = 'registro' | 'stripe' | 'asaas'
export type PaginaNavegador = { conta?: IdConta; guia?: IdGuiaSite; url: string; pronta: boolean }

export interface PonteNavegador {
  abrir(conta: IdConta, onde: Retangulo): Promise<void>
  posicionar(onde: Retangulo): Promise<void>
  mostrar(sim: boolean): Promise<void>
  voltar(): Promise<void>
  recarregar(): Promise<void>
  /** Abre o site da conta no navegador do computador (plano B). */
  fora(conta: IdConta): Promise<void>
  fechar(): Promise<void>
  /** M58: o site de um guia (endereço fixo no processo principal) e o plano B no navegador do computador. */
  abrirGuia?(guia: IdGuiaSite, onde: Retangulo): Promise<void>
  foraGuia?(guia: IdGuiaSite): Promise<void>
  /** A cada página nova: o endereço e se a conta já ficou pronta. Devolve a função que para de ouvir. */
  aoMudarPagina(f: (p: PaginaNavegador) => void): () => void
}
