import { explicarTrava } from './explicar-trava'
// Ponte do "Colocar no ar com um clique" (M56; telas prototipo/caminho-novo/PB1Publicar … PB5NoAr).
// O processo principal (app/adaptadores/no-ar.cjs) faz tudo nas contas do cliente; a tela só acompanha.

export type IdPassoNoAr = 'vistoria' | 'banco' | 'publicar' | 'github' | 'teste' | 'acesso' | 'celular'
export type EstadoPassoNoAr = 'falta' | 'agora' | 'feito' | 'pulado' | 'atencao' | 'erro'
export type FaseNoAr = 'parado' | 'rodando' | 'vistoria' | 'corrigindo' | 'noar' | 'erro'
export type SituacaoNomeNoAr = 'livre' | 'ocupado' | 'seu' | 'incerto' | 'invalido'

export interface EstadoNoAr {
  fase: FaseNoAr
  nome: string | null
  passos: { id: IdPassoNoAr; estado: EstadoPassoNoAr }[]
  /** Pontos da vistoria, em português simples (só na fase 'vistoria'). */
  achados: string[]
  /** https://<nome>.vercel.app — só quando está mesmo no ar. */
  endereco: string | null
  /** `detalhe`: resumo técnico do erro (sem segredos), quando a ferramenta disse algo útil. */
  erro: { passo: IdPassoNoAr; motivo: string; detalhe?: string } | null
  avisos: string[]
  /** A conta de dono que o Atlas criou no sistema (e-mail da licença). A senha o dono cria em "Esqueci minha senha". */
  acesso?: { email: string; novo: boolean; senha?: boolean } | null
  /** A cota do plano do Claude acabou: a obra espera renovar sozinha e continua de onde parou (não é erro). */
  esperandoCota?: boolean
  /** O que a etapa de agora está fazendo (PG1Progresso). pct = contagem real; null = a tela anda pelo tempo de costume (s). */
  sub?: SubNoAr | null
  /** Quanto cada etapa já feita levou (ms). */
  duracoes?: Partial<Record<IdPassoNoAr, number>>
  /** Notícias de verdade, com hora (ISO), da mais velha para a mais nova. */
  diario?: { hora: string; texto: string }[]
}

export interface SubNoAr { texto: string; pct: number | null; costume: [number, number] | null; inicio: number; noticia: number }

/** Tempo de costume de cada etapa (segundos), para o "faltam ~N min". */
export const COSTUME_NO_AR: Record<IdPassoNoAr, number> = { vistoria: 120, banco: 240, publicar: 180, github: 20, teste: 20, acesso: 10, celular: 1 }

export interface PonteNoAr {
  readonly indisponivel?: boolean
  sugerir(pasta: string, obraNome: string, extra?: string): Promise<{ nome: string | null; livres: string[] }>
  nomeLivre(nome: string, pasta?: string): Promise<SituacaoNomeNoAr>
  iniciar(pasta: string, nome: string): Promise<EstadoNoAr>
  estado(pasta: string): Promise<EstadoNoAr>
  corrigir(pasta: string): Promise<EstadoNoAr>
  /** Antes de começar: precisa de banco, a conta está ligada e quantos bancos ativos ela já tem (grátis = 2). Opcional. */
  conferirAntes?(pasta: string): Promise<AntesDoNoAr>
  /** Senha do dono criada no Atlas (28/11/2026): grava direto na conta do sistema, sem e-mail. Nunca é guardada. */
  definirSenha?(pasta: string, senha: string): Promise<{ ok: true }>
}

export interface AntesDoNoAr { precisaBanco: boolean; bancoNovo: boolean; contaLigada: boolean; bancosAtivos: number | null }

export const PASSOS_NO_AR: { id: IdPassoNoAr; titulo: string; sub: string }[] = [
  { id: 'vistoria', titulo: 'Vistoria final', sub: 'Segurança, privacidade (LGPD) e cada pessoa vendo só o que é dela.' },
  { id: 'banco', titulo: 'Banco de dados na sua conta Supabase', sub: 'Criado em São Paulo, vazio, com as tabelas do sistema.' },
  { id: 'publicar', titulo: 'Publicando na sua conta Vercel', sub: 'Montando o sistema e ligando ao banco.' },
  { id: 'github', titulo: 'Publicação só com a sua aprovação', sub: 'Mudança pedida depois só entra no ar quando você clicar em Colocar no ar.' },
  { id: 'teste', titulo: 'Teste de verdade no endereço', sub: 'O Atlas abre o sistema e confere que ele responde.' },
  { id: 'acesso', titulo: 'Seu acesso de dono', sub: 'O Atlas cria a sua conta no sistema com o seu e-mail.' },
  { id: 'celular', titulo: 'Pronto para instalar no celular', sub: 'Ícone, nome e o QR code para a equipe.' },
]

