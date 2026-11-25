// M46 (aprovado pelo Luiz em 24/11/2026): o Atlas roda no Mac e no Windows. O processo principal diz qual é (preload: plataforma);
// as telas usam as palavras do computador do cliente. Sem a ponte (web, teste): Windows, como sempre foi.
type ComPlataforma = { atlasDesktop?: { plataforma?: string } }

export const ehMac = (): boolean => typeof window !== 'undefined' && (window as unknown as ComPlataforma).atlasDesktop?.plataforma === 'mac'

export interface Palavras {
  sistema: string
  cofre: string
  lixeira: string
  abrirComOSistema: string
  /** Windows: o Atlas ajusta a tampa (powercfg). Mac: não dá sem senha de administrador, então só o aviso. */
  ajustaTampa: boolean
}

export function palavras(): Palavras {
  return ehMac()
    ? { sistema: 'o Mac', cofre: 'nas Chaves do Mac', lixeira: 'a Lixeira', abrirComOSistema: 'Ajustes do Sistema → Geral → Itens de Início', ajustaTampa: false }
    : { sistema: 'o Windows', cofre: 'no cofre do Windows', lixeira: 'a Lixeira do Windows', abrirComOSistema: 'Configurações → Abrir com o Windows', ajustaTampa: true }
}
