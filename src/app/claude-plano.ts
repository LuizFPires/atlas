// Explicação do plano em linguagem de leigo (prototipo/F03Claude, modo "conectado").
// O efeito do plano aparece em DIAS DE OBRA e pausas, nunca em tokens. O Atlas só detecta o plano; quem troca é o cliente, no site do Claude.
import type { Plano } from './ponte-claude'

export const NOME_PLANO: Record<Plano, string> = { pro: 'Pro', max: 'Max' }

export interface ExplicacaoPlano {
  titulo: string
  texto: string
}

export function explicarPlano(plano: Plano | undefined): ExplicacaoPlano {
  if (plano === 'pro') {
    return {
      titulo: 'COMO O ATLAS VAI TRABALHAR NO SEU PLANO PRO',
      texto: 'As obras ficam prontas, com pausas. Quando a cota do seu plano acaba, a obra pausa sozinha e volta quando a cota renova. Nada se perde.',
    }
  }
  if (plano === 'max') {
    return {
      titulo: 'COMO O ATLAS VAI TRABALHAR NO SEU PLANO MAX',
      texto: 'As obras andam mais rápido e quase não pausam. Se um dia a cota acabar, a obra pausa sozinha e volta quando a cota renova. Nada se perde.',
    }
  }
  return {
    titulo: 'COMO O ATLAS VAI TRABALHAR NO SEU PLANO',
    texto: 'Ainda não consegui ver qual é o seu plano. Sem pressa: o Atlas tenta de novo sozinho e, quando enxergar, explica aqui como as obras vão andar.',
  }
}

/** Só o plano Pro mostra o convite para o Max. O Atlas não escolhe nem vende plano: só aponta para o site do Claude. */
export const mostrarConviteMax = (plano: Plano | undefined): boolean => plano !== 'max'

export const TEXTO_CONVITE_MAX = {
  titulo: 'Quer obras mais rápidas?',
  texto: 'No plano Max da Anthropic a obra pausa bem menos e termina em menos dias. A troca é feita na sua conta do Claude, não aqui. O Atlas percebe sozinho, sem você fazer nada, e já ajusta a previsão das obras.',
  link: 'Ver os planos no site do Claude ↗',
}
