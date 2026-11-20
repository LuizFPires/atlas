import { useEffect, useState } from 'react'
import { Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import type { EstadoEntrega, PortaEntrega } from './entrega'
import './web.css'

/** Entrega do app pronto (F18c): "seu app está no ar", link, instalar no celular e como instalar. */
export function EntregaApp({ porta }: { porta: PortaEntrega }) {
  const [e, setE] = useState<EstadoEntrega | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    porta.estado().then((r) => { if (vivo) setE(r) }, () => { if (vivo) setE({ estado: 'falhou', mensagem: 'Sem conexão com o servidor. Veja a sua internet e tente de novo.' }) })
    return () => { vivo = false }
  }, [porta])

  const copiar = async (link: string) => {
    try { await navigator.clipboard.writeText(link); setCopiado(true) } catch { setCopiado(false) }
  }
  const host = (link: string) => link.replace(/^https?:\/\//, '')

  return (
    <div className="c">
      <header className="c-topo"><Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} /><b className="cf-topo-titulo">Pronto!</b></header>
      <main className="en-corpo">
        {!e && <p className="c-lead" role="status">Um instante…</p>}
        {e?.estado === 'montando' && (
          <>
            <h1>Estamos montando o seu app.</h1>
            <p className="c-lead" role="status">Isso leva só um pouquinho. Assim que ficar pronto, o link aparece aqui.</p>
          </>
        )}
        {e?.estado === 'falhou' && (
          <>
            <h1>Não deu para mostrar o seu app agora.</h1>
            <p role="alert" className="v-erro">{e.mensagem}</p>
            <p className="c-lead">Nada se perdeu: o que você escolheu está guardado. Tente de novo em instantes ou peça ajuda à Ajuda do Atlas.</p>
          </>
        )}
        {e?.estado === 'pronto' && (
          <>
            <span className="en-selo"><Icone nome="check" tamanho={40} /></span>
            <h1>O app da {e.nome} está no ar.</h1>
            <p className="c-lead">Ele é seu: fica na sua conta, com o seu nome e a sua marca. Instale no celular e já comece a usar.</p>

            <div className="en-link">
              <Icone nome="clipe" tamanho={22} />
              <span className="en-link-txt">{host(e.link)}</span>
              <button type="button" className="p-link en-copiar" onClick={() => copiar(e.link)}>{copiado ? 'copiado' : 'copiar'}</button>
            </div>

            <div className="en-acoes">
              <a className="v-acao" href={e.link} target="_blank" rel="noopener noreferrer"><Icone nome="celular" />Instalar no celular</a>
              <a className="v-acao v-acao--contorno" href="/app"><Icone nome="obra" />Mudar no Atlas</a>
            </div>

            <div className="en-como">
              <span className="cf-rot">Como instalar no celular</span>
              <div><b>Android</b><span>abra o link e toque em "Instalar".</span></div>
              <div><b>iPhone</b><span>abra no Safari, toque em Compartilhar e "Adicionar à Tela de Início".</span></div>
            </div>
          </>
        )}
      </main>
      <footer className="cf-rodape"><span>Atlas · Comece pronto</span><span>Tela 3 de 3 · entrega</span></footer>
    </div>
  )
}
