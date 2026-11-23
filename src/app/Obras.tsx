import { useEffect, useState } from 'react'
import type { PonteObras } from './ponte-obras'
import { faseDaObra, nomeDaPasta, type EtapaObra, type FaseObra } from './fase-obra'
import { ETAPAS_CASA } from './obras-dados'
import { PredioSubindo } from './PredioSubindo'
import './obras.css'

/** Obra começada, como o "Continuar" entrega ao app: a pasta, o nome para mostrar e a etapa em que parou. */
export type ObraParaContinuar = { pasta: string; nome: string; etapa: EtapaObra }

interface Props {
  obras: PonteObras
  /** Só para o % das obras em construção. */
  painel?: { ler(pasta: string): Promise<{ pct: number }> }
  /** "Continuar" num cartão: leva a obra à etapa em que parou. Sem ele, os cartões não aparecem. */
  onContinuar?: (o: ObraParaContinuar) => void
  /** Primeiro nome do dono, só para cumprimentar. */
  nome?: string
  /** "Começar do zero" (ou uma ideia): vai para a nova obra, com o nome da ideia se houver. */
  onComecar: (ideia?: string) => void
  /** "Já tenho um protótipo": encaminha ao F06c (milestone 15). */
  onTrazer: () => void
}

/** F05: minhas obras (prototipo/F05Obras). O primeiro passo vem no topo, com o prédio subindo ao lado; a analogia da casa logo
 *  abaixo. Diferente do protótipo por decisão do Luiz (22/11/2026): sem a seção "Ideias para barbearias" (PLAN, Milestone 13). */
export function Obras({ obras, painel, nome = 'Zé', onComecar, onTrazer, onContinuar }: Props) {
  const [feitas, setFeitas] = useState<string[]>([])
  const [fases, setFases] = useState<{ pasta: string; fase: FaseObra }[] | null>(null)
  const [aba, setAba] = useState<'andamento' | 'concluidas'>('andamento')
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    let vivo = true
    void (async () => {
      const l = await obras.listar().catch(() => [] as string[])
      if (!vivo) return
      setFeitas(l)
      if (!obras.situacao || !onContinuar) return
      const lidas: { pasta: string; fase: FaseObra }[] = []
      for (const pasta of l.slice(0, 50)) {
        const s = await obras.situacao(pasta).catch(() => null)
        if (!s) continue
        const pct = s.plano && painel ? await painel.ler(pasta).then((e) => e.pct, () => null) : null
        lidas.push({ pasta, fase: faseDaObra(s, pct) })
      }
      if (vivo) setFases(lidas)
    })()
    return () => { vivo = false }
  }, [obras, painel, onContinuar])
  const primeira = feitas.length === 0
  const andamento = (fases ?? []).filter((f) => !f.fase.concluida)
  const concluidas = (fases ?? []).filter((f) => f.fase.concluida)
  const mostradas = aba === 'andamento' ? andamento : concluidas

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

      <div className="at-obras__topo">
        <section className="at-obras__primeira" aria-label={primeira ? 'Comece a sua primeira obra' : 'Comece outra obra'}>
          <span className="at-obras__rotulo at-obras__rotulo--lime">{primeira ? 'PRIMEIRO PASSO: O PROJETO' : 'UMA NOVA OBRA'}</span>
          <h2>{primeira ? 'Comece a sua primeira obra' : 'Comece outra obra'}</h2>
          <p>Conte, com as suas palavras, o que a sua barbearia precisa. O Claude desenha as telas junto com você. Nada é construído antes de você aprovar.</p>
          {!primeira && !fases && <p className="at-obras__feitas">Já tem {feitas.length === 1 ? '1 obra começada' : `${feitas.length} obras começadas`}: {feitas.join(', ')}.</p>}
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

      {fases && fases.length > 0 && (
        <section className="at-obras__lista" aria-label="Suas obras">
          <div className="at-obras__lista-cab">
            <h2>Suas obras</h2>
            <div className="at-obras__abas" role="tablist" aria-label="Filtrar obras">
              <button type="button" role="tab" aria-selected={aba === 'andamento'} className="at-obras__aba" onClick={() => setAba('andamento')}>Em andamento ({andamento.length})</button>
              <button type="button" role="tab" aria-selected={aba === 'concluidas'} className="at-obras__aba" onClick={() => setAba('concluidas')}>Concluídas ({concluidas.length})</button>
            </div>
          </div>
          {mostradas.length === 0
            ? <p className="at-obras__vazio">{aba === 'andamento' ? 'Nenhuma obra em andamento agora.' : 'Nenhuma obra pronta ainda. Quando a primeira ficar pronta, ela aparece aqui.'}</p>
            : (
              <div className="at-obras__cartoes" role="tabpanel">
                {mostradas.map(({ pasta, fase }) => {
                  const n = nomeDaPasta(pasta)
                  return (
                    <article key={pasta} className="at-obras__cartao" aria-label={n}>
                      <span className="at-obras__cartao-rot">{fase.concluida ? 'PRONTA' : fase.etapa === 'obra' ? 'EM CONSTRUÇÃO' : 'NO PROJETO'}</span>
                      <h3 title={pasta}>{n}</h3>
                      <p className="at-obras__cartao-fase">{fase.rotulo}</p>
                      {fase.pct !== undefined && <div className="at-obras__barra" aria-hidden="true"><span style={{ width: `${fase.pct}%` }} /></div>}
                      <button type="button" className="at-obras__acao at-obras__acao--principal at-obras__continuar" onClick={() => onContinuar?.({ pasta, nome: n, etapa: fase.etapa })}>{fase.concluida ? 'Abrir →' : 'Continuar →'}</button>
                    </article>
                  )
                })}
              </div>
            )}
        </section>
      )}

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
