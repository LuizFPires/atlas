// Onde cada obra parou (Minhas obras → "Continuar", pedido do Luiz em 23/11/2026). A regra lê só o que cada etapa deixou na pasta
// (app/adaptadores/obras.cjs, situacao): estilo escolhido = design-system.md; telas = prototipo/versoes; nome = marca/marca.md;
// (a ordem segue o caminho novo de 23/11/2026: estilo → nome → telas → contas → começar)
// construção = PLAN.md (o % vem do painel).
import { textoAvanco } from './avanco'

export type SituacaoObra = { estilo: boolean; prototipo: boolean; marca: boolean; plano: boolean; noAr?: { endereco: string; quando: string | null } }
export type EtapaObra = 'estilo' | 'batismo' | 'telas' | 'aprovar' | 'obra'
export type FaseObra = { etapa: EtapaObra; concluida: boolean; rotulo: string; pct?: number }

export function faseDaObra(s: SituacaoObra, pct: number | null): FaseObra {
  if (s.plano) {
    if (pct !== null && Number.isFinite(pct)) {
      const p = Math.max(0, Math.min(100, pct))
      return p >= 100 ? { etapa: 'obra', concluida: true, rotulo: 'Obra pronta', pct: 100 } : { etapa: 'obra', concluida: false, rotulo: `Construindo · ${textoAvanco(p)}% pronto`, pct: p }
    }
    return { etapa: 'obra', concluida: false, rotulo: 'Construindo' }
  }
  // Caminho novo (23/11/2026): ideia → estilo → nome → conferir as telas → contas → começar. As telas são pintadas em segundo
  // plano a partir do estilo, então depois do estilo vem o nome; com o nome dado, falta conferir o protótipo (e daí as contas).
  if (s.marca) return { etapa: 'telas', concluida: false, rotulo: s.prototipo ? 'Parou em: conferir o protótipo' : 'Parou em: as telas (sendo desenhadas)' }
  if (s.estilo) return { etapa: 'batismo', concluida: false, rotulo: 'Parou em: dar o nome' }
  if (s.prototipo) return { etapa: 'telas', concluida: false, rotulo: 'Parou em: as telas (já começadas)' } // protótipo trazido de outra IA
  return { etapa: 'estilo', concluida: false, rotulo: 'Parou em: escolher o estilo' }
}

/** Nome para mostrar a partir da pasta ("agenda-do-ze" → "Agenda do ze"), com no máximo 60 letras. */
export function nomeDaPasta(pasta: string): string {
  const t = pasta.replace(/-+/g, ' ').trim()
  const n = t ? t[0].toUpperCase() + t.slice(1) : 'Obra'
  return n.length > 60 ? `${n.slice(0, 59).trimEnd()}…` : n
}
