import { useEffect, useState } from 'react'
import { Botao, Icone } from '../ui'
import { LateralPassos } from './Ativacao'
import type { PedidoAjudaPasso } from './ajuda-passo'
import { CartaoPasso, PreviaSite } from './GuiaConta'
import { CONTAS, TEXTO_OPCIONAL, type IdConta } from './contas-passos'
import { CONTAS_OBRIGATORIAS, type ContaObrigatoria, type PonteContas } from './ponte-contas'
import './app.css'
import './claude.css'
import './contas.css'

interface Props {
  contas: PonteContas
  /** Segue para F04b (acompanhar pelo celular). */
  onContinuar: () => void
  /** De quanto em quanto tempo o Atlas olha sozinho se a conta ficou pronta (leve). Padrão: 5 s. */
  sondagemMs?: number
  /** Abre a Ajuda do Atlas (F17) já com o print do passo. */
  onPedirAjuda?: (pedido: PedidoAjudaPasso) => void
}

/** F04: abrir as contas (prototipo/F04Contas). GitHub, Supabase e Vercel, uma por vez, um passo por vez. As contas são do próprio cliente. */
export function Contas({ contas, onContinuar, sondagemMs = 5000, onPedirAjuda }: Props) {
  const [conta, setConta] = useState(0)
  const [passo, setPasso] = useState(0)
  const [feitas, setFeitas] = useState<Partial<Record<IdConta, boolean>>>({})
  const [aviso, setAviso] = useState('')
  const [ajuda, setAjuda] = useState(false)
  const [detectada, setDetectada] = useState<IdConta | null>(null)

  const c = CONTAS[conta]
  const p = c.passos[passo]
  const ultimo = passo === c.passos.length - 1
  const fim = ultimo && conta === CONTAS.length - 2 // última conta obrigatória (Vercel)

  // Detecção sozinha: ao abrir, vê o que já está pronto; depois, enquanto o cliente faz a conta no site, olha de tempos em tempos.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const prontas: Partial<Record<IdConta, boolean>> = {}
      for (const id of CONTAS_OBRIGATORIAS) prontas[id] = await contas.pronta(id).catch(() => false)
      if (!vivo || !CONTAS_OBRIGATORIAS.some((id) => prontas[id])) return
      setFeitas((f) => ({ ...f, ...prontas }))
      const primeira = CONTAS.findIndex((x) => !x.opcional && !prontas[x.id])
      if (primeira >= 0) { setConta(primeira); setPasso(0) }
    })()
    return () => { vivo = false }
  }, [contas])

  const idAtual = CONTAS[conta].id
  const jaFeita = !!feitas[idAtual]
  useEffect(() => {
    if (CONTAS[conta].opcional || jaFeita) return
    let vivo = true
    const id = setInterval(() => {
      void contas.pronta(idAtual as ContaObrigatoria).then((ok) => {
        if (!vivo || !ok) return
        setFeitas((f) => ({ ...f, [idAtual]: true }))
        setDetectada(idAtual)
        setPasso(CONTAS[conta].passos.length - 1)
      }).catch(() => {})
    }, sondagemMs)
    return () => { vivo = false; clearInterval(id) }
  }, [conta, idAtual, jaFeita, contas, sondagemMs])

  const ir = (nova: number) => { setConta(nova); setPasso(0); setAviso(''); setDetectada(null); setAjuda(false) }

  const avancar = async () => {
    setAviso('')
    if (passo === 0) {
      try { await contas.abrirSite(c.id as ContaObrigatoria) } catch { setAviso(`Não consegui abrir o site do ${c.nome} agora. Abra ele no seu navegador e siga os passos daqui mesmo.`) }
    }
    if (!ultimo) { setPasso(passo + 1); setAjuda(false); return }
    setFeitas({ ...feitas, [c.id]: true })
    ir(conta + 1)
  }
  const voltar = () => {
    setAviso('')
    if (passo > 0) { setPasso(passo - 1); setAjuda(false) }
    else if (conta > 0) ir(conta - 1)
  }

  return (
    <div className="at-ativ-fundo">
      <div className="at-ativ at-contas">
        <LateralPassos agora={4} />
        <section className="at-contas__corpo">
          <div className="at-contas__abas">
            {CONTAS.map((x, i) => (
              <button key={x.id} type="button" className={`at-contas__aba ${i === conta ? 'at-contas__aba--atual' : ''} ${feitas[x.id] ? 'at-contas__aba--feita' : ''}`} aria-current={i === conta ? 'step' : undefined} onClick={() => ir(i)}>
                <span className="at-contas__aba-bola">{feitas[x.id] ? <Icone nome="check" tamanho={12} /> : i + 1}</span>
                {x.nome}
              </button>
            ))}
          </div>
          <div className="at-contas__grade">
            <div className="at-claude__col">
              <div className="at-claude__cab">
                <span className="at-claude__rotulo">CONTA {conta + 1} DE {CONTAS.length} · {c.nome.toUpperCase()}</span>
                <h1>{c.oque}</h1>
                <span className="at-ativ__txt">{c.porque}</span>
              </div>

              {!c.opcional && (
                <>
                  <CartaoPasso passo={p} n={passo + 1} total={c.passos.length} />
                  {detectada === c.id && <p className="at-contas__detectada" role="status"><Icone nome="check" tamanho={16} /> O Atlas viu sozinho: a sua conta do {c.nome} está pronta.</p>}
                  <div className="at-ativ__rodape at-claude__acoes">
                    <Botao variante="secundario" onClick={voltar} disabled={conta === 0 && passo === 0}>← Voltar</Botao>
                    {fim ? <Botao onClick={onContinuar}>Último passo →</Botao> : <Botao onClick={() => void avancar()}>{passo === 0 ? 'Abrir o site →' : ultimo ? 'Próxima conta →' : 'Fiz isso →'}</Botao>}
                  </div>
                  {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
                  <button type="button" className="at-ativ__link at-claude__nao-consegui" onClick={() => setAjuda(!ajuda)} aria-expanded={ajuda}>Não consegui fazer este passo</button>
                  {ajuda && (
                    <div className="at-claude__ajuda">
                      <b>Tudo bem, acontece com todo mundo.</b>
                      <div className="at-claude__ajuda-acoes">
                        <Botao><Icone nome="play" tamanho={16} /> Ver este passo em vídeo (40 s)</Botao>
                        <Botao variante="secundario" onClick={() => onPedirAjuda?.({ origem: 'F04', conta: c.nome, passo: passo + 1, totalPassos: c.passos.length, print: { url: p.site.url, titulo: p.site.titulo, botaoCerto: p.site.itens.find((i) => i.destaque)?.txt } })}><Icone nome="ajuda" tamanho={16} /> Pedir ajuda ao Atlas (mande um print)</Botao>
                      </div>
                    </div>
                  )}
                </>
              )}

              {c.opcional && (
                <>
                  <div className="at-contas__opcional">
                    <b>{TEXTO_OPCIONAL.titulo}</b>
                    <span className="at-ativ__txt">{TEXTO_OPCIONAL.texto}</span>
                  </div>
                  <div className="at-ativ__rodape at-claude__acoes">
                    <Botao onClick={onContinuar}>Último passo →</Botao>
                    <span className="at-ativ__txt">{TEXTO_OPCIONAL.nota}</span>
                  </div>
                </>
              )}
            </div>
            <PreviaSite site={p.site} />
          </div>
        </section>
      </div>
    </div>
  )
}
