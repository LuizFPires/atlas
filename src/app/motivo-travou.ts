// Por que um comando de avanço da obra não saiu. Usa o tradutor único (explicar-trava.ts): o que houve + o que fazer + código.
import { textoDaTrava } from './explicar-trava'

/** `oQueFalhou` é a primeira frase ("Não consegui mandar as correções."); o resto vem da explicação do código. */
export function motivoDoTravamento(codigo: string, oQueFalhou: string): string {
  return textoDaTrava(codigo, oQueFalhou)
}
