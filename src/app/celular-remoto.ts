// M33 — o notebook como canteiro do celular. O celular deixa pedidos no servidor do Atlas; aqui o app busca (batida), executa um
// por vez com as MESMAS pontes das telas do computador (o Claude é sempre o do cliente, neste notebook) e publica o resultado:
// fase e progresso do projeto, as telas navegáveis já protegidas (montarNavegavel), os nomes sugeridos e o status das obras.
//
// Regras:
//  - Um pedido por vez, na ordem em que chegou. O servidor reentrega o que ficou sem resposta (notebook desligou no meio):
//    um pedido que já está na fila ou rodando não roda de novo.
//  - Toda falha vira resposta 'erro' com frase de leigo; a fila nunca trava.
//  - Nada de caminho, código ou segredo sai daqui: o status leva só nome, etapa, % e uma frase.
import { MAX_DOC_CELULAR, montarNavegavel, type PontePrototipo, type TelaDesenhada } from './ponte-prototipo'
import type { EntradaEstilo, EstiloProposto, PonteEstilo } from './ponte-estilo'
import type { NomeProposto, PonteBatismo } from './ponte-batismo'
import type { ModoObra, PonteConstrucao, PonteModoObra } from './ponte-construcao'
import { situacaoDaObra, type PontePainel } from './ponte-painel'
import { momentoDaObra } from './momento-obra'
import type { PonteObras } from './ponte-obras'
import type { PonteArquivos } from './ponte-arquivos'
import type { ObraStatus } from '../web/obras-status'
import type { PonteTestar } from './ponte-testar'
import { montarResumoTeste, type ResumoTesteCelular } from './teste-celular'

export type TipoPedido = 'obra_nova' | 'ajuste' | 'aprovar_telas' | 'nome' | 'construir' | 'pausar' | 'continuar' | 'foto_ajuda' | 'testar' | 'entrevistar'
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
  /** Testar a ideia: o resumo dos testes de uma obra (substitui o anterior). */
  teste?(obraId: string, resumo: ResumoTesteCelular): Promise<void>
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
  /** M58: a foto que o celular mandou para a Ajuda do Atlas (data URL). */
  aoFotoAjuda?: (dataUrl: string) => Promise<void> | void
  /** Testar a ideia (28/11/2026): o mesmo motor da aba do computador. */
  testar?: PonteTestar
}

