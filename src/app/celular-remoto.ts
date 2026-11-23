// M33 — o notebook como canteiro do celular. O celular deixa pedidos no servidor do Atlas; aqui o app busca (batida), executa um
// por vez com as MESMAS pontes das telas do computador (o Claude é sempre o do cliente, neste notebook) e publica o resultado:
// fase e progresso do projeto, as telas navegáveis já protegidas (montarNavegavel), os nomes sugeridos e o status das obras.
//
// Regras:
//  - Um pedido por vez, na ordem em que chegou. O servidor reentrega o que ficou sem resposta (notebook desligou no meio):
//    um pedido que já está na fila ou rodando não roda de novo.
//  - Toda falha vira resposta 'erro' com frase de leigo; a fila nunca trava.
//  - Nada de caminho, código ou segredo sai daqui: o status leva só nome, etapa, % e uma frase.
import { montarNavegavel, type PontePrototipo, type TelaDesenhada } from './ponte-prototipo'
import type { EntradaEstilo, EstiloProposto, PonteEstilo } from './ponte-estilo'
import type { NomeProposto, PonteBatismo } from './ponte-batismo'
import type { ModoObra, PonteConstrucao, PonteModoObra } from './ponte-construcao'
import type { PontePainel } from './ponte-painel'
import type { PonteObras } from './ponte-obras'
import type { PonteArquivos } from './ponte-arquivos'
import type { ObraStatus } from '../web/obras-status'

export type TipoPedido = 'obra_nova' | 'ajuste' | 'aprovar_telas' | 'nome' | 'construir' | 'pausar' | 'continuar'
export type FaseProjeto = 'na_fila' | 'desenhando' | 'telas_prontas' | 'ajustando' | 'pensando_nomes' | 'nomes_prontos' | 'pronto_para_construir' | 'construindo' | 'erro'

export interface PedidoRemoto { id: string; tipo: TipoPedido; obra_id: string; dados: Record<string, unknown>; criado_em: string }
export interface ProjetoRemoto {
  nome: string
  fase: FaseProjeto
  progresso: { feitas: number; total: number; atual: string; telas: Array<{ nome: string; pronta: boolean }> }
  nomes: Array<{ nome: string; porque: string }>
  mensagem: string
}

/** Chamadas ao servidor do Atlas feitas por ESTE notebook (credencial da ativação). */
export interface CanalRemoto {
  /** Avisa que está ligado (e o que está fazendo) e traz os pedidos novos. */
  sinal(ocupado: string | null): Promise<PedidoRemoto[]>
  responder(id: string, estado: 'feito' | 'erro', mensagem: string): Promise<void>
  /** Publica o projeto; `documento` = as telas navegáveis protegidas (só quando mudaram). */
  projeto(obraId: string, p: ProjetoRemoto, documento?: string): Promise<void>
  /** Baixa (e apaga do servidor) uma foto de referência que o celular mandou. Devolve o data URL. */
  referencia(id: string): Promise<string>
  /** Status das obras (M30): a lista substitui o que o servidor tinha. */
  status(obras: ObraStatus[]): Promise<void>
}

/** O que o notebook lembra de cada obra que nasceu no celular (obra_id do servidor → pasta daqui). */
export interface ObraLigada { pasta: string; nome: string; nomes?: NomeProposto[] }
export interface MemoriaRemoto {
  ler(): Record<string, ObraLigada>
  gravar(m: Record<string, ObraLigada>): void
}

export interface PontesRemoto {
  obras: PonteObras
  prototipo: PontePrototipo
  estilo: PonteEstilo
  batismo: PonteBatismo
  construcao: PonteConstrucao
  modos: PonteModoObra
  painel: PontePainel
  arquivos: PonteArquivos
}

const OCUPADO: Record<TipoPedido, string> = {
  obra_nova: 'Desenhando as telas', ajuste: 'Ajustando as telas', aprovar_telas: 'Pensando nos nomes', nome: 'Guardando o nome',
  construir: 'Preparando a obra', pausar: 'Pausando a obra', continuar: 'Continuando a obra',
}
const NAO_CONHECE = 'Essa obra não está neste notebook. Abra o Atlas no computador onde ela foi criada.'

class ErroLeigo extends Error {}

const frase = (e: unknown) => (e instanceof ErroLeigo ? e.message : 'Não deu certo agora no notebook. Tente de novo daqui a pouco; se continuar, abra a Ajuda do Atlas no computador.')

