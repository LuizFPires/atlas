import { useState } from 'react'
import { Botao, Icone } from '../ui'
import { LateralPassos } from './Ativacao'
import { CartaoPasso, PreviaSite } from './GuiaConta'
import { CONTAS, TEXTO_OPCIONAL, type IdConta } from './contas-passos'
import type { ContaObrigatoria, PonteContas } from './ponte-contas'
import './app.css'
import './claude.css'
import './contas.css'

interface Props {
  contas: PonteContas
  /** Segue para F04b (acompanhar pelo celular). */
  onContinuar: () => void
}

/** F04: abrir as contas (prototipo/F04Contas). GitHub, Supabase e Vercel, uma por vez, um passo por vez. As contas são do próprio cliente. */
export function Contas({ contas, onContinuar }: Props) {
  const [conta, setConta] = useState(0)
  const [passo, setPasso] = useState(0)
  const [feitas, setFeitas] = useState<Partial<Record<IdConta, boolean>>>({})
  const [aviso, setAviso] = useState('')

  const c = CONTAS[conta]
  const p = c.passos[passo]
  const ultimo = passo === c.passos.length - 1
  const fim = ultimo && conta === CONTAS.length - 2 // última conta obrigatória (Vercel)

  const ir = (nova: number) => { setConta(nova); setPasso(0); setAviso('') }

  const avancar = async () => {
    setAviso('')
    if (passo === 0) {
      try { await contas.abrirSite(c.id as ContaObrigatoria) } catch { setAviso(`Não consegui abrir o site do ${c.nome} agora. Abra ele no seu navegador e siga os passos daqui mesmo.`) }
    }
    if (!ultimo) { setPasso(passo + 1); return }
    setFeitas({ ...feitas, [c.id]: true })
    ir(conta + 1)
  }
  const voltar = () => {
    setAviso('')
    if (passo > 0) setPasso(passo - 1)
    else if (conta > 0) ir(conta - 1)
  }

  return (
    <div className="at-ativ-fundo">
      <div className="at-ativ at-contas">
        <LateralPassos agora={4} />
        <section className="at-contas__corpo">
          <div className="at-contas__abas">
            {CONTAS.map((x, i) => (
              <button key={x.id} type="button" className={`at-contas__aba ${i === conta ? 'at-contas__aba--atual' : ''} ${feitas[x.id] ? 'at-contas__aba--feita' : ''}`} aria-current={i === conta ? 'step' : undefined} onClick={() => ir(i)}>
                <span className="at-contas__aba-bola">{feitas[x.id] ? <Icone nome="check" tamanho={12} /> : i + 1}</span>
                {x.nome}
              </button>
            ))}
          </div>
          <div className="at-contas__grade">
            <div className="at-claude__col">
              <div className="at-claude__cab">
                <span className="at-claude__rotulo">CONTA {conta + 1} DE {CONTAS.length} · {c.nome.toUpperCase()}</span>
                <h1>{c.oque}</h1>
                <span className="at-ativ__txt">{c.porque}</span>
              </div>

              {!c.opcional && (
                <>
                  <CartaoPasso passo={p} n={passo + 1} total={c.passos.length} />
                  <div className="at-ativ__rodape at-claude__acoes">
                    <Botao variante="secundario" onClick={voltar} disabled={conta === 0 && passo === 0}>← Voltar</Botao>
                    {fim ? <Botao onClick={onContinuar}>Último passo →</Botao> : <Botao onClick={() => void avancar()}>{passo === 0 ? 'Abrir o site →' : ultimo ? 'Próxima conta →' : 'Fiz isso →'}</Botao>}
                  </div>
                  {aviso && <p className="at-ativ__erro" role="alert">{aviso}</p>}
                </>
              )}

              {c.opcional && (
                <>
                  <div className="at-contas__opcional">
                    <b>{TEXTO_OPCIONAL.titulo}</b>
                    <span className="at-ativ__txt">{TEXTO_OPCIONAL.texto}</span>
                  </div>
                  <div className="at-ativ__rodape at-claude__acoes">
                    <Botao onClick={onContinuar}>Último passo →</Botao>
                    <span className="at-ativ__txt">{TEXTO_OPCIONAL.nota}</span>
                  </div>
                </>
              )}
            </div>
            <PreviaSite site={p.site} />
          </div>
        </section>
      </div>
    </div>
  )
}
