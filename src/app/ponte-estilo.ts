// Porta entre o app e o Claude que cria o estilo da obra. A geração dos 3 estilos e a escrita do design-system.md
// na subpasta da obra são o Claude por baixo; o adaptador real é pendência de /entregar (app/PENDENTE-ENTREGAR.md).
// Aqui só existe o mock do modo fixture. O design system é DA OBRA (do cliente): não precisa seguir os temas do Atlas.

export interface Referencia {
  tipo: 'link' | 'print' | 'fala'
  /** Link (já limpo), nome do print guardado ou texto falado/escrito. */
  valor: string
}

export interface EntradaEstilo {
  referencias: Referencia[]
  /** O que o cliente do cliente deve sentir ("Confiança", "Tradição"...). */
  sentimentos: string[]
  /** Complemento escrito/falado pelo cliente (opcional). */
  extra: string
}

export interface EstiloProposto {
  id: string
  nome: string
  de: string
  fundo: string
  topo: string
  topoTxt: string
  destaque: string
  destTxt: string
  linha: string
  raio: string
  fonte: string
}

/** O que o cliente já tem: arquivos subidos (nomes dentro da obra) e as cores, se escreveu. */
export interface Identidade {
  arquivos: string[]
  /** Códigos das cores e links (manual, Figma) que o cliente escreveu ou falou. */
  cores: string
  /** Já veio um design-system.md pronto: ele foi guardado na raiz da obra e vale do jeito que veio. */
  prontoDS?: boolean
}

export type OrigemDoDesignSystem =
  | { tipo: 'estilo'; estilo: EstiloProposto; entrada: EntradaEstilo }
  | { tipo: 'identidade'; identidade: Identidade }

export interface PonteEstilo {
  /** Pede ao Claude 3 estilos a partir das referências e do sentimento. */
  propor(entrada: EntradaEstilo): Promise<EstiloProposto[]>
  /** Transforma a escolha no design-system.md dentro da subpasta da obra. Devolve o caminho, só para mostrar. */
  materializar(pasta: string, origem: OrigemDoDesignSystem): Promise<{ caminho: string }>
}

/** Os 3 estilos de exemplo do protótipo (prototipo/F06bEstilo.dc.html). No app real, quem propõe é o Claude. */
export const ESTILOS_EXEMPLO: EstiloProposto[] = [
  { id: 'couro', nome: 'Couro e madeira', de: 'Inspirado no site da Aesop: tons quentes e letras clássicas.', fundo: '#FBF7F2', topo: '#2B211B', topoTxt: '#FBF7F2', destaque: '#B5651D', destTxt: '#FFFFFF', linha: '#D9CFC4', raio: '10px', fonte: "'Fraunces', Georgia, serif" },
  { id: 'navalha', nome: 'Navalha', de: 'Preto e dourado. Elegante, cara de barbearia premium.', fundo: '#141414', topo: '#000000', topoTxt: '#D8B45A', destaque: '#D8B45A', destTxt: '#141414', linha: '#3A3A3A', raio: '4px', fonte: "'Geist', system-ui, sans-serif" },
  { id: 'leve', nome: 'Leve e moderno', de: 'Inspirado no app do Nubank: limpo, botões redondos.', fundo: '#FFFFFF', topo: '#5B2C83', topoTxt: '#FFFFFF', destaque: '#5B2C83', destTxt: '#FFFFFF', linha: '#E3DDEB', raio: '18px', fonte: "'Geist', system-ui, sans-serif" },
]

/** Texto do design-system.md da obra (formato simples, lido pelo Claude e por outras IAs). */
export function montarDesignSystemMd(origem: OrigemDoDesignSystem): string {
  if (origem.tipo === 'identidade') {
    const { arquivos, cores, prontoDS } = origem.identidade
    return [
      '# Design system da obra',
      '',
      `Origem: identidade visual que o cliente já tem.${prontoDS ? ' Veio um design-system.md pronto: ele vale do jeito que veio.' : ' O Claude lê os arquivos abaixo e completa este documento.'}`,
      '',
      '## Arquivos do cliente',
      ...(arquivos.length ? arquivos.map((a) => `- estilo/identidade/${a}`) : ['- (nenhum arquivo)']),
      '',
      '## Cores e links informados',
      cores.trim() || '(o Claude tira das imagens enviadas)',
      '',
    ].join('\n')
  }
  const e = origem.estilo
  return [
    '# Design system da obra',
    '',
    `Estilo: ${e.nome}. ${e.de}`,
    `Sentimento: ${origem.entrada.sentimentos.join(', ') || 'não informado'}.`,
    '',
    '## Cores',
    `- fundo: ${e.fundo}`,
    `- topo: ${e.topo} (texto ${e.topoTxt})`,
    `- destaque: ${e.destaque} (texto ${e.destTxt})`,
    `- linhas: ${e.linha}`,
    '',
    '## Letras',
    `- fonte: ${e.fonte}`,
    '',
    '## Botões e caixas',
    `- cantos: ${e.raio}`,
    '',
  ].join('\n')
}

export interface EstiloFixture extends PonteEstilo {
  /** Pedidos feitos e documentos "escritos" (só na memória). */
  readonly pedidos: EntradaEstilo[]
  readonly escritos: { pasta: string; caminho: string; texto: string }[]
}

/** Mock do modo fixture: devolve os 3 estilos de exemplo e não toca no disco. */
export function criarEstiloFixture(raiz = 'C:\\Users\\Zé\\Atlas\\Obras'): EstiloFixture {
  const pedidos: EntradaEstilo[] = []
  const escritos: EstiloFixture['escritos'] = []
  return {
    pedidos,
    escritos,
    async propor(entrada) { pedidos.push(entrada); return ESTILOS_EXEMPLO.map((e) => ({ ...e })) },
    async materializar(pasta, origem) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(pasta)) throw new Error('pasta-invalida')
      const caminho = `${raiz}\\${pasta}\\design-system.md`
      escritos.push({ pasta, caminho, texto: montarDesignSystemMd(origem) })
      return { caminho }
    },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que o Claude criou o estilo. */
export const estiloIndisponivel: PonteEstilo = {
  async propor() { throw new Error('indisponivel') },
  async materializar() { throw new Error('indisponivel') },
}
