import { useEffect, useState } from 'react'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { Configurador } from './Configurador'
import { EntregaApp } from './EntregaApp'
import { modoFixture } from '../app/ativacao-api'
import { criarEntregaFixture, criarEntregaProducao, type PortaEntrega } from './entrega'
import { Entrada } from './Portal'
import type { PortalApi } from './portal-api'
import { prateleira, type SegmentoPronto } from './conteudo'
import type { Personalizacao, PortaPersonalizacao } from './personalizacao'
import './web.css'

type Fase = { fase: 'carregando' } | { fase: 'entrar' } | { fase: 'erro'; mensagem: string } | { fase: 'config'; segmento: SegmentoPronto; inicial: Personalizacao | null } | { fase: 'entrega'; porta: PortaEntrega }

const ehSegmento = (s: unknown): s is SegmentoPronto => prateleira.some((x) => x.segmento === s)

/**
 * Passo pós-compra do app pronto (rota /personalizar): login do Portal (se preciso) -> configurador -> entrega.
 * Só quem comprou um app pronto passa daqui (o servidor confere pela licença do login); a implantação do zero não usa esta rota.
 * `entrega` é a porta do provisionamento: fixture só no modo demo; em produção, "preparando" honesto (app/PENDENTE-ENTREGAR.md).
 */
export function PassoApp({ api, porta, entrega = (p) => (modoFixture() ? criarEntregaFixture(p.nome_negocio) : criarEntregaProducao()) }: { api: PortalApi; porta: PortaPersonalizacao; entrega?: (p: Personalizacao) => PortaEntrega }) {
  const [f, setF] = useState<Fase>({ fase: api.logado() ? 'carregando' : 'entrar' })

  useEffect(() => {
    if (f.fase !== 'carregando') return
    let vivo = true
    porta.ler().then((r) => {
      if (!vivo) return
      if (!r.ok) return setF(api.logado() ? { fase: 'erro', mensagem: r.mensagem } : { fase: 'entrar' })
      if (!ehSegmento(r.segmento)) return setF({ fase: 'erro', mensagem: 'Essa conta não tem um app pronto para personalizar. Se você comprou um, entre com o e-mail da compra.' })
      setF({ fase: 'config', segmento: r.segmento, inicial: r.personalizacao })
    })
    return () => { vivo = false }
  }, [f.fase, porta, api])

  if (f.fase === 'config') {
    return (
      <Configurador
        segmento={f.segmento}
        inicial={f.inicial}
        onSalvar={async (p) => {
          const r = await porta.salvar(p)
          if (!r.ok) return { ok: false, mensagem: r.mensagem }
          setF({ fase: 'entrega', porta: entrega(r.personalizacao ?? p) })
          return { ok: true }
        }}
      />
    )
  }
  if (f.fase === 'entrega') return <EntregaApp porta={f.porta} />

  return (
    <div className="c">
      <header className="c-topo"><Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} /><span>atlas-ia.app.br/personalizar</span></header>
      {f.fase === 'entrar' ? (
        <Entrada api={api} aviso="" onEntrou={() => setF({ fase: 'carregando' })} />
      ) : f.fase === 'erro' ? (
        <main className="p-main"><p role="alert" className="v-erro">{f.mensagem}</p><a className="p-link" href="/conta">Ir para a minha conta</a></main>
      ) : (
        <main className="p-main"><p className="c-lead" role="status">Um instante…</p></main>
      )}
    </div>
  )
}
