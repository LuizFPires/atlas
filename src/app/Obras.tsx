import { useEffect, useState } from 'react'
import type { PonteObras } from './ponte-obras'
import { ETAPAS_CASA, IDEIAS } from './obras-dados'
import './obras.css'

interface Props {
  obras: PonteObras
  /** Primeiro nome do dono, só para cumprimentar. */
  nome?: string
  /** "Começar do zero" (ou uma ideia): vai para a nova obra, com o nome da ideia se houver. */
  onComecar: (ideia?: string) => void
  /** "Já tenho um protótipo": encaminha ao F06c (milestone 15). */
  onTrazer: () => void
}

/** F05: minhas obras (prototipo/F05Obras). Analogia da casa, um botão claro para a primeira obra (u05) e ideias de sistemas. */
export function Obras({ obras, nome = 'Zé', onComecar, onTrazer }: Props) {
  const [feitas, setFeitas] = useState<string[]>([])
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    let vivo = true
    obras.listar().then((l) => { if (vivo) setFeitas(l) }).catch(() => {})
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
        <span className="at-obras__rotulo">MINHAS OBRAS</span>
        <h1>Tudo pronto, {nome}. Agora vamos construir.</h1>
      </header>

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

      <div className="at-obras__baixo">
        <section className="at-obras__primeira">
          <span className="at-obras__rotulo at-obras__rotulo--lime">{primeira ? 'PRIMEIRO PASSO: O PROJETO' : 'UMA NOVA OBRA'}</span>
          <h2>{primeira ? 'Comece a sua primeira obra' : 'Comece outra obra'}</h2>
          <p>Conte, com as suas palavras, o que a sua barbearia precisa. O Claude desenha as telas junto com você. Nada é construído antes de você aprovar.</p>
          {!primeira && <p className="at-obras__feitas">Já tem {feitas.length === 1 ? '1 obra começada' : `${feitas.length} obras começadas`}: {feitas.join(', ')}.</p>}
          <div className="at-obras__acoes">
            <button type="button" className="at-obras__acao at-obras__acao--principal" onClick={() => onComecar()}>Começar do zero →</button>
            <button type="button" className="at-obras__acao" onClick={onTrazer}>Já tenho um protótipo</button>
          </div>
        </section>

        <section className="at-obras__ideias">
          <span className="at-obras__rotulo">IDEIAS PARA BARBEARIAS · ESCOLHA UMA PARA COMEÇAR</span>
          <div className="at-obras__grade">
            {IDEIAS.map((i) => (
              <button key={i.nome} type="button" className="at-obras__ideia" onClick={() => onComecar(i.nome)}><b>{i.nome}</b><span>{i.desc}</span></button>
            ))}
          </div>
          <span className="at-obras__pasta">
            Cada obra vira um sistema separado, com o seu próprio endereço. Todas ficam guardadas na pasta <b>Atlas\Obras</b>, no seu computador.{' '}
            <button type="button" className="at-obras__link" onClick={abrir}>Abrir a pasta</button>
          </span>
          {aviso && <p className="at-obras__aviso" role="status">{aviso}</p>}
        </section>
      </div>
    </div>
  )
}
