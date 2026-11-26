// M33 — o que o app do celular precisa do servidor do Atlas. Quem trabalha é sempre o notebook do cliente; aqui só se lê o estado
// e se deixam pedidos. O servidor decide o dono pelo login do Portal. Sem resposta válida, nada é inventado.
import type { PortalApi } from '../web/portal-api'
import type { ObraStatus } from '../web/obras-status'
import { criarPrototipoFixture, montarNavegavel } from '../app/ponte-prototipo'
import { ESTILOS_EXEMPLO } from '../app/ponte-estilo'

export type FaseProjeto = 'na_fila' | 'desenhando' | 'telas_prontas' | 'ajustando' | 'pensando_nomes' | 'nomes_prontos' | 'pronto_para_construir' | 'construindo' | 'erro'
export type TipoPedido = 'obra_nova' | 'ajuste' | 'aprovar_telas' | 'nome' | 'construir' | 'pausar' | 'continuar' | 'foto_ajuda'

export interface Projeto {
  obra_id: string
  nome: string
  fase: FaseProjeto
  progresso: { feitas: number; total: number; atual: string; telas: Array<{ nome: string; pronta: boolean }> }
  nomes: Array<{ nome: string; porque: string }>
  mensagem: string
  telas_token: string | null
  atualizado_em: string
}
export interface PedidoResumo { id: string; tipo: TipoPedido; obra_id: string; estado: 'pendente' | 'entregue' | 'feito' | 'erro'; mensagem: string; criado_em: string }
export interface EstadoCelular {
  computador: { ligado: boolean; visto_em: string | null; ocupado: string | null }
  projetos: Projeto[]
  pedidos: PedidoResumo[]
}
export interface Visual { modo: 'prints' | 'marca' | 'sugere'; observacao: string; cores: string[]; referencias: string[] }

export interface ApiCelular {
  logado(): boolean
  /** Por que o login caiu sozinho da última vez (diagnóstico; null se não caiu). */
  ultimaSaida?(): { quando: string; motivo: string } | null
  pedirCodigo(email: string): Promise<void>
  entrar(email: string, codigo: string): Promise<void>
  sair(): void
  nome(): Promise<string>
  estado(): Promise<EstadoCelular>
  obras(): Promise<ObraStatus[]>
  pedir(tipo: TipoPedido, obraId: string | null, dados: object): Promise<{ id: string; obra_id: string }>
  foto(dataUrl: string): Promise<string>
  /** O documento navegável (já protegido: sem script) das telas do projeto. */
  telas(token: string): Promise<string>
  /** M41: avisos neste celular (cota voltou, obra parou, obra pronta). Ausente = não oferece. */
  avisos?: { chave(): Promise<string>; assinar(assinatura: unknown): Promise<void> }
}

const falha = (r: { ok: false; mensagem: string }) => new Error(r.mensagem)
const FASES: FaseProjeto[] = ['na_fila', 'desenhando', 'telas_prontas', 'ajustando', 'pensando_nomes', 'nomes_prontos', 'pronto_para_construir', 'construindo', 'erro']

/** Confere a resposta do servidor: o que não tem o formato esperado é descartado. */
export function lerEstado(d: Record<string, unknown>): EstadoCelular {
  const c = (d.computador ?? {}) as Record<string, unknown>
  const projetos = (Array.isArray(d.projetos) ? d.projetos : []).filter((p): p is Projeto => !!p && typeof p === 'object' && typeof (p as Projeto).obra_id === 'string' && FASES.includes((p as Projeto).fase))
  const pedidos = (Array.isArray(d.pedidos) ? d.pedidos : []).filter((p): p is PedidoResumo => !!p && typeof p === 'object' && typeof (p as PedidoResumo).id === 'string')
  return {
    computador: { ligado: c.ligado === true, visto_em: typeof c.visto_em === 'string' ? c.visto_em : null, ocupado: typeof c.ocupado === 'string' ? c.ocupado : null },
    projetos, pedidos,
  }
}

export function criarApiCelularPortal(portal: PortalApi): ApiCelular {
  return {
    logado: () => portal.logado(),
    ultimaSaida: () => portal.ultimaSaida?.() ?? null,
    async pedirCodigo(email) { const r = await portal.pedirCodigoLogin(email); if (!r.ok) throw falha(r) },
    async entrar(email, codigo) { const r = await portal.entrar(email, codigo); if (!r.ok) throw falha(r) },
    sair: () => portal.sair(),
    async nome() { const r = await portal.eu(); return r.ok ? r.perfil.nome : '' },
    async estado() {
      if (!portal.celular) throw new Error('O Atlas no celular ainda não está disponível.')
      const r = await portal.celular()
      if (!r.ok) throw falha(r)
      return lerEstado(r)
    },
    async obras() { const r = await portal.obras(); if (!r.ok) throw falha(r); return r.obras },
    async pedir(tipo, obraId, dados) {
      const r = await portal.pedirCelular!(tipo, obraId, dados)
      if (!r.ok) throw falha(r)
      return { id: r.id, obra_id: r.obra_id }
    },
    async foto(dataUrl) { const r = await portal.fotoCelular!(dataUrl); if (!r.ok) throw falha(r); return r.id },
    ...(portal.chaveAvisos && portal.assinarAvisos ? {
      avisos: {
        async chave() { const r = await portal.chaveAvisos!(); if (!r.ok) throw falha(r); return r.chave },
        async assinar(a: unknown) { const r = await portal.assinarAvisos!(a); if (!r.ok) throw falha(r) },
      },
    } : {}),
    async telas(token) {
      const r = await portal.verTelas!(token)
      if (!r.ok) throw falha(r)
      if (typeof r.documento !== 'string' || !r.documento.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'')) throw new Error('Essas telas não abriram.')
      return r.documento
    },
  }
}

