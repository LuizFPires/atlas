export const TELA_ATIVACAO = 'F02'
export const TELA_CLAUDE = 'F03'
export const TELA_OBRAS = 'F05'

/** Tela inicial do app: a flag --tela= manda; sem flag, já ativado cai em Obras (F05), senão na ativação (F02).
 *  Mesma regra do instalador (instalador/passos.ts telaInicial); um teste garante que as duas não se separam. */
export function telaInicial(argv: string[], jaAtivado = false): string {
  const a = argv.find((x) => x.startsWith('--tela='))
  if (a) return a.slice('--tela='.length)
  return jaAtivado ? TELA_OBRAS : TELA_ATIVACAO
}

/** Valor de uma flag --nome=valor (ex.: --token=...), ou ''. */
export function flag(argv: string[], nome: string): string {
  const a = argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : ''
}
