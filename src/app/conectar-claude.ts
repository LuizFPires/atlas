// Atalho "Conectar o Claude agora" de qualquer tela que precise do Claude (o AppDesktop leva à tela de conectar e, ao
// terminar, volta para onde a pessoa estava). Ausente (testes, celular): o botão não aparece.
import { createContext } from 'react'

export const ContextoConectarClaude = createContext<(() => void) | null>(null)
