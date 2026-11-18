export const TELA_ATIVACAO = 'F02'
export const TELA_CLAUDE = 'F03'
export const TELA_CONTAS = 'F04'
export const TELA_CELULAR = 'F04b'
export const TELA_OBRAS = 'F05'
export const TELA_RETOMAR = 'F12'

/** Tela inicial do app: a flag --tela= manda; sem flag, não ativado cai na ativação (F02); ativado COM obra em andamento abre
 *  Retomar (F12, M21); ativado sem obra em andamento cai em Obras (F05).
 *  Mesma regra do instalador (instalador/passos.ts telaInicial); um teste garante que as duas não se separam. */
export function telaInicial(argv: string[], jaAtivado = false, obraEmAndamento = false): string {
  const a = argv.find((x) => x.startsWith('--tela='))
  if (a) return a.slice('--tela='.length)
  if (!jaAtivado) return TELA_ATIVACAO
  return obraEmAndamento ? TELA_RETOMAR : TELA_OBRAS
}

/** Valor de uma flag --nome=valor (ex.: --token=...), ou ''. */
export function flag(argv: string[], nome: string): string {
  const a = argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : ''
}
