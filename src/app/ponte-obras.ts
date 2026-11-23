// Porta entre o app e a pasta das obras do cliente: C:\Users\<nome>\Atlas\Obras (uma subpasta por obra).
// Nunca Desktop/Documentos (OneDrive). A pasta é só o diretório da obra: NUNCA guarda segredo.
// O adaptador real (criar a pasta de verdade no Electron) é pendência de /entregar (app/PENDENTE-ENTREGAR.md).

export interface ObraCriada {
  /** Nome da subpasta (sem barras), ex.: "agenda-da-barbearia-do-ze". */
  pasta: string
  /** Caminho completo, só para mostrar ao cliente. */
  caminho: string
}

import type { SituacaoObra } from './fase-obra'

export interface PonteObras {
  /** Caminho da pasta das obras, para mostrar ("C:\Users\Zé\Atlas\Obras"). */
  raiz(): string
  /** Subpastas que já existem (uma por obra). */
  listar(): Promise<string[]>
  /** Cria a subpasta da obra dentro de Atlas\Obras. Nunca sobrescreve uma que já existe. */
  criarSubpasta(nome: string): Promise<ObraCriada>
  /** Abre Atlas\Obras no Explorador de Arquivos. */
  abrirPasta(): Promise<void>
  /** Onde a obra parou (Minhas obras → "Continuar"): o que cada etapa já deixou na pasta. */
  situacao?(pasta: string): Promise<SituacaoObra>
}

/** Nome de obra vira nome de pasta: sem acento, minúsculo, só letras/números/hífen. Nada de "..", barras ou nomes reservados do Windows. */
export function nomeParaPasta(nome: string): string {
  const s = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  const base = s || 'obra'
  return /^(con|prn|aux|nul|com\d|lpt\d)$/.test(base) ? `${base}-obra` : base
}

/** Escolhe um nome que não colide com os existentes: obra, obra-2, obra-3... */
export function pastaLivre(nome: string, existentes: readonly string[]): string {
  const base = nomeParaPasta(nome)
  const usados = new Set(existentes.map((e) => e.toLowerCase()))
  if (!usados.has(base)) return base
  for (let i = 2; ; i++) {
    const c = `${base}-${i}`
    if (!usados.has(c)) return c
  }
}

export const raizDasObras = (usuario: string) => `C:\\Users\\${usuario}\\Atlas\\Obras`

export interface ObrasFixture extends PonteObras {
  /** Pastas "criadas" (só na memória). */
  readonly criadas: string[]
  /** Quantas vezes pediram para abrir a pasta. */
  readonly aberturas: number
}

/** Mock do modo fixture: não toca no disco. */
export function criarObrasFixture(usuario = 'Zé', iniciais: string[] = []): ObrasFixture {
  const criadas = [...iniciais]
  let aberturas = 0
  return {
    criadas,
    get aberturas() { return aberturas },
    raiz: () => raizDasObras(usuario),
    async listar() { return [...criadas] },
    async criarSubpasta(nome) {
      const pasta = pastaLivre(nome, criadas)
      criadas.push(pasta)
      return { pasta, caminho: `${raizDasObras(usuario)}\\${pasta}` }
    },
    async abrirPasta() { aberturas++ },
    // Fixture: obra criada aqui ainda não tem nenhuma etapa feita.
    async situacao(pasta) { if (!criadas.includes(pasta)) throw new Error('obra-inexistente'); return { estilo: false, prototipo: false, marca: false, plano: false } },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que criou a pasta. */
export const obrasIndisponivel: PonteObras = {
  raiz: () => 'C:\\Users\\<seu nome>\\Atlas\\Obras',
  async listar() { return [] },
  async criarSubpasta() { throw new Error('indisponivel') },
  async abrirPasta() { throw new Error('indisponivel') },
}
