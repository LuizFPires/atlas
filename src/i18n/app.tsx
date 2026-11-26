import { createContext, useContext } from 'react'
import type { Idioma } from './idioma'

// M31 (Luiz, 26/11/2026): o idioma do Atlas instalado. Vem da licença (decidido na compra e fixo depois). Antes de ativar,
// português, até o servidor dizer o idioma da licença pelo link do e-mail. Sem provedor: português.
const IdiomaDoApp = createContext<Idioma>('pt')
export const ProvedorIdioma = IdiomaDoApp.Provider
export const useIdioma = (): Idioma => useContext(IdiomaDoApp)

/** Antes da ativação: ?idioma=en (modo fixture, para ver as telas em inglês); senão português. O idioma do computador NÃO
 *  decide: um brasileiro com Windows em inglês continua em português (o idioma é o da compra). */
export function idiomaAntesDeAtivar(busca = typeof window === 'undefined' ? '' : window.location.search): Idioma {
  return new URLSearchParams(busca).get('idioma') === 'en' ? 'en' : 'pt'
}

/** Escolhe o texto do idioma atual a partir de um dicionário { pt, en }. */
export function useTextos<T>(d: { pt: T; en: T }): T {
  return d[useIdioma()]
}
