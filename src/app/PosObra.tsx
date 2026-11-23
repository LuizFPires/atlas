import { useEffect, useRef, useState } from 'react'
import { Icone, Microfone, useVoz } from '../ui'
import { textoDaObra } from './ponte-cota'
import type { PonteArquivos } from './ponte-arquivos'
import { SemLicencaError, TIPOS_PEDIDO, executarComLicenca, recadoLicenca, type PonteLicenca, type PedidoAnterior, type PedidoPosObra, type PlanoPosObra, type PontePosObra, type StatusPedido, type TipoPedido } from './ponte-posobra'
import './posobra.css'

interface Props {
  obra: { nome: string; pasta: string }
  posobra: PontePosObra
  arquivos?: PonteArquivos
  /** Licença em dia (S4 /verificar): conferida ANTES de mexer na obra. */
  licenca: PonteLicenca
  /** Depois que a correção virou versão de teste: ver o andamento no painel da obra. */
  onAcompanhar?: () => void
}

const ROTULO_STATUS: Record<StatusPedido, string> = { 'no-ar': 'No ar', 'para-conferir': 'Para conferir', 'em-andamento': 'Em andamento' }

/**
 * F14: pós-obra. O cliente conta, com as palavras dele, o que quer mudar (falando, escrevendo ou mandando um print).
 * Tudo o que ele diz é DADO para o Claude (o adaptador delimita); o print é só uma imagem guardada na pasta da obra.
 */
