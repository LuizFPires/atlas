// Portas da aprovação (F08): planejar a obra, guardar o MODO da obra e começar a construir.
//  - PonteModoObra: preferência da obra (automático ou passo a passo), guardada na PASTA DA OBRA em `.atlas\modo.json`.
//    É o formato que o painel da obra (M19) lê para honrar a escolha e permitir trocar. Nunca guarda segredo.
//  - PonteConstrucao: (1) `planejar` mostra etapas, prazo e consumo da cota; (2) `iniciar` gera o PLAN.md da obra no formato
//    obrigatório (o mesmo que o painel do canteiro lê) e dispara a linha de produção do kit no modo escolhido.
// Aqui só existem os mocks do modo fixture. O adaptador real (o Claude gerando o PLAN e ligando o roteiro) é pendência de /entregar.
// Tudo que o cliente escreveu (nome da obra) é DADO: passa por `comoDado` antes de entrar no PLAN.md.

import { comoDado } from './ponte-estilo'
import type { Plano } from './ponte-claude'

// ---- Modo da obra -------------------------------------------------------------------------------------------------------------

export type ModoObra = 'automatico' | 'passo-a-passo'
export const MODOS_OBRA: readonly ModoObra[] = ['automatico', 'passo-a-passo']
/** O modo que o Atlas recomenda (e que já vem escolhido). */
export const MODO_RECOMENDADO: ModoObra = 'automatico'

/** Onde a escolha mora, dentro da pasta da obra (o M19 lê este mesmo arquivo). */
export const ARQUIVO_MODO = '.atlas/modo.json'

export interface PreferenciaModo {
  versao: 1
  modo: ModoObra
  /** ISO 8601, só para registro. */
  escolhidoEm: string
}

export const ehModoObra = (m: unknown): m is ModoObra => typeof m === 'string' && (MODOS_OBRA as readonly string[]).includes(m)

export function serializarModo(modo: ModoObra, agora = new Date()): string {
  const p: PreferenciaModo = { versao: 1, modo, escolhidoEm: agora.toISOString() }
  return JSON.stringify(p, null, 2) + '\n'
}

/** Lê o conteúdo de `modo.json`. Qualquer coisa fora do formato vira null (o painel então pergunta, não adivinha). */
export function lerModoDoTexto(texto: string): ModoObra | null {
  try {
    const o = JSON.parse(texto) as unknown
    if (o && typeof o === 'object' && (o as { versao?: unknown }).versao === 1 && ehModoObra((o as { modo?: unknown }).modo)) return (o as PreferenciaModo).modo
  } catch { /* texto estragado */ }
  return null
}

/** Como o adaptador real liga o modo na linha de produção do kit (`recomendado.json` da obra). */
export function paraRecomendado(modo: ModoObra): { ativo: boolean } {
  return { ativo: modo === 'automatico' }
}

export interface PonteModoObra {
  /** Modo guardado na pasta da obra; null se ainda não escolheu (ou o arquivo está estragado). */
  ler(pasta: string): Promise<ModoObra | null>
  /** Guarda (ou troca) o modo da obra. Pode ser chamado de novo depois: o cliente pode trocar no painel. */
  gravar(pasta: string, modo: ModoObra): Promise<void>
}

/** Textos de leigo de cada modo (a tela e o painel usam os mesmos). */
export const TEXTO_MODO: Record<ModoObra, { titulo: string; explica: string }> = {
  'automatico': {
    titulo: 'Automático do começo ao fim, sem me chamar',
    explica: 'O Atlas toca a obra inteira sozinho, etapa por etapa, e só chama você quando for de verdade preciso. É o jeito mais tranquilo: você pode ir cuidar da sua vida.',
  },
  'passo-a-passo': {
    titulo: 'Me chamar para aprovar cada etapa',
    explica: 'Quando uma etapa termina, o Atlas para e mostra o que ficou pronto. A próxima só começa quando você disser que pode. Mais controle, mas a obra espera por você.',
  },
}

/** No automático, estas são as ÚNICAS paradas: o resto o Atlas resolve sozinho. */
export const PARADAS_REAIS = [
  'quando só você pode resolver (como entrar numa conta ou autorizar algo), e aí o Atlas explica o passo a passo;',
  'quando a cota do seu plano do Claude acaba: a obra pausa sozinha e volta sozinha quando a cota renova;',
  'quando algum pagamento ou acesso de uma conta sua (cobrança, senha que venceu) precisa de você.',
] as const

// ---- Planejamento (etapas, prazo, cota) ---------------------------------------------------------------------------------------

export interface Etapa {
  /** "M1", "M2"... */
  n: string
  nome: string
  desc: string
  /** Tela do protótipo da obra que esta etapa constrói, se houver (caminho relativo à pasta da obra). */
  tela?: string
}

export interface PrevisaoPlano {
  /** Dias de obra no plano do cliente (nunca tokens). */
  dias: number
  /** Quantas vezes a cota deve acabar e a obra pausar sozinha (estimativa). */
  pausas: number
}

export interface Planejamento {
  etapas: Etapa[]
  /** Previsão por plano; o da tela é o do cliente, o outro só serve para o "no Max seria...". */
  previsao: Record<Plano, PrevisaoPlano>
}

export interface ResultadoInicio {
  /** Caminho do PLAN.md gravado na pasta da obra (só para mostrar). */
  plan: string
  modo: ModoObra
}

export interface PonteConstrucao {
  /** Pede ao Claude as etapas da obra (lendo telas.md/regras.md/design-system.md da pasta) e a previsão por plano. */
  planejar(pasta: string, obraNome: string): Promise<Planejamento>
  /** Gera o PLAN.md da obra (nunca sobrescreve um existente), guarda o modo e inicia a construção nesse modo. */
  iniciar(pasta: string, obraNome: string, modo: ModoObra, etapas: Etapa[]): Promise<ResultadoInicio>
}

