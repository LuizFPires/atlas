// App-modelo MERCEARIA (M32 d3) — personalização: nome do negócio + cor principal/de apoio viram propriedades CSS do tema.
import type { CSSProperties } from 'react'
import { COR_APOIO_PADRAO, COR_PRINCIPAL_PADRAO, corLegivel, normalizarHex } from '../../web/personalizacao'

export interface PersonalizacaoApp { nome: string; corPrincipal: string; corApoio: string }

export const PERSONALIZACAO_EXEMPLO: PersonalizacaoApp = { nome: 'Mercearia do Seu Zé', corPrincipal: '#34D399', corApoio: '#12261F' }

/** Cor inválida cai na padrão do Atlas (nunca injeta texto livre no CSS). */
export function personalizacaoSegura(p: Partial<PersonalizacaoApp>): PersonalizacaoApp {
  return {
    nome: (p.nome ?? '').trim().slice(0, 60) || 'Minha mercearia',
    corPrincipal: normalizarHex(p.corPrincipal ?? '') ?? COR_PRINCIPAL_PADRAO,
    corApoio: normalizarHex(p.corApoio ?? '') ?? COR_APOIO_PADRAO,
  }
}

/** Variáveis do tema do design system que o app sobrescreve: destaque (lime) e seleção (soft). */
export function variaveisDoTema(p: PersonalizacaoApp): CSSProperties {
  const s = personalizacaoSegura(p)
  return {
    '--lime': s.corPrincipal,
    '--lime-txt': s.corPrincipal,
    '--on-lime': corLegivel(s.corPrincipal),
    '--soft': s.corApoio,
    '--side-lime': s.corPrincipal,
    '--side-act-marca': s.corPrincipal,
  } as CSSProperties
}
