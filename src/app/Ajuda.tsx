import { useEffect, useRef, useState } from 'react'
import { Icone, Microfone, useVoz } from '../ui'
import { textoDaObra } from './ponte-cota'
import { montarCaso, type MotivoCaso, type PonteCasosAdmin } from './ponte-ajuda-casos'
import { AINDA_NAO_DEU, ehPaginaId, normalizarResposta, saudacaoAjuda, type ContextoAjuda, type PonteAjuda, type PrintAjuda, type RespostaAjuda, type Turno } from './ponte-ajuda'
import './ajuda.css'

interface Props {
  ajuda: PonteAjuda
  /** Para onde vão os casos que o Atlas não resolveu (painel do administrador). */
  casos?: PonteCasosAdmin
  contexto: ContextoAjuda
  /** Primeiro nome do cliente, para o "Oi, Zé". */
  nome?: string
  onFechar: () => void
}

type Mensagem =
  | { id: number; de: 'cliente'; texto: string; falado: boolean }
  | { id: number; de: 'atlas'; texto: string; resposta?: RespostaAjuda }

/** Quadro do print: desenhado aqui com texto escapado. Endereço, título e texto são DADO; nunca vira link nem imagem carregada. */
function QuadroPrint({ print }: { print: PrintAjuda }) {
  return (
    <div className="at-ajuda-p__print" aria-label="Print da tela">
      <div className="at-ajuda-p__barra"><i /><i /><i /><span>{textoDaObra(print.url, 80)}</span></div>
      <div className="at-ajuda-p__print-corpo">
        <b>{textoDaObra(print.titulo, 100)}</b>
        {print.detalhe && <span>{textoDaObra(print.detalhe, 240)}</span>}
      </div>
    </div>
  )
}

/**
 * F17: a Ajuda do Atlas (prototipo/F17Ajuda), painel lateral de 520 px. Todo o suporte é o próprio Atlas.
 * A conversa vai pela porta `PonteAjuda` (o Claude por baixo); o que o cliente falou, escreveu ou mostrou é DADO.
 */