// ── Fixture: um "notebook" de mentira que anda sozinho a cada leitura do estado (demonstração e testes) ──

export interface ApiCelularFixture extends ApiCelular {
  readonly pedidos: Array<{ tipo: TipoPedido; obra_id: string; dados: object }>
  desligar(): void
}

export function criarApiCelularFixture(opcoes: { logado?: boolean; ligado?: boolean } = {}): ApiCelularFixture {
  let logado = opcoes.logado ?? true
  let ligado = opcoes.ligado ?? true
  const pedidos: Array<{ tipo: TipoPedido; obra_id: string; dados: object }> = []
  const projetos = new Map<string, Projeto>()
  const proto = criarPrototipoFixture()
  let telasDoc: string | null = null
  const obras: ObraStatus[] = [
    { id: 'o1', nome: 'Agenda da Barbearia', etapa_atual: { numero: 4, rotulo: 'Marcação pelo cliente' }, total_etapas: 7, percentual: 62, estado: 'construindo', ativa_agora: true, ultima_noticia: 'Trabalhando em: Marcação pelo cliente.', quando: new Date(Date.now() - 8 * 60_000).toISOString() },
    { id: 'o2', nome: 'Orçamentos rápidos', etapa_atual: { numero: 5, rotulo: 'Tudo pronto' }, total_etapas: 5, percentual: 100, estado: 'pronta', ativa_agora: false, ultima_noticia: 'Obra pronta.', quando: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  ]
  const NOMES_TELAS = ['Início', 'Agenda do dia', 'Escolher barbeiro', 'Escolher serviço', 'Novo horário', 'Confirmação']
  const novo = (obra_id: string, nome: string): Projeto => ({ obra_id, nome, fase: 'desenhando', progresso: { feitas: 0, total: NOMES_TELAS.length, atual: NOMES_TELAS[0], telas: NOMES_TELAS.map((n) => ({ nome: n, pronta: false })) }, nomes: [], mensagem: '', telas_token: null, atualizado_em: new Date().toISOString() })
  /** Cada leitura do estado é um "passo" do notebook. */
  const andar = async () => {
    if (!ligado) return
    for (const p of projetos.values()) {
      if (p.fase === 'desenhando') {
        const feitas = Math.min(p.progresso.total, p.progresso.feitas + 2)
        p.progresso = { ...p.progresso, feitas, atual: NOMES_TELAS[feitas] ?? '', telas: p.progresso.telas.map((t, i) => ({ ...t, pronta: i < feitas })) }
        if (feitas >= p.progresso.total) {
          if (!telasDoc) {
            const e = await proto.desenhar('demo', p.nome, ESTILOS_EXEMPLO[0], '')
            const v = e.versoes[e.versoes.length - 1]
            telasDoc = montarNavegavel(v.telas, v.telas[0].id)
          }
          Object.assign(p, { fase: 'telas_prontas', telas_token: 'f'.repeat(43) })
        }
      } else if (p.fase === 'ajustando') p.fase = 'telas_prontas'
      else if (p.fase === 'pensando_nomes') Object.assign(p, { fase: 'nomes_prontos', nomes: [{ nome: 'Navalha', porque: 'Curto, forte e com cara de barbearia.' }, { nome: 'Cadeira Livre', porque: 'Diz o que o cliente procura: um horário.' }, { nome: 'Agenda do Zé', porque: 'Leva o seu nome, como a barbearia.' }] })
    }
  }
  const api: ApiCelularFixture = {
    pedidos,
    desligar() { ligado = false },
    logado: () => logado,
    async pedirCodigo() {},
    async entrar(_e, codigo) { if (!/^\d{6,8}$/.test(codigo.replace(/\D/g, ''))) throw new Error('Esse código não confere. Confira os números do e-mail.'); logado = true },
    sair() { logado = false },
    async nome() { return 'Zé' },
    async estado() {
      await andar()
      return { computador: { ligado, visto_em: new Date().toISOString(), ocupado: ligado && [...projetos.values()].some((p) => p.fase === 'desenhando') ? 'Desenhando as telas' : null }, projetos: [...projetos.values()].map((p) => structuredClone(p)), pedidos: [] }
    },
    async obras() { return structuredClone(obras) },
    async pedir(tipo, obraId, dados) {
      const obra_id = obraId ?? `c${String(pedidos.length).padStart(16, '0')}`
      pedidos.push({ tipo, obra_id, dados })
      const p = projetos.get(obra_id)
      if (tipo === 'obra_nova') projetos.set(obra_id, novo(obra_id, 'Barbearia três cadeiras'))
      else if (p && tipo === 'ajuste') p.fase = 'ajustando'
      else if (p && tipo === 'aprovar_telas') p.fase = 'pensando_nomes'
      else if (p && tipo === 'nome') Object.assign(p, { fase: 'pronto_para_construir', nome: String((dados as { nome?: string }).nome ?? p.nome) })
      else if (p && tipo === 'construir') {
        p.fase = 'construindo'
        obras.unshift({ id: obra_id, nome: p.nome, etapa_atual: { numero: 1, rotulo: 'Preparar o canteiro' }, total_etapas: 7, percentual: 0, estado: 'construindo', ativa_agora: false, ultima_noticia: 'Obra começando.', quando: new Date().toISOString() })
      }
      return { id: String(pedidos.length).padStart(32, '0'), obra_id }
    },
    async foto() { return String(pedidos.length + 1).padStart(32, 'a') },
    async telas() { if (!telasDoc) throw new Error('Essas telas ainda não estão prontas.'); return telasDoc },
  }
  return api
}
