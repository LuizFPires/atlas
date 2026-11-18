import { useEffect, useRef, useState } from 'react'
import { Botao } from '../ui'
import type { EstiloProposto } from './ponte-estilo'
import { montarSrcDoc, SANDBOX_PREVIEW, type EstadoProto, type PontePrototipo } from './ponte-prototipo'
import type { ObraDoEstilo } from './Estilo'
import './prototipo.css'

interface Props {
  obra: ObraDoEstilo
  /** O estilo escolhido no M14 (null se o cliente trouxe a própria identidade). */
  estilo: EstiloProposto | null
  prototipo: PontePrototipo
  onVoltar: () => void
  /** Segue para dar o nome (F07b, M17); até lá volta às obras. */
  onConcluir?: () => void
}

interface Msg { quem: 'CLAUDE' | 'VOCÊ'; txt: string }

export const recadoDoErroProto = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'O Claude que desenha as telas ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; por enquanto, não há nada que você precise refazer.'
    case 'pedido-vazio': return 'Escreva ou fale o que você quer mudar.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

/** Preview do celular: o HTML (gerado/importado, NÃO confiável) só vive dentro de um iframe com sandbox vazio. Nunca no DOM do app. */
export function CelularPreview({ html, titulo }: { html: string; titulo: string }) {
  const doc = montarSrcDoc(html)
  return (
    <div className="at-proto__celular">
      {doc === null
        ? <div className="at-proto__seguro" role="img" aria-label="Tela grande demais para mostrar">Esta tela é grande demais para eu mostrar aqui com segurança. O Claude vai deixá-la mais leve.</div>
        : <iframe className="at-proto__tela" title={titulo} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer" />}
    </div>
  )
}

/** F07: telas desenhadas com o Claude no estilo escolhido, com o celular ao lado. */
export function Prototipo({ obra, estilo, prototipo, onVoltar, onConcluir }: Props) {
  const [estado, setEstado] = useState<EstadoProto>({ versoes: [], atual: 0 })
  const [aba, setAba] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const iniciou = useRef(false)

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    void (async () => {
      try {
        let e = await prototipo.estado(obra.pasta)
        if (!e.versoes.length) {
          if (!estilo) throw new Error('indisponivel')
          e = await prototipo.desenhar(obra.pasta, obra.nome, estilo)
          setMsgs([{ quem: 'CLAUDE', txt: 'Fiz as primeiras telas no estilo que você escolheu. Dá uma olhada no celular ao lado e me diga o que quer mudar.' }])
        }
        setEstado(e)
        setAba(e.versoes.find((v) => v.numero === e.atual)?.telas[0]?.id ?? '')
      } catch (x) { setErro(recadoDoErroProto(x)) } finally { setPronto(true) }
    })()
  }, [prototipo, obra, estilo])

  const versao = estado.versoes.find((v) => v.numero === estado.atual)
  const tela = versao?.telas.find((t) => t.id === aba) ?? versao?.telas[0]

  return (
    <div className="at-proto">
      <header className="at-proto__cab">
        <div className="at-proto__tit">
          <span className="at-proto__rotulo">Projeto 2 de 3 · Telas{estilo ? ` · Estilo "${estilo.nome}"` : ''}{versao ? ` · Versão ${versao.numero}` : ''}</span>
          <h1>{obra.nome}</h1>
        </div>
        <div className="at-proto__acoes">
          <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
          <Botao disabled={!versao} onClick={() => onConcluir ? onConcluir() : onVoltar()}>Telas do meu jeito: dar o nome →</Botao>
        </div>
      </header>

      {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
      {!pronto && <p role="status">O Claude está desenhando as telas…</p>}

      <div className="at-proto__grade">
        <section className="at-proto__chat" aria-label="Conversa com o Claude">
          <ul className="at-proto__msgs" aria-live="polite">
            {msgs.map((m, i) => (
              <li key={i} className={`at-proto__msg ${m.quem === 'VOCÊ' ? 'at-proto__msg--eu' : ''}`}><b>{m.quem}</b>{m.txt}</li>
            ))}
          </ul>
        </section>
        <section className="at-proto__lado" aria-label="Preview do celular">
          {versao && (
            <div className="at-proto__abas" role="tablist" aria-label="Telas do sistema">
              {versao.telas.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={t.id === tela?.id} className={`at-proto__aba ${t.id === tela?.id ? 'at-proto__aba--on' : ''}`} onClick={() => setAba(t.id)}>{t.nome}</button>
              ))}
            </div>
          )}
          {tela && <CelularPreview html={tela.html} titulo={`Tela ${tela.nome} no celular`} />}
        </section>
      </div>
    </div>
  )
}
