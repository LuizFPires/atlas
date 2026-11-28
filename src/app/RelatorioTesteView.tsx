// Relatório do "Testar a ideia" (TI1TestarIdeia): aviso amarelo de termômetro, o veredito, quanto pagariam, pontos fortes e
// fracos e o mapa de calor por tipo de agente em barras de duelo (a favor × contra na mesma linha). Os números vêm do programa.
import { useState, useSyncExternalStore } from 'react'
import { Botao, Cartao, CampoFalado } from '../ui'
import { textoDaTrava } from './explicar-trava'
import { GavetaEntrevistas } from './GavetaEntrevistas'
import { esquecerRevisao, ouvirRevisoes, pedidoDeRevisao, revisaoDe, revisar } from './revisao-teste'
import type { AgenteNaCena, CenaTeste, ContagemTeste, PonteTestar, RelatorioTeste, ResumoTeste, TemaRelatorio } from './ponte-testar'
import { AVISO_IA, frasesDoVeredito } from './testar-ideia-util'

interface Props {
  rel: RelatorioTeste; resumo: ResumoTeste; nome: string; cena: CenaTeste; pasta: string; ponte: PonteTestar; onVoltar: () => void; onDeNovo: () => void
  /** Revisa o protótipo com o pedido e devolve o número da versão nova (para aprovar na aba Protótipo). */
  revisarPrototipo?: (pedido: string) => Promise<number>
  onVerPrototipo?: () => void
  ondeAprovar?: string
}
const mil = (n: number) => n.toLocaleString('pt-BR')

