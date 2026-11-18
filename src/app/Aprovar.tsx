import { useEffect, useState } from 'react'
import { Botao, Icone } from '../ui'
import type { ObraDoEstilo } from './Estilo'
import type { PonteClaude, Plano } from './ponte-claude'
import { NOME_PLANO } from './claude-plano'
import type { Etapa, Planejamento, PonteConstrucao } from './ponte-construcao'
import './aprovar.css'

interface Props {
  obra: ObraDoEstilo
  construcao: PonteConstrucao
  claude: PonteClaude
  /** Volta ao protótipo (batismo). */
  onVoltar: () => void
}

export const recadoDoErroAprovar = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'Quem monta o plano da obra ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; você não precisa refazer nada.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

/** Texto do prazo em dias de obra (nunca em tokens). */
export const textoDias = (dias: number) => `≈ ${dias} ${dias === 1 ? 'dia' : 'dias'}`

/** Texto do consumo da cota, em palavras simples. */
export function textoCota(pausas: number): string {
  if (pausas <= 0) return 'A obra deve caber na cota do seu plano, sem parar.'
  return `A obra deve usar a cota do seu plano até o fim ${pausas === 1 ? 'uma vez' : `umas ${pausas} vezes`}. Quando isso acontece, ela pausa sozinha e volta quando a cota renova. Nada se perde.`
}

/** F08: aprovar e começar a obra. Mostra etapas, prazo no plano do cliente e consumo da cota. */
export function Aprovar({ obra, construcao, claude, onVoltar }: Props) {
  const [plano, setPlano] = useState<Plano | undefined>()
  const [plan, setPlan] = useState<Planejamento | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    construcao.planejar(obra.pasta, obra.nome).then((p) => { if (vivo) setPlan(p) }, (x) => { if (vivo) setErro(recadoDoErroAprovar(x)) })
    claude.estado().then((s) => { if (vivo) setPlano(s.plano) }, () => undefined)
    return () => { vivo = false }
  }, [construcao, claude, obra.pasta, obra.nome])

  const etapas: Etapa[] = plan?.etapas ?? []
  const meu = plano ?? 'pro'
  const previsao = plan?.previsao[meu]
  const outro: Plano = meu === 'pro' ? 'max' : 'pro'
  const previsaoOutro = plan?.previsao[outro]

  return (
    <div className="at-apr">
      <header className="at-apr__cab">
        <span className="at-apr__rotulo">PROTÓTIPO APROVADO · VERSÃO 3</span>
        <h1>Pronto para a obra. Confira antes de começar.</h1>
      </header>
      {erro && <p className="at-apr__erro" role="alert">{erro}</p>}
      {!plan && !erro && <p role="status">O Atlas está montando o plano da obra…</p>}
      {plan && (
        <div className="at-apr__grade">
          <section className="at-apr__card" aria-label="O que vai ser construído">
            <span className="at-apr__rotulo">O QUE VAI SER CONSTRUÍDO · {etapas.length} ETAPAS</span>
            {etapas.map((e) => (
              <div key={e.n} className="at-apr__etapa"><span>{e.n}</span><div><b>{e.nome}</b><small>{e.desc}</small></div></div>
            ))}
          </section>
          <div className="at-apr__lado">
            {previsao && (
              <section className="at-apr__card at-apr__previsao" aria-label="Previsão no seu plano">
                <span className="at-apr__rotulo">PREVISÃO NO SEU PLANO ({NOME_PLANO[meu].toUpperCase()})</span>
                <div className="at-apr__dias"><b>{textoDias(previsao.dias)}</b><span>com pausas da cota</span></div>
                <span className="at-apr__texto">{previsaoOutro ? `No ${NOME_PLANO[outro]} seria cerca de ${previsaoOutro.dias} ${previsaoOutro.dias === 1 ? 'dia' : 'dias'}. ` : ''}Você pode deixar rodando à noite: a obra pausa e volta sozinha.</span>
                <span className="at-apr__texto">{textoCota(previsao.pausas)}</span>
              </section>
            )}
            <section className="at-apr__combinado" aria-label="Combinado antes de começar">
              <b>Combinado antes de começar</b>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Você pode pausar quando quiser.</span>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Pode desligar o computador: a obra é salva a cada passo.</span>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Mudou de ideia? Ajustes entram no pós-obra, sem perder nada.</span>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Depois de começar ainda dá para ajustar: é só pedir, falando, e o Atlas muda sem perder o que já está pronto.</span>
            </section>
            <div className="at-apr__rodape">
              <Botao variante="secundario" onClick={onVoltar}>Voltar ao protótipo</Botao>
              <Botao className="at-apr__comecar" disabled>Começar a obra</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