// ---- PLAN.md da obra do cliente (formato obrigatório do painel) ---------------------------------------------------------------

const umaLinha = (t: string, max: number, vazio: string) => comoDado(t, max * 2).join(' ').slice(0, max).trim() || vazio

/**
 * PLAN.md no formato que o painel do canteiro lê: "## Milestone N — título", `peso:`, `spec:`, `tela:`, tarefas "- [ ]" e `Notas:`.
 * Cada etapa vira um milestone. O texto do cliente é normalizado para uma linha (nada de cabeçalho ou tarefa falsa vindo dele).
 */
export function montarPlanMd(obraNome: string, etapas: readonly Etapa[]): string {
  const nome = umaLinha(obraNome, 80, 'Obra')
  const saida = [
    `# PLAN — ${nome}`,
    'Fonte da verdade: prototipo/ (aprovado pelo cliente)',
    '',
    'Cada milestone é uma etapa da obra. Detalhe do que construir está em telas.md e regras.md, na pasta da obra.',
  ]
  etapas.forEach((e, i) => {
    const n = i + 1
    const titulo = umaLinha(e.nome, 60, `Etapa ${n}`)
    const desc = umaLinha(e.desc, 160, titulo)
    const tela = e.tela && /^[a-zA-Z0-9._\-/]+$/.test(e.tela) && !e.tela.includes('..') && !e.tela.startsWith('/') ? e.tela : ''
    saida.push(
      '',
      `## Milestone ${n} — ${titulo}`,
      'peso: 2',
      'spec: regras.md, telas.md',
      `tela: ${tela}`,
      `- [ ] Construir: ${desc}`,
      '- [ ] Testar o que foi feito',
      '- [ ] Conferir com o protótipo aprovado',
      'Notas:',
    )
  })
  return saida.join('\n') + '\n'
}

// ---- Mocks do modo fixture ------------------------------------------------------------------------------------------------------

/** As 8 etapas de exemplo do protótipo (barbearia). */
export const ETAPAS_EXEMPLO: Etapa[] = ([
  ['M1', 'Base e login', 'Entrada para você, os barbeiros e os clientes'],
  ['M2', 'Serviços e preços', 'Corte, barba, combos e duração de cada um'],
  ['M3', 'Agenda dos barbeiros', 'Horários de trabalho, folgas e bloqueios'],
  ['M4', 'Cliente marca horário', 'Escolhe barbeiro, dia e hora pelo celular'],
  ['M5', 'Confirmação por WhatsApp', 'Aviso automático e lembrete no dia'],
  ['M6', 'Pagamento online', 'Pix ou cartão, direto na sua conta'],
  ['M7', 'Seu painel', 'Agenda de todos, faturamento do dia'],
  ['M8', 'Publicação', 'No ar, com o endereço da barbearia'],
] as const).map(([n, nome, desc]) => ({ n, nome, desc }))

export const PREVISAO_EXEMPLO: Record<Plano, PrevisaoPlano> = { pro: { dias: 2, pausas: 3 }, max: { dias: 1, pausas: 1 } }

export interface ModoObraFixture extends PonteModoObra {
  /** Preferências "gravadas" (só na memória), por pasta. */
  readonly gravados: Record<string, ModoObra>
}

export function criarModoObraFixture(iniciais: Record<string, ModoObra> = {}): ModoObraFixture {
  const gravados: Record<string, ModoObra> = { ...iniciais }
  return {
    gravados,
    async ler(pasta) { return Object.prototype.hasOwnProperty.call(gravados, pasta) ? gravados[pasta] : null },
    async gravar(pasta, modo) {
      if (!ehModoObra(modo)) throw new Error('modo-invalido')
      gravados[pasta] = modo
    },
  }
}

export interface ConstrucaoFixture extends PonteConstrucao {
  /** Cada início de obra "disparado" (só na memória). */
  readonly iniciadas: { pasta: string; modo: ModoObra; plan: string; recomendado: { ativo: boolean } }[]
}

/** Mock: não toca no disco nem dispara nada. Grava o modo no mesmo armazém de preferências que o painel (M19) lê. */
export function criarConstrucaoFixture(modos: PonteModoObra = criarModoObraFixture(), raiz = 'C:\\Users\\Zé\\Atlas\\Obras'): ConstrucaoFixture {
  const iniciadas: ConstrucaoFixture['iniciadas'] = []
  return {
    iniciadas,
    async planejar() { return { etapas: ETAPAS_EXEMPLO.map((e) => ({ ...e })), previsao: PREVISAO_EXEMPLO } },
    async iniciar(pasta, obraNome, modo, etapas) {
      if (!ehModoObra(modo)) throw new Error('modo-invalido')
      if (!etapas.length) throw new Error('sem-etapas')
      if (iniciadas.some((i) => i.pasta === pasta)) throw new Error('ja-iniciada')
      const plan = montarPlanMd(obraNome, etapas)
      await modos.gravar(pasta, modo)
      iniciadas.push({ pasta, modo, plan, recomendado: paraRecomendado(modo) })
      return { plan: `${raiz}\\${pasta}\\PLAN.md`, modo }
    },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que planejou nem que começou a obra. */
export const construcaoIndisponivel: PonteConstrucao = {
  async planejar() { throw new Error('indisponivel') },
  async iniciar() { throw new Error('indisponivel') },
}
export const modoObraIndisponivel: PonteModoObra = {
  async ler() { throw new Error('indisponivel') },
  async gravar() { throw new Error('indisponivel') },
}