export function RelatorioTesteView({ rel, resumo, nome, cena, pasta, ponte, onVoltar, onDeNovo, revisarPrototipo, onVerPrototipo, ondeAprovar = 'na aba Protótipo' }: Props) {
  const [gaveta, setGaveta] = useState<string | 'lista' | null>(null)
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
        {cena.agentes.length > 0 && (
          <Cartao className="at-testar__card at-rel__span3">
            <span className="at-testar__r">ENTREVISTE QUALQUER UM DOS {mil(cena.agentes.length)} AGENTES</span>
            <span className="at-testar__txt">Escolha um agente e pergunte o que quiser. A conversa abre ao lado e fica guardada neste teste.</span>
            <div className="at-rel__ags">
              {sugeridos(cena.agentes).map((a) => (
                <button key={a.id} type="button" className="at-gaveta__ag" onClick={() => setGaveta(a.id)}>
                  <span className={`at-gaveta__av ${a.r === 'usaria' ? 'az' : a.r === 'nao' ? 'vm' : 'dv'}`}>{a.nome.charAt(0)}</span>
                  <span><b>{a.nome}, {a.idade}</b>{Object.values(a.tracos).slice(0, 2).join(' · ')}</span>
                  <span className={`at-gaveta__selo ${a.r === 'usaria' ? 'az' : a.r === 'nao' ? 'vm' : 'dv'}`}>{a.mudou ? 'MUDOU DE IDEIA' : a.r === 'usaria' ? 'FÃ' : a.r === 'nao' ? 'CONTRA' : 'EM DÚVIDA'}</span>
                </button>
              ))}
              <button type="button" className="at-gaveta__ag at-gaveta__ag--busca" onClick={() => setGaveta('lista')}><span className="at-gaveta__av">+</span><span><b>Procurar outro agente</b>por nome, profissão, cidade ou opinião</span></button>
            </div>
          </Cartao>
        )}
        {revisarPrototipo && <Ideias pasta={pasta} n={resumo.n} rel={rel} revisarPrototipo={revisarPrototipo} onVerPrototipo={onVerPrototipo} ondeAprovar={ondeAprovar} />}
      </div>
      {gaveta && <GavetaEntrevistas pasta={pasta} n={resumo.n} ponte={ponte} agentes={cena.agentes} aberto={gaveta} onFechar={() => setGaveta(null)} />}
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

/** 4 agentes para começar: o contra mais falante, um fã, quem mudou de ideia e outro contra (sem repetir). */
function sugeridos(agentes: AgenteNaCena[]): AgenteNaCena[] {
  const com = agentes.filter((a) => a.fala)
  const escolhas = [com.find((a) => a.r === 'nao'), com.find((a) => a.r === 'usaria'), com.find((a) => a.mudou), com.filter((a) => a.r === 'nao')[1], com.find((a) => a.r === 'duvida')]
  return [...new Map(escolhas.filter((a): a is AgenteNaCena => !!a).map((a) => [a.id, a])).values()].slice(0, 4)
}

function Ideias({ pasta, n, rel, revisarPrototipo, onVerPrototipo, ondeAprovar }: { pasta: string; n: number; rel: RelatorioTeste; revisarPrototipo: (pedido: string) => Promise<number>; onVerPrototipo?: () => void; ondeAprovar: string }) {
  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set(rel.ideias.slice(0, 2).map((_, i) => i)))
  const [outra, setOutra] = useState('')
  const [escrevendo, setEscrevendo] = useState(false)
  const chave = `${pasta}#${n}`
  const rev = useSyncExternalStore(ouvirRevisoes, () => revisaoDe(chave))
  const total = marcadas.size + (outra.trim() ? 1 : 0)
  const enviar = () => {
    const escolhidas = rel.ideias.filter((_, i) => marcadas.has(i))
    revisar(chave, [...escolhidas.map((i) => i.titulo), ...(outra.trim() ? [outra.trim()] : [])], () => revisarPrototipo(pedidoDeRevisao(n, escolhidas, outra)))
  }
  return (
    <Cartao className="at-testar__card at-rel__span3">
      <span className="at-testar__r">IDEIAS PARA O PROTÓTIPO · TIRADAS DAS CRÍTICAS DOS AGENTES</span>
      {rev ? (
        <div className="at-rel__feito" role="status">
          <span className="at-rel__ok" aria-hidden="true">{rev.estado === 'erro' ? '!' : '✓'}</span>
          <div>
            {rev.estado === 'revisando' && <><b>O Atlas está revisando o protótipo.</b> Vai virar uma versão nova, com {rev.ideias.map((t) => `“${t}”`).join(', ')}. A versão de agora continua guardada. Pode sair desta tela: quando ficar pronta, você aprova {ondeAprovar}.</>}
            {rev.estado === 'pronta' && <><b>{rev.versao ? `A versão ${rev.versao} do protótipo está pronta.` : 'A versão nova do protótipo está pronta.'}</b> Revise e aprove {ondeAprovar}. Depois, rode o teste de novo com os mesmos agentes para comparar.</>}
            {rev.estado === 'erro' && <><b>Não deu para revisar o protótipo agora.</b> {textoDaTrava(rev.erro, 'A revisão do protótipo')}</>}
            <div className="at-rel__passos"><span className="ok">✓ Ideias enviadas</span><span className={rev.estado === 'revisando' ? 'ag' : rev.estado === 'pronta' ? 'ok' : ''}>{rev.estado === 'pronta' ? '✓ Protótipo revisado' : 'Revisando as telas…'}</span><span>Você aprova a versão nova</span><span>Testar de novo com os mesmos agentes</span></div>
            {rev.estado === 'pronta' && onVerPrototipo && <div className="at-testar__acoes at-testar__acoes--esq"><Botao onClick={() => { esquecerRevisao(chave); onVerPrototipo() }}>Ver a versão {rev.versao} no Protótipo →</Botao></div>}
            {rev.estado === 'erro' && <div className="at-testar__acoes at-testar__acoes--esq"><Botao variante="secundario" onClick={() => esquecerRevisao(chave)}>Voltar às ideias</Botao></div>}
          </div>
        </div>
      ) : (
        <>
          <span className="at-testar__nota">Marque as que você quer. A decisão é sua.</span>
          {rel.ideias.length === 0 && <span className="at-testar__txt">Os agentes não deixaram nenhuma ideia clara desta vez. Você pode escrever a sua mudança abaixo.</span>}
          {rel.ideias.map((i, k) => (
            <label key={k} className={`at-rel__sug${marcadas.has(k) ? ' at-rel__sug--sel' : ''}`}>
              <input type="checkbox" checked={marcadas.has(k)} onChange={(e) => setMarcadas((m) => { const x = new Set(m); if (e.target.checked) x.add(k); else x.delete(k); return x })} />
              <span><b>{i.titulo}</b>{i.como}{i.n ? ` (${mil(i.n)} agentes falaram disso.)` : ''}</span>
            </label>
          ))}
          {escrevendo ? <CampoFalado rotulo="Outra mudança sua" valor={outra} onChange={setOutra} placeholder="Escreva ou fale o que mais quer mudar, junto com essas" /> : <button type="button" className="at-rel__sug at-rel__sug--outra" onClick={() => setEscrevendo(true)}><span aria-hidden="true">+</span><span><b>Outra mudança sua</b>Escreva ou fale o que mais quer mudar, junto com essas.</span></button>}
          <div className="at-rel__pedido">
            <span className="at-testar__nota">{total === 0 ? 'Marque pelo menos uma ideia (ou escreva a sua).' : `${total} ${total === 1 ? 'mudança marcada' : 'mudanças marcadas'}. O Atlas revisa o protótipo e mostra a versão nova para você aprovar antes de qualquer construção.`}</span>
            <Botao disabled={total === 0} onClick={enviar}>Revisar o protótipo com as ideias marcadas →</Botao>
          </div>
        </>
      )}
    </Cartao>
  )
}
