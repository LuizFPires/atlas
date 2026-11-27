import { Botao, Icone } from '../ui'
import { Esperando } from '../ui/Progresso'
import type { ContaLigavel, SituacaoContas } from './ponte-ligar-contas'
import './contas-prontas.css'

/*
 * Contas já prontas (Luiz, 27/11/2026): "se ele já tiver desenvolvido algo com o Atlas, o segundo app precisa entender que o
 * primeiro já passou pelas etapas de conta". Antes de mostrar o passo a passo de criar contas, o Atlas pergunta às próprias contas
 * se elas já estão ligadas a este computador. Todas ligadas: esta tela, com um clique para seguir. Faltando alguma: o passo a passo
 * começa direto na que falta.
 */

const NOMES: Record<ContaLigavel, { nome: string; papel: string }> = {
  github: { nome: 'GitHub', papel: 'onde fica guardado o código' },
  supabase: { nome: 'Supabase', papel: 'onde ficam os dados' },
  hosp: { nome: 'Vercel', papel: 'onde o sistema fica no ar' },
}
const ORDEM: ContaLigavel[] = ['github', 'supabase', 'hosp']

/** Todas as contas obrigatórias já estão ligadas neste computador? */
export const todasLigadas = (s: SituacaoContas | null | undefined): boolean => Boolean(s && ORDEM.every((c) => s[c]?.ligado))

export function ConferindoContas() {
  return (
    <main className="at-cprontas">
      <section className="at-cprontas__card" role="status">
        <span className="at-cprontas__rot">5 · AS CONTAS</span>
        <b className="at-cprontas__tit">Conferindo as suas contas…</b>
        <Esperando rotulo="Conferindo as contas" agora="Perguntando ao GitHub, ao Supabase e à Vercel" costume={[2, 10]} />
      </section>
    </main>
  )
}

export function ContasProntas({ situacao, onContinuar, onOutras, onVoltar }: { situacao: SituacaoContas; onContinuar: () => void; onOutras: () => void; onVoltar?: () => void }) {
  return (
    <main className="at-cprontas">
      <section className="at-cprontas__card at-cprontas__card--ok">
        <span className="at-cprontas__rot at-cprontas__rot--ok">5 · AS CONTAS · JÁ ESTÁ TUDO PRONTO</span>
        <b className="at-cprontas__tit">As suas contas já estão ligadas neste computador.</b>
        <span className="at-cprontas__txt">Você já fez esta etapa numa obra anterior. Esta obra usa as mesmas contas: não precisa criar nem ligar nada de novo.</span>
        <ul className="at-cprontas__lista">
          {ORDEM.map((c) => (
            <li key={c}>
              <span className="at-cprontas__ok" aria-hidden="true"><Icone nome="check" tamanho={14} /></span>
              <span><span><b>{NOMES[c].nome}</b><span className="at-cprontas__mudo">{situacao[c].usuario ? ` · ligado como ${situacao[c].usuario}` : ' · ligado'}</span></span><small>{NOMES[c].papel}</small></span>
            </li>
          ))}
        </ul>
        <span className="at-cprontas__nota">Pagamentos (Stripe ou Asaas) ficam para depois, só se você for vender o sistema.</span>
        <div className="at-cprontas__acoes">
          {onVoltar && <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>}
          <Botao onClick={onContinuar}>Continuar →</Botao>
        </div>
        <button type="button" className="at-cprontas__link" onClick={onOutras}>Quero usar outras contas nesta obra</button>
      </section>
    </main>
  )
}
