import { useEffect, useState } from 'react'
import './progresso.css'

/*
 * Nenhuma bolinha girando sozinha (Luiz, 27/11/2026; protótipo caminho-novo/PG1Progresso e PG2ProgressoOutras, aprovado).
 * Todo lugar que espera mostra três coisas:
 *  1. o que está fazendo AGORA (texto curto à direita da barra);
 *  2. quanto já foi, DE VERDADE: a barra conta coisas reais (arquivos, telas, tentativas). Sem contagem, anda pelo tempo de
 *     costume e para em 90% até a notícia chegar;
 *  3. um SINAL DE VIDA: ponto que pulsa e "última notícia há X s". Passou muito do normal, avisa em âmbar.
 */

/** Relógio que anda a cada segundo (para "há X s" e para a barra por tempo de costume). */
export function useRelogio(intervaloMs = 1000): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}

/** Faixa de tempo de costume, em segundos: [mínimo, máximo]. */
export type Costume = readonly [number, number]

/** Porcentagem mostrada: a contagem real manda; sem ela, o tempo passado sobre o tempo de costume, parando em 90%. */
export function pctDoProgresso({ pct, inicio, costume }: { pct?: number | null; inicio?: number | null; costume?: Costume | null }, agora: number): number {
  if (typeof pct === 'number' && Number.isFinite(pct)) return Math.max(0, Math.min(100, Math.round(pct)))
  if (!costume || !inicio) return 0
  const s = Math.max(0, (agora - inicio) / 1000)
  return Math.min(90, Math.round((s / Math.max(1, costume[1])) * 90))
}

/** "3 s", "1 min 12 s", "2 min". */
export function duracaoCurta(s: number): string {
  const t = Math.max(0, Math.round(s))
  if (t < 60) return `${t} s`
  const m = Math.floor(t / 60)
  const r = t % 60
  return r ? `${m} min ${String(r).padStart(2, '0')} s` : `${m} min`
}

const faixa = ([a, b]: Costume) => (b < 90 ? `${a} a ${b} s` : `${Math.max(1, Math.round(a / 60))} a ${Math.max(1, Math.round(b / 60))} min`)

/** Anel com o número da etapa que se completa conforme ela avança (no lugar da bolinha girando). */
export function AnelEtapa({ numero, pct }: { numero: number | string; pct: number }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <span className="at-anel" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="12" fill="none" className="at-anel__fundo" strokeWidth="2.5" />
        <circle cx="14" cy="14" r="12" fill="none" className="at-anel__arco" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - p} transform="rotate(-90 14 14)" />
      </svg>
      <span>{numero}</span>
    </span>
  )
}

export interface ProgressoProps {
  /** O que está fazendo agora, curto (fica à direita da barra). */
  agora: string
  /** Contagem real (0..100). Sem ela, a barra anda pelo tempo de costume. */
  pct?: number | null
  /** Quando esta espera começou (ms). */
  inicio?: number | null
  /** Quanto costuma levar, em segundos. */
  costume?: Costume | null
  /** Quando chegou a última notícia de verdade (ms). */
  noticia?: number | null
  /** De quem é a notícia: "da Vercel", "do Supabase"... */
  fonte?: string
  /** Texto fixo para o sinal de vida (no lugar do automático). */
  pulso?: string
  /** Nome para leitores de tela. */
  rotulo: string
  /** Relógio de fora (testes ou quem já tem um). */
  relogio?: number
  /** Esconde a % (quando a barra mostra outra coisa, como o tempo que o código ainda vale). */
  semPct?: boolean
}

/** Barra fina + o que está fazendo + % e, embaixo, o sinal de vida. */
export function Progresso({ agora: texto, pct, inicio, costume, noticia, fonte, pulso, rotulo, relogio, semPct = false }: ProgressoProps) {
  const proprio = useRelogio()
  const agora = relogio ?? proprio
  const valor = pctDoProgresso({ pct, inicio, costume }, agora)
  const passados = inicio ? (agora - inicio) / 1000 : 0
  const demorando = Boolean(costume && inicio && passados > costume[1] * 1.5)
  const partes: string[] = []
  if (pulso) partes.push(pulso)
  else {
    if (noticia) partes.push(`Última notícia${fonte ? ` ${fonte}` : ''} há ${duracaoCurta((agora - noticia) / 1000)}`)
    if (costume) partes.push(`normalmente leva ${faixa(costume)}`)
    if (!noticia && inicio) partes.push(`já foram ${duracaoCurta(passados)}`)
  }
  const sinal = demorando ? 'Está levando mais que o normal. O Atlas continua e avisa se precisar de você.' : partes.join(' · ')
  return (
    <span className="at-prog">
      <span className="at-prog__linha" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor} aria-valuetext={`${texto}, ${valor}%`}>
        <span className="at-prog__barra"><i style={{ width: `${Math.max(3, valor)}%` }} /></span>
        <span className="at-prog__agora">{texto}</span>
        {!semPct && <span className="at-prog__pct">{valor}%</span>}
      </span>
      {sinal && <span className={`at-prog__pulso${demorando ? ' at-prog__pulso--demorando' : ''}`}><span className="at-prog__vivo" aria-hidden="true" />{sinal}</span>}
    </span>
  )
}

/** Espera sem contagem possível: anota sozinho quando começou e anda pelo tempo de costume. */
export function Esperando(props: Omit<ProgressoProps, 'inicio' | 'pct'>) {
  const [inicio] = useState(() => Date.now())
  return <Progresso {...props} inicio={inicio} />
}
