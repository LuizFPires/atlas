// M33 — Radar de pirataria. Decisão do Luiz: o Radar SÓ AVISA. Nada aqui pausa, bloqueia ou cancela licença;
// ele levanta sinais no painel e o Luiz decide. "Já verifiquei" (resolver) só baixa o sinal, sem apagar histórico.
// Privacidade: nunca IP. Só a UF derivada do acesso, o id curto (8 hex) do dispositivo e agregados.
import { adminLogado, type DepsAdmin } from './admin.ts'
import { sha256 } from './cripto.ts'
import { REGIAO_DA_UF } from './geo.ts'
import { type Deps, ErroRegra } from './tipos.ts'

export type TipoSinal = 'instancia_recusada' | 'troca_frequente' | 'regioes_distantes' | 'degustacao_repetida'
export type GravidadeSinal = 'alta' | 'media' | 'baixa'
export interface DetalhesSinal { regioes?: [string, string]; trocas?: number; dias?: number; dispositivo_hash?: string; tentativas?: number }
export interface SinalRadar { id: string; tipo: TipoSinal; gravidade: GravidadeSinal; licenca_id: string | null; cliente: string; descricao: string; quando: Date; detalhes: DetalhesSinal }
export interface ResumoRadar { licencas_sob_suspeita: number; sinais_abertos: number; por_tipo: Record<TipoSinal, number> }

const HORA = 3600_000
const DIA = 24 * HORA
const BRT_MS = 3 * HORA

// ── CRITÉRIOS DE GRAVIDADE (decisão automática, sujeita a ajuste do Luiz) ───────────────────────────────────
// Princípio: "forte" = a pessoa está INSISTINDO em usar a licença/teste fora do combinado; "médio" = padrão estranho que pode
// ter explicação inocente (viagem, troca de computador legítima); "baixo" = primeira ocorrência isolada. O Radar nunca age sozinho.
//
// 2º computador barrado (instancia_recusada) — recusas do guardião nos últimos 7 dias, somando todas as tentativas da licença:
//     1 recusa = baixa (pode ser alguém que copiou a pasta sem querer) · 2 = média · 3 ou mais = ALTA (uma cópia rodando de vez em outro lugar).
export const RECUSA = { janela_dias: 7, media: 2, alta: 3 }
// Troca frequente — trocas de computador FEITAS PELO CLIENTE (as liberadas pelo Luiz não contam) nos últimos 30 dias.
//     O limite normal é 1 troca a cada 7 dias; 3 ou mais em 30 dias já exige muita insistência = MÉDIA; 5 ou mais = ALTA.
export const TROCAS = { janela_dias: 30, media: 3, alta: 5 }
// Regiões distantes — dois acessos da MESMA licença, de UFs em macrorregiões diferentes (N, NE, CO, SE, S), com até 6 h de diferença.
//     Sempre MÉDIA (internet de celular e viagem de avião existem). Um sinal por dia de Brasília.
export const REGIOES = { janela_horas: 6 }
// Teste grátis repetido — o ledger do teste (degustacoes_dispositivos) já barrou o mesmo computador tentando pegar outro teste:
//     1 barrada = baixa (reinstalou?) · 2 ou mais = ALTA (pessoa insistindo em burlar o teste). Olha os últimos 30 dias.
export const TESTE = { janela_dias: 30, alta: 2 }
/** Eventos e fatos mais antigos que isso não entram na leitura (o maior critério acima é de 30 dias) nem ficam guardados. */
export const RETENCAO_DIAS = 90
const LEITURA_DIAS = 30

const ORDEM: Record<GravidadeSinal, number> = { alta: 0, media: 1, baixa: 2 }
const diaBrt = (d: Date) => new Date(d.getTime() - BRT_MS).toISOString().slice(0, 10)
const veses = (n: number) => (n === 1 ? '1 vez' : `${n} vezes`)

// ── registro (chamado pelo /instancia/validar; nunca derruba a validação) ──────────────────────────────────
/** Id curto do dispositivo: 8 primeiros caracteres do sha256 do hash do computador (não é o hash, não se desfaz). */
export const dispositivoCurto = async (computadorHash: string) => (await sha256(computadorHash)).slice(0, 8)

/** Grava a recusa de 2º computador. Limitado a 30/hora por licença para não encher a tabela. Falha em silêncio (o Radar é só aviso). */
export async function registrarRecusa(d: Deps, licencaId: string, computadorHash: string, uf: string | null) {
  try {
    if (!(await d.store.tentarEvento(`radar:recusa:${licencaId}`, 30, HORA, d.agora()))) return
    await d.store.registrarEventoRadar({ licenca_id: licencaId, tipo: 'instancia_recusada', uf, dispositivo: await dispositivoCurto(computadorHash), criado_em: d.agora() })
  } catch { /* o aviso não pode derrubar o guardião */ }
}

