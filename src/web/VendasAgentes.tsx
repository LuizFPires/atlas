// Página de vendas: como o Atlas trabalha por dentro (pedido do Luiz, 22/11/2026).
// Mostra o mestre de obras coordenando especialistas que começam com a "mesa limpa" e compara quanto o Claude lê para
// construir um app de agendamento sozinho, numa conversa longa, e pelo Atlas. Os números vêm de tokens.ts (conta testada).
import { Icone, type NomeIcone } from '../ui/Icone'
import { emMilhoes, ESTIMATIVA_AGENDAMENTO, estimarTokens } from './tokens'

const EQUIPE: Array<{ nome: string; icone: NomeIcone }> = [
  { nome: 'Arquiteta', icone: 'paleta' },
  { nome: 'Eng. de planejamento', icone: 'livro' },
  { nome: 'Equipe de execução', icone: 'martelo' },
  { nome: 'Inspetor de qualidade', icone: 'check' },
  { nome: 'Técnico de segurança', icone: 'escudo' },
  { nome: 'Eng. de desempenho', icone: 'raio' },
  { nome: 'Despachante', icone: 'pasta' },
  { nome: 'Vistoriador', icone: 'olho' },
]

const ROTULO = 'Mestre de obras no centro, ligado a cada especialista: Arquiteta, Eng. de planejamento, Equipe de execução, Inspetor de qualidade, Técnico de segurança, Eng. de desempenho, Despachante e Vistoriador.'

/** Computador: especialistas em volta do mestre. Celular: mestre em cima e especialistas em duas colunas (texto legível). */
function Desenho({ celular = false }: { celular?: boolean }) {
  const C = celular ? { x: 180, y: 62 } : { x: 340, y: 215 }
  const nos = EQUIPE.map((p, i) => {
    if (celular) return { ...p, x: i % 2 === 0 ? 92 : 268, y: 178 + Math.floor(i / 2) * 96 }
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / EQUIPE.length
    return { ...p, x: C.x + 255 * Math.cos(a), y: C.y + 150 * Math.sin(a) }
  })
  return (
    <svg className={`v-ag-desenho ${celular ? 'v-ag-desenho--cel' : 'v-ag-desenho--pc'}`} viewBox={celular ? '0 0 360 520' : '0 0 680 440'} role="img" aria-label={ROTULO}>
      {celular ? (
        <>
          <line x1={C.x} y1={C.y} x2={C.x} y2={nos[nos.length - 1].y} className="v-ag-linha" />
          {nos.map((n) => <line key={`l-${n.nome}`} x1={C.x} y1={n.y} x2={n.x} y2={n.y} className="v-ag-linha" />)}
        </>
      ) : nos.map((n) => <line key={`l-${n.nome}`} x1={C.x} y1={C.y} x2={n.x} y2={n.y} className="v-ag-linha" />)}
      {nos.map((n) => (
        <g key={n.nome}>
          <circle cx={n.x} cy={n.y} r={28} className="v-ag-no" />
          <Icone nome={n.icone} tamanho={22} x={n.x - 11} y={n.y - 11} className="v-ag-ic" />
          <text x={n.x} y={n.y + 46} textAnchor="middle" className="v-ag-txt">{n.nome}</text>
        </g>
      ))}
      <circle cx={C.x} cy={C.y} r={54} className="v-ag-centro" />
      <Icone nome="obra" tamanho={26} x={C.x - 13} y={C.y - 30} className="v-ag-ic-centro" />
      <text x={C.x} y={C.y + 12} textAnchor="middle" className="v-ag-txt-centro">Mestre</text>
      <text x={C.x} y={C.y + 26} textAnchor="middle" className="v-ag-txt-centro">de obras</text>
    </svg>
  )
}

