// Testar a ideia no celular (Luiz, 28/11/2026): as MESMAS telas do computador, ligadas ao notebook pelo servidor do Atlas.
// Ler = o resumo que o notebook publicou; fazer = deixar um pedido na fila e esperar o notebook responder.
import type { MensagemEntrevista, PonteTestar, ResumoTeste } from '../app/ponte-testar'
import type { ResumoTesteCelular } from '../app/teste-celular'
import type { ApiCelular, EstadoCelular } from './api'

export interface OpcoesPonteCelular {
  /** Lê o estado do servidor (com cache curto, para várias telas não martelarem o servidor). */
  ler(forcar?: boolean): Promise<EstadoCelular>
  esperaMs?: number
  /** Quanto esperar o notebook responder uma entrevista (a batida fica rápida, mas o Claude ainda pensa). */
  limiteEntrevistaMs?: number
  /** A revisão do protótipo pode levar uns 15 minutos. */
  limiteRevisaoMs?: number
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Lê com cache: no máximo uma ida ao servidor a cada `ttl` (as telas leem a cada 3 s). */
export function leitorComCache(api: ApiCelular, ttl = 6000): OpcoesPonteCelular['ler'] {
  let ultimo: { em: number; p: Promise<EstadoCelular> } | null = null
  return (forcar = false) => {
    if (!forcar && ultimo && Date.now() - ultimo.em < ttl) return ultimo.p
    const p = api.estado()
    ultimo = { em: Date.now(), p }
    p.catch(() => { ultimo = null })
    return p
  }
}

export function criarPonteTestarCelular(api: ApiCelular, obraId: string, o: OpcoesPonteCelular): PonteTestar & { revisarPrototipo(pedido: string): Promise<number> } {
  const espera = o.esperaMs ?? 4000
  /** Teste pedido pelo celular que o notebook ainda não começou (ele pega os pedidos a cada 20 s). */
  let pedido: { n: number; quantidade: number; mesmosDe: number | null; em: number } | null = null
  const resumo = async (forcar = false): Promise<ResumoTesteCelular | null> => (await o.ler(forcar)).testes[obraId] ?? null

  /** Só os testes que o celular consegue mostrar: rodando, ou prontos com o relatório publicado. */
  const visiveis = (r: ResumoTesteCelular | null): ResumoTeste[] => {
    const lista = (r?.testes ?? []).filter((t) => t.estado !== 'pronto' || !!r?.relatorios[t.n])
    if (pedido && !lista.some((t) => t.n >= pedido!.n) && Date.now() - pedido.em < 15 * 60_000) {
      lista.unshift({ n: pedido.n, criadoEm: new Date(pedido.em).toISOString(), quantidade: pedido.quantidade, mesmosDe: pedido.mesmosDe, versao: null, etapa: 'entender', estado: 'rodando', motivo: null, feitos: 0, olhados: 0, termometro: null, maisContra: null })
    }
    return lista
  }

  /** Espera o pedido ser respondido pelo notebook. Devolve a mensagem (quando deu certo). */
  async function esperarPedido(id: string, limiteMs: number, pronto?: () => Promise<boolean>): Promise<string> {
    const ate = Date.now() + limiteMs
    while (Date.now() < ate) {
      await dormir(espera)
      const e = await o.ler(true).catch(() => null)
      if (!e) continue
      const p = e.pedidos.find((x) => x.id === id)
      if (p?.estado === 'erro') throw new Error(p.mensagem.startsWith('codigo:') ? p.mensagem.slice(7) : 'notebook-recusou')
      if (p?.estado === 'feito' && (!pronto || (await pronto()))) return p.mensagem
    }
    throw new Error('notebook-demorou')
  }

  return {
    async listar() { return visiveis(await resumo()) },
    async iniciar(_pasta, x) {
      const r = await resumo(true)
      const lista = r?.testes ?? []
      if (lista.some((t) => t.estado === 'rodando' || t.estado === 'pausado-cota') || pedido) throw new Error('teste-em-andamento')
      const mesmos = x.mesmosDe !== null && x.mesmosDe !== undefined
      await api.pedir('testar', obraId, { quantidade: x.quantidade, mesmos })
      const n = Math.max(0, ...lista.map((t) => t.n)) + 1
      pedido = { n, quantidade: x.quantidade, mesmosDe: mesmos ? x.mesmosDe ?? null : null, em: Date.now() }
      return { n }
    },
    async estado(_pasta, n) {
      const t = (await resumo())?.testes.find((x) => x.n === n)
      if (t) { if (pedido && t.n >= pedido.n) pedido = null; return t }
      return visiveis(null).find((x) => x.n === n) ?? null
    },
    async relatorio(_pasta, n) { return (await resumo())?.relatorios[n] ?? null },
    async cena(_pasta, n) { return (await resumo())?.cenas[n] ?? { agentes: [], eventos: [] } },
    async entrevistas(_pasta, n) { return (await resumo())?.entrevistas[n] ?? {} },
    async entrevistar(_pasta, n, id, pergunta) {
      const antes = ((await resumo())?.entrevistas[n]?.[id] ?? []).length
      const { id: pid } = await api.pedir('entrevistar', obraId, { teste: n, agente: id, pergunta })
      let resposta: MensagemEntrevista | undefined
      await esperarPedido(pid, o.limiteEntrevistaMs ?? 4 * 60_000, async () => {
        const msgs = (await resumo())?.entrevistas[n]?.[id] ?? []
        resposta = msgs.length > antes ? [...msgs].reverse().find((m) => m.de === 'agente') : undefined
        return !!resposta
      })
      return { resposta: resposta!.texto }
    },
    async retomar() { return { ok: true as const } },
    async revisarPrototipo(texto) {
      const { id } = await api.pedir('ajuste', obraId, { texto: texto.slice(0, 4000) })
      const m = await esperarPedido(id, o.limiteRevisaoMs ?? 30 * 60_000)
      const v = /^versao:(\d+)$/.exec(m)
      return v ? Number(v[1]) : 0
    },
  }
}
