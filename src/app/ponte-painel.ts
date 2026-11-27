import type { TravaObra } from './travas'
// Portas do painel da obra (F09): ler o andamento (PLAN.md da obra, prazo, "agora na obra"), pausar/continuar, dar o OK da etapa
// e mostrar o canteiro 3D. O MODO (automático ou passo a passo) vem da PonteModoObra do M18 (`<obra>\.atlas\modo.json`).
// Aqui só existe o mock do modo fixture. O adaptador real (ler PLAN.md/estado da obra, ligar o canteiro) é pendência de /entregar
// (app/PENDENTE-ENTREGAR.md, M19). Nenhum segredo passa por aqui; nada do cliente vira instrução.

import { comoDado } from './ponte-estilo'
import { ETAPAS_EXEMPLO, ehModoObra, montarPlanMd, type ModoObra } from './ponte-construcao'

// ---- PLAN.md da obra: o MESMO cálculo do painel do canteiro (.claude/hooks/plano.cjs) ------------------------------------------------

/** "## Milestone 3 — título", "## M3 — título" e "## M3: título" (igual ao plano.cjs). */
const RE_MS = /^##\s+(?:Milestone\s+|M)(\d+)\s*[—–:-]\s*(.+?)\s*$/i

export interface MilestoneLido { n: number; titulo: string; peso: number; total: number; feitas: number; pct: number; status: 'concluido' | 'andamento' | 'pendente' }
export interface PlanoLido { milestones: MilestoneLido[]; tarefas: number; feitas: number; pct: number; proximo: number | null }

