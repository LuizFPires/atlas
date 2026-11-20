import { useEffect, useState } from 'react'
import { Icone } from '../ui'
import { ROTULO_ESTADO, type EstadoObra, type ObraStatus, type PonteStatusObras } from './obras-status'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const tom = (e: EstadoObra) => (e === 'aguardando_aprovacao' || e === 'pausada' ? ' p-selo--aviso' : '')

/** "Minhas obras" (M30): lista as obras do dono e abre o detalhe. Só mostra o resumo de status que a porta entrega. */
export function MinhasObras({ ponte }: { ponte: PonteStatusObras }) {
  const [obras, setObras] = useState<ObraStatus[] | null>(null)
  const [erro, setErro] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ponte.listarObras().then((o) => { if (vivo) setObras(o) }, () => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [ponte])

  const obra = obras?.find((o) => o.id === aberta)
  if (obra) return <DetalheObra obra={obra} onVoltar={() => setAberta(null)} />

  return (
    <section className="p-card" aria-labelledby="p-ob">
      <span className="v-mono p-rotulo" id="p-ob">Minhas obras</span>
      {erro && <p role="alert" className="v-erro">Não consegui buscar as suas obras agora. Tente de novo daqui a pouco.</p>}
      {!erro && !obras && <p className="c-mute p-p" role="status">Buscando as suas obras…</p>}
      {obras && obras.length === 0 && <p className="c-mute p-p">Você ainda não tem obras por aqui. Quando o seu computador começar uma, ela aparece nesta lista.</p>}
      <ul className="ob-lista">
        {obras?.map((o) => (
          <li key={o.id}>
            <button type="button" className="ob-item" onClick={() => setAberta(o.id)} aria-label={`Abrir a obra ${o.nome}`}>
              <span className="ob-topo">
                <b>{o.nome}</b>
                <span className={`p-selo${tom(o.estado)}`}>● {ROTULO_ESTADO[o.estado]}</span>
              </span>
              {o.ativa_agora && <span className="ob-agora"><Icone nome="martelo" tamanho={16} /> Sendo construída agora</span>}
              <Barra pct={o.percentual} nome={o.nome} />
              <span className="c-mute ob-etapa">Etapa {o.etapa_atual.numero} de {o.total_etapas}: {o.etapa_atual.rotulo}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Barra({ pct, nome }: { pct: number; nome: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <span className="ob-barra-linha">
      <span className="ob-barra" role="progressbar" aria-label={`Andamento de ${nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}><span style={{ width: `${v}%` }} /></span>
      <b className="v-mono ob-pct">{v}%</b>
    </span>
  )
}

/**
 * Prédio em 3D (isométrico) que sobe com o andamento: um andar por etapa, acesos até onde a obra chegou.
 * Decisão: o Canteiro real (cena3d.js, Three.js) é código do kit e `three` não é dependência do front web; embutir a cena viva
 * é pendência de /entregar junto do adaptador. Aqui o celular mostra o prédio em SVG isométrico (3D), sem peso extra.
 */
export function PredioSubindo({ obra }: { obra: ObraStatus }) {
  const andares = Math.max(1, Math.min(obra.total_etapas, 12))
  const feitos = Math.round((obra.percentual / 100) * andares)
  const H = 26, W = 44, X0 = 130, Y0 = 210
  const topo = Y0 - andares * H - W / 3
  return (
    <svg className="ob-predio" viewBox={`0 ${topo - 20} 260 ${Y0 - topo + 50}`} role="img" aria-label={`Prédio em 3D com ${feitos} de ${andares} andares prontos`} data-feitos={feitos} data-andares={andares}>
      <polygon points={`${X0 - W - 14},${Y0 - 4} ${X0},${Y0 + 24} ${X0 + W + 14},${Y0 - 4} ${X0},${Y0 - 32}`} fill="var(--card2, #1e2125)" stroke="var(--card-b, #333)" />
      {Array.from({ length: andares }, (_, i) => {
        const yb = Y0 - i * H
        const pronto = i < feitos
        const cor = pronto ? 'var(--lime, #c6f135)' : 'var(--card, #26292e)'
        const d = W / 3
        return (
          <g key={i} data-pronto={pronto}>
            <polygon points={`${X0 - W},${yb - d} ${X0},${yb} ${X0},${yb - H} ${X0 - W},${yb - H - d}`} fill={cor} stroke="var(--card-b, #333)" opacity={pronto ? 0.95 : 0.6} />
            <polygon points={`${X0},${yb} ${X0 + W},${yb - d} ${X0 + W},${yb - H - d} ${X0},${yb - H}`} fill={cor} stroke="var(--card-b, #333)" opacity={pronto ? 0.7 : 0.4} />
          </g>
        )
      })}
    </svg>
  )
}

function DetalheObra({ obra, onVoltar }: { obra: ObraStatus; onVoltar: () => void }) {
  const etapas = Array.from({ length: obra.total_etapas }, (_, i) => i + 1)
  return (
    <section className="p-card ob-detalhe" aria-labelledby="p-obd">
      <button type="button" className="p-link" onClick={onVoltar}>← Voltar para as obras</button>
      <h2 id="p-obd" className="ob-nome">{obra.nome}</h2>
      <span className="ob-topo">
        <span className={`p-selo${tom(obra.estado)}`}>● {ROTULO_ESTADO[obra.estado]}</span>
        {obra.ativa_agora && <span className="ob-agora"><Icone nome="martelo" tamanho={16} /> Sendo construída agora</span>}
      </span>
      <Barra pct={obra.percentual} nome={obra.nome} />
      <div className="ob-canteiro">
        <PredioSubindo obra={obra} />
        <span className="v-mono p-rotulo">Canteiro 3D · o prédio sobe a cada etapa pronta</span>
      </div>
      <span className="v-mono p-rotulo">Linha do tempo</span>
      <ol className="ob-tempo" aria-label="Etapas da obra">
        {etapas.map((n) => {
          const st = n < obra.etapa_atual.numero || obra.percentual >= 100 ? 'feita' : n === obra.etapa_atual.numero ? 'atual' : 'depois'
          return (
            <li key={n} className={`ob-et ob-et--${st}`} aria-current={st === 'atual' ? 'step' : undefined}>
              <span className="ob-bola">{st === 'feita' ? <Icone nome="check" tamanho={14} /> : n}</span>
              <span>{n === obra.etapa_atual.numero ? obra.etapa_atual.rotulo : `Etapa ${n}`}{st === 'feita' ? ' (pronta)' : st === 'atual' ? ' (agora)' : ''}</span>
            </li>
          )
        })}
      </ol>
      <div className="p-liberada">
        <b>Última notícia</b>
        <span>{obra.ultima_noticia}</span>
        <small className="c-mute">{quando(obra.quando)}</small>
      </div>
    </section>
  )
}