/** Nome provisório a partir do relato: as primeiras palavras, sem pontuação. Mais tarde o cliente escolhe o de verdade. */
export function nomeProvisorio(relato: string): string {
  const palavras = relato.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((p) => p.length > 2).slice(0, 4)
  return palavras.length ? palavras.join(' ').slice(0, 60) : 'Obra do celular'
}

function telasDoEstado(versao: { telas: TelaDesenhada[] } | undefined) {
  return (versao?.telas ?? []).map((t) => ({ nome: t.nome.slice(0, 60), pronta: true }))
}

export function criarExecutorRemoto(p: PontesRemoto, canal: CanalRemoto, memoria: MemoriaRemoto, opcoes: { intervaloProgressoMs?: number } = {}) {
  const fila: PedidoRemoto[] = []
  const conhecidos = new Set<string>()
  let atual: PedidoRemoto | null = null
  let rodando: Promise<void> | null = null
  const intervalo = opcoes.intervaloProgressoMs ?? 8000

  const ligada = (obraId: string): ObraLigada => {
    const o = memoria.ler()[obraId]
    if (!o) throw new ErroLeigo(NAO_CONHECE)
    return o
  }
  const lembrar = (obraId: string, o: ObraLigada) => memoria.gravar({ ...memoria.ler(), [obraId]: o })

  const vazio = (nome: string, fase: FaseProjeto, extra: Partial<ProjetoRemoto> = {}): ProjetoRemoto =>
    ({ nome, fase, progresso: { feitas: 0, total: 0, atual: '', telas: [] }, nomes: [], mensagem: '', ...extra })

  async function publicarTelas(obraId: string, o: ObraLigada, fase: FaseProjeto, extra: Partial<ProjetoRemoto> = {}) {
    const est = await p.prototipo.estado(o.pasta)
    const versao = est.versoes.find((v) => v.numero === est.atual) ?? est.versoes[est.versoes.length - 1]
    const telas = telasDoEstado(versao)
    const doc = versao && versao.telas.length ? montarNavegavel(versao.telas, versao.telas[0].id) : null
    await canal.projeto(obraId, vazio(o.nome, fase, { progresso: { feitas: telas.length, total: telas.length, atual: '', telas }, ...extra }), doc ?? undefined)
  }

  /** Enquanto o Claude desenha, publica o mapa com as telas que já ficaram prontas (só quando muda). */
  function acompanhar(obraId: string, o: ObraLigada, fase: FaseProjeto) {
    let ultimo = ''
    let vivo = true
    const passo = async () => {
      while (vivo) {
        await new Promise((r) => setTimeout(r, intervalo))
        if (!vivo || !p.prototipo.progresso) return
        const g = await p.prototipo.progresso(o.pasta).catch(() => null)
        if (!g || !vivo) continue
        const prontas = new Set(g.telas.map((t) => t.id))
        const telas = g.mapa.map((m) => ({ nome: m.nome.slice(0, 60), pronta: prontas.has(m.id) }))
        const proxima = g.mapa.find((m) => !prontas.has(m.id))
        const chave = JSON.stringify(telas)
        if (chave === ultimo) continue
        ultimo = chave
        await canal.projeto(obraId, vazio(o.nome, fase, { progresso: { feitas: prontas.size, total: g.mapa.length, atual: proxima?.nome.slice(0, 80) ?? '', telas } })).catch(() => {})
      }
    }
    void passo()
    return () => { vivo = false }
  }

  async function obraNova(ped: PedidoRemoto) {
    const relato = String(ped.dados.relato ?? '')
    const v = (ped.dados.visual ?? {}) as { modo?: string; observacao?: string; cores?: string[]; referencias?: string[] }
    const nome = nomeProvisorio(relato)
    // Reentrega depois de desligar no meio: reaproveita a pasta que já foi criada para este pedido.
    let o = memoria.ler()[ped.obra_id]
    if (!o) {
      const criada = await p.obras.criarSubpasta(nome)
      o = { pasta: criada.pasta, nome }
      lembrar(ped.obra_id, o)
    }
    await canal.projeto(ped.obra_id, vazio(o.nome, 'desenhando', { progresso: { feitas: 0, total: 0, atual: 'Lendo a sua ideia', telas: [] } }))
    // Fotos do celular: para a pasta da obra, para o Claude olhar junto.
    const prints: string[] = []
    for (const [i, id] of (v.referencias ?? []).entries()) {
      const dataUrl = await canal.referencia(id)
      if (!p.arquivos.guardarImagem) break
      const g = await p.arquivos.guardarImagem(o.pasta, `celular-${i + 1}`, dataUrl)
      prints.push(g.nome)
    }
    const extra = [v.observacao, (v.cores ?? []).length ? `Cores que o cliente escolheu: ${(v.cores ?? []).join(', ')}` : ''].filter(Boolean).join('\n')
    let estilo: EstiloProposto | null = null
    if (v.modo === 'marca') {
      await p.estilo.materializar(o.pasta, { tipo: 'identidade', identidade: { arquivos: prints, cores: (v.cores ?? []).join(' ') } })
    } else {
      const entrada: EntradaEstilo = { referencias: [...prints.map((n) => ({ tipo: 'print' as const, valor: n })), ...(extra ? [{ tipo: 'fala' as const, valor: extra }] : [])], sentimentos: [], extra }
      const propostos = await p.estilo.propor(entrada, o.pasta)
      estilo = propostos[0] ?? null
      if (estilo) await p.estilo.materializar(o.pasta, { tipo: 'estilo', estilo, entrada })
    }
    const parar = acompanhar(ped.obra_id, o, 'desenhando')
    try { await p.prototipo.desenhar(o.pasta, o.nome, estilo, relato) } finally { parar() }
    await publicarTelas(ped.obra_id, o, 'telas_prontas')
  }

  async function executar(ped: PedidoRemoto) {
    switch (ped.tipo) {
      case 'obra_nova': return obraNova(ped)
      case 'ajuste': {
        const o = ligada(ped.obra_id)
        await canal.projeto(ped.obra_id, vazio(o.nome, 'ajustando', { progresso: { feitas: 0, total: 0, atual: 'Ajustando as telas', telas: [] } }))
        await p.prototipo.ajustar(o.pasta, String(ped.dados.texto ?? ''))
        return publicarTelas(ped.obra_id, o, 'telas_prontas')
      }
      case 'aprovar_telas': {
        const o = ligada(ped.obra_id)
        await canal.projeto(ped.obra_id, vazio(o.nome, 'pensando_nomes'))
        const nomes = await p.batismo.sugerir(o.pasta, o.nome)
        lembrar(ped.obra_id, { ...o, nomes })
        return canal.projeto(ped.obra_id, vazio(o.nome, 'nomes_prontos', { nomes: nomes.slice(0, 3).map((n) => ({ nome: n.nome.slice(0, 60), porque: n.porque.slice(0, 140) })) }))
      }
      case 'nome': {
        const o = ligada(ped.obra_id)
        const nome = String(ped.dados.nome ?? '').slice(0, 60)
        const sugerido = o.nomes?.find((n) => n.nome === nome)
        await p.batismo.batizar(o.pasta, sugerido ? { origem: 'sugestao', nome, slogan: sugerido.slogan, logo: sugerido.logo } : { origem: 'cliente', nome, slogan: '', logo: null })
        lembrar(ped.obra_id, { ...o, nome })
        return canal.projeto(ped.obra_id, vazio(nome, 'pronto_para_construir'))
      }
      case 'construir': {
        const o = ligada(ped.obra_id)
        const modo: ModoObra = ped.dados.modo === 'passo' ? 'passo-a-passo' : 'automatico'
        const plano = await p.construcao.planejar(o.pasta, o.nome)
        await p.modos.gravar(o.pasta, modo)
        await p.construcao.iniciar(o.pasta, o.nome, modo, plano.etapas)
        await canal.projeto(ped.obra_id, vazio(o.nome, 'construindo', { progresso: { feitas: 0, total: plano.etapas.length, atual: plano.etapas[0]?.nome.slice(0, 80) ?? '', telas: [] } }))
        return publicarStatus()
      }
      case 'pausar': { const o = ligada(ped.obra_id); await p.painel.pausar(o.pasta); return publicarStatus() }
      case 'continuar': { const o = ligada(ped.obra_id); await p.painel.continuar(o.pasta); return publicarStatus() }
    }
  }

  async function trabalhar() {
    while (fila.length) {
      atual = fila.shift()!
      const ped = atual
      try {
        await executar(ped)
        await canal.responder(ped.id, 'feito', '').catch(() => {})
      } catch (e) {
        if (ped.tipo === 'obra_nova' || ped.tipo === 'ajuste') {
          const o = memoria.ler()[ped.obra_id]
          if (o) await canal.projeto(ped.obra_id, vazio(o.nome, 'erro', { mensagem: frase(e) })).catch(() => {})
        }
        await canal.responder(ped.id, 'erro', frase(e)).catch(() => {})
      }
      atual = null
      conhecidos.delete(ped.id)
    }
  }

  async function publicarStatus() {
    const ligadas = memoria.ler()
    const porPasta = new Map(Object.entries(ligadas).map(([id, o]) => [o.pasta, { id, nome: o.nome }]))
    const pastas = await p.obras.listar().catch(() => [] as string[])
    for (const o of Object.values(ligadas)) if (!pastas.includes(o.pasta)) pastas.push(o.pasta)
    const obras: ObraStatus[] = []
    let achouAtiva = false
    for (const pasta of pastas.slice(0, 20)) {
      const e = await p.painel.ler(pasta).catch(() => null)
      if (!e || e.tarefas === 0) continue
      const lig = porPasta.get(pasta)
      const id = lig?.id ?? pasta
      if (!/^[\w.-]{1,64}$/.test(id)) continue
      const estado: ObraStatus['estado'] = e.pct >= 100 ? 'pronta' : e.pausadaPorVoce || e.parada === 'cota' ? 'pausada' : e.parada || e.etapaPronta ? 'aguardando_aprovacao' : 'construindo'
      const ativa = !achouAtiva && estado === 'construindo' && e.agora.length > 0
      if (ativa) achouAtiva = true
      const noticia = e.parada === 'voce' ? 'Precisa de você no notebook: abra o Atlas lá para ver o passo a passo.'
        : e.parada === 'cota' ? 'A cota do Claude acabou. A obra continua sozinha quando ela renovar.'
          : e.parada === 'billing' ? 'Uma cobrança de uma conta sua precisa de atenção. Abra o Atlas no notebook.'
            : e.pausadaPorVoce ? 'Obra pausada por você.'
              : e.etapaPronta ? `A etapa "${e.etapaPronta.nome}" terminou e espera o seu OK.`
                : e.pct >= 100 ? 'Obra pronta.'
                  : e.etapa ? `Trabalhando em: ${e.etapa.nome}.` : ''
      obras.push({
        id, nome: (lig?.nome ?? pasta.replace(/-/g, ' ')).slice(0, 80),
        etapa_atual: { numero: e.etapa?.n ?? e.etapas.length, rotulo: (e.etapa?.nome ?? 'Tudo pronto').slice(0, 80) },
        total_etapas: e.etapas.length, percentual: Math.max(0, Math.min(100, Math.round(e.pct))), estado, ativa_agora: ativa,
        ultima_noticia: noticia, quando: new Date().toISOString(),
      })
    }
    await canal.status(obras)
  }

  return {
    /** Uma batida: avisa o servidor que está ligado e pega os pedidos novos. Chamar de tempos em tempos (~20 s). */
    async batida() {
      const novos = await canal.sinal(atual ? OCUPADO[atual.tipo] : null)
      for (const ped of novos) {
        if (conhecidos.has(ped.id)) continue
        conhecidos.add(ped.id)
        fila.push(ped)
      }
      if (!rodando && fila.length) rodando = trabalhar().finally(() => { rodando = null })
    },
    /** Espera a fila esvaziar (testes e desligamento). */
    async ocioso() { while (rodando) await rodando },
    publicarStatus,
  }
}

