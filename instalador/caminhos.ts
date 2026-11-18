/** Caminhos do Atlas no Windows do cliente (lógica pura, testável em qualquer SO). */

const PROIBIDAS = ['desktop', 'área de trabalho', 'documents', 'documentos']

export function nomeDoUsuarioValido(nome: string): boolean {
  return nome.trim().length > 0 && !/[\\/:*?"<>|]/.test(nome)
}

export function pastaObras(usuario: string): string {
  if (!nomeDoUsuarioValido(usuario)) throw new Error('Nome de usuário do Windows inválido.')
  return `C:\\Users\\${usuario.trim()}\\Atlas\\Obras`
}

/** A pasta das obras nunca pode ficar em Desktop, Documentos ou OneDrive. */
export function pastaObrasSegura(caminho: string): boolean {
  const partes = caminho.toLowerCase().split(/[\\/]+/)
  return !partes.some((p) => PROIBIDAS.includes(p) || p.startsWith('onedrive'))
}

export const NOME_ATALHO = 'Atlas · minhas obras'

export function atalhoAreaDeTrabalho(areaDeTrabalho: string): string {
  return `${areaDeTrabalho.replace(/[\\/]+$/, '')}\\${NOME_ATALHO}.lnk`
}
