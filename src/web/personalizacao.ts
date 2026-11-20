// M32 (b) — personalização do app pronto: tipos, validação de cor (mesma regra do servidor) e porta do configurador.
import type { PortalApi, Resp } from './portal-api'
import type { SegmentoPronto } from './conteudo'

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/
export const MAX_NOME = 60

export interface Personalizacao { nome_negocio: string; logo_url: string | null; cor_principal: string; cor_apoio: string }

export const COR_PRINCIPAL_PADRAO = '#C6F135'
export const COR_APOIO_PADRAO = '#2A3A12'
export const PALETA_PRINCIPAL = ['#C6F135', '#4ADE80', '#38BDF8', '#F472B6']
export const PALETA_APOIO = ['#2A3A12', '#1E2125', '#3A2A12']

/** Aceita "1e7a46", "#1E7A46" ou com espaços; devolve "#1E7A46" ou null se não for um código de 6 dígitos. */
export function normalizarHex(digitado: string): string | null {
  const s = digitado.trim().replace(/^#/, '')
  const h = `#${s}`
  return HEX_RE.test(h) ? h.toUpperCase() : null
}

/** Preto ou branco, o que ler melhor em cima da cor (para o texto do botão e do ícone na prévia). */
export function corLegivel(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.55 ? '#141619' : '#FFFFFF'
}

export interface PersonalizacaoLida { segmento: SegmentoPronto | null; personalizacao: Personalizacao | null }

/** Porta do configurador: o App liga ao Portal (real) ou a um fixture; a tela não sabe qual. */
export interface PortaPersonalizacao {
  ler(): Promise<Resp<PersonalizacaoLida>>
  salvar(p: Personalizacao): Promise<Resp<PersonalizacaoLida>>
}

export function criarPersonalizacaoPortal(api: Pick<PortalApi, 'personalizacao' | 'salvarPersonalizacao'>): PortaPersonalizacao {
  return { ler: () => api.personalizacao(), salvar: (p) => api.salvarPersonalizacao(p) }
}

/** Fixture (modo demonstração e testes): guarda em memória. */
export function criarPersonalizacaoFixture(segmento: SegmentoPronto = 'barbearia'): PortaPersonalizacao & { salvas: Personalizacao[] } {
  let atual: Personalizacao | null = null
  const f = {
    salvas: [] as Personalizacao[],
    async ler() { return { ok: true as const, segmento, personalizacao: atual } },
    async salvar(p: Personalizacao) { atual = p; f.salvas.push(p); return { ok: true as const, segmento, personalizacao: p } },
  }
  return f
}
