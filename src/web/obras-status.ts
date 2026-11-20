// Porta do status das obras no celular (M30). Mesmo padrão de src/app/ponte-celular.ts: o Portal constrói contra esta PORTA,
// com FIXTURE; o adaptador real é pendência de /entregar (app/PENDENTE-ENTREGAR.md).
// PENDENTE (decisão de arquitetura, PRD §8): como o status sai do computador do cliente e chega aqui. Hipótese: o computador publica
// só este resumo num destino que o Portal lê (relay do Atlas que guarda status, nunca código nem segredo). Nada disso existe ainda:
// não há endpoint nem migration neste núcleo. O servidor é quem decide o dono pelo login do Portal; o dono nunca vem do corpo.

export type EstadoObra = 'construindo' | 'pausada' | 'aguardando_aprovacao' | 'pronta' | 'no_ar'

/**
 * O que o celular MOSTRA de uma obra. É um resumo: nunca carrega código, caminho de arquivo, conteúdo de tarefa
 * nem dado interno da obra. `ultima_noticia` é um texto curto e já "limpo" (sem trecho de código nem segredo).
 */
export interface ObraStatus {
  id: string
  nome: string
  segmento?: string
  etapa_atual: { numero: number; rotulo: string }
  total_etapas: number
  /** 0 a 100. */
  percentual: number
  estado: EstadoObra
  /** A obra que a equipe está tocando neste momento (no máximo uma). */
  ativa_agora: boolean
  ultima_noticia: string
  /** Quando a notícia foi dada (ISO 8601). */
  quando: string
}

export interface PonteStatusObras {
  /** Obras do dono logado no Portal. O servidor decide o dono pelo login. */
  listarObras(): Promise<ObraStatus[]>
  /** Uma obra do dono logado; null se não existir ou não for dele. */
  obra(id: string): Promise<ObraStatus | null>
}

const h = (min: number) => new Date(Date.UTC(2026, 10, 19, 15, 0) - min * 60_000).toISOString()

export const OBRAS_EXEMPLO: ObraStatus[] = [
  { id: 'o1', nome: 'Agenda da Barbearia', segmento: 'Barbearia', etapa_atual: { numero: 3, rotulo: 'Agendamento pelo celular' }, total_etapas: 5, percentual: 60, estado: 'construindo', ativa_agora: true, ultima_noticia: 'Terminei a tela onde o cliente escolhe o horário. Agora estou testando.', quando: h(12) },
  { id: 'o2', nome: 'Controle de Estoque', segmento: 'Loja', etapa_atual: { numero: 4, rotulo: 'Tudo pronto' }, total_etapas: 4, percentual: 100, estado: 'pronta', ativa_agora: false, ultima_noticia: 'Obra pronta. Falta você dar uma olhada e aprovar.', quando: h(60 * 26) },
  { id: 'o3', nome: 'Cardápio Digital', etapa_atual: { numero: 2, rotulo: 'Fotos dos pratos' }, total_etapas: 6, percentual: 30, estado: 'aguardando_aprovacao', ativa_agora: false, ultima_noticia: 'Preciso que você aprove as fotos antes de eu continuar.', quando: h(60 * 5) },
]

export interface StatusObrasFixture extends PonteStatusObras {
  /** Quantas vezes a lista foi pedida. */
  readonly pedidos: number
}

export function criarStatusObrasFixture(obras: ObraStatus[] = OBRAS_EXEMPLO): StatusObrasFixture {
  const f = {
    pedidos: 0,
    async listarObras() { f.pedidos++; return structuredClone(obras) },
    async obra(id: string) { const o = obras.find((x) => x.id === id); return o ? structuredClone(o) : null },
  }
  return f
}

/**
 * Adaptador REAL (M30 relay): lê o resumo das obras na API do Atlas pela rota do portal (POST /portal/obras).
 * O servidor decide o dono pelo login; aqui não vai id nenhum. Falha de rede/sessão lança (a tela mostra o aviso amigável);
 * lista vazia = o computador ainda não publicou nada.
 */
export function criarStatusObrasPortal(api: { obras(): Promise<{ ok: true; obras: ObraStatus[] } | { ok: false; mensagem: string }> }): PonteStatusObras {
  const todas = async () => {
    const r = await api.obras()
    if (!r.ok) throw new Error(r.mensagem)
    return r.obras
  }
  return {
    listarObras: todas,
    async obra(id: string) { return (await todas()).find((o) => o.id === id) ?? null },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge ter obras. */
export const statusObrasIndisponivel: PonteStatusObras = {
  async listarObras() { return [] },
  async obra() { return null },
}

export const ROTULO_ESTADO: Record<EstadoObra, string> = {
  construindo: 'Construindo',
  pausada: 'Pausada',
  aguardando_aprovacao: 'Esperando você',
  pronta: 'Pronta',
  no_ar: 'No ar',
}
