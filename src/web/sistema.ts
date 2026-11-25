// M47 (aprovado pelo Luiz em 24/11/2026): a página do link do e-mail reconhece o computador sozinha, sem perguntar.
export type Sistema = 'mac' | 'windows'

interface Navegador { userAgent?: string; platform?: string; maxTouchPoints?: number; userAgentData?: { platform?: string } }

/** Mac ou Windows pelo próprio navegador. Na dúvida (Linux, desconhecido): Windows, com o link "Não é um Windows?" na página. */
export function sistemaDoNavegador(n: Navegador | undefined = typeof navigator === 'undefined' ? undefined : (navigator as unknown as Navegador)): Sistema {
  const p = `${n?.userAgentData?.platform ?? ''} ${n?.platform ?? ''} ${n?.userAgent ?? ''}`
  if (/mac/i.test(p) && !/iphone|ipad|ipod/i.test(p)) return 'mac'
  return 'windows'
}

/** Tela de toque: um iPad se apresenta como "Macintosh"; um Mac de verdade não tem toque. O servidor usa isso para dizer "celular". */
export const temToque = (n: Navegador | undefined = typeof navigator === 'undefined' ? undefined : (navigator as unknown as Navegador)): boolean => (n?.maxTouchPoints ?? 0) > 1
