import { useState } from 'react'
import { ehMac } from './plataforma'
import { Botao, Icone } from '../ui'
import canteiroImagem from '../assets/canteiro-3d.jpg'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { textoDaObra } from './ponte-cota'
import { quandoParou, saudacao, type ObraParada, type PonteRetomar } from './ponte-retomar'
import './retomar.css'

interface Props {
  obra: ObraParada
  /** Primeiro nome do cliente. */
  nome?: string
  retomar: PonteRetomar
  /** A linha de produção foi religada: vai para o painel rodando. */
  onContinuou: (obra: ObraParada) => void
  /** "Agora não": vai para Minhas obras. */
  onAgoraNao: () => void
  agora?: () => Date
}

/**
 * F12: ao ligar o computador o Atlas abre aqui. UM botão claro ("Continuar obra"): um clique religa a linha de produção e leva ao
 * painel rodando (no máximo 2 cliques, exigência do milestone). "Agora não" só leva a Minhas obras; nada é perdido.
 */
export function Retomar({ obra, nome, retomar, onContinuou, onAgoraNao, agora = () => new Date() }: Props) {
  const [ligando, setLigando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const quando = quandoParou(obra.paradaEm, agora())
  const etapa = obra.etapa ? `M${obra.etapa.n} ${textoDaObra(obra.etapa.nome, 60)}` : null

  const continuar = async () => {
    if (ligando) return
    setLigando(true)
    setFalhou(false)
    try {
      await retomar.continuar(obra)
      onContinuou(obra)
    } catch {
      setFalhou(true)
      setLigando(false)
    }
  }

  return (
    <div className="at-rt">
      <div className="at-rt__marca"><Monograma largura={62} altura={34} /><NomeAtlas largura={150} altura={22} /></div>
      <div className="at-rt__card">
        <img className="at-rt__cena" src={canteiroImagem} alt="Canteiro 3D da obra, parado onde ficou" />
        <div className="at-rt__corpo">
          <span className="at-rt__rotulo">{saudacao(agora().getHours(), nome ?? '')}</span>
          <h1>{quando ? `Sua obra parou ${quando}, quando o computador foi desligado.` : 'Sua obra ficou parada quando o computador foi desligado.'}</h1>
          <div className="at-rt__info">
            <span><b>{textoDaObra(obra.nome, 80)}</b> · {Math.round(obra.pct)}%{etapa ? ` · ${etapa}` : ''}</span>
            <span className="at-rt__ok"><Icone nome="check" tamanho={14} /> Nada se perdeu. Ela continua exatamente dali.</span>
          </div>
          <Botao className="at-rt__btn" onClick={() => { void continuar() }} disabled={ligando}>
            <Icone nome="play" tamanho={18} />
            {ligando ? 'Religando a obra…' : 'Continuar obra'}
          </Botao>
          {falhou && <p className="at-rt__nota" role="status">Não consegui religar agora. Sem pressa: toque em Continuar obra de novo, ou chame a Ajuda do Atlas.</p>}
          <button type="button" className="at-rt__link" onClick={onAgoraNao}>Agora não</button>
        </div>
      </div>
      <span className="at-rt__rodape">{ehMac() ? 'O Atlas abre sozinho quando você liga o computador. Para desligar isso: Ajustes do Sistema → Geral → Itens de Início.' : 'O Atlas abre sozinho quando você liga o computador. Para desligar isso: Configurações → Abrir com o Windows.'}</span>
    </div>
  )
}