/** Grava de onde veio um acesso válido (só a UF), no máximo 1 vez a cada 2 h por licença e UF. Sem UF conhecida não grava nada. */
export async function registrarAcesso(d: Deps, licencaId: string, uf: string | null) {
  if (!uf) return
  try {
    if (!(await d.store.tentarEvento(`radar:acesso:${licencaId}:${uf}`, 1, 2 * HORA, d.agora()))) return
    await d.store.registrarEventoRadar({ licenca_id: licencaId, tipo: 'acesso', uf, dispositivo: null, criado_em: d.agora() })
  } catch { /* idem */ }
}

// ── leitura ────────────────────────────────────────────────────────────────────────────────────────────
interface Calculo { sinais: SinalRadar[] }

/** Calcula TODOS os sinais (inclusive os já baixados), com `quando` = o fato mais recente do sinal. */
async function calcular(d: DepsAdmin): Promise<Calculo> {
  const agora = d.agora()
  const desde = new Date(agora.getTime() - LEITURA_DIAS * DIA)
  const s = d.store
  const [clientes, licencas, trocas, eventos, barradas] = await Promise.all([
    s.listarClientes(), s.listarLicencas(), s.listarTrocas(), s.eventosRadar(desde), s.barradasDeTeste(desde, 1),
  ])
  const cli = new Map(clientes.map((c) => [c.id, c]))
  const lic = new Map(licencas.map((l) => [l.id, l]))
  const rotulo = (licencaId: string) => {
    const c = cli.get(lic.get(licencaId)?.cliente_id ?? '')
    return c ? c.empresa?.trim() || c.nome_tratamento : 'Atlas'
  }
  const sinais: SinalRadar[] = []

  // (a) 2º computador barrado
  const recusas = new Map<string, typeof eventos>()
  for (const e of eventos) {
    if (e.tipo !== 'instancia_recusada' || e.criado_em.getTime() < agora.getTime() - RECUSA.janela_dias * DIA) continue
    recusas.set(e.licenca_id, [...(recusas.get(e.licenca_id) ?? []), e])
  }
  for (const [licId, lista] of recusas) {
    if (!lic.has(licId)) continue
    const n = lista.length
    const freq = new Map<string, number>()
    for (const e of lista) if (e.dispositivo) freq.set(e.dispositivo, (freq.get(e.dispositivo) ?? 0) + 1)
    const principal = [...freq].sort((a, b) => b[1] - a[1])[0]?.[0]
    sinais.push({
      id: `instancia_recusada:${licId}`, tipo: 'instancia_recusada', licenca_id: licId, cliente: rotulo(licId),
      gravidade: n >= RECUSA.alta ? 'alta' : n >= RECUSA.media ? 'media' : 'baixa',
      descricao: `Uma cópia do app tentou rodar em outro computador com esta licença (${veses(n)} nos últimos ${RECUSA.janela_dias} dias). O Atlas barrou: a licença continua só no computador de sempre.`,
      quando: lista.reduce((m, e) => (e.criado_em > m ? e.criado_em : m), lista[0].criado_em),
      detalhes: { tentativas: n, ...(principal ? { dispositivo_hash: principal } : {}) },
    })
  }

  // (b) troca frequente (só as feitas pelo cliente)
  const porLicenca = new Map<string, Date[]>()
  for (const t of trocas) {
    if (t.por_admin || t.feita_em.getTime() < agora.getTime() - TROCAS.janela_dias * DIA) continue
    porLicenca.set(t.licenca_id, [...(porLicenca.get(t.licenca_id) ?? []), t.feita_em])
  }
  for (const [licId, quandos] of porLicenca) {
    const n = quandos.length
    if (n < TROCAS.media || !lic.has(licId)) continue
    sinais.push({
      id: `troca_frequente:${licId}`, tipo: 'troca_frequente', licenca_id: licId, cliente: rotulo(licId),
      gravidade: n >= TROCAS.alta ? 'alta' : 'media',
      descricao: `A licença trocou de computador ${veses(n)} em ${TROCAS.janela_dias} dias, bem mais que o normal (o combinado é 1 troca por semana).`,
      quando: quandos.reduce((m, q) => (q > m ? q : m), quandos[0]),
      detalhes: { trocas: n, dias: TROCAS.janela_dias },
    })
  }

  // (c) regiões distantes em poucas horas
  const acessos = new Map<string, Array<{ uf: string; t: number }>>()
  for (const e of eventos) if (e.uf && REGIAO_DA_UF[e.uf]) acessos.set(e.licenca_id, [...(acessos.get(e.licenca_id) ?? []), { uf: e.uf, t: e.criado_em.getTime() }])
  for (const [licId, lista] of acessos) {
    if (!lic.has(licId)) continue
    lista.sort((a, b) => a.t - b.t)
    const porDia = new Map<string, { a: string; b: string; t: number }>()
    for (let j = 1; j < lista.length; j++) {
      for (let i = j - 1; i >= 0 && lista[j].t - lista[i].t <= REGIOES.janela_horas * HORA; i--) {
        if (REGIAO_DA_UF[lista[i].uf] === REGIAO_DA_UF[lista[j].uf]) continue
        const dia = diaBrt(new Date(lista[j].t))
        const x = porDia.get(dia)
        if (!x || lista[j].t > x.t) porDia.set(dia, { a: lista[i].uf, b: lista[j].uf, t: lista[j].t })
      }
    }
    for (const [dia, x] of porDia) {
      sinais.push({
        id: `regioes_distantes:${licId}:${dia}`, tipo: 'regioes_distantes', licenca_id: licId, cliente: rotulo(licId), gravidade: 'media',
        descricao: `A licença foi usada em ${x.a} e em ${x.b} com menos de ${REGIOES.janela_horas} horas de diferença. Pode ser viagem ou internet de celular, mas também pode ser a licença compartilhada.`,
        quando: new Date(x.t), detalhes: { regioes: [x.a, x.b] },
      })
    }
  }

  // (d) teste grátis repetido (ledger da degustação)
  for (const b of barradas) {
    if (b.ultima_em.getTime() < agora.getTime() - TESTE.janela_dias * DIA) continue
    sinais.push({
      id: `degustacao_repetida:${b.dispositivo}`, tipo: 'degustacao_repetida', licenca_id: lic.has(b.licenca_id) ? b.licenca_id : null,
      cliente: lic.has(b.licenca_id) ? rotulo(b.licenca_id) : 'Teste grátis', gravidade: b.barradas >= TESTE.alta ? 'alta' : 'baixa',
      descricao: `Um computador tentou pegar o teste grátis de novo (${veses(b.barradas)}). O Atlas barrou todas: só vale 1 teste por computador.`,
      quando: b.ultima_em, detalhes: { dispositivo_hash: b.dispositivo, tentativas: b.barradas },
    })
  }
  return { sinais }
}

