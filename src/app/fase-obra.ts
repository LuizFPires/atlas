// Onde cada obra parou (Minhas obras → "Continuar", pedido do Luiz em 23/11/2026). A regra lê só o que cada etapa deixou na pasta
// (app/adaptadores/obras.cjs, situacao): estilo escolhido = design-system.md; telas = prototipo/versoes; nome = marca/marca.md;
// construção = PLAN.md (o % vem do painel).

export type SituacaoObra = { estilo: boolean; prototipo: boolean; marca: boolean; plano: boolean }
export type EtapaObra = 'estilo' | 'telas' | 'aprovar' | 'obra'
export type FaseObra = { etapa: EtapaObra; concluida: boolean; rotulo: string; pct?: number }

export function faseDaObra(s: SituacaoObra, pct: number | null): FaseObra {
  if (s.plano) {
    if (pct !== null && Number.isFinite(pct)) {
      const p = Math.max(0, Math.min(100, Math.round(pct)))
      return p >= 100 ? { etapa: 'obra', concluida: true, rotulo: 'Obra pronta', pct: 100 } : { etapa: 'obra', concluida: false, rotulo: `Construindo · ${p}% pronto`, pct: p }
    }
    return { etapa: 'obra', concluida: false, rotulo: 'Construindo' }
  }
  if (s.marca) return { etapa: 'aprovar', concluida: false, rotulo: 'Parou em: aprovar e começar a construção' }
  if (s.prototipo) return { etapa: 'telas', concluida: false, rotulo: 'Parou em: as telas (já começadas)' }
  if (s.estilo) return { etapa: 'telas', concluida: false, rotulo: 'Parou em: desenhar as telas' }
  return { etapa: 'estilo', concluida: false, rotulo: 'Parou em: escolher o estilo' }
}

/** Nome para mostrar a partir da pasta ("agenda-do-ze" → "Agenda do ze"), com no máximo 60 letras. */
export function nomeDaPasta(pasta: string): string {
  const t = pasta.replace(/-+/g, ' ').trim()
  const n = t ? t[0].toUpperCase() + t.slice(1) : 'Obra'
  return n.length > 60 ? `${n.slice(0, 59).trimEnd()}…` : n
}
