import { BloqueioPolitica } from './BloqueioPolitica'
import { textoDaTrava } from './explicar-trava'
import { motivoDoTravamento } from './motivo-travou'
import { politicaIndisponivel, type PontePolitica, type ResultadoPolitica } from './ponte-politica'
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
  /** M65: análise quando o pedido é bloqueado pela política. */
  politica?: PontePolitica
  /** Destravar pelo app: abre o Falar com o Atlas com o motivo de o pedido não ter saído. */
  onAjuda?: (contexto: { onde: string; erro?: string }) => void
  /** Aprovar antes (Luiz, 27/11/2026): abre a versão de teste neste computador para conferir. */
  onVerTeste?: () => Promise<void>
  /** Aprovar antes: publica as mudanças conferidas (Colocar no ar). */
  onColocarNoAr?: () => Promise<void>
}

const ROTULO_STATUS: Record<StatusPedido, string> = { 'no-ar': 'No ar', 'para-conferir': 'Para conferir', 'em-andamento': 'Em andamento', cancelada: 'Cancelada', descartada: 'Descartada' }
const rotuloDe = (h: PedidoAnterior) => (h.status === 'em-andamento' && h.fila === 'agora' ? 'Sendo feita' : h.status === 'em-andamento' && h.fila === 'fila' ? 'Na fila' : ROTULO_STATUS[h.status])
/** Cancelar e descartar (Guilherme, 27/11/2026): o que acontece, em português, antes de confirmar. */
const textoConfirmar = (h: PedidoAnterior) => h.status === 'para-conferir'
  ? 'Ela não vai para o ar e o Atlas desfaz na versão de teste. O que está no ar não muda.'
  : h.fila === 'agora'
    ? 'O Atlas para agora o que está fazendo nela e descarta o que ainda não ficou pronto. A fila segue com o próximo pedido.'
    : 'Ainda não começou: sai da fila e nada muda no sistema.'
const ERROS_CONTROLE: Record<string, string> = {
  'obra-trabalhando': 'A obra está trabalhando em outra mudança agora. Pause a obra e tente de novo.',
  'descartar-conflito': 'Essa mudança se misturou com outras que vieram depois, então não dá para tirar sozinha. Peça aqui em cima o que você quer desfazer.',
  'descartar-nao-achou': 'Não achei essa mudança na versão de teste. Peça aqui em cima o que você quer desfazer.',
  'ja-pronta': 'Essa mudança acabou de ficar pronta. Quando ela aparecer para conferir, use Descartar.',
  'ja-rodando': 'O Atlas ainda está terminando outra ação nesta obra. Tente de novo em instantes.',
}

/**
 * F14: pós-obra. O cliente conta, com as palavras dele, o que quer mudar (falando, escrevendo ou mandando um print).
 * Tudo o que ele diz é DADO para o Claude (o adaptador delimita); o print é só uma imagem guardada na pasta da obra.
 */