export function PosObra({ obra, posobra, arquivos, licenca, onAcompanhar }: Props) {
  const [tipo, setTipo] = useState<TipoPedido>('mudar')
  const [texto, setTexto] = useState('')
  const [prints, setPrints] = useState<string[]>([])
  const [erro, setErro] = useState('')
  // O plano carrega o SNAPSHOT do pedido que foi explicado: "Pode fazer" executa exatamente isso.
  const [explicado, setExplicado] = useState<{ plano: PlanoPosObra; pedido: PedidoPosObra } | null>(null)
  const plano = explicado?.plano ?? null
  const setPlano = () => setExplicado(null)
  const reqId = useRef(0)
  const [rodando, setRodando] = useState(false)
  const [recadoLic, setRecadoLic] = useState('')
  const [feito, setFeito] = useState<string | null>(null)
  const [entendendo, setEntendendo] = useState(false)
  const [historico, setHistorico] = useState<PedidoAnterior[]>([])
  const vivo = useRef(true)
  const mudouPedido = () => { reqId.current++; setEntendendo(false); setPlano(); setRecadoLic(''); setFeito(null) }
  // Microfone: a transcrição cai no campo e continua editável antes de enviar.
  const { gravando, alternar, suportado } = useVoz((falado) => { if (!entendendo) { setTexto((t) => [t, falado].filter(Boolean).join(' ')); mudouPedido() } })

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
      setPlano()
      setErro('')
    } catch (x) {
      setErro(x instanceof Error && x.message === 'tipo-nao-aceito'
        ? 'Esse arquivo eu não consigo olhar. Mande um print em PNG, JPG ou WEBP, ou conte com palavras.'
        : 'Não consegui pegar essa imagem agora. Tente de novo ou conte com palavras.')
    }
  }

  // O Atlas explica ANTES de mexer: nada é executado aqui. O plano vale só para o que o cliente enviou; se ele mexer no pedido, o plano some.
  const enviar = async () => {
    if ((!texto.trim() && prints.length === 0) || entendendo) return
    const id = ++reqId.current
    const pedido: PedidoPosObra = { tipo, texto, prints: [...prints] }
    setEntendendo(true)
    setErro('')
    try {
      const p = await posobra.entender(obra.pasta, pedido)
      if (id === reqId.current && vivo.current) setExplicado({ plano: p, pedido })
    } catch (x) {
      if (id !== reqId.current) return
      setPlano()
      setErro(x instanceof Error && x.message === 'pedido-vazio'
        ? 'Conte o que você quer mudar, com as suas palavras, ou mande um print.'
        : 'Não consegui entender o pedido agora. Tente de novo em instantes ou conte de outro jeito.')
    } finally { if (id === reqId.current) setEntendendo(false) }
  }

  // "Pode fazer": confere a licença e SÓ ENTÃO roda a correção pelo mesmo pipeline da obra. Sem licença em dia, nada roda.
  const aprovar = async () => {
    if (!explicado || rodando) return
    setRodando(true)
    setErro('')
    setRecadoLic('')
    try {
      const r = await executarComLicenca(licenca, posobra, obra.pasta, explicado.pedido, explicado.plano)
      setFeito(r.nome)
      setPlano()
      setTexto('')
      setPrints([])
      setHistorico(await posobra.historico(obra.pasta).catch(() => historico))
    } catch (x) {
      if (x instanceof SemLicencaError) setRecadoLic(recadoLicenca(x.motivo))
      else setErro('Não consegui começar agora. Nada foi mexido no seu sistema. Tente de novo em instantes.')
    } finally { setRodando(false) }
  }

  return (
    <main className="at-pos">
      <header className="at-pos__topo">
        <div className="at-pos__tit">
          <span className="at-pos__rotulo">PÓS-OBRA · {textoDaObra(obra.nome, 60).toUpperCase()}</span>
          <h1>O que você quer mudar?</h1>
        </div>
        <div className="at-pos__tipos" role="group" aria-label="Tipo de pedido">
          {TIPOS_PEDIDO.map((k) => (
            <button key={k.id} type="button" aria-pressed={k.id === tipo} className={`at-pos__tipo ${k.id === tipo ? 'at-pos__tipo--on' : ''}`} disabled={entendendo} onClick={() => { setTipo(k.id); mudouPedido() }}>{k.nome}</button>
          ))}
        </div>
      </header>
      <div className="at-pos__col">
        <div className="at-pos__card">
          <div className="at-pos__fala">
            <Microfone gravando={gravando} onAlternar={alternar} className="at-pos__mic" />
            <div className="at-pos__fala-txt">
              <label htmlFor="pedido">Aperte e fale, como se contasse para um amigo no restaurante</label>
              <span>Ou escreva, se preferir. O Atlas escreve o que você falar aqui embaixo.</span>
            </div>
          </div>
          <textarea id="pedido" rows={6} value={texto} disabled={entendendo} onChange={(e) => { setTexto(e.target.value); mudouPedido() }} />
          {!suportado && <span className="at-pos__dica">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
          {prints.length > 0 && <span className="at-pos__dica"><Icone nome="imagem" tamanho={14} /> Vai junto: {prints.join(', ')}</span>}
          <div className="at-pos__acoes">
            <button type="button" className="at-pos__sec" onClick={() => void anexar()} disabled={!arquivos || entendendo}>Anexar print</button>
            <button type="button" className="at-pos__enviar" onClick={() => void enviar()} disabled={(!texto.trim() && prints.length === 0) || entendendo}>{entendendo ? 'Lendo o seu pedido…' : 'Enviar para o Claude'}</button>
          </div>
        </div>
        {erro && <p className="at-pos__erro" role="alert">{erro}</p>}
        {recadoLic && <p className="at-pos__licenca" role="status">{recadoLic}</p>}
        {feito && (
          <p className="at-pos__licenca" role="status">
            Combinado! Comecei “{feito}” numa versão de teste. O sistema no ar só muda quando você aprovar.{' '}
            {onAcompanhar && <button type="button" className="at-pos__nao" onClick={onAcompanhar}>Ver como está indo</button>}
          </p>
        )}
        {plano && (
          <section className="at-pos__plano" aria-label="O que o Claude entendeu">
            <span className="at-pos__plano-rot">O CLAUDE ENTENDEU ASSIM</span>
            <p>{plano.entendi}</p>
            <ol>{plano.passos.map((p) => <li key={p}>{p}</li>)}</ol>
            <span className="at-pos__plano-min">Leva cerca de {plano.minutos} minutos. O sistema no ar só muda quando você aprovar.</span>
            <div className="at-pos__plano-acoes">
              <button type="button" className="at-pos__ok" onClick={() => void aprovar()} disabled={rodando}>{rodando ? 'Conferindo a licença…' : 'Pode fazer'}</button>
              <button type="button" className="at-pos__nao" onClick={() => setPlano()} disabled={rodando}>Não é isso</button>
            </div>
          </section>
        )}
      </div>
      <aside className="at-pos__lado" aria-label="Pedidos anteriores">
        <span className="at-pos__rotulo">PEDIDOS ANTERIORES</span>
        {historico.length === 0 && (
          <div className="at-pos__vazio">
            <Icone nome="relogio" tamanho={22} />
            <b>Nenhum pedido ainda.</b>
            <span>Quando você pedir uma mudança, ela aparece aqui com o andamento: em teste, no ar ou desfeita.</span>
          </div>
        )}
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
