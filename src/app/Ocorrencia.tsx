import { useEffect, useRef, useState } from 'react'
import { Botao, Icone } from '../ui'
import type { AvisoEnviado, Ocorrencia as DadosOcorrencia, PonteOcorrencias } from './ponte-ocorrencia'
import './ocorrencia.css'

interface Props {
  pasta: string
  ocorrencias: PonteOcorrencias
  /** O cliente fez: a obra continua. */
  onResolvida: () => void
  /** "Fazer depois": volta ao painel; a obra segue com o que não depende disso. */
  onAdiada: () => void
  /** Abre a Ajuda do Atlas (nunca atendimento humano). */
  onPedirAjuda?: () => void
}

const recado = (e: unknown) =>
  e instanceof Error && e.message === 'indisponivel'
    ? 'Quem acompanha as paradas da obra ainda não está ligado neste computador. Quando estiver, o passo a passo aparece aqui; você não precisa refazer nada.'
    : 'Não consegui fazer isso agora. Tente de novo em instantes.'

/**
 * F11: ocorrência. É o ÚNICO tipo de parada que exige o cliente (nota u11). Passo a passo com prints e aviso no celular e no e-mail.
 * Vale nos DOIS modos da obra: mesmo no automático a obra para aqui e chama o cliente. Tudo o que vem da ocorrência é DADO:
 * entra como texto (o React escapa), sem link, sem imagem de endereço vindo de dado e sem executar nada.
 */
export function Ocorrencia({ pasta, ocorrencias, onResolvida, onAdiada, onPedirAjuda }: Props) {
  const [o, setO] = useState<DadosOcorrencia | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [feito, setFeito] = useState(0)
  const [chave, setChave] = useState('')
  const [aviso, setAviso] = useState<AvisoEnviado | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const avisada = useRef<number | null>(null)

  useEffect(() => {
    let vivo = true
    ocorrencias.ler(pasta).then(
      (r) => { if (vivo) { setO(r); setCarregou(true) } },
      (x) => { if (vivo) { setErro(recado(x)); setCarregou(true) } },
    )
    return () => { vivo = false }
  }, [ocorrencias, pasta])

  // Avisa o celular e o e-mail uma vez por ocorrência.
  useEffect(() => {
    if (!o || avisada.current === o.id) return
    avisada.current = o.id
    let vivo = true
    ocorrencias.avisar(pasta, o.id).then((a) => { if (vivo) setAviso(a) }, () => { if (vivo) setAviso({ celular: false, email: false }) })
    return () => { vivo = false }
  }, [o, ocorrencias, pasta])

  const agir = async (fn: () => Promise<void>, depois: () => void) => {
    setErro('')
    setOcupado(true)
    try { await fn(); depois() } catch (x) { setErro(recado(x)) } finally { setOcupado(false) }
  }

  if (!carregou) return <p role="status">O Atlas está preparando o passo a passo…</p>
  if (!o) {
    return (
      <div className="at-oc">
        {erro && <p className="at-oc__erro" role="alert">{erro}</p>}
        {!erro && <p role="status">Não há nada esperando por você agora.</p>}
        <div><Botao className="at-oc__btn" onClick={onAdiada}>Voltar ao painel</Botao></div>
      </div>
    )
  }

  const precisaChave = !!o.campo
  const concluir = () => {
    if (precisaChave && !chave.trim()) { setErro('Cole a chave no campo ao lado antes de continuar.'); return }
    void agir(() => ocorrencias.resolver(pasta, o.id, precisaChave ? chave.trim() : undefined), () => { setChave(''); onResolvida() })
  }

  const avisoTxt = !aviso || (aviso.celular && aviso.email)
    ? 'Também mandamos este passo a passo para o seu e-mail e celular.'
    : aviso.celular ? 'Também mandamos este passo a passo para o seu celular.'
      : aviso.email ? 'Também mandamos este passo a passo para o seu e-mail.'
        : 'Não consegui avisar no celular nem no e-mail agora. O passo a passo está aqui, quando você puder.'

  return (
    <div className="at-oc">
      <div className="at-oc__col">
        <span className="at-oc__selo"><Icone nome="relogio" tamanho={14} /> A obra precisa de você · {o.minutos} {o.minutos === 1 ? 'minuto' : 'minutos'}</span>
        <h1>{o.titulo}</h1>
        <p className="at-oc__texto">{o.motivo}</p>
        <ol className="at-oc__passos" aria-label="Passo a passo">
          {o.passos.map((p, i) => {
            const ok = i < feito
            const atual = i === feito
            return (
              <li key={i}>
                <button type="button" className={`at-oc__passo ${atual ? 'at-oc__passo--atual' : ''}`} aria-current={atual ? 'step' : undefined} onClick={() => setFeito(i + 1)}>
                  <span className={`at-oc__bola ${ok ? 'at-oc__bola--ok' : ''}`}>{ok ? <Icone nome="check" tamanho={14} /> : i + 1}</span>
                  <span className="at-oc__passo-txt">
                    <b>{p.titulo}</b>
                    {p.desc && <span>{p.desc}</span>}
                    {atual && p.print && (
                      <span className="at-oc__print" role="img" aria-label={`Print do passo: ${p.print}`}><Icone nome="imagem" tamanho={22} /><span>{p.print}</span></span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        {erro && <p className="at-oc__erro" role="alert">{erro}</p>}
        <div className="at-oc__acoes">
          <Botao className="at-oc__btn" disabled={ocupado} onClick={concluir}>{precisaChave ? 'Já colei a chave: continuar' : 'Já fiz: continuar'}</Botao>
          <button type="button" className="at-oc__link" disabled={ocupado} onClick={() => void agir(() => ocorrencias.adiar(pasta, o.id), onAdiada)}>Fazer depois (a obra segue sem isso)</button>
        </div>
      </div>
      <aside className="at-oc__lado">
        {o.campo && (
          <div className="at-oc__cartao">
            <span className="at-oc__rotulo">ONDE COLAR A CHAVE</span>
            <label htmlFor="oc-chave">{o.campo.rotulo}</label>
            <input id="oc-chave" type="password" autoComplete="off" spellCheck={false} placeholder="Cole aqui" value={chave} onChange={(e) => setChave(e.target.value)} />
            <span className="at-oc__nota">{o.campo.dica}</span>
          </div>
        )}
        <div className="at-oc__cartao at-oc__cartao--2">
          <b>Travou em algum passo?</b>
          <span className="at-oc__texto">Mande um print para a Ajuda do Atlas. Ela olha e diz o que fazer.</span>
          {onPedirAjuda && <button type="button" className="at-oc__link at-oc__link--forte" onClick={onPedirAjuda}>Abrir a Ajuda do Atlas</button>}
        </div>
        <span className="at-oc__aviso" role="status">{avisoTxt}</span>
      </aside>
    </div>
  )
}