export function Ajuda({ ajuda, casos, contexto, nome, onFechar }: Props) {
  const [prints, setPrints] = useState<PrintAjuda[]>(contexto.print ? [contexto.print] : [])
  const [msgs, setMsgs] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [falado, setFalado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [fechado, setFechado] = useState(false) // "Fiz, deu certo": a conversa terminou bem
  const proximo = useRef(1)
  const caso = useRef<'nao' | 'enviando' | 'enviado'>('nao') // um caso por conversa
  const fim = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)
  const { gravando, alternar, suportado } = useVoz((t) => { setTexto((a) => [a, t].filter(Boolean).join(' ')); setFalado(true) })

  useEffect(() => { fim.current?.scrollIntoView?.({ block: 'end' }) }, [msgs, ocupado])

  const ultimaAcao = [...msgs].reverse().find((m) => m.de === 'atlas')
  const historico = (): Turno[] => msgs.map((m) => ({ de: m.de, texto: m.texto }))

  // Caso não resolvido: vai ao painel do administrador (uma vez), sem segredo. Se não deu para anotar, não finge que anotou.
  const anotarCaso = async (motivo: MotivoCaso, turnos: Turno[], avisar: boolean) => {
    if (!casos || caso.current !== 'nao') return
    caso.current = 'enviando'
    try {
      await casos.enviar(montarCaso({ ...contexto, print: prints[prints.length - 1] ?? contexto.print ?? null }, turnos, motivo))
      caso.current = 'enviado'
      if (avisar) setMsgs((m) => [...m, { id: proximo.current++, de: 'atlas', texto: 'Anotei o seu caso, com o print e o passo onde você parou, para o Atlas estudar o que aconteceu. Você pode me contar de outro jeito ou mandar outro print a qualquer hora.' }])
    } catch {
      caso.current = 'nao'
      if (avisar) setMsgs((m) => [...m, { id: proximo.current++, de: 'atlas', texto: 'Não consegui anotar o seu caso agora. Sem pressa: você pode me contar de outro jeito ou mandar outro print, que eu continuo aqui com você.' }])
    }
  }

  const enviar = async (mensagem: string, vindoDaVoz = false) => {
    const t = mensagem.trim()
    if (!t || ocupado) return
    const id = ++reqId.current
    const antes = historico()
    setMsgs((m) => [...m, { id: proximo.current++, de: 'cliente', texto: t, falado: vindoDaVoz }])
    setTexto('')
    setFalado(false)
    setAviso('')
    setOcupado(true)
    try {
      // A resposta do Claude é DADO: passa pelo normalizador (texto simples, sem promessa de gente, página só da lista fechada).
      const r = normalizarResposta(await ajuda.conversar({ ...contexto, print: prints[prints.length - 1] ?? null }, antes, t))
      if (id === reqId.current) {
        setMsgs((m) => [...m, { id: proximo.current++, de: 'atlas', texto: r.texto, resposta: r }])
        const turnos = [...antes, { de: 'cliente' as const, texto: t }, { de: 'atlas' as const, texto: r.texto }]
        const vezes = turnos.filter((x) => x.de === 'cliente' && x.texto === AINDA_NAO_DEU).length
        if (r.naoResolvido) void anotarCaso('sem-saida', turnos, true)
        else if (vezes >= 2) void anotarCaso('ainda-nao-deu', turnos, true)
      }
    } catch {
      if (id === reqId.current) setAviso('Não consegui responder agora. Nada se perdeu: tente de novo em instantes.')
    } finally { if (id === reqId.current) setOcupado(false) }
  }

  const abrirPagina = async (id: unknown) => {
    if (!ehPaginaId(id)) return
    try { await ajuda.abrirPagina(id) } catch { setAviso('Não consegui abrir a página agora. Tente de novo em instantes.') }
  }
  const deuCerto = () => {
    setFechado(true)
    setMsgs((m) => [...m, { id: proximo.current++, de: 'atlas', texto: 'Que bom que deu certo! Se aparecer outra coisa, é só me chamar por aqui.' }])
  }

  // Fechar com a conversa aberta e sem "deu certo": o caso não resolvido também vai ao painel.
  const fechar = () => {
    if (!fechado && msgs.some((m) => m.de === 'cliente')) void anotarCaso('fechou-sem-resolver', historico(), false)
    onFechar()
  }

  const tirar = async () => {
    const p = await ajuda.tirarPrint(contexto.pasta).catch(() => null)
    if (p) setPrints((l) => [...l, p])
    else setAviso('Não consegui tirar o print agora. Você pode anexar uma imagem ou contar com palavras.')
  }
  const anexar = async () => {
    const p = await ajuda.anexarImagem(contexto.pasta).catch(() => null)
    if (p) setPrints((l) => [...l, p])
  }

  return (
    <>
    {contexto.origem === 'erro' && (
      <div className="at-ajuda-p__erro" role="alert">
        <span aria-hidden="true">!</span>
        <div><b>{textoDaObra(contexto.erro?.titulo, 100) || 'Algo deu errado.'}</b><span>A Ajuda do Atlas já abriu ao lado, com o print da tela.</span></div>
      </div>
    )}
    <aside className="at-ajuda-p" aria-label="Ajuda do Atlas">
      <header className="at-ajuda-p__topo">
        <span className="at-ajuda-p__logo"><Icone nome="ajuda" tamanho={22} /></span>
        <div className="at-ajuda-p__tit">
          <b>Ajuda do Atlas</b>
          <span>● responde na hora, a qualquer hora</span>
        </div>
        <button type="button" className="at-ajuda-p__fechar" aria-label="Fechar a Ajuda" onClick={fechar}><Icone nome="x" tamanho={20} /></button>
      </header>
      <div className="at-ajuda-p__conversa" role="log" aria-live="polite">
        <div className="at-ajuda-p__balao at-ajuda-p__balao--atlas">{saudacaoAjuda(contexto, nome)}</div>
        {prints.length > 0 && (
          <div className="at-ajuda-p__eu">
            {prints.map((p, i) => <QuadroPrint key={i} print={p} />)}
          </div>
        )}
        {msgs.map((m) => m.de === 'cliente' ? (
          <div key={m.id} className="at-ajuda-p__eu">
            <div className="at-ajuda-p__balao at-ajuda-p__balao--eu">
              {m.falado && <span className="at-ajuda-p__falado"><Icone nome="microfone" tamanho={12} /> falado</span>}
              {m.texto}
            </div>
          </div>
        ) : (
          <div key={m.id} className="at-ajuda-p__balao at-ajuda-p__balao--atlas">
            <span>{m.texto}</span>
            {m.resposta?.passos && (
              <ol className="at-ajuda-p__passos">
                {m.resposta.passos.map((p, i) => <li key={i}><b>{i + 1}.</b> {p}</li>)}
              </ol>
            )}
            {m.resposta?.traducoes && (
              <ul className="at-ajuda-p__trad" aria-label="O que quer dizer">
                {m.resposta.traducoes.map((t) => <li key={t.en}><b>{t.en}</b> quer dizer “{t.pt}”</li>)}
              </ul>
            )}
            {m.resposta?.depois && <span className="at-ajuda-p__depois">{m.resposta.depois}</span>}
            {m.resposta?.passos && (
              <div className="at-ajuda-p__acoes">
                {m.resposta.pagina && <button type="button" className="at-ajuda-p__primario" disabled={fechado || m !== ultimaAcao} onClick={() => void abrirPagina(m.resposta?.pagina)}>Abrir a página certa</button>}
                <button type="button" className="at-ajuda-p__sec" disabled={fechado || m !== ultimaAcao || ocupado} onClick={deuCerto}><Icone nome="check" tamanho={14} /> Fiz, deu certo</button>
                <button type="button" className="at-ajuda-p__sec" disabled={fechado || m !== ultimaAcao || ocupado} onClick={() => void enviar(AINDA_NAO_DEU)}>Ainda não deu</button>
              </div>
            )}
          </div>
        ))}
        {ocupado && <div className="at-ajuda-p__balao at-ajuda-p__balao--atlas" role="status">Estou olhando…</div>}
        {aviso && <p className="at-ajuda-p__aviso" role="alert">{aviso}</p>}
        <div ref={fim} />
      </div>
      <footer className="at-ajuda-p__rodape">
        <div className="at-ajuda-p__chips">
          <button type="button" className="at-ajuda-p__chip" onClick={() => void tirar()}><Icone nome="imagem" tamanho={15} /> Tirar print da tela</button>
          <button type="button" className="at-ajuda-p__chip" onClick={() => void anexar()}><Icone nome="clipe" tamanho={15} /> Anexar imagem</button>
        </div>
        <form className="at-ajuda-p__linha" onSubmit={(e) => { e.preventDefault(); void enviar(texto, falado) }}>
          <Microfone gravando={gravando} onAlternar={alternar} className="at-ajuda-p__mic" />
          <label htmlFor="msgAjuda" className="at-ajuda-p__so-leitor">Mensagem para a Ajuda do Atlas</label>
          <input id="msgAjuda" value={texto} disabled={ocupado} placeholder="Fale ou escreva o que aconteceu…" onChange={(e) => { setTexto(e.target.value); if (!e.target.value) setFalado(false) }} />
          <button type="submit" className="at-ajuda-p__enviar" aria-label="Enviar" disabled={!texto.trim() || ocupado}><Icone nome="seta" tamanho={18} /></button>
        </form>
        {!suportado && <span className="at-ajuda-p__dica">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
      </footer>
    </aside>
    </>
  )
}