const OCUPADO: Record<TipoPedido, string> = {
  obra_nova: 'Desenhando as telas', ajuste: 'Ajustando as telas', aprovar_telas: 'Pensando nos nomes', nome: 'Guardando o nome',
  construir: 'Preparando a obra', pausar: 'Pausando a obra', continuar: 'Continuando a obra', foto_ajuda: 'Levando a foto para a Ajuda',
  testar: 'Começando o teste da ideia', entrevistar: 'Entrevistando um agente',
}
const NAO_CONHECE = 'Essa obra não está neste notebook. Abra o Atlas no computador onde ela foi criada.'
const SEM_TESTE = 'Este notebook ainda não tem o teste da ideia. Atualize o Atlas no computador.'

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
  /** Depois de uma entrevista, a batida fica mais rápida por uns minutos (a conversa não espera 20 s a cada pergunta). */
  let rapidoAte = 0
  const intervalo = opcoes.intervaloProgressoMs ?? 8000

  const ligada = (obraId: string): ObraLigada => {
    const o = memoria.ler()[obraId]
    if (!o) throw new ErroLeigo(NAO_CONHECE)
    return o
  }
  /** Pausar/continuar: além das obras criadas pelo celular, as criadas no notebook (o celular as conhece pelo nome da pasta,
   *  que é o id que o status manda). Achado em 26/11/2026: "Pausar" no celular não parava a obra criada no notebook. */
  const ligadaOuPasta = async (obraId: string): Promise<ObraLigada> => {
    const o = memoria.ler()[obraId]
    if (o) return o
    const pastas = await p.obras.listar().catch(() => [] as string[])
    if (pastas.includes(obraId)) return { pasta: obraId, nome: obraId.replace(/-/g, ' ') }
    throw new ErroLeigo(NAO_CONHECE)
  }
  const lembrar = (obraId: string, o: ObraLigada) => memoria.gravar({ ...memoria.ler(), [obraId]: o })

  const vazio = (nome: string, fase: FaseProjeto, extra: Partial<ProjetoRemoto> = {}): ProjetoRemoto =>
    ({ nome, fase, progresso: { feitas: 0, total: 0, atual: '', telas: [] }, nomes: [], mensagem: '', ...extra })

  async function publicarTelas(obraId: string, o: ObraLigada, fase: FaseProjeto, extra: Partial<ProjetoRemoto> = {}) {
    const est = await p.prototipo.estado(o.pasta)
    const versao = est.versoes.find((v) => v.numero === est.atual) ?? est.versoes[est.versoes.length - 1]
    const telas = telasDoEstado(versao)
    const doc = versao && versao.telas.length ? montarNavegavel(versao.telas, versao.telas[0].id) : null
    await canal.projeto(obraId, vazio(o.nome, fase, { progresso: { feitas: telas.length, total: telas.length, atual: '', telas }, ...extra }), doc && doc.length <= MAX_DOC_CELULAR ? doc : undefined)
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
        // Ideias do teste (28/11/2026) também chegam aqui, e podem ser de uma obra criada no computador: aí só cria a versão nova
        // do protótipo (o dono aprova na aba Protótipo). A resposta leva a versão para o celular mostrar.
        if (!memoria.ler()[ped.obra_id]) { const o = await ligadaOuPasta(ped.obra_id); const r = await p.prototipo.ajustar(o.pasta, String(ped.dados.texto ?? '')); return `versao:${r.estado.atual}` }
        const o = ligada(ped.obra_id)
        await canal.projeto(ped.obra_id, vazio(o.nome, 'ajustando', { progresso: { feitas: 0, total: 0, atual: 'Ajustando as telas', telas: [] } }))
        const r = await p.prototipo.ajustar(o.pasta, String(ped.dados.texto ?? ''))
        await publicarTelas(ped.obra_id, o, 'telas_prontas')
        return `versao:${r.estado.atual}`
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
      case 'pausar': { const o = await ligadaOuPasta(ped.obra_id); await p.painel.pausar(o.pasta); return publicarStatus(true) }
      case 'continuar': { const o = await ligadaOuPasta(ped.obra_id); await p.painel.continuar(o.pasta); return publicarStatus(true) }
      case 'foto_ajuda': { const d = await canal.referencia(String(ped.dados.referencia ?? '')); await p.aoFotoAjuda?.(d); return }
      case 'testar': {
        if (!p.testar) throw new ErroLeigo(SEM_TESTE)
        const o = await ligadaOuPasta(ped.obra_id)
        const testes = await p.testar.listar(o.pasta)
        // Já tem um rodando (reentrega depois de desligar no meio, ou dois toques): não começa outro, só mostra o que está rodando.
        if (testes.some((t) => t.estado === 'rodando' || t.estado === 'pausado-cota')) return publicarTeste(ped.obra_id, o.pasta, true)
        const anterior = ped.dados.mesmos === true ? testes.find((t) => t.estado === 'pronto') ?? null : null
        const est = await p.prototipo.estado(o.pasta).catch(() => null)
        const versao = est && est.versoes.length ? `v${est.atual}` : null
        await p.testar.iniciar(o.pasta, { quantidade: Number(ped.dados.quantidade) as 100 | 250 | 500 | 1000, mesmosDe: anterior?.n ?? null, versao })
        return publicarTeste(ped.obra_id, o.pasta, true)
      }
      case 'entrevistar': {
        if (!p.testar) throw new ErroLeigo(SEM_TESTE)
        const o = await ligadaOuPasta(ped.obra_id)
        rapidoAte = Date.now() + 3 * 60_000
        await p.testar.entrevistar(o.pasta, Number(ped.dados.teste), String(ped.dados.agente ?? ''), String(ped.dados.pergunta ?? ''))
        return publicarTeste(ped.obra_id, o.pasta, true)
      }
    }
  }

  // Testar a ideia: o que foi publicado por último de cada obra (só reenvia o que mudou; força a cada 5 min).
  const ultimoTeste = new Map<string, { chave: string; em: number }>()
  async function publicarTeste(obraId: string, pasta: string, forcar = false) {
    if (!p.testar || !canal.teste) return
    const r = await montarResumoTeste(p.testar, pasta)
    if (!r) return
    const chave = JSON.stringify(r)
    const u = ultimoTeste.get(obraId)
    if (!forcar && u && u.chave === chave && Date.now() - u.em < 5 * 60_000) return
    await canal.teste(obraId, r)
    ultimoTeste.set(obraId, { chave, em: Date.now() })
  }
  /** Confere os testes de todas as obras daqui (o celular vê o andamento ao vivo). Só sobe o que mudou. */
  async function publicarTestes() {
    if (!p.testar || !canal.teste) return
    const ligadas = memoria.ler()
    const porPasta = new Map(Object.entries(ligadas).map(([id, o]) => [o.pasta, id]))
    const pastas = await p.obras.listar().catch(() => [] as string[])
    for (const o of Object.values(ligadas)) if (!pastas.includes(o.pasta)) pastas.push(o.pasta)
    for (const pasta of pastas.slice(0, 20)) {
      const id = porPasta.get(pasta) ?? pasta
      if (!/^[\w.-]{1,64}$/.test(id)) continue
      await publicarTeste(id, pasta).catch(() => {})
    }
  }

  async function trabalhar() {
    while (fila.length) {
      atual = fila.shift()!
      const ped = atual
      try {
        const r = await executar(ped)
        await canal.responder(ped.id, 'feito', typeof r === 'string' ? r : '').catch(() => {})
      } catch (e) {
        if (ped.tipo === 'obra_nova' || ped.tipo === 'ajuste') {
          const o = memoria.ler()[ped.obra_id]
          if (o) await canal.projeto(ped.obra_id, vazio(o.nome, 'erro', { mensagem: frase(e) })).catch(() => {})
        }
        // Teste e entrevista: o celular mostra a mesma explicação do computador, então vai o código do erro (ex.: claude-cota).
        const cod = (ped.tipo === 'testar' || ped.tipo === 'entrevistar') && !(e instanceof ErroLeigo) && e instanceof Error && /^[a-z][a-z0-9-]{2,40}$/.test(e.message) ? e.message : null
        await canal.responder(ped.id, 'erro', cod ? `codigo:${cod}` : frase(e)).catch(() => {})
      }
      atual = null
      conhecidos.delete(ped.id)
    }
  }

  // O que foi mandado por último (sem a hora): não reenvia o mesmo andamento; reenvia de qualquer jeito a cada 5 min.
  let ultimoEnvio = { chave: '', em: 0 }
  async function publicarStatus(forcar = false) {
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
      // Luiz (25/11/2026): o celular dizia "Construindo" com ninguém trabalhando (a obra esperava outra, ou a cota tinha acabado).
      // Agora o celular diz o MESMO que o painel do notebook: o momento da obra (trabalhando, esperando, precisa de você, com defeito).
      const modo = (await p.modos.ler(pasta).catch(() => null)) ?? 'automatico'
      const m = momentoDaObra(e, situacaoDaObra(modo, e))
      // "Parada" (com "Continuar a obra") só quando a PESSOA pausou. Esperando (entre uma parte e outra, cota, fila, religando)
      // continua "construindo": o notebook segue sozinho (achado em 26/11/2026, Eduardo viu "Parada" com a obra andando).
      const estado: ObraStatus['estado'] = m.nivel === 'pronta' ? 'pronta' : m.nivel === 'precisa' || m.nivel === 'defeito' ? 'aguardando_aprovacao' : m.nivel === 'pausada' ? 'pausada' : 'construindo'
      const ativa = !achouAtiva && estado === 'construindo' && e.agora.length > 0
      if (ativa) achouAtiva = true
      const noticia = m.nivel === 'trabalhando' ? (e.etapa ? `Trabalhando em: ${e.etapa.nome}.` : m.titulo)
        : m.nivel === 'precisa' || m.nivel === 'defeito' ? `${m.titulo} Abra o Atlas no notebook para ver o que fazer.`
          : m.nivel === 'esperando' && !e.agora.length && m.rotulo === 'NINGUÉM TRABALHANDO' ? 'Entre uma parte e outra. O Atlas religa sozinho; você não precisa fazer nada.'
            : m.nivel === 'esperando' ? `${m.titulo} Você não precisa fazer nada.`
              : m.titulo
      obras.push({
        id, nome: (lig?.nome ?? pasta.replace(/-/g, ' ')).slice(0, 80),
        etapa_atual: { numero: e.etapa?.n ?? e.etapas.length, rotulo: (e.etapa?.nome ?? 'Tudo pronto').slice(0, 80) },
        total_etapas: e.etapas.length, percentual: Math.max(0, Math.min(100, Math.floor(e.pct * 100 + 1e-6) / 100)), estado, ativa_agora: ativa,
        ultima_noticia: noticia.slice(0, 200), quando: new Date().toISOString(),
      })
    }
    const chave = JSON.stringify(obras.map((o) => ({ ...o, quando: '' })))
    if (!forcar && chave === ultimoEnvio.chave && Date.now() - ultimoEnvio.em < 5 * 60_000) return
    await canal.status(obras)
    ultimoEnvio = { chave, em: Date.now() }
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
    publicarTestes,
    /** Se agora a batida deve ser rápida (alguém está entrevistando um agente pelo celular). */
    rapido: () => Date.now() < rapidoAte,
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

