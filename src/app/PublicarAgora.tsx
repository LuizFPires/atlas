// "Publicar agora" (Guilherme, 27/11/2026: "quero que poste sem as alterações"): painel pela direita que diz o que vai para o ar
// e o que fica de fora (continua na fila), e como fica a obra. Protótipo aprovado pelo Luiz em 27/11/2026 (tela 2).
import { useEffect, useRef, useState } from 'react'
import { textoDaObra } from './ponte-cota'
import type { PedidoAnterior, PontePosObra } from './ponte-posobra'
import './publicar-agora.css'

interface Props {
  obra: { nome: string; pasta: string }
  posobra: Pick<PontePosObra, 'historico' | 'publicarAgora'>
  endereco?: string | null
  onFechar: () => void
  /** Publicação começou: a tela vai para o acompanhamento do "Colocar no ar". */
  onPublicando: () => void
  onVerTeste?: () => void
}

const ERROS: Record<string, string> = {
  'sem-publicacao': 'Esta obra ainda não foi publicada. Use "Colocar no ar" quando ela ficar pronta.',
  'ja-rodando': 'O Atlas ainda está terminando outra ação nesta obra. Tente de novo em instantes.',
}

export function PublicarAgora({ obra, posobra, endereco, onFechar, onPublicando, onVerTeste }: Props) {
  const [lista, setLista] = useState<PedidoAnterior[] | null>(null)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState('')
  const fechar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let vivo = true
    posobra.historico(obra.pasta).then((h) => { if (vivo) setLista(h) }, () => { if (vivo) setLista([]) })
    fechar.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', tecla)
    return () => { vivo = false; window.removeEventListener('keydown', tecla) }
  }, [posobra, obra.pasta, onFechar])

  const prontas = (lista ?? []).filter((h) => h.status === 'para-conferir')
  const fora = (lista ?? []).filter((h) => h.status === 'em-andamento')
  const publicar = async () => {
    if (!posobra.publicarAgora) return
    setIndo(true); setErro('')
    try { await posobra.publicarAgora(obra.pasta); onPublicando() } catch (e) {
      const c = e instanceof Error ? e.message : String(e)
      setErro(ERROS[c] ?? 'Não consegui começar a publicar agora. Tente de novo em instantes.')
      setIndo(false)
    }
  }
  return (
    <>
      <div className="at-pa-fundo" onClick={onFechar} aria-hidden="true" />
      <aside className="at-pa" role="dialog" aria-modal="true" aria-label="Publicar agora">
        <div className="at-pa__cab">
          <div><span className="at-pa__rot">PUBLICAR AGORA</span><h2>Publicar o que já está pronto</h2></div>
          <button type="button" ref={fechar} className="at-pa__fechar" onClick={onFechar}>Fechar ✕</button>
        </div>
        <p className="at-pa__intro">Coloca no ar agora a versão que já está pronta, <b>sem esperar as mudanças da fila</b>. Elas continuam sendo feitas e você publica depois.</p>
        <section className="at-pa__grupo at-pa__grupo--vai" aria-label="Vai para o ar">
          <span className="at-pa__rot at-pa__rot--lime">VAI PARA O AR</span>
          <div className="at-pa__li"><span><i aria-hidden="true">✓</i>Tudo o que já está no ar hoje</span>{endereco && <small>{endereco.replace(/^https:\/\//, '')}</small>}</div>
          {prontas.map((h) => <div key={h.id} className="at-pa__li"><span><i aria-hidden="true">✓</i>{textoDaObra(h.nome, 60)}</span><small>pronta para conferir</small></div>)}
          {prontas.length > 0 && <small className="at-pa__dica">Não quer alguma? Toque em “Descartar” nela, em Pedir mudança.</small>}
        </section>
        {fora.length > 0 && (
          <section className="at-pa__grupo" aria-label="Fica de fora">
            <span className="at-pa__rot">FICA DE FORA · CONTINUA NA FILA</span>
            {fora.map((h) => <div key={h.id} className="at-pa__li"><span><i aria-hidden="true">–</i>{textoDaObra(h.nome, 60)}</span><small>{h.fila === 'agora' ? 'sendo feita' : 'na fila'}</small></div>)}
          </section>
        )}
        <section className="at-pa__grupo" aria-label="Como fica">
          <span className="at-pa__rot">COMO FICA</span>
          <ol className="at-pa__passos">
            <li>A obra <b>pausa</b> enquanto publica (uns 5 minutos).</li>
            <li>O Atlas confere, publica na sua Vercel e testa o endereço.</li>
            <li>A obra <b>volta sozinha</b> para a fila, de onde parou.</li>
          </ol>
        </section>
        {erro && <p className="at-pa__erro" role="alert">{erro}</p>}
        <div className="at-pa__pe">
          {onVerTeste && <button type="button" className="at-pa__sec" onClick={onVerTeste}>Ver como ficou</button>}
          <button type="button" className="at-pa__ok" disabled={indo || lista === null || !posobra.publicarAgora} onClick={() => void publicar()}>{indo ? 'Começando…' : 'Publicar agora →'}</button>
        </div>
      </aside>
    </>
  )
}
