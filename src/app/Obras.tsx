import { useEffect, useState } from 'react'
import type { PonteObras } from './ponte-obras'
import type { EtapaObra } from './fase-obra'
import { ETAPAS_CASA } from './obras-dados'
import { PredioSubindo } from './PredioSubindo'
import './obras.css'

/** Obra começada, como o "Continuar" entrega ao app: a pasta, o nome para mostrar e a etapa em que parou. */
export type ObraParaContinuar = { pasta: string; nome: string; etapa: EtapaObra }

interface Props {
  obras: PonteObras
  /** Não usado aqui desde o Canteiro (Milestone 37); mantido para quem ainda passa. */
  painel?: { ler(pasta: string): Promise<{ pct: number }> }
  /** As obras já começadas estão no Canteiro de obras (Milestone 37): leva para lá. */
  onVerCanteiro?: () => void
  /** Primeiro nome do dono, só para cumprimentar. */
  nome?: string
  /** "Começar do zero" (ou uma ideia): vai para a nova obra, com o nome da ideia se houver. */
  onComecar: (ideia?: string) => void
  /** "Já tenho um protótipo": encaminha ao F06c (milestone 15). */
  onTrazer: () => void
}

/** F05: minhas obras (prototipo/F05Obras). O primeiro passo vem no topo, com o prédio subindo ao lado; a analogia da casa logo
 *  abaixo. Diferente do protótipo por decisão do Luiz (22/11/2026): sem a seção "Ideias para barbearias" (PLAN, Milestone 13). */
export function Obras({ obras, nome = 'Zé', onComecar, onTrazer, onVerCanteiro }: Props) {
  const [feitas, setFeitas] = useState<string[]>([])
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    let vivo = true
    void obras.listar().catch(() => [] as string[]).then((l) => { if (vivo) setFeitas(l) })
    return () => { vivo = false }
  }, [obras])
  const primeira = feitas.length === 0

  const abrir = () => {
    setAviso('')
    obras.abrirPasta().catch(() => setAviso(`Ainda não consigo abrir a pasta por aqui. Ela fica em ${obras.raiz()}.`))
  }

  return (
    <div className="at-obras">
      <header className="at-obras__cab">
        <span className="at-obras__rotulo">NOVA OBRA</span>
        <h1>Tudo pronto, {nome}. Agora vamos construir.</h1>
      </header>

      <div className="at-obras__topo">
        <section className="at-obras__primeira" aria-label={primeira ? 'Comece a sua primeira obra' : 'Comece outra obra'}>
          <span className="at-obras__rotulo at-obras__rotulo--lime">{primeira ? 'PRIMEIRO PASSO: O PROJETO' : 'UMA NOVA OBRA'}</span>
          <h2>{primeira ? 'Comece a sua primeira obra' : 'Comece outra obra'}</h2>
          <p>Conte, com as suas palavras, o que a sua barbearia precisa. O Claude desenha as telas junto com você. Nada é construído antes de você aprovar.</p>
          {!primeira && (
            <p className="at-obras__feitas">
              Você já tem {feitas.length === 1 ? '1 obra' : `${feitas.length} obras`} no Canteiro.{' '}
              {onVerCanteiro && <button type="button" className="at-obras__link" onClick={onVerCanteiro}>Ver o Canteiro de obras</button>}
            </p>
          )}
          <div className="at-obras__acoes">
            <button type="button" className="at-obras__acao at-obras__acao--principal" onClick={() => onComecar()}>Começar do zero →</button>
            <button type="button" className="at-obras__acao" onClick={onTrazer}>Já tenho um protótipo</button>
          </div>
          <span className="at-obras__pasta">
            Cada obra vira um sistema separado, com o seu próprio endereço. Todas ficam guardadas na pasta <b>Atlas\Obras</b>, no seu computador.{' '}
            <button type="button" className="at-obras__link" onClick={abrir}>Abrir a pasta</button>
          </span>
          {aviso && <p className="at-obras__aviso" role="status">{aviso}</p>}
        </section>
        <figure className="at-obras__predio">
          <PredioSubindo />
          <figcaption><b>Este prédio é o seu sistema.</b> Cada andar é uma etapa pronta e conferida. Durante a obra, você vê o seu prédio subir aqui no Atlas.</figcaption>
        </figure>
      </div>

      <section className="at-obras__casa" aria-label="Fazer um sistema é igual construir uma casa">
        <div className="at-obras__casa-cab">
          <h2>Fazer um sistema é igual construir uma casa.</h2>
          <span>Por isso aqui a gente chama de <b>obra</b>. Veja como é parecido:</span>
        </div>
        <ol className="at-obras__etapas">
          {ETAPAS_CASA.map((e) => (
            <li key={e.n} className="at-obras__etapa">
              <div className="at-obras__etapa-cab"><span className="at-obras__bola">{e.n}</span><b>{e.nome}</b></div>
              <div><span className="at-obras__mini">NUMA CASA</span><span className="at-obras__etapa-txt at-obras__etapa-txt--mute">{e.casa}</span></div>
              <hr />
              <div><span className="at-obras__mini at-obras__mini--lime">NO ATLAS</span><span className="at-obras__etapa-txt">{e.atlas}</span></div>
            </li>
          ))}
        </ol>
        <span className="at-obras__nota">Quem trabalha na obra é o <b>Claude</b>: um constrói, outro confere, outro fiscaliza. Você só decide e acompanha.</span>
      </section>
    </div>
  )
}