export function PosObra({ obra, posobra, arquivos, licenca, onAcompanhar, politica = politicaIndisponivel, onAjuda, onVerTeste, onColocarNoAr }: Props) {
  const [avisoHist, setAvisoHist] = useState('')
  const [abrindo, setAbrindo] = useState<'teste' | 'noar' | null>(null)
  const agirHist = async (qual: 'teste' | 'noar', f?: () => Promise<void>) => {
    if (!f) return
    setAvisoHist(''); setAbrindo(qual)
    try { await f() } catch (e) { if (vivo.current) setAvisoHist(textoDaTrava(e, qual === 'teste' ? 'Não consegui abrir a versão de teste agora.' : 'Não consegui começar a colocar no ar agora.')) } finally { if (vivo.current) setAbrindo(null) }
  }
  const [bloqueio, setBloqueio] = useState<ResultadoPolitica | null>(null)
  const [tipo, setTipo] = useState<TipoPedido>('mudar')
  const [texto, setTexto] = useState('')
  const [prints, setPrints] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [travou, setTravou] = useState<string | null>(null) // código do último "Pode fazer" que não saiu
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
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [controlando, setControlando] = useState(false)
  const [recadoHist, setRecadoHist] = useState('')
  const controlar = async (h: PedidoAnterior) => {
    const descartar = h.status === 'para-conferir'
    const f = descartar ? posobra.descartar : posobra.cancelar
    if (!f) return
    setControlando(true); setAvisoHist(''); setRecadoHist('')
    try {
      const r = await f.call(posobra, obra.pasta, h.id)
      if (!vivo.current) return
      setConfirmar(null)
      const nome = textoDaObra(h.nome, 60)
      setRecadoHist(descartar ? `Descartada. “${nome}” não vai para o ar.`
        : h.fila === 'agora' ? (('continuou' in r && r.continuou) ? `Cancelado. O Atlas parou “${nome}” e já começou o próximo pedido.` : `Cancelado. O Atlas parou “${nome}”.`)
          : `Cancelado. “${nome}” saiu da fila.`)
      setHistorico(await posobra.historico(obra.pasta).catch(() => historico))
    } catch (e) {
      const c = e instanceof Error ? e.message : String(e)
      if (vivo.current) setAvisoHist(ERROS_CONTROLE[c] ?? 'Não consegui agora. Tente de novo em instantes.')
    } finally { if (vivo.current) setControlando(false) }
  }
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
        : textoDaTrava(x, 'Não consegui pegar essa imagem (você pode contar com palavras).'))
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
      if (id !== reqId.current || !vivo.current) return
      if (p.politica?.bloqueia) { setBloqueio(p.politica); setPlano(); return }
      setExplicado({ plano: p, pedido })
    } catch (x) {
      if (id !== reqId.current) return
      setPlano()
      setErro(x instanceof Error && x.message === 'pedido-vazio'
        ? 'Conte o que você quer mudar, com as suas palavras, ou mande um print.'
        : textoDaTrava(x, 'Não consegui entender o pedido (você pode contar de outro jeito).'))
    } finally { if (id === reqId.current) setEntendendo(false) }
  }

  // "Pode fazer": confere a licença e SÓ ENTÃO roda a correção pelo mesmo pipeline da obra. Sem licença em dia, nada roda.
  const aprovar = async () => {
    if (!explicado || rodando) return
    setRodando(true)
    setErro('')
    setTravou(null)
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
      else {
        const codigo = x instanceof Error ? x.message : ''
        setTravou(codigo)
        setErro(motivoDoTravamento(codigo, 'Não consegui começar. Nada foi mexido no seu sistema.'))
      }
    } finally { setRodando(false) }
  }

  if (bloqueio) {
    return (
      <main className="at-pos">
        <BloqueioPolitica modo={bloqueio.situacao === 'embargada' || bloqueio.situacao === 'recusada' ? 'embargada' : 'pedido'} sinais={bloqueio.sinais} obra={obra.pasta} politica={politica} onVoltar={() => { setBloqueio(null); setTexto(''); setPrints([]) }} />
      </main>
    )
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
        {erro && travou !== null && plano && (
          <div className="at-pos__destravar">
            <button type="button" className="at-pos__sec" disabled={rodando} onClick={() => void aprovar()}>Tentar de novo</button>
            {onAjuda && <button type="button" className="at-pos__sec" onClick={() => onAjuda({ onde: 'o pedido de mudança da obra', erro: travou || 'sem-codigo' })}>Pedir ao Atlas para destravar</button>}
          </div>
        )}
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
        {historico.some((h) => h.status === 'para-conferir') && (
          <div className="at-pos__conferir" aria-label="Mudanças para conferir">
            <b>{historico.filter((h) => h.status === 'para-conferir').length === 1 ? '1 mudança pronta para você conferir' : `${historico.filter((h) => h.status === 'para-conferir').length} mudanças prontas para você conferir`}</b>
            <span>1. Veja como ficou na versão de teste, neste computador. 2. Gostou? Coloque no ar: o Atlas confere de novo e publica tudo o que está pronto.</span>
            <div className="at-pos__conferir-acoes">
              {onVerTeste && <button type="button" className="at-pos__sec" disabled={abrindo !== null} onClick={() => void agirHist('teste', onVerTeste)}>{abrindo === 'teste' ? 'Abrindo…' : 'Ver como ficou'}</button>}
              {onColocarNoAr && <button type="button" className="at-pos__ok" disabled={abrindo !== null} onClick={() => void agirHist('noar', onColocarNoAr)}>{abrindo === 'noar' ? 'Começando…' : 'Colocar no ar →'}</button>}
            </div>
          </div>
        )}
        {avisoHist && <span className="at-pos__erro" role="alert">{avisoHist}</span>}
        {recadoHist && <span className="at-pos__recado" role="status">{recadoHist}</span>}
        {historico.map((h) => {
          const pode = (h.podeCancelar && !!posobra.cancelar) || (h.podeDescartar && !!posobra.descartar)
          const verbo = h.status === 'para-conferir' ? 'Descartar' : 'Cancelar'
          return (
            <div key={h.id} className={`at-pos__hist${h.fila === 'agora' ? ' at-pos__hist--agora' : ''}${h.status === 'cancelada' || h.status === 'descartada' ? ' at-pos__hist--fora' : ''}`}>
              <div><b>{textoDaObra(h.nome, 60)}</b><span className={`at-pos__st at-pos__st--${h.status}${h.fila ? ` at-pos__st--${h.fila}` : ''}`}>{rotuloDe(h)}</span></div>
              <div className="at-pos__hist-pe">
                <span>{h.data}</span>
                {pode && confirmar !== h.id && <button type="button" className="at-pos__cancelar" disabled={controlando} onClick={() => { setConfirmar(h.id); setRecadoHist(''); setAvisoHist('') }} aria-label={`${verbo} ${textoDaObra(h.nome, 60)}`}>{verbo}</button>}
              </div>
              {confirmar === h.id && (
                <div className="at-pos__confirma" role="group" aria-label={`Confirmar: ${verbo.toLowerCase()} ${textoDaObra(h.nome, 60)}`}>
                  <span><b>{verbo} “{textoDaObra(h.nome, 60)}”?</b> {textoConfirmar(h)}</span>
                  <div>
                    <button type="button" className="at-pos__sec" disabled={controlando} onClick={() => setConfirmar(null)}>Manter</button>
                    <button type="button" className="at-pos__perigo" disabled={controlando} onClick={() => void controlar(h)}>{controlando ? 'Fazendo…' : `Sim, ${verbo.toLowerCase()}`}</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {historico.some((h) => h.podeCancelar) && <span className="at-pos__nota">Para cancelar, não precisa escrever: use “Cancelar” no pedido. Se ele já estava sendo feito, o Atlas para e descarta o que não ficou pronto. O sistema no ar não muda.</span>}
        <span className="at-pos__nota">Todo pedido vira uma versão de teste. O sistema no ar só muda quando você confere e clica em "Colocar no ar". Se não gostou, peça a correção aqui.</span>
      </aside>
    </main>
  )
}
