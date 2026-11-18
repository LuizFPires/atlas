// Porta entre o app e os arquivos que o cliente sobe para a obra (print de referência, logo, cores, manual, design-system.md).
// O diálogo de escolher arquivo e a cópia para a subpasta da obra (C:\Users\<nome>\Atlas\Obras\<obra>\...) ficam atrás desta porta,
// SEMPRE dentro da raiz permitida. Nunca guarda segredo. O adaptador real (dialog.showOpenDialog + fs.copyFile no Electron) é pendência de /entregar.

export type TipoArquivo = 'imagem' | 'logo' | 'cores' | 'manual' | 'design-system'

/** Onde, dentro da subpasta da obra, o arquivo é guardado. */
export type Destino = 'estilo/referencias' | 'estilo/identidade' | 'marca' | 'raiz'

export interface ArquivoEscolhido {
  nome: string
  tamanho: number
  /** Alça opaca do arquivo escolhido. O renderer só devolve este token; o conteúdo e o caminho de origem ficam atrás da porta. */
  token: string
}

export interface ArquivoGuardado {
  /** Nome final dentro da obra (sem barras). */
  nome: string
  /** Caminho completo, só para mostrar ao cliente. */
  caminho: string
}

export interface PonteArquivos {
  /** Abre o "Escolher arquivo" do computador, já filtrado pelo tipo. Devolve null se o cliente desistir. */
  escolher(tipo: TipoArquivo): Promise<ArquivoEscolhido | null>
  /**
   * Copia o arquivo escolhido (pelo token que `escolher` devolveu) para a subpasta da obra. Nunca sai da raiz e nunca sobrescreve.
   * Revalida extensão (do tipo em que foi escolhido) e os 20 MB; o destino 'raiz' só aceita .md. Token desconhecido: 'token-invalido'.
   */
  guardar(pasta: string, destino: Destino, token: string): Promise<ArquivoGuardado>
}

export const EXTENSOES: Record<TipoArquivo, readonly string[]> = {
  imagem: ['png', 'jpg', 'jpeg', 'webp'],
  // SVG fica fora da logo: pode carregar script. Política: só formatos que não executam nada.
  logo: ['png', 'pdf', 'jpg', 'jpeg', 'webp'],
  cores: ['png', 'jpg', 'jpeg', 'webp', 'txt', 'pdf'],
  manual: ['pdf', 'md', 'txt', 'png', 'jpg', 'jpeg', 'webp'],
  'design-system': ['md'],
}

export const TAMANHO_MAXIMO = 20 * 1024 * 1024

export const extensaoDe = (nome: string) => (nome.includes('.') ? nome.slice(nome.lastIndexOf('.') + 1).toLowerCase() : '')

export const extensaoPermitida = (tipo: TipoArquivo, nome: string) => EXTENSOES[tipo].includes(extensaoDe(nome))

/** Nome de arquivo vira nome seguro: sem pasta, sem "..", sem caracteres proibidos no Windows. Mantém a extensão. */
export function nomeArquivoSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? ''
  const ext = extensaoDe(base).replace(/[^a-z0-9]/g, '')
  const miolo = (extensaoDe(base) ? base.slice(0, base.lastIndexOf('.')) : base)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  const m = miolo || 'arquivo'
  const seguro = /^(con|prn|aux|nul|com\d|lpt\d)$/.test(m) ? `${m}-arquivo` : m
  return ext ? `${seguro}.${ext}` : seguro
}

/** Monta o caminho final e garante que ele continua dentro de <raiz>\<pasta>. Lança se tentarem sair. */
export function caminhoNaObra(raiz: string, pasta: string, destino: Destino, nomeFinal: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pasta)) throw new Error('pasta-invalida')
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(nomeFinal) || nomeFinal.includes('..')) throw new Error('nome-invalido')
  const partes = destino === 'raiz' ? [] : destino.split('/')
  return [raiz, pasta, ...partes, nomeFinal].join('\\')
}

/** Escolhe um nome que não colide: logo.png, logo-2.png, logo-3.png... */
export function nomeLivre(nome: string, existentes: readonly string[]): string {
  const usados = new Set(existentes.map((e) => e.toLowerCase()))
  if (!usados.has(nome)) return nome
  const ext = extensaoDe(nome)
  const base = ext ? nome.slice(0, nome.lastIndexOf('.')) : nome
  for (let i = 2; ; i++) {
    const c = ext ? `${base}-${i}.${ext}` : `${base}-${i}`
    if (!usados.has(c)) return c
  }
}

export interface ArquivosFixture extends PonteArquivos {
  /** Arquivos "guardados" (só na memória): caminho completo. */
  readonly guardados: string[]
  /** Próximos arquivos que o "Escolher arquivo" devolve (null = cliente desistiu). Sem fila, devolve um exemplo do tipo. */
  fila: (Omit<ArquivoEscolhido, 'token'> | null)[]
  /** Só para teste: registra um arquivo SEM validar (como um renderer forjado faria) e devolve o token. */
  registrar(tipo: TipoArquivo, arquivo: Omit<ArquivoEscolhido, 'token'>): string
}

const EXEMPLO: Record<TipoArquivo, string> = {
  imagem: 'print-do-site.png',
  logo: 'logo-barbearia.png',
  cores: 'cores-da-fachada.jpg',
  manual: 'manual-da-marca.pdf',
  'design-system': 'design-system.md',
}

/** Mock do modo fixture: não toca no disco. */
export function criarArquivosFixture(raiz = 'C:\\Users\\Zé\\Atlas\\Obras'): ArquivosFixture {
  const guardados: string[] = []
  const fila: ArquivosFixture['fila'] = []
  const emAberto = new Map<string, { tipo: TipoArquivo; nome: string; tamanho: number }>()
  let n = 0
  const registrar: ArquivosFixture['registrar'] = (tipo, a) => {
    const token = `tok-${++n}`
    emAberto.set(token, { tipo, nome: a.nome, tamanho: a.tamanho })
    return token
  }
  return {
    guardados,
    fila,
    registrar,
    async escolher(tipo) {
      const a = fila.length ? fila.shift()! : { nome: EXEMPLO[tipo], tamanho: 120_000 }
      if (a === null) return null
      if (!extensaoPermitida(tipo, a.nome)) throw new Error('tipo-nao-aceito')
      if (a.tamanho > TAMANHO_MAXIMO) throw new Error('grande-demais')
      return { ...a, token: registrar(tipo, a) }
    },
    async guardar(pasta, destino, token) {
      const a = emAberto.get(token)
      if (!a) throw new Error('token-invalido')
      // Revalida: o que vale é o que a porta guardou ao escolher, nunca o que o renderer diz.
      if (!extensaoPermitida(a.tipo, a.nome)) throw new Error('tipo-nao-aceito')
      if (a.tamanho > TAMANHO_MAXIMO) throw new Error('grande-demais')
      if (destino === 'raiz' && extensaoDe(a.nome) !== 'md') throw new Error('tipo-nao-aceito')
      const prefixo = caminhoNaObra(raiz, pasta, destino, 'x').slice(0, -1)
      const existentes = guardados.filter((g) => g.startsWith(prefixo)).map((g) => g.slice(prefixo.length))
      const nome = nomeLivre(nomeArquivoSeguro(a.nome), existentes)
      const caminho = caminhoNaObra(raiz, pasta, destino, nome)
      guardados.push(caminho)
      emAberto.delete(token)
      return { nome, caminho }
    },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que subiu o arquivo. */
export const arquivosIndisponivel: PonteArquivos = {
  async escolher() { throw new Error('indisponivel') },
  async guardar() { throw new Error('indisponivel') },
}
