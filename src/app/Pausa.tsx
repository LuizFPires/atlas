import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import { contagemAteVolta, deveRetomar, horaDeVolta, textoDaObra, type EstadoCota, type PonteCota } from './ponte-cota'
import './pausa.css'

interface Props {
  pasta: string
  cota: PonteCota
  /** Estado já lido pelo painel (evita um piscar de tela vazia). */
  inicial?: EstadoCota | null
  /** "Voltar ao painel". */
  onVoltar: () => void
  /** A obra voltou sozinha (a cota renovou). */
  onRetomou?: () => void
  /** Abre o site do Claude nos planos (o Atlas não escolhe plano). */
  onVerMax?: () => void
  /** De quanto em quanto tempo olha a cota (ms); 0 desliga a sondagem (testes). */
  sondagemMs?: number
  agora?: () => Date
}

const agoraReal = () => new Date()

/**
 * F10: pausa pela cota do Claude. Tom CALMO: "pausa por cota não é erro". Mostra a hora de volta e NENHUMA ação obrigatória:
 * quando a cota renova, a obra continua sozinha (nos dois modos da obra).
 */
export function Pausa({ pasta, cota, inicial = null, onVoltar, onRetomou, onVerMax, sondagemMs = 30000, agora = agoraReal }: Props) {
  const [estado, setEstado] = useState<EstadoCota | null>(inicial)
  const [relogio, setRelogio] = useState(() => agora())
  const [retomada, setRetomada] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const tentando = useRef(false)

  // Confere a cota, e retoma SOZINHO quando renovou (uma vez; sem clique do cliente).
  useEffect(() => {
    let vivo = true
    const conferir = async () => {
      if (tentando.current) return
      tentando.current = true
      try {
        const e = await cota.ler(pasta)
        if (!vivo) return
        setEstado(e)
        setRelogio(agora())
        setFalhou(false)
        if (deveRetomar(e)) {
          await cota.retomar(pasta)
          if (!vivo) return
          setRetomada(true)
          onRetomou?.()
        }
      } catch {
        if (vivo) setFalhou(true)
      } finally {
        tentando.current = false
      }
    }
    void conferir()
    if (!sondagemMs) return () => { vivo = false }
    const id = setInterval(() => { void conferir() }, sondagemMs)
    return () => { vivo = false; clearInterval(id) }
  }, [cota, pasta, sondagemMs, agora, onRetomou])

  const hora = horaDeVolta(estado?.voltaEm ?? null)
  const contagem = contagemAteVolta(estado?.voltaEm ?? null, relogio)
  const passou = !!estado?.voltaEm && contagem === '0:00'
  const plano = estado?.plano === 'max' ? 'Max' : estado?.plano === 'pro' ? 'Pro' : null
  const etapa = textoDaObra(estado?.parouEm?.etapa, 12)
  const tarefa = textoDaObra(estado?.parouEm?.tarefa, 100)

  if (retomada) {
    return (
      <div className="at-pausa">
        <div className="at-pausa__card" role="status">
          <div className="at-pausa__cab"><span className="at-pausa__bola"><Icone nome="check" tamanho={26} /></span><span className="at-pausa__rotulo">A COTA RENOVOU</span></div>
          <h1>A cota renovou e a obra já voltou sozinha.</h1>
          <p>Você não precisou fazer nada. Ela continuou exatamente de onde parou.</p>
          <div className="at-pausa__acoes"><Botao className="at-pausa__btn" onClick={onVoltar}>Voltar ao painel</Botao></div>
        </div>
      </div>
    )
  }

  return (
    <div className="at-pausa">
      <div className="at-pausa__card">
        <div className="at-pausa__cab">
          <span className="at-pausa__bola"><Icone nome="pausa" tamanho={26} /></span>
          <span className="at-pausa__rotulo">OBRA EM PAUSA · NADA A FAZER</span>
        </div>
        <h1>{hora ? `A cota do seu plano Claude acabou por agora. A obra volta sozinha às ${hora}.` : 'A cota do seu plano Claude acabou por agora. A obra volta sozinha quando ela renovar.'}</h1>
        <p>
          {plano ? `Isso é normal no plano ${plano}.` : 'Isso é normal.'} Tudo o que foi feito está salvo
          {etapa ? `: a obra parou no ${etapa}${tarefa ? `, no meio da tarefa "${tarefa}",` : ''} e continua dali.` : ' e a obra continua de onde parou.'}
        </p>
        <div className="at-pausa__tempo">
          <span className="at-pausa__relogio">{contagem ?? '—'}</span>
          <div className="at-pausa__tempo-txt">
            <b>horas até a cota renovar</b>
            <span>
              {passou
                ? 'A hora chegou. Estou conferindo se a cota já renovou; assim que renovar, a obra continua sozinha.'
                : `Pode desligar o computador. Ao ligar${hora ? ` depois das ${hora}` : ' mais tarde'}, a obra continua sozinha.`}
            </span>
          </div>
        </div>
        <div className="at-pausa__acoes">
          <Botao className="at-pausa__btn" onClick={onVoltar}>Voltar ao painel</Botao>
          {plano === 'Pro' && onVerMax && <button type="button" className="at-pausa__link" onClick={onVerMax}>Quero terminar mais rápido (ver o plano Max)</button>}
        </div>
        {falhou && <p className="at-pausa__nota" role="status">Não consegui conferir a cota agora. Sem pressa: tento de novo sozinho.</p>}
        <span className="at-pausa__nota">Avisamos no seu celular quando a obra voltar.</span>
      </div>
    </div>
  )
}