/** Liga o notebook ao celular enquanto `executor` existir: batida a cada 20 s e o andamento das obras conferido a cada 30 s
 *  (só sobe quando mudou). Antes era a cada 2 min e o celular mostrava 1% com o notebook em 2,72% (Eduardo, 26/11/2026). */
export const BATIDA_MS = 20_000
export const BATIDA_RAPIDA_MS = 5_000
export const STATUS_MS = 30_000
export const TESTES_MS = 15_000
export function ligarCelularRemoto(ex: ReturnType<typeof criarExecutorRemoto>): () => void {
  let ultima = 0
  const bater = () => { ultima = Date.now(); void ex.batida().catch(() => {}) }
  const status = () => { void ex.publicarStatus().catch(() => {}) }
  const testes = () => { void ex.publicarTestes().catch(() => {}) }
  bater(); status(); testes()
  // Batida a cada 20 s; a cada 5 s enquanto alguém entrevista um agente pelo celular.
  const t = setInterval(() => { if (Date.now() - ultima >= (ex.rapido() ? BATIDA_RAPIDA_MS : BATIDA_MS) - 500) bater() }, BATIDA_RAPIDA_MS)
  const s = setInterval(status, STATUS_MS)
  const q = setInterval(testes, TESTES_MS)
  return () => { clearInterval(t); clearInterval(s); clearInterval(q) }
}
