// Lacunas de publicação do kit (S16, decidido em 18/11/2026):
//  - PWA é o caminho padrão; TWA só quando for só Android; Expo + EAS quando exigir iOS (loja) ou recurso nativo.
//  - Avisos que precisam vir CEDO (D-U-N-S, 12 testadores).
//  - Tradução dos passos técnicos do corretor para o leigo.
// Funções puras, sem rede: servem ao guia do app (Publicando) e às instruções entregues ao agente.

export type CaminhoLoja = 'pwa' | 'twa' | 'expo-eas'
export type Plataforma = 'ios' | 'android'

export interface NecessidadeLoja {
  /** Onde o cliente quer estar nas lojas. Vazio = só instalável pelo navegador. */
  lojas: readonly Plataforma[]
  /** Precisa de recurso que o navegador não dá (Bluetooth, leitor de cartão, notificação nativa no iPhone com app de loja...). */
  precisaNativo?: boolean
}

/** Escolhe o caminho mais simples que atende. Dúvida -> o mais simples (PWA). */
export function escolherCaminhoLoja(n: NecessidadeLoja): CaminhoLoja {
  const ios = n.lojas.includes('ios')
  const android = n.lojas.includes('android')
  if (n.precisaNativo || ios) return 'expo-eas'
  if (android) return 'twa'
  return 'pwa'
}

export const EXPLICACAO_CAMINHO: Record<CaminhoLoja, string> = {
  pwa: 'O app instala direto do navegador, sem loja: grátis, rápido e igual nos dois celulares.',
  twa: 'O seu site vira app do Google Play (só Android), pelo mesmo site, sem refazer nada.',
  'expo-eas': 'O app é refeito como app de verdade, e o EAS monta o pacote na nuvem (funciona no Windows, inclusive para iPhone). A Apple não aceita site embrulhado.',
}

/** Avisos que o cliente precisa saber ANTES de começar, para não parar no meio. */
export function avisosCedo(c: CaminhoLoja, lojas: readonly Plataforma[]): string[] {
  const a: string[] = []
  if (c === 'pwa') return a
  if (lojas.includes('ios')) {
    a.push('Apple Developer custa US$ 99 por ano, e para conta de empresa pede o número D-U-N-S (grátis, mas pode levar dias para sair). Peça já.')
  }
  if (lojas.includes('android')) {
    a.push('Google Play custa US$ 25 (uma vez). Conta nova precisa de 12 testadores por 14 dias seguidos antes de publicar: chame amigos e clientes logo.')
  }
  return a
}

const TRADUCOES: [RegExp, string][] = [
  [/\beas build\b/i, 'montar o pacote do app na nuvem'],
  [/\beas submit\b/i, 'enviar o pacote para a loja de testes'],
  [/\btestflight\b/i, 'a área de testes da Apple (você testa no seu iPhone antes de publicar)'],
  [/teste interno/i, 'a área de testes do Google Play (só quem você convidar vê)'],
  [/bundle ?identifier|package name/i, 'o código único do seu app (depois de publicado não muda)'],
  [/\b\.aab\b/i, 'o arquivo do app para o Google Play'],
  [/d-u-n-s/i, 'o número de empresa da Apple (grátis, pode demorar alguns dias)'],
  [/app store connect/i, 'o painel da Apple onde o seu app aparece'],
  [/play console/i, 'o painel do Google onde o seu app aparece'],
  [/verifica[cç][aã]o em duas etapas/i, 'o código que chega no seu celular para confirmar que é você'],
]

/** Troca termos técnicos por palavras de gente; o resto do texto fica igual. */
export function traduzirPassoTecnico(texto: string): string {
  return TRADUCOES.reduce((t, [re, novo]) => t.replace(re, novo), texto)
}