/** Porta fiel de `lerPlano` (plano.cjs): % ponderado pelo `peso:` de cada milestone. Um teste compara os dois lado a lado. */
export function lerPlanoDoTexto(texto: string): PlanoLido {
  const ms: MilestoneLido[] = []
  let atual: MilestoneLido | null = null
  for (const l of texto.split(/\r?\n/)) {
    const m = l.match(RE_MS)
    if (m) { atual = { n: Number(m[1]), titulo: m[2], peso: 1, total: 0, feitas: 0, pct: 0, status: 'pendente' }; ms.push(atual); continue }
    if (/^##\s/.test(l)) { atual = null; continue }
    if (!atual) continue
    const p = l.match(/^peso:\s*(\d+(?:[.,]\d+)?)/i)
    if (p) atual.peso = Number(p[1].replace(',', '.'))
    const t = l.match(/^\s*[-*]\s+\[( |x|X)\]/)
    if (t) { atual.total++; if (t[1] !== ' ') atual.feitas++ }
  }
  let pesoTotal = 0, pesoFeito = 0, tarefas = 0, feitas = 0
  for (const m of ms) {
    const frac = m.total ? m.feitas / m.total : 0
    m.pct = Math.round(frac * 100)
    m.status = m.total && m.feitas === m.total ? 'concluido' : m.feitas > 0 ? 'andamento' : 'pendente'
    pesoTotal += m.peso; pesoFeito += m.peso * frac
    tarefas += m.total; feitas += m.feitas
  }
  const proximo = ms.find((m) => m.status !== 'concluido')
  return { milestones: ms, tarefas, feitas, pct: pesoTotal ? Math.round((pesoFeito / pesoTotal) * 1000) / 10 : 0, proximo: proximo ? proximo.n : null }
}

// ---- Estado da obra -------------------------------------------------------------------------------------------------------------

/** Paradas REAIS (as únicas que o modo automático aceita): precisa de você (F11), pausa por cota (F10) e cobrança/billing. */
export type ParadaReal = 'voce' | 'cota' | 'billing'
export const PARADAS: readonly ParadaReal[] = ['voce', 'cota', 'billing']

export interface QuemTrabalha {
  /** Duas letras (a bolinha). */
  sigla: string
  quem: string
  oque: string
  /** `ativo` = trabalhando agora (destaque verde); `espera` = esperando a vez. */
  tom: 'ativo' | 'espera'
}

export interface EtapaDaObra { n: number; nome: string; feitas: number; total: number; pct: number }

export interface EstadoObra {
  pct: number
  /** M51: esperando a vez na fila; começa sozinha quando a obra `nome` ficar pronta. */
  naFila?: { depoisDe: string; nome: string } | null
  /** M51: minutos de trabalho que faltam (pelo ritmo real); null sem medida. */
  restanteMin?: number | null
  tarefas: number
  feitas: number
  /** Etapa em andamento (a próxima não concluída); null quando a obra acabou. */
  etapa: { n: number; nome: string } | null
  etapas: EtapaDaObra[]
  /** "≈ 3 h 20" e "Hoje, ~18h"; null quando ainda não dá para estimar. */
  restante: string | null
  previsao: string | null
  agora: QuemTrabalha[]
  /** O cliente pausou a obra. */
  pausadaPorVoce: boolean
  /** Parada real em curso (cota, precisa de você, cobrança). */
  parada: ParadaReal | null
  /** Trava conhecida de uma conta (travas.ts): a obra NÃO para; a ficha explica no topo. */
  trava?: TravaObra | null
  /** Uma etapa acabou de terminar e a linha de produção espera o OK (só vale no passo a passo; no automático o painel libera sozinho). */
  etapaPronta: { n: number; nome: string } | null
  /** Há uma versão de teste para abrir. */
  temTeste: boolean
  /** Vigia (24/11/2026): a linha parou sem avançar. 'tentando' = o Atlas religa sozinho; 'precisa-voce' = desistiu e pede o cliente. */
  vigia?: VigiaObra | null
  /** M41: último sinal da linha (qualquer saída do Claude, medido pelo Atlas), ISO; null sem linha rodando. */
  sinal?: string | null
  /** M41: parada por cota com a hora de volta que o Claude informou, ISO. */
  voltaEm?: string | null
  /** M41: as últimas linhas do diário da obra (a mais nova por último). */
  diario?: LinhaDiario[]
}

/** M41: uma linha do diário da obra, em português simples (nunca senha nem chave). */
export interface LinhaDiario { em: string; tipo: 'info' | 'trabalho' | 'parada' | 'pedido' | 'retomada' | 'entrega' | 'defeito'; texto: string; detalhe?: string }

/** M41: cronograma da obra (aba Cronograma). Datas em ISO. */
export interface EtapaCronograma {
  n: number; nome: string; status: 'entregue' | 'andamento' | 'falta'; pct: number
  previsto: { inicio: string; fim: string } | null
  /** antes: entregue antes de o Atlas começar a medir (hora desconhecida). */
  real: { inicio: string; fim?: string; antes?: boolean } | null
  esperado: { inicio: string; fim: string } | null
}
export interface Cronograma { inicio: string; previstoFim: string; esperadoFim: string; diferencaMs: number; pausaMs: number; entregues: number; total: number; etapas: EtapaCronograma[]; pausas: { inicio: string; fim: string | null }[] }

/** fala: o que a linha disse ao parar (quando pede algo à pessoa); conta: a conta que ela pede para ligar. */
export interface VigiaObra { situacao: 'tentando' | 'precisa-voce'; tentativa: number; de: number; motivo: string; proximaEm?: string; fala?: string; conta?: 'GitHub' | 'Vercel' | 'Supabase'; checagens?: Checagem[]; opcoes?: OpcaoDecisao[] }
/** Guilherme (24/11/2026): a linha parou perguntando como seguir; cada opção que o cliente pode escolher. */
export interface OpcaoDecisao { rotulo: string; explica: string; recomendada: boolean }
/** M41 (O4): uma das conferências que o Atlas fez ao desistir de religar sozinho. */
export interface Checagem { nome: string; ok: boolean; dica?: string }

export type Situacao = 'andando' | 'pausada' | 'espera-ok' | 'cota' | 'precisa-de-voce' | 'billing' | 'concluida'

/**
 * A regra do modo, em um lugar só:
 *  - obra pronta (100%) => concluída;
 *  - parada real (cota, precisa de você, cobrança) => para nos DOIS modos;
 *  - pausa do cliente => pausada;
 *  - fim de etapa: PASSO A PASSO => espera o OK do cliente; AUTOMÁTICO => segue sozinho (nunca pede aprovação).
 */
export function situacaoDaObra(modo: ModoObra, e: Pick<EstadoObra, 'pct' | 'parada' | 'pausadaPorVoce' | 'etapaPronta'>): Situacao {
  if (e.pct >= 100) return 'concluida'
  if (e.parada === 'cota') return 'cota'
  if (e.parada === 'voce') return 'precisa-de-voce'
  if (e.parada === 'billing') return 'billing'
  if (e.pausadaPorVoce) return 'pausada'
  if (modo === 'passo-a-passo' && e.etapaPronta) return 'espera-ok'
  return 'andando'
}

/** Aba Desempenho (26/11/2026): a curva S do consumo do plano do Claude. Valores em % do orçamento da obra; datas em ISO. */
export interface PontoCurva { t: string; v: number }
export interface Desempenho {
  /** true até a 1ª etapa entregue: o orçamento ainda é estimativa pelo tamanho do plano. */
  estimativaInicial: boolean
  realizadoPct: number
  previstoAgoraPct: number
  fisicoPct: number
  /** Gasto em relação ao que o físico andou: 0,18 = 18% a mais que o previsto; null sem medida. */
  ritmo: number | null
  plano: 'pro' | 'max' | 'ultra'
  /** Cota da janela de 5 h (em unidades de consumo); null no Ultra (sem janela de 5 h). */
  cota: number | null
  /** true depois da 1ª pausa de cota: a cota foi medida neste computador. */
  cotaAprendida: boolean
  terminoProjetado: string
  previstoFim: string
  pausasPrevistas: { inicio: string; fim: string }[]
  /** Trechos em que a obra não trabalhou (computador desligado, Atlas fechado ou obra pausada; 30 min ou mais, fora da cota). */
  semTrabalho?: { inicio: string; fim: string; ate_agora: boolean }[]
  /** Quanto do orçamento a obra deve usar até o fim, no ritmo de agora. */
  projetadoFimPct?: number
  serie: { previsto: PontoCurva[]; realizado: PontoCurva[]; projetado: PontoCurva[] }
}

export interface PontePainel {
  /** Lê o andamento da obra (PLAN.md da pasta, prazo, quem trabalha). */
  ler(pasta: string): Promise<EstadoObra>
  /** Pausa a obra a pedido do cliente. */
  pausar(pasta: string): Promise<void>
  /** Continua a obra pausada pelo cliente. */
  continuar(pasta: string): Promise<void>
  /** O cliente deu o OK da etapa que terminou (passo a passo), ou o painel liberou sozinho (automático). */
  aprovarEtapa(pasta: string): Promise<void>
  /** Troca o modo na linha de produção (o adaptador real regrava o `recomendado.json` da obra, via `paraRecomendado`). */
  aplicarModo(pasta: string, modo: ModoObra): Promise<void>
  /**
   * Endereço do canteiro 3D desta obra (o servidor local do kit, .claude/canteiro/server.cjs, só em 127.0.0.1); null = sem canteiro vivo,
   * e a tela mostra a imagem 3D de apoio.
   */
  enderecoCanteiro(pasta: string): string | null
  /** Abre a versão de teste da obra. */
  abrirTeste(pasta: string): Promise<void>
  /** M41: o diário completo da obra. */
  diario?(pasta: string): Promise<LinhaDiario[]>
  /** M41: o cronograma da obra. */
  cronograma?(pasta: string): Promise<Cronograma>
  /** Aba Desempenho: curva S do consumo, ritmo de gasto, pausas previstas e término projetado. */
  desempenho?(pasta: string): Promise<Desempenho>
  /** A linha parou perguntando como seguir: o cliente escolhe uma das opções (pelo rótulo). */
  decidir?(pasta: string, rotulo: string): Promise<void>
}

/** Só aceita o servidor local do canteiro: http://127.0.0.1:<porta>/... (nada de endereço vindo de dado). */
export const enderecoCanteiroSeguro = (url: string | null | undefined): string | null => {
  if (!url) return null
  return /^http:\/\/127\.0\.0\.1:\d{2,5}(\/[A-Za-z0-9._~\-/?=&%]*)?$/.test(url) ? url : null
}

// ---- Textos de prazo ---------------------------------------------------------------------------------------------------------

export function textoRestante(minutos: number): string {
  if (minutos <= 0) return 'nada'
  if (minutos < 60) return `≈ ${Math.max(1, Math.round(minutos))} min`
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return m ? `≈ ${h} h ${String(m).padStart(2, '0')}` : `≈ ${h} h`
}

export function textoPrevisao(agora: Date, minutos: number): string {
  if (minutos <= 0) return 'Agora'
  const fim = new Date(agora.getTime() + minutos * 60000)
  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const amanha = new Date(agora.getTime() + 86400000)
  const hora = fim.getMinutes() >= 30 ? fim.getHours() + 1 : fim.getHours()
  const h = `~${hora % 24}h`
  if (dia(fim) === dia(agora) && hora < 24) return `Hoje, ${h}`
  if (dia(fim) === dia(amanha)) return `Amanhã, ${h}`
  return `${fim.getDate()}/${String(fim.getMonth() + 1).padStart(2, '0')}, ${h}`
}

/** Nome curto da etapa para a tela ("Confirmação por WhatsApp" => como está no PLAN). Texto do plano é DADO. */
const nomeCurto = (t: string) => comoDado(t, 80).join(' ').slice(0, 60).trim() || 'Etapa'

export function estadoDoPlano(texto: string): Pick<EstadoObra, 'pct' | 'tarefas' | 'feitas' | 'etapa' | 'etapas'> {
  const p = lerPlanoDoTexto(texto)
  const prox = p.milestones.find((m) => m.n === p.proximo)
  return {
    pct: p.pct,
    tarefas: p.tarefas,
    feitas: p.feitas,
    etapa: prox ? { n: prox.n, nome: nomeCurto(prox.titulo) } : null,
    etapas: p.milestones.map((m) => ({ n: m.n, nome: nomeCurto(m.titulo), feitas: m.feitas, total: m.total, pct: m.pct })),
  }
}

// ---- Mock do modo fixture ----------------------------------------------------------------------------------------------------

export interface PainelFixture extends PontePainel {
  /** O PLAN.md "da obra" (só na memória). */
  plan: string
  /** Chamadas recebidas (para os testes). */
  readonly chamadas: string[]
  /** Último modo aplicado na linha de produção. */
  modoAplicado: ModoObra | null
  /** M41: o diário de exemplo (a mais nova por último). */
  diarioDeExemplo: LinhaDiario[]
  /** Simulações do protótipo ("Simular no protótipo"). */
  readonly simular: {
    concluirEtapa(): void
    concluirObra(): void
    pararPor(p: ParadaReal | null): void
    /** Vigia: a linha parou sem avançar (null = tudo normal). */
    vigia(v: VigiaObra | null): void
    /** A linha parou e ninguém está trabalhando agora (sem a obra estar pronta). */
    semNinguem(): void
  }
}

/** PLAN.md de exemplo: 8 etapas da barbearia, 4 prontas e a 5ª (WhatsApp) a meio caminho. */
export function planoDeExemplo(): string {
  const linhas = montarPlanMd('Agenda da Barbearia do Zé', ETAPAS_EXEMPLO).split('\n')
  let ms = 0, tarefaNoMs = 0
  return linhas.map((l) => {
    if (RE_MS.test(l)) { ms++; tarefaNoMs = 0; return l }
    if (/^- \[ \]/.test(l)) { tarefaNoMs++; if (ms <= 4 || (ms === 5 && tarefaNoMs === 1)) return l.replace('[ ]', '[x]') }
    return l
  }).join('\n')
}

const MIN_POR_TAREFA = 12

export function criarPainelFixture(opcoes: { plan?: string; agora?: () => Date; endereco?: string | null } = {}): PainelFixture {
  const chamadas: string[] = []
  const agoraRel = opcoes.agora ?? (() => new Date())
  let pausada = false
  let parada: ParadaReal | null = null
  let etapaPronta: EstadoObra['etapaPronta'] = null
  let vigia: VigiaObra | null = null
  let ninguem = false
  const marcarMs = (n: number) => {
    let dentro = false
    f.plan = f.plan.split('\n').map((l) => {
      const m = l.match(RE_MS)
      if (m) dentro = Number(m[1]) === n
      return dentro && /^\s*[-*]\s+\[ \]/.test(l) ? l.replace('[ ]', '[x]') : l
    }).join('\n')
  }
  const f: PainelFixture = {
    plan: opcoes.plan ?? planoDeExemplo(),
    chamadas,
    modoAplicado: null,
    diarioDeExemplo: [
      { em: '2026-11-24T12:02:00.000Z', tipo: 'info', texto: 'O Atlas começou a trabalhar na obra' },
      { em: '2026-11-24T12:41:00.000Z', tipo: 'entrega', texto: 'Terminou a etapa Agenda do dia' },
      { em: '2026-11-24T13:05:00.000Z', tipo: 'parada', texto: 'Parou sem conseguir avançar. O Atlas vai tentar de novo sozinho.' },
      { em: '2026-11-24T13:07:00.000Z', tipo: 'retomada', texto: 'O Atlas religou a obra sozinho (tentativa 1 de 3)' },
      { em: '2026-11-24T13:20:00.000Z', tipo: 'trabalho', texto: 'Escrevendo o código' },
    ],
    simular: {
      concluirEtapa() {
        const e = estadoDoPlano(f.plan).etapa
        if (!e) return
        marcarMs(e.n)
        etapaPronta = { n: e.n, nome: e.nome }
      },
      concluirObra() { f.plan = f.plan.replace(/\[ \]/g, '[x]'); etapaPronta = null; parada = null; pausada = false },
      pararPor(p) { parada = p },
      vigia(v) { vigia = v; ninguem = v !== null },
      semNinguem() { ninguem = true },
    },
    async ler() {
      const base = estadoDoPlano(f.plan)
      const faltam = base.tarefas - base.feitas
      const min = faltam * MIN_POR_TAREFA
      const acabou = base.pct >= 100
      return {
        ...base,
        restante: acabou ? null : textoRestante(min),
        previsao: acabou ? null : textoPrevisao(agoraRel(), min),
        agora: acabou || ninguem ? [] : [
          { sigla: 'IM', quem: 'Equipe de execução', oque: base.etapa ? `Construindo a etapa ${base.etapa.nome}` : 'Construindo', tom: 'ativo' },
          { sigla: 'QA', quem: 'Inspetor de qualidade', oque: 'Testes prontos, esperando a vez', tom: 'espera' },
          { sigla: 'FI', quem: 'Fiscal', oque: etapaPronta ? `Aprovou a etapa ${etapaPronta.nome}` : 'Conferindo cada tarefa pronta', tom: 'espera' },
        ],
        pausadaPorVoce: pausada,
        parada,
        etapaPronta,
        temTeste: !acabou || base.feitas > 0,
        vigia: acabou ? null : vigia,
        diario: f.diarioDeExemplo.slice(-8),
      }
    },
    async diario() { return f.diarioDeExemplo.slice() },
    async desempenho() {
      // Exemplo (o mesmo do protótipo aprovado): 19h41, 14,2% gasto, 2 pausas da cota até ~09h do dia seguinte.
      const H = 3600_000
      const t0 = Date.parse('2026-11-26T22:00:00.000Z')
      const i = (h: number) => new Date(t0 + h * H).toISOString()
      const s = (n: number, f: (k: number) => number) => Array.from({ length: n + 1 }, (_, k) => ({ t: i((14 * k) / n), v: Math.round(f(k / n) * 10000) / 100 }))
      return {
        estimativaInicial: false, realizadoPct: 14.2, previstoAgoraPct: 12, fisicoPct: 12.03, ritmo: 0.18, plano: 'pro' as const, cota: 15, cotaAprendida: true,
        terminoProjetado: i(14), previstoFim: i(14),
        pausasPrevistas: [{ inicio: i(3.66), fim: i(5) }, { inicio: i(8.5), fim: i(10) }],
        serie: {
          previsto: s(40, (u) => u * u * (3 - 2 * u)),
          realizado: [{ t: i(0), v: 0 }, { t: i(0.35), v: 6 }, { t: i(0.68), v: 14.2 }],
          projetado: [{ t: i(0.68), v: 14.2 }, { t: i(3.66), v: 40 }, { t: i(5), v: 40 }, { t: i(8.5), v: 75 }, { t: i(10), v: 75 }, { t: i(14), v: 100 }],
        },
      }
    },
    async cronograma() {
      const H = 3600_000
      const t0 = Date.parse('2026-11-24T12:00:00.000Z')
      const i = (h: number) => new Date(t0 + h * H).toISOString()
      return {
        inicio: i(0), previstoFim: i(76), esperadoFim: i(98), diferencaMs: 22 * H, pausaMs: 14 * H, entregues: 3, total: 5,
        etapas: [
          { n: 1, nome: 'Base e login', status: 'entregue', pct: 100, previsto: { inicio: i(0), fim: i(8) }, real: { inicio: i(0), fim: i(10) }, esperado: null },
          { n: 2, nome: 'Agenda do dia', status: 'entregue', pct: 100, previsto: { inicio: i(8), fim: i(20) }, real: { inicio: i(10), fim: i(19) }, esperado: null },
          { n: 3, nome: 'Marcar horário', status: 'entregue', pct: 100, previsto: { inicio: i(20), fim: i(34) }, real: { inicio: i(19), fim: i(40) }, esperado: null },
          { n: 4, nome: 'Confirmação por WhatsApp', status: 'andamento', pct: 45, previsto: { inicio: i(34), fim: i(50) }, real: { inicio: i(40) }, esperado: { inicio: i(44), fim: i(60) } },
          { n: 5, nome: 'Relatórios', status: 'falta', pct: 0, previsto: { inicio: i(50), fim: i(76) }, real: null, esperado: { inicio: i(60), fim: i(98) } },
        ],
        pausas: [{ inicio: i(22), fim: i(36) }],
      }
    },
    async pausar() { chamadas.push('pausar'); pausada = true },
    async continuar() { chamadas.push('continuar'); pausada = false; vigia = null; ninguem = false },
    async decidir(_p, rotulo) { chamadas.push(`decidir:${rotulo}`); vigia = null; ninguem = false },
    async aprovarEtapa() { chamadas.push('aprovarEtapa'); etapaPronta = null },
    async aplicarModo(_pasta, modo) {
      if (!ehModoObra(modo)) throw new Error('modo-invalido')
      chamadas.push(`aplicarModo:${modo}`)
      f.modoAplicado = modo
    },
    enderecoCanteiro() { return enderecoCanteiroSeguro(opcoes.endereco ?? null) },
    async abrirTeste() { chamadas.push('abrirTeste') },
  }
  return f
}

/** Sem adaptador real e fora do modo fixture: não finge andamento. */
export const painelIndisponivel: PontePainel = {
  async ler() { throw new Error('indisponivel') },
  async pausar() { throw new Error('indisponivel') },
  async continuar() { throw new Error('indisponivel') },
  async aprovarEtapa() { throw new Error('indisponivel') },
  async aplicarModo() { throw new Error('indisponivel') },
  enderecoCanteiro() { return null },
  async abrirTeste() { throw new Error('indisponivel') },
}
