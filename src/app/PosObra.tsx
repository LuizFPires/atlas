import { useEffect, useRef, useState } from 'react'
import { Icone, Microfone, useVoz } from '../ui'
import { textoDaObra } from './ponte-cota'
import type { PonteArquivos } from './ponte-arquivos'
import { TIPOS_PEDIDO, type PedidoAnterior, type PontePosObra, type StatusPedido, type TipoPedido } from './ponte-posobra'
import './posobra.css'

interface Props {
  obra: { nome: string; pasta: string }
  posobra: PontePosObra
  arquivos?: PonteArquivos
}

const ROTULO_STATUS: Record<StatusPedido, string> = { 'no-ar': 'No ar', 'para-conferir': 'Para conferir', 'em-andamento': 'Em andamento' }

/**
 * F14: pós-obra. O cliente conta, com as palavras dele, o que quer mudar (falando, escrevendo ou mandando um print).
 * Tudo o que ele diz é DADO para o Claude (o adaptador delimita); o print é só uma imagem guardada na pasta da obra.
 */
export function PosObra({ obra, posobra, arquivos }: Props) {
  const [tipo, setTipo] = useState<TipoPedido>('mudar')
  const [texto, setTexto] = useState('')
  const [prints, setPrints] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState<PedidoAnterior[]>([])
  const vivo = useRef(true)
  // Microfone: a transcrição cai no campo e continua editável antes de enviar.
  const { gravando, alternar, suportado } = useVoz((falado) => setTexto((t) => [t, falado].filter(Boolean).join(' ')))

  useEffect(() => {
    vivo.current = true
    posobra.historico(obra.pasta).then((h) => { if (vivo.current) setHistorico(h) }, () => {})
    return () => { vivo.current = false }
  }, [posobra, obra.pasta])

  const anexar = async () => {
    if (!arquivos) return
    try {
      const a = await arquivos.escolher('imagem')
      if (!a) return
      const g = await arquivos.guardar(obra.pasta, 'posobra/prints', a.token)
      setPrints((l) => [...l, g.nome])
      setErro('')
    } catch (x) {
      setErro(x instanceof Error && x.message === 'tipo-nao-aceito'
        ? 'Esse arquivo eu não consigo olhar. Mande um print em PNG, JPG ou WEBP, ou conte com palavras.'
        : 'Não consegui pegar essa imagem agora. Tente de novo ou conte com palavras.')
    }
  }

  return (
    <main className="at-pos">
      <div className="at-pos__col">
        <div className="at-pos__tit">
          <span className="at-pos__rotulo">PÓS-OBRA · {textoDaObra(obra.nome, 60).toUpperCase()}</span>
          <h1>O que você quer mudar?</h1>
        </div>
        <div className="at-pos__tipos" role="group" aria-label="Tipo de pedido">
          {TIPOS_PEDIDO.map((k) => (
            <button key={k.id} type="button" aria-pressed={k.id === tipo} className={`at-pos__tipo ${k.id === tipo ? 'at-pos__tipo--on' : ''}`} onClick={() => setTipo(k.id)}>{k.nome}</button>
          ))}
        </div>
        <div className="at-pos__card">
          <div className="at-pos__fala">
            <Microfone gravando={gravando} onAlternar={alternar} className="at-pos__mic" />
            <div className="at-pos__fala-txt">
              <label htmlFor="pedido">Aperte e fale, como se contasse para um amigo no restaurante</label>
              <span>Ou escreva, se preferir. O Atlas escreve o que você falar aqui embaixo.</span>
            </div>
          </div>
          <textarea id="pedido" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {!suportado && <span className="at-pos__dica">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
          {prints.length > 0 && <span className="at-pos__dica"><Icone nome="imagem" tamanho={14} /> Vai junto: {prints.join(', ')}</span>}
          <div className="at-pos__acoes">
            <button type="button" className="at-pos__sec" onClick={() => void anexar()} disabled={!arquivos}>Anexar print</button>
            <button type="button" className="at-pos__enviar" disabled={!texto.trim() && prints.length === 0}>Enviar para o Claude</button>
          </div>
        </div>
        {erro && <p className="at-pos__erro" role="alert">{erro}</p>}
      </div>
      <aside className="at-pos__lado" aria-label="Pedidos anteriores">
        <span className="at-pos__rotulo">PEDIDOS ANTERIORES</span>
        {historico.map((h) => (
          <div key={h.id} className="at-pos__hist">
            <div><b>{textoDaObra(h.nome, 60)}</b><span className={`at-pos__st at-pos__st--${h.status}`}>{ROTULO_STATUS[h.status]}</span></div>
            <span>{h.data}</span>
          </div>
        ))}
        <span className="at-pos__nota">Todo pedido gera uma versão de teste antes de ir para o ar. Se algo der errado, dá para voltar para a versão anterior com um clique.</span>
      </aside>
    </main>
  )
}
