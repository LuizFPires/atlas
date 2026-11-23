// Cortesia ou teste vencido: o Atlas inteiro trava. Só este aviso, no meio da tela, com um botão só: comprar.
// Sem menu, sem microfone, sem Ajuda. A conferência da licença continua por baixo e destrava sozinha quando o pagamento cai.
import type { Encerrado } from './licenca-no-app'
import './acesso-encerrado.css'

export function AcessoEncerrado({ encerrado, onComprar }: { encerrado: Encerrado; onComprar: () => void }) {
  const teste = encerrado.rotulo === 'TESTE GRÁTIS'
  return (
    <main className="at-encerrado">
      <section className="at-encerrado__cartao" role="alertdialog" aria-modal="true" aria-labelledby="at-encerrado-titulo" aria-describedby="at-encerrado-texto">
        <svg className="at-encerrado__marca" viewBox="0 0 48 48" aria-hidden="true">
          <rect x="11" y="21" width="26" height="19" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M17 21v-5a7 7 0 0 1 14 0v5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="30.5" r="2.5" fill="currentColor" />
        </svg>
        <p className="at-encerrado__rotulo">{encerrado.rotulo}</p>
        <h1 id="at-encerrado-titulo" className="at-encerrado__titulo">{encerrado.titulo}</h1>
        <p id="at-encerrado-texto" className="at-encerrado__texto">
          {teste ? 'O seu teste grátis do Atlas chegou ao fim.' : 'A sua cortesia do Atlas chegou ao fim.'} Para continuar construindo, fique com o Atlas.
          As suas obras estão guardadas neste computador e voltam do mesmo ponto assim que o pagamento for confirmado.
        </p>
        <button type="button" className="at-encerrado__comprar" onClick={onComprar} autoFocus>Quero o Atlas</button>
      </section>
    </main>
  )
}