const CHAVE = 'atlas:celular:obras'
/** Lembra as obras do celular no próprio computador (só id do servidor → pasta e nome; nada de segredo). */
export function criarMemoriaRemotoLocal(): MemoriaRemoto {
  return {
    ler() { try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} } },
    gravar(m) { try { localStorage.setItem(CHAVE, JSON.stringify(m)) } catch { /* sem armazenamento: vale nesta sessão */ } },
  }
}
export function criarMemoriaRemotoFixture(): MemoriaRemoto {
  let m: Record<string, ObraLigada> = {}
  return { ler: () => structuredClone(m), gravar: (n) => { m = structuredClone(n) } }
}

/** Liga o notebook ao celular enquanto `executor` existir: batida a cada 20 s e status das obras a cada 2 min. */
export const BATIDA_MS = 20_000
export const STATUS_MS = 120_000
export function ligarCelularRemoto(ex: ReturnType<typeof criarExecutorRemoto>): () => void {
  const bater = () => { void ex.batida().catch(() => {}) }
  const status = () => { void ex.publicarStatus().catch(() => {}) }
  bater(); status()
  const t = setInterval(bater, BATIDA_MS)
  const s = setInterval(status, STATUS_MS)
  return () => { clearInterval(t); clearInterval(s) }
}