export function VendasAgentes() {
  const e = estimarTokens(ESTIMATIVA_AGENDAMENTO)
  const p = ESTIMATIVA_AGENDAMENTO
  const pctAtlas = Math.round((e.atlas / e.sozinho) * 100)
  return (
    <section id="por-dentro" className="v-sec" aria-label="Como o Atlas trabalha por dentro">
      <div className="v-cab">
        <span className="v-mono">Por dentro do canteiro</span>
        <h2>O mestre de obras não carrega a obra inteira na cabeça.</h2>
        <p>Numa obra de verdade, o mestre não assenta tijolo, não faz a elétrica e não confere o prumo sozinho. Ele chama quem sabe, na hora certa, e só cobra o resultado. O Atlas trabalha assim.</p>
      </div>

      <div className="v-ag-duas">
        <div><Desenho /><Desenho celular /></div>
        <ol className="v-ag-passos">
          <li><b>O mestre lê só o plano.</b><span>Ele sabe em que etapa a obra está e chama o especialista da vez.</span></li>
          <li><b>Cada especialista começa com a mesa limpa.</b><span>Recebe só a etapa dele, não a conversa inteira da obra.</span></li>
          <li><b>Entrega um relatório curto e sai.</b><span>O mestre guarda só o resumo. O resto fica salvo no plano e no GitHub, não na memória.</span></li>
          <li><b>Toda etapa passa por três revisões.</b><span>Qualidade, segurança e desempenho, antes de o andar subir.</span></li>
        </ol>
      </div>

      <div className="v-ag-conta">
        <div className="v-cab">
          <h3>Por que isso economiza a sua cota do Claude</h3>
          <p>Numa conversa comum, a cada mensagem o Claude relê tudo o que já foi dito. Quanto mais longa a conversa, mais ele relê, como uma bola de neve. No Atlas, cada especialista lê só o que precisa.</p>
        </div>
        <div className="v-ag-barras">
          <span className="v-mono">Um app de agendamento, em {p.etapas} etapas</span>
          <div className="v-ag-barra">
            <span className="v-ag-rot">Claude sozinho, numa conversa só</span>
            <span className="v-ag-trilho"><span className="v-ag-cheio v-ag-cheio--sozinho" style={{ width: '100%' }} /></span>
            <b>{emMilhoes(e.sozinho)} de tokens lidos</b>
          </div>
          <div className="v-ag-barra">
            <span className="v-ag-rot">Com o Atlas</span>
            <span className="v-ag-trilho"><span className="v-ag-cheio" style={{ width: `${pctAtlas}%` }} /></span>
            <b>{emMilhoes(e.atlas)} de tokens lidos</b>
          </div>
          <p className="v-ag-resumo"><b>Cerca de {e.economiaPct}% a menos</b>, mesmo com três revisões a mais por etapa.</p>
        </div>
        <p className="v-ag-nota" role="note" aria-label="Como fizemos a conta">
          Como fizemos a conta: é uma conta simplificada, para mostrar a diferença, não uma promessa. Os dois lados fazem o mesmo trabalho: {p.sozinho.trocasPorEtapa} trocas de mensagens por etapa, cada uma acrescentando cerca de {p.sozinho.porTroca / 1000} mil tokens. Sozinho, tudo numa conversa só. No Atlas, a equipe de execução começa cada etapa com cerca de {p.execucao.base / 1000} mil tokens de regras e arquivos, e os três revisores e o mestre de obras também começam limpos. O gasto real muda com o tamanho do app e com recursos do próprio Claude que resumem conversas longas.
        </p>
      </div>

      <div className="v-grade2">
        <div className="v-card"><span className="v-passo-disco"><Icone nome="relogio" /></span><b>Um método pronto, no automático</b><span>O passo a passo de construir um sistema já vem montado: planejar, fazer, revisar e só então juntar. Você não precisa saber o que pedir a cada momento.</span></div>
        <div className="v-card"><span className="v-passo-disco"><Icone nome="moeda" /></span><b>A sua cota do Claude rende mais</b><span>Lendo menos para fazer o mesmo trabalho, a sua assinatura do Claude constrói mais antes de pausar.</span></div>
      </div>
    </section>
  )
}
