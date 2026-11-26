// Ponte da página de vendas (M61; prototipo/caminho-novo/LC4Pagina). O adaptador real é app/adaptadores/pagina-vendas.cjs.
export type FaseVendas = 'nada' | 'pronta' | 'aprovada' | 'construindo' | 'testando' | 'teste-ok' | 'teste-falhou' | 'abrindo' | 'aberta' | 'erro'
export interface EstadoVendas { fase: FaseVendas; versao: number; html: string; resumo: string; etapas: string[]; erro: string | null }
export interface Marcacao { x: number; y: number; texto: string }

export interface PonteVendas {
  indisponivel?: boolean
  estado(pasta: string): Promise<EstadoVendas>
  desenhar(pasta: string, obraNome: string): Promise<EstadoVendas>
  ajustar(pasta: string, marcacoes: Marcacao[]): Promise<EstadoVendas>
  /** A chave de TESTE do gateway vai direto para a Vercel do cliente; a tela não guarda. */
  aprovar(pasta: string, chaveTeste: string): Promise<EstadoVendas>
  abrir(pasta: string, chaveReal: string): Promise<EstadoVendas>
}

export function explicarErroVendas(m: string): string {
  if (m === 'chave-invalida') return 'Essa chave não parece certa. Confira se é a do modo certo (teste ou de verdade) e copie de novo, inteira.'
  if (m === 'vercel-variaveis' || m === 'vercel-deploy') return 'A Vercel não aceitou agora. Confira se a conta da Vercel continua ligada e tente de novo.'
  if (m === 'teste-nao-passou') return 'Antes de abrir, a compra de teste precisa dar certo.'
  if (m === 'obra-fora-do-ar') return 'Primeiro o sistema precisa estar no ar.'
  return 'Não deu certo agora. Tente de novo em instantes.'
}

const PAGINA_EXEMPLO = '<!doctype html><html><body style="font-family:sans-serif;margin:0"><header style="padding:24px;background:#1F5FAD;color:#fff"><h1>O ponto da sua equipe no celular</h1><p>Sem papel e sem relógio na parede.</p><a href="#precos" style="color:#fff">Testar grátis 14 dias</a></header><section id="precos" style="padding:24px"><h2>Preços</h2><p>Grátis · Mensal R$ 49 · Anual R$ 470</p></section></body></html>'

export function criarVendasFixture({ passoMs = 600 }: { passoMs?: number } = {}): PonteVendas {
  const m = new Map<string, EstadoVendas>()
  const de = (p: string) => { if (!m.has(p)) m.set(p, { fase: 'nada', versao: 0, html: '', resumo: '', etapas: [], erro: null }); return m.get(p) as EstadoVendas }
  return {
    async estado(p) { return structuredClone(de(p)) },
    async desenhar(p) { Object.assign(de(p), { fase: 'pronta', versao: 1, html: PAGINA_EXEMPLO, resumo: 'Versão 1, com as cores do app.' }); return structuredClone(de(p)) },
    async ajustar(p, ms) { if (!ms.length) throw new Error('sem-marcacoes'); const e = de(p); Object.assign(e, { versao: e.versao + 1, resumo: `Fiz ${ms.length} ${ms.length === 1 ? 'ajuste' : 'ajustes'}.`, html: e.html.replace('O ponto da sua equipe no celular', 'Bata o ponto pelo celular em 3 segundos') }); return structuredClone(e) },
    async aprovar(p, chave) {
      if (!/^(sk_test_|\$aact_hmlg_)/.test(chave.trim())) throw new Error('chave-invalida')
      const e = de(p); e.fase = 'construindo'
      void (async () => { await new Promise((r) => setTimeout(r, passoMs)); e.fase = 'testando'; await new Promise((r) => setTimeout(r, passoMs)); Object.assign(e, { fase: 'teste-ok', etapas: ['A compra foi paga (sem dinheiro de verdade)', 'A conta da empresa foi criada', 'O acesso chegou no e-mail'] }) })()
      return structuredClone(e)
    },
    async abrir(p, chave) { if (!/^(sk_live_|\$aact_prod_)/.test(chave.trim())) throw new Error('chave-invalida'); de(p).fase = 'aberta'; return structuredClone(de(p)) },
  }
}

export const vendasIndisponivel: PonteVendas = {
  indisponivel: true,
  async estado() { return { fase: 'nada', versao: 0, html: '', resumo: '', etapas: [], erro: null } },
  async desenhar() { throw new Error('indisponivel') },
  async ajustar() { throw new Error('indisponivel') },
  async aprovar() { throw new Error('indisponivel') },
  async abrir() { throw new Error('indisponivel') },
}