/** O que dizer quando um passo deu erro: o que houve + o que fazer, do tradutor único (explicar-trava.ts). */
/** Erros que são defeito da obra: a linha corrige pelo "Corrigir e continuar" (app/adaptadores/no-ar.cjs, CORRIGIVEIS). */
export const CORRIGIVEIS_NO_AR = ['supabase-migrations', 'supabase-funcoes', 'vercel-build']

export function explicarErro(motivo: string): { frase: string; fazer: string; conta?: 'supabase' | 'vercel' | 'github' } {
  const x = explicarTrava(motivo)
  return { frase: x.houve, fazer: x.fazer, ...(x.conta ? { conta: x.conta } : {}) }
}

const esperaFalsa = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Simulação para o modo fixture: os passos andam sozinhos; o nome "ponto" está ocupado (para testar as sugestões). */
export function criarNoArFixture({ passoMs = 700, reprovar = false }: { passoMs?: number; reprovar?: boolean } = {}): PonteNoAr {
  const estados = new Map<string, EstadoNoAr>()
  const ids = PASSOS_NO_AR.map((p) => p.id)
  const base = (nome: string | null): EstadoNoAr => ({ fase: 'parado', nome, passos: ids.map((id) => ({ id, estado: 'falta' })), achados: [], endereco: null, erro: null, avisos: [] })
  let reprova = reprovar
  async function andar(pasta: string, desde = 0) {
    const e = estados.get(pasta)
    if (!e) return
    e.duracoes = e.duracoes ?? {}
    e.diario = e.diario ?? []
    for (let i = desde; i < ids.length; i++) {
      e.passos[i].estado = 'agora'
      const inicio = Date.now()
      const textos = ['Conferindo segurança e privacidade', 'Criando as tabelas', 'Enviando arquivos', 'Ligando ao repositório', 'Abrindo o endereço', 'Preparando o QR code']
      for (let k = 1; k <= 4; k++) {
        e.sub = { texto: `${textos[i]} · ${k} de 4`, pct: (k - 1) * 25, costume: null, inicio, noticia: Date.now() }
        await esperaFalsa(passoMs / 4)
      }
      e.sub = null
      e.duracoes[ids[i]] = Date.now() - inicio
      e.diario.push({ hora: new Date().toISOString(), texto: `${PASSOS_NO_AR[i].titulo}: pronto.` })
      if (i === 0 && reprova) { e.passos[0].estado = 'atencao'; e.fase = 'vistoria'; e.achados = ['Um funcionário conseguia ver o ponto de outro funcionário. Vai ficar cada um vendo só o seu.', 'Falta a página de privacidade (LGPD) no rodapé do app.']; return }
      e.passos[i].estado = 'feito'
    }
    e.fase = 'noar'
    e.endereco = `https://${e.nome}.vercel.app`
  }
  return {
    async sugerir(_pasta, obraNome, extra = 'ampla') {
      const b = obraNome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meu-sistema'
      const livres = [`${b}${extra}`, `${b}-equipe`, `${extra}-${b}`, `meu${b}-${extra}`]
      return { nome: livres[0], livres }
    },
    async nomeLivre(nome) { return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(nome) ? (nome === 'ponto' ? 'ocupado' : 'livre') : 'invalido' },
    async iniciar(pasta, nome) {
      const e = { ...base(nome), fase: 'rodando' as FaseNoAr }
      estados.set(pasta, e)
      void andar(pasta)
      return structuredClone(e)
    },
    async estado(pasta) { return structuredClone(estados.get(pasta) ?? base(null)) },
    async definirSenha(pasta, senha) {
      if (senha.length < 8) throw new Error('senha-curta')
      const e = estados.get(pasta)
      if (e?.acesso) estados.set(pasta, { ...e, acesso: { ...e.acesso, senha: true } })
      return { ok: true as const }
    },
    async corrigir(pasta) {
      const e = estados.get(pasta)
      if (!e) throw new Error('nada-para-corrigir')
      e.fase = 'corrigindo'; e.achados = []; reprova = false
      void esperaFalsa(passoMs * 2).then(() => { e.fase = 'rodando'; void andar(pasta, 0) })
      return structuredClone(e)
    },
  }
}

/** Sem adaptador: não finge que publicou. */
export const noArIndisponivel: PonteNoAr = {
  indisponivel: true,
  async sugerir() { return { nome: null, livres: [] } },
  async nomeLivre() { return 'incerto' },
  async iniciar() { throw new Error('indisponivel') },
  async estado() { return { fase: 'parado', nome: null, passos: PASSOS_NO_AR.map((p) => ({ id: p.id, estado: 'falta' })), achados: [], endereco: null, erro: null, avisos: [] } },
  async corrigir() { throw new Error('indisponivel') },
}