const aberto = (x: SinalRadar, baixas: Map<string, Date>) => {
  const b = baixas.get(x.id)
  return !b || b < x.quando // a baixa só vale até o último fato conhecido: fato novo depois dela reabre o sinal
}

/** Sinais ainda abertos, mais graves primeiro. A baixa NÃO apaga nada: só esconde enquanto não houver fato novo. */
export async function radar(d: DepsAdmin, jwt: string) {
  await adminLogado(d, jwt)
  const baixas = new Map((await d.store.baixasRadar()).map((b) => [b.sinal_id, b.resolvida_em]))
  const { sinais } = await calcular(d)
  const abertos = sinais.filter((x) => aberto(x, baixas)).sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || b.quando.getTime() - a.quando.getTime())
  const por_tipo: Record<TipoSinal, number> = { instancia_recusada: 0, troca_frequente: 0, regioes_distantes: 0, degustacao_repetida: 0 }
  for (const x of abertos) por_tipo[x.tipo]++
  const resumo: ResumoRadar = { licencas_sob_suspeita: new Set(abertos.map((x) => x.licenca_id).filter(Boolean)).size, sinais_abertos: abertos.length, por_tipo }
  return { ligado: true, resumo, sinais: abertos.slice(0, 200) }
}

/** "Já verifiquei": registra a baixa (quem e quando) e anota na auditoria. Não apaga eventos nem troca nada na licença. */
export async function resolverSinal(d: DepsAdmin, jwt: string, id: unknown) {
  const adm = await adminLogado(d, jwt)
  if (typeof id !== 'string' || !/^[a-z_]{5,30}:[\w.:-]{1,120}$/.test(id)) throw new ErroRegra('sinal_invalido', 'Sinal inválido.', 400)
  const { sinais } = await calcular(d)
  const sinal = sinais.find((x) => x.id === id)
  if (!sinal) throw new ErroRegra('sinal_nao_encontrado', 'Esse sinal não existe mais.', 404)
  const baixas = new Map((await d.store.baixasRadar()).map((b) => [b.sinal_id, b.resolvida_em]))
  if (!aberto(sinal, baixas)) return { ok: true, ja_resolvido: true }
  await d.store.baixarSinalRadar(id, adm.email, d.agora())
  const dono = sinal.licenca_id ? (await d.store.licencaPorId(sinal.licenca_id))?.cliente_id ?? null : null
  await d.store.inserirOcorrencia({ cliente_id: dono, tipo: 'radar_baixa', descricao: `Radar: sinal "${sinal.tipo}" marcado como já verificado.`, autor: adm.email, resolvida: true, criada_em: d.agora() })
  return { ok: true, ja_resolvido: false }
}

/** Retenção (chamada pelo agendador diário): apaga eventos mais velhos que RETENCAO_DIAS. */
export const limparRadar = (d: Deps) => d.store.limparEventosRadar(new Date(d.agora().getTime() - RETENCAO_DIAS * DIA))
