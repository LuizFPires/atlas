// Ponte do "Colocar no ar com um clique" (M56; telas prototipo/caminho-novo/PB1Publicar … PB5NoAr).
// O processo principal (app/adaptadores/no-ar.cjs) faz tudo nas contas do cliente; a tela só acompanha.

export type IdPassoNoAr = 'vistoria' | 'banco' | 'publicar' | 'github' | 'teste' | 'celular'
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
  erro: { passo: IdPassoNoAr; motivo: string } | null
  avisos: string[]
}

export interface PonteNoAr {
  readonly indisponivel?: boolean
  sugerir(pasta: string, obraNome: string, extra?: string): Promise<{ nome: string | null; livres: string[] }>
  nomeLivre(nome: string, pasta?: string): Promise<SituacaoNomeNoAr>
  iniciar(pasta: string, nome: string): Promise<EstadoNoAr>
  estado(pasta: string): Promise<EstadoNoAr>
  corrigir(pasta: string): Promise<EstadoNoAr>
}

export const PASSOS_NO_AR: { id: IdPassoNoAr; titulo: string; sub: string }[] = [
  { id: 'vistoria', titulo: 'Vistoria final', sub: 'Segurança, privacidade (LGPD) e cada pessoa vendo só o que é dela.' },
  { id: 'banco', titulo: 'Banco de dados na sua conta Supabase', sub: 'Criado em São Paulo, vazio, com as tabelas do sistema.' },
  { id: 'publicar', titulo: 'Publicando na sua conta Vercel', sub: 'Montando o sistema e ligando ao banco.' },
  { id: 'github', titulo: 'Ligando ao seu GitHub', sub: 'Toda mudança aprovada no pós-obra entra no ar sozinha.' },
  { id: 'teste', titulo: 'Teste de verdade no endereço', sub: 'O Atlas abre o sistema e confere que ele responde.' },
  { id: 'celular', titulo: 'Pronto para instalar no celular', sub: 'Ícone, nome e o QR code para a equipe.' },
]

/** O que dizer quando um passo deu erro (motivo técnico -> frase simples + o que fazer). */
export function explicarErro(motivo: string): { frase: string; conta?: 'supabase' | 'vercel' | 'github' } {
  if (motivo === 'sem-conta-supabase') return { frase: 'A sua conta do Supabase não está ligada a este computador.', conta: 'supabase' }
  if (motivo.startsWith('vercel-')) return { frase: 'A Vercel não aceitou a publicação agora. Pode ser a conta desligada deste computador ou o site da Vercel fora do ar.', conta: 'vercel' }
  // Cada motivo do Supabase com a sua frase (26/11/2026: uma frase só escondia a causa do Ponto).
  if (motivo === 'supabase-limite-gratis') return { frase: 'A sua conta grátis do Supabase já tem 2 bancos ativos, que é o limite. Pause ou apague um projeto antigo no site do Supabase (ou mude para o plano pago) e toque em Tentar de novo.' }
  if (motivo === 'supabase-401' || motivo === 'supabase-403') return { frase: 'O Supabase não aceitou a ligação com a sua conta (ela pode ter vencido). Religue a conta e tente de novo.', conta: 'supabase' }
  if (motivo === 'supabase-429') return { frase: 'O Supabase pediu uma pausa (muitos pedidos seguidos). Espere um minuto e tente de novo.' }
  if (motivo === 'supabase-migrations') return { frase: 'O banco foi criado, mas as tabelas do sistema não subiram. Fale com o Atlas para ele corrigir pela linha da obra.' }
  if (motivo === 'supabase-link') return { frase: 'Não consegui conectar a obra ao banco novo no Supabase. Tente de novo em alguns minutos; se repetir, fale com o Atlas.' }
  if (motivo === 'supabase-funcoes') return { frase: 'O banco e as tabelas estão prontos, mas as funções do servidor não subiram. Fale com o Atlas para ele corrigir pela linha da obra.' }
  if (motivo === 'supabase-demorou') return { frase: 'O Supabase está demorando para preparar o banco novo. Isso às vezes leva mais de 10 minutos; toque em Tentar de novo daqui a pouco.' }
  if (motivo === 'supabase-sem-organizacao') return { frase: 'A sua conta do Supabase ainda não tem uma organização. Crie uma no site do Supabase e tente de novo.' }
  if (motivo.startsWith('supabase-')) return { frase: 'O Supabase não terminou de preparar o banco. Às vezes ele demora; dá para tentar de novo.' }
  if (motivo === 'teste-falhou') return { frase: 'O sistema foi publicado, mas não respondeu no teste. O Atlas não diz que está no ar sem conferir.' }
  if (motivo === 'ferramentas-indisponiveis') return { frase: 'Faltam as ferramentas da Vercel e do Supabase neste computador, e não consegui instalar agora.' }
  return { frase: 'Algo não saiu como esperado neste passo.' }
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
    for (let i = desde; i < ids.length; i++) {
      e.passos[i].estado = 'agora'
      await esperaFalsa(passoMs)
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
