import { useState } from 'react'
import { textoDaTrava } from './explicar-trava'
import { Botao, Icone } from '../ui'
import canteiroImagem from '../assets/canteiro-3d.jpg'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { textoDaObra } from './ponte-cota'
import { quandoParou, saudacao, type ObraParada, type PonteRetomar } from './ponte-retomar'
import './retomar.css'

interface Props {
  obra: ObraParada
  /** M37: as outras obras que também pararam (a de `obra` é a mais recente). Com elas, o botão vira "Continuar todas". */
  outras?: ObraParada[]
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
export function Retomar({ obra, outras = [], nome, retomar, onContinuou, onAgoraNao, agora = () => new Date() }: Props) {
  const [ligando, setLigando] = useState(false)
  const [falhou, setFalhou] = useState('')
  const quando = quandoParou(obra.paradaEm, agora())
  const varias = outras.length > 0
  const etapa = obra.etapa ? `M${obra.etapa.n} ${textoDaObra(obra.etapa.nome, 60)}` : null

  const continuar = async () => {
    if (ligando) return
    setLigando(true)
    setFalhou('')
    try {
      for (const o of [obra, ...outras]) await retomar.continuar(o)
      onContinuou(obra)
    } catch (e) {
      setFalhou(textoDaTrava(e, 'Não consegui religar a obra.'))
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
          {varias
            ? <h1>{`Suas ${outras.length + 1} obras pararam ${quando ?? ''}`.trimEnd()}, quando o computador foi desligado.</h1>
            : <h1>{quando ? `Sua obra parou ${quando}, quando o computador foi desligado.` : 'Sua obra ficou parada quando o computador foi desligado.'}</h1>}
          <div className="at-rt__info">
            {varias
              ? <ul className="at-rt__lista">{[obra, ...outras].map((o) => <li key={o.pasta}><b>{textoDaObra(o.nome, 80)}</b><span>{Math.round(o.pct)}%</span></li>)}</ul>
              : <span><b>{textoDaObra(obra.nome, 80)}</b> · {Math.round(obra.pct)}%{etapa ? ` · ${etapa}` : ''}</span>}
            <span className="at-rt__ok"><Icone nome="check" tamanho={14} /> {varias ? 'Nada se perdeu. Cada uma continua exatamente dali.' : 'Nada se perdeu. Ela continua exatamente dali.'}</span>
          </div>
          <Botao className="at-rt__btn" onClick={() => { void continuar() }} disabled={ligando}>
            <Icone nome="play" tamanho={18} />
            {ligando ? (varias ? 'Religando as obras…' : 'Religando a obra…') : (varias ? 'Continuar todas' : 'Continuar obra')}
          </Botao>
          {falhou && <p className="at-rt__nota" role="status">{falhou}</p>}
          <button type="button" className="at-rt__link" onClick={onAgoraNao}>Agora não</button>
        </div>
      </div>
      <span className="at-rt__rodape">Enquanto o Atlas estiver fechado, a obra espera. Ela continua quando você abre o Atlas pelo ícone e toca em Continuar.</span>
    </div>
  )
}
