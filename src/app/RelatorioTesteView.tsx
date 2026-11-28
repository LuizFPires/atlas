// Relatório do "Testar a ideia" (TI1TestarIdeia): aviso amarelo de termômetro, o veredito, quanto pagariam, pontos fortes e
// fracos e o mapa de calor por tipo de agente em barras de duelo (a favor × contra na mesma linha). Os números vêm do programa.
import { useState } from 'react'
import { Botao, Cartao } from '../ui'
import type { CenaTeste, ContagemTeste, RelatorioTeste, ResumoTeste, TemaRelatorio } from './ponte-testar'
import { AVISO_IA, frasesDoVeredito } from './testar-ideia-util'

interface Props { rel: RelatorioTeste; resumo: ResumoTeste; nome: string; cena: CenaTeste; onVoltar: () => void; onDeNovo: () => void }
const mil = (n: number) => n.toLocaleString('pt-BR')

export function RelatorioTesteView({ rel, resumo, nome, onVoltar, onDeNovo }: Props) {
  const g = rel.geral
  const v = frasesDoVeredito(rel)
  const dims = Object.keys(rel.porTipo).filter((k) => rel.porTipo[k].length > 1)
  const [dim, setDim] = useState(dims.includes('Profissão') ? 'Profissão' : dims[0])
  const maxPreco = Math.max(1, ...rel.preco.map((p) => p.n))
  const topo = rel.preco.reduce<{ rotulo: string; n: number } | null>((m, p) => (!m || p.n > m.n ? p : m), null)
  return (
    <div className="at-rel">
      <div className="at-rel__cab">
        <span className="at-testar__r">TESTE {resumo.n}{resumo.versao ? ` · PROTÓTIPO ${resumo.versao.toUpperCase()}` : ''} · {mil(resumo.quantidade)} AGENTES · SALVO</span>
        <h2 className="at-testar__h">O que {mil(g.total)} agentes de IA acharam do {nome}</h2>
      </div>
      <div className="at-rel__termo" role="note"><span aria-hidden="true">!</span><div><b>Isto é um termômetro, não uma pesquisa de mercado.</b> As “pessoas” são agentes de IA, não pessoas reais: uma IA só fazendo vários papéis. Use para achar problemas e ideias antes de construir, não para decidir se o negócio dá certo. O Atlas não recomenda nem garante nada.</div></div>
      <div className="at-rel__grade">
        <Cartao className="at-testar__card at-rel__span2">
          <span className="at-testar__r">O TERMÔMETRO · AGENTES DE IA</span>
          <div className="at-rel__ver">
            <div className="at-rel__anel" style={{ ['--p' as string]: `${g.pctUsaria}%` }}><div><b>{g.pctUsaria}%</b><small>usariam</small></div></div>
            <div className="at-rel__vtxt">
              <b>{v.titulo}</b>
              <span className="at-testar__txt">{mil(g.usaria)} agentes usariam, {mil(g.nao)} não, {mil(g.duvida)} ficaram em dúvida.{v.quem ? ` ${v.quem}` : ''}</span>
              {rel.mudaram > 0 && <span className="at-testar__nota">Depois da conversa entre eles, {mil(rel.mudaram)} mudaram de ideia ({mil(rel.passaramAGostar)} passaram a gostar).</span>}
              {rel.semResposta > 0 && <span className="at-testar__nota">{mil(rel.semResposta)} agentes não responderam e ficaram fora das contas.</span>}
            </div>
          </div>
        </Cartao>
        <Cartao className="at-testar__card at-rel__preco">
          <span className="at-testar__r">QUANTO PAGARIAM POR MÊS</span>
          <div className="at-rel__hist" role="img" aria-label={rel.preco.map((p) => `${p.rotulo}: ${p.n}`).join(', ')}>
            {rel.preco.map((p) => <div key={p.rotulo}><i className={p === topo ? 'on' : ''} style={{ height: `${Math.max(4, (p.n / maxPreco) * 100)}%` }} /><span>{p.rotulo}</span></div>)}
          </div>
          <span className="at-testar__nota">{topo && topo.n > 0 ? `O mais escolhido: ${topo.rotulo}.` : 'Ninguém disse quanto pagaria.'}{rel.produto.preco ? ` Hoje o ${nome} está em R$ ${mil(rel.produto.preco)}.` : ''}</span>
        </Cartao>
        <Temas titulo="PONTOS FORTES" lista={rel.fortes} cor="az" />
        <Temas titulo="PONTOS FRACOS" lista={rel.fracos} cor="vm" />
        {dim && (
          <Cartao className="at-testar__card at-rel__span3">
            <span className="at-testar__r">MAPA DE CALOR · QUEM GOSTOU, POR TIPO DE AGENTE</span>
            <div className="at-rel__dims">{dims.map((k) => <button key={k} type="button" aria-pressed={k === dim} onClick={() => setDim(k)}>{k}</button>)}</div>
            <div className="at-rel__duelos">{rel.porTipo[dim].map((x) => <Duelo key={x.valor} x={x} />)}</div>
            <div className="at-rel__leg"><span><i className="az" />a favor</span><span><i className="dv" />em dúvida</span><span><i className="vm" />contra</span><span>Linhas apagadas têm menos de 20 agentes: olhe com cuidado.</span></div>
          </Cartao>
        )}
      </div>
      <div className="at-testar__acoes">
        <Botao variante="secundario" onClick={onVoltar}>← Testes</Botao>
        <Botao variante="secundario" onClick={onDeNovo}>Rodar de novo com os mesmos agentes</Botao>
      </div>
      <span className="at-testar__nota at-testar__nota--dir">{AVISO_IA}</span>
    </div>
  )
}

function Temas({ titulo, lista, cor }: { titulo: string; lista: TemaRelatorio[]; cor: 'az' | 'vm' }) {
  return (
    <Cartao className="at-testar__card">
      <span className="at-testar__r">{titulo}</span>
      <div className="at-testar__itens">
        {lista.length === 0 && <span className="at-testar__nota">Nada que muitos agentes tenham dito.</span>}
        {lista.slice(0, 5).map((t) => (
          <div key={t.tema} className={`at-testar__it ${cor}`}>
            <b>{t.tema}</b><span>{mil(t.n)}</span>
            {t.exemplo && <q>“{t.exemplo.fala}” · {t.exemplo.quem}</q>}
          </div>
        ))}
      </div>
    </Cartao>
  )
}

function Duelo({ x }: { x: ContagemTeste & { valor: string } }) {
  return (
    <div className={`at-rel__duelo${x.total < 20 ? ' at-rel__duelo--poucos' : ''}`}>
      <span className="at-rel__dn">{x.valor}<small>{mil(x.total)} agentes</small></span>
      <b className="az">{x.pctUsaria}%<small>a favor</small></b>
      <div className="at-rel__db" aria-label={`${x.valor}: ${x.pctUsaria}% a favor, ${x.pctNao}% contra`}><i className="az" style={{ width: `${x.pctUsaria}%` }} /><i className="dv" style={{ width: `${x.pctDuvida}%` }} /><i className="vm" style={{ width: `${x.pctNao}%` }} /></div>
      <b className="vm">{x.pctNao}%<small>contra</small></b>
    </div>
  )
}
