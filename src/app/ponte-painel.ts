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
  /** Uma etapa acabou de terminar e a linha de produção espera o OK (só vale no passo a passo; no automático o painel libera sozinho). */
  etapaPronta: { n: number; nome: string } | null
  /** Há uma versão de teste para abrir. */
  temTeste: boolean
}

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
  /** Simulações do protótipo ("Simular no protótipo"). */
  readonly simular: {
    concluirEtapa(): void
    concluirObra(): void
    pararPor(p: ParadaReal | null): void
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
    simular: {
      concluirEtapa() {
        const e = estadoDoPlano(f.plan).etapa
        if (!e) return
        marcarMs(e.n)
        etapaPronta = { n: e.n, nome: e.nome }
      },
      concluirObra() { f.plan = f.plan.replace(/\[ \]/g, '[x]'); etapaPronta = null; parada = null; pausada = false },
      pararPor(p) { parada = p },
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
        agora: acabou ? [] : [
          { sigla: 'IM', quem: 'Equipe de execução', oque: base.etapa ? `Construindo a etapa ${base.etapa.nome}` : 'Construindo', tom: 'ativo' },
          { sigla: 'QA', quem: 'Inspetor de qualidade', oque: 'Testes prontos, esperando a vez', tom: 'espera' },
          { sigla: 'FI', quem: 'Fiscal', oque: etapaPronta ? `Aprovou a etapa ${etapaPronta.nome}` : 'Conferindo cada tarefa pronta', tom: 'espera' },
        ],
        pausadaPorVoce: pausada,
        parada,
        etapaPronta,
        temTeste: !acabou || base.feitas > 0,
      }
    },
    async pausar() { chamadas.push('pausar'); pausada = true },
    async continuar() { chamadas.push('continuar'); pausada = false },
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
