import { useEffect, useState, type ReactNode } from 'react'
import { AnelEtapa } from './Progresso'
import { Icone } from './Icone'
import './trabalhando.css'

/** Progresso estimado (0..95): anda rápido no começo e desacelera; só a tela que chama sabe quando acabou de verdade. */
export function progressoEstimado(segundosPassados: number, segundosEsperados: number): number {
  const p = 1 - Math.exp(-segundosPassados / Math.max(1, segundosEsperados / 2.2))
  return Math.min(95, Math.round(p * 100))
}

const tempo = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const duracao = (s: number) => (s < 90 ? 'menos de um minuto e meio' : `uns ${Math.round(s / 60)} minutos`)

interface Props {
  titulo: string
  /** O que o Claude faz, em ordem, em palavras de leigo. */
  etapas: string[]
  /** Quanto costuma levar (segundos): guia a barra e o recado. */
  segundos: number
  /** Ilustração animada opcional (ex.: o celular sendo pintado). */
  ilustracao?: ReactNode
  /** Andamento real (ex.: telas prontas de um mapa). Quando dá, manda na barra, na etapa e no recado; null = estimativa pelo relógio. */
  andamento?: (segundosPassados: number) => { pct: number; etapa: number; nota: string } | null
}

/** Espera do Claude com cara de progresso, para ninguém achar que travou: barra que anda, etapas, tempo passado. */
export function Trabalhando({ titulo, etapas, segundos, ilustracao, andamento }: Props) {
  const [passados, setPassados] = useState(0)
  useEffect(() => {
    const inicio = Date.now()
    const t = setInterval(() => setPassados((Date.now() - inicio) / 1000), 500)
    return () => clearInterval(t)
  }, [])
  const real = andamento?.(passados) ?? null
  const pct = real ? Math.max(0, Math.min(99, real.pct)) : progressoEstimado(passados, segundos)
  // A etapa atual acompanha a barra; a última fica "agora" até a tela terminar de verdade.
  const atual = real ? Math.max(0, Math.min(etapas.length - 1, real.etapa)) : Math.min(etapas.length - 1, Math.floor((pct / 95) * etapas.length))
  return (
    <section className="at-trab" role="status" aria-label={titulo}>
      {ilustracao && <div className="at-trab__ilustra">{ilustracao}</div>}
      <div className="at-trab__corpo">
        <div className="at-trab__cab">
          <b>{titulo}</b>
          <span className="at-trab__tempo">{tempo(passados)}</span>
        </div>
        <div className="at-trab__barra" role="progressbar" aria-label="Andamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <ol className="at-trab__etapas">
          {etapas.map((e, i) => {
            const fase = i < atual ? 'feita' : i === atual ? 'agora' : 'depois'
            return (
              <li key={e} data-fase={fase}>
                {fase === 'agora'
                  ? <AnelEtapa numero={i + 1} pct={Math.round(Math.max(0, Math.min(1, (pct / 95) * etapas.length - i)) * 100)} />
                  : <span className="at-trab__marca" aria-hidden="true">{fase === 'feita' ? <Icone nome="check" tamanho={14} /> : i + 1}</span>}
                <span>{e}</span>
              </li>
            )
          })}
        </ol>
        <span className="at-trab__nota">{real ? real.nota : `Leva ${duracao(segundos)}.`} Pode deixar esta tela aberta: o Atlas segue trabalhando e mostra tudo quando terminar.</span>
      </div>
    </section>
  )
}
