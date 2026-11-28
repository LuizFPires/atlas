// Aba "Testar a ideia" (TI1TestarIdeia, aprovado pelo Luiz em 28/11/2026): os testes salvos e a comparação, a tela de
// quantidade, o teste rodando (Praça ao vivo) e o relatório. São agentes de IA, não pessoas reais: um termômetro.
import { useCallback, useEffect, useState } from 'react'
import { Botao, Cartao } from '../ui'
import { textoDaTrava } from './explicar-trava'
import { MINUTOS, type CenaTeste, type PonteTestar, type Quantidade, type RelatorioTeste, type ResumoTeste } from './ponte-testar'
import { PracaTeste, type FasePraca } from './PracaTeste'
import { RelatorioTesteView } from './RelatorioTesteView'
import { AVISO_IA, compararTemas } from './testar-ideia-util'
import './testar-ideia.css'

type Tela = { t: 'lista' } | { t: 'novo'; mesmosDe: number | null } | { t: 'teste'; n: number }
interface Props {
  pasta: string; nome: string; ponte: PonteTestar
  /** Versão atual do protótipo ("v3"), guardada no teste para a comparação. */
  lerVersao?: () => Promise<string | null>
  revisarPrototipo?: (pedido: string) => Promise<number>
  onVerPrototipo?: () => void
  /** Onde o dono aprova a versão nova do protótipo (no celular: "no Atlas do computador, na aba Protótipo"). */
  ondeAprovar?: string
}

const pct = (x: number) => `${x}%`
const quando = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
const mil = (n: number) => n.toLocaleString('pt-BR')

export function TestarIdeia({ pasta, nome, ponte, lerVersao, revisarPrototipo, onVerPrototipo, ondeAprovar }: Props) {
  const [testes, setTestes] = useState<ResumoTeste[] | null>(null)
  const [tela, setTela] = useState<Tela>({ t: 'lista' })
  const [erro, setErro] = useState<string | null>(null)

  const ler = useCallback(() => ponte.listar(pasta).then(setTestes, () => setTestes([])), [ponte, pasta])
  useEffect(() => { void ler() }, [ler])

  if (!testes) return <p className="at-testar__nota">Lendo os seus testes…</p>
  if (tela.t === 'novo') {
    return <NovoTeste nome={nome} anterior={testes.find((t) => t.estado === 'pronto') ?? null} mesmosDe={tela.mesmosDe} erro={erro}
      onVoltar={() => { setErro(null); setTela({ t: 'lista' }) }}
      onComecar={(quantidade, mesmosDe) => { setErro(null); (lerVersao ? lerVersao().catch(() => null) : Promise.resolve(null)).then((versao) => ponte.iniciar(pasta, { quantidade, mesmosDe, versao })).then(({ n }) => { void ler(); setTela({ t: 'teste', n }) }, (e) => setErro(textoDaTrava(e, 'Começar o teste'))) }} />
  }
  if (tela.t === 'teste') return <TesteAberto pasta={pasta} nome={nome} ponte={ponte} n={tela.n} revisarPrototipo={revisarPrototipo} onVerPrototipo={onVerPrototipo} ondeAprovar={ondeAprovar} onVoltar={() => { void ler(); setTela({ t: 'lista' }) }} onDeNovo={(n) => setTela({ t: 'novo', mesmosDe: n })} />
  if (!testes.length) return <Convite nome={nome} onTestar={() => setTela({ t: 'novo', mesmosDe: null })} />
  return <ListaDeTestes pasta={pasta} ponte={ponte} testes={testes} onNovo={() => setTela({ t: 'novo', mesmosDe: null })} onAbrir={(n) => setTela({ t: 'teste', n })} onDeNovo={(n) => setTela({ t: 'novo', mesmosDe: n })} />
}

function Convite({ nome, onTestar }: { nome: string; onTestar: () => void }) {
  return (
    <Cartao className="at-testar__convite">
      <span className="at-testar__r at-testar__r--lime">TESTAR A IDEIA · QUANDO QUISER</span>
      <b className="at-testar__tit">Quer ver como 500 clientes reagem ao {nome}?</b>
      <span className="at-testar__txt">O Atlas cria 500 pessoas diferentes, do jeito do seu público, mostra as telas para cada uma e conta o que elas acharam: o que agradou, o que incomodou e quanto pagariam. Você ajusta o protótipo antes de construir.</span>
      <div className="at-testar__tags"><span>≈ 25 MIN</span><span>USA A SUA COTA DO CLAUDE</span><span>FICA SALVO</span></div>
      <div className="at-testar__acoes"><Botao onClick={onTestar}>Testar a ideia →</Botao></div>
      <span className="at-testar__nota">{AVISO_IA}</span>
    </Cartao>
  )
}

function NovoTeste({ nome, anterior, mesmosDe, erro, onVoltar, onComecar }: { nome: string; anterior: ResumoTeste | null; mesmosDe: number | null; erro: string | null; onVoltar: () => void; onComecar: (q: Quantidade, mesmosDe: number | null) => void }) {
  const [q, setQ] = useState<Quantidade>(500)
  const [mesmos, setMesmos] = useState(mesmosDe !== null || !!anterior)
  const base = mesmosDe ?? anterior?.n ?? null
  const [indo, setIndo] = useState(false)
  const rot: Record<Quantidade, string> = { 100: 'rápido', 250: '', 500: 'recomendado', 1000: 'máximo' }
  return (
    <div className="at-testar__novo">
      <h2 className="at-testar__h">Quem vai testar o {nome}</h2>
      <Cartao className="at-testar__card">
        <span className="at-testar__r">QUANTAS PESSOAS</span>
        <div className="at-testar__qtd" role="radiogroup" aria-label="Quantas pessoas">
          {([100, 250, 500, 1000] as Quantidade[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={q === k} className={`at-testar__q${q === k ? ' at-testar__q--on' : ''}`} onClick={() => setQ(k)}>
              <b>{mil(k)}</b>{rot[k] ? `${rot[k]} · ` : ''}≈ {MINUTOS[k]} min
            </button>
          ))}
        </div>
        {base !== null && <label className="at-testar__mesmos"><input type="checkbox" checked={mesmos} onChange={(e) => setMesmos(e.target.checked)} /> Usar os mesmos agentes do teste {base} (para comparar de forma justa)</label>}
        {q === 1000 && <span className="at-testar__nota">1.000 traz mais variedade de opiniões e falas, mas gasta o dobro da cota de 500. Os números mudam pouco: é a mesma IA fazendo mais papéis.</span>}
        <div className="at-testar__cota"><b>Usa a sua cota do Claude.</b> 500 pessoas gastam uma boa parte dela; 1.000, o dobro. Se a cota acabar no meio, o teste pausa e continua sozinho quando ela voltar. Se fechar o Atlas, ele continua de onde parou quando você abrir de novo.</div>
      </Cartao>
      <Cartao className="at-testar__card">
        <span className="at-testar__r">COMO É FEITO</span>
        <span className="at-testar__txt">1. O Atlas lê o seu briefing e as telas do protótipo. 2. Cria as pessoas, todas diferentes (idade, cidade, trabalho, dinheiro, celular, jeito…). 3. Cada uma vê as telas e diz o que achou. 4. Elas conversam entre si: quem gostou tenta convencer quem não gostou, e vice-versa. 5. O programa faz as contas e monta o relatório.</span>
      </Cartao>
      {erro && <p className="at-testar__erro" role="alert">{erro}</p>}
      <div className="at-testar__acoes">
        <Botao variante="secundario" onClick={onVoltar}>Voltar</Botao>
        <Botao disabled={indo} onClick={() => { setIndo(true); onComecar(q, mesmos ? base : null); setTimeout(() => setIndo(false), 1500) }}>Começar com {mil(q)} pessoas →</Botao>
      </div>
      <span className="at-testar__nota at-testar__nota--dir">{AVISO_IA}</span>
    </div>
  )
}

const FASES: { etapa: ResumoTeste['etapa'][]; texto: (r: ResumoTeste) => string }[] = [
  { etapa: ['entender', 'agentes'], texto: (r) => `Criando ${mil(r.quantidade)} pessoas diferentes` },
  { etapa: ['olhar'], texto: () => 'Mostrando as telas para cada uma' },
  { etapa: ['conversa'], texto: () => 'A conversa: postam, comentam, discutem' },
  { etapa: ['relatorio'], texto: () => 'Montando o relatório' },
]
const faseDaPraca = (e: ResumoTeste['etapa']): FasePraca => (e === 'entender' || e === 'agentes' ? 'criando' : e === 'olhar' ? 'olhando' : e)

function TesteAberto({ pasta, nome, ponte, n, onVoltar, onDeNovo, revisarPrototipo, onVerPrototipo, ondeAprovar }: { pasta: string; nome: string; ponte: PonteTestar; n: number; onVoltar: () => void; onDeNovo: (n: number) => void; revisarPrototipo?: (pedido: string) => Promise<number>; onVerPrototipo?: () => void; ondeAprovar?: string }) {
  const [r, setR] = useState<ResumoTeste | null>(null)
  const [cena, setCena] = useState<CenaTeste>({ agentes: [], eventos: [] })
  const [rel, setRel] = useState<RelatorioTeste | null>(null)
  const [some, setSome] = useState(false)

  useEffect(() => {
    let vivo = true
    let pronto = false
    const atualizar = () => {
      if (pronto) return
      ponte.estado(pasta, n).then((e) => {
        if (!vivo) return
        if (!e) { setSome(true); return }
        setR(e)
        if (e.estado === 'pronto') { pronto = true; ponte.relatorio(pasta, n).then((x) => { if (vivo) setRel(x) }, () => {}) }
        if (e.etapa !== 'entender') ponte.cena(pasta, n).then((c) => { if (vivo) setCena(c) }, () => {})
      }, () => {})
    }
    atualizar()
    const t = setInterval(atualizar, 3000)
    const parar = ponte.aoMudar?.((m) => { if (m === n) atualizar() })
    return () => { vivo = false; clearInterval(t); parar?.() }
  }, [ponte, pasta, n])

  if (some) return <div className="at-testar__novo"><p className="at-testar__erro">{textoDaTrava('teste-invalido')}</p><Botao variante="secundario" onClick={onVoltar}>Voltar aos testes</Botao></div>
  if (!r) return <p className="at-testar__nota">Abrindo o teste {n}…</p>
  if (r.estado === 'pronto' && rel) return <RelatorioTesteView rel={rel} resumo={r} nome={nome} cena={cena} pasta={pasta} ponte={ponte} onVoltar={onVoltar} onDeNovo={() => onDeNovo(n)} revisarPrototipo={revisarPrototipo} onVerPrototipo={onVerPrototipo} ondeAprovar={ondeAprovar} />
  const t = r.termometro
  const idx = FASES.findIndex((f) => f.etapa.includes(r.etapa))
  const feed = cena.eventos.slice(-8).reverse()
  const quem = new Map(cena.agentes.map((a) => [a.id, a]))
  return (
    <div className="at-testar__sim">
      <div className="at-testar__cena">
        <PracaTeste agentes={cena.agentes} eventos={cena.eventos} fase={faseDaPraca(r.etapa)} nome={nome} />
        <div className="at-testar__hud"><span>{FASES[Math.max(0, idx)]?.texto(r).toUpperCase()}</span><b>{mil(r.etapa === 'olhar' ? r.olhados : r.feitos)}</b><span>DE {mil(r.quantidade)} PESSOAS{r.rodada ? ` · RODADA ${r.rodada} DE 6` : ''}</span></div>
      </div>
      <div className="at-testar__lado">
        <div className="at-testar__voltar"><Botao variante="secundario" onClick={onVoltar}>← Testes</Botao></div>
        {r.estado === 'pausado-cota' && <div className="at-testar__pausa" role="status"><b>Pausado: a cota do Claude acabou.</b> O teste continua sozinho quando ela voltar (o Atlas tenta de novo a cada 15 minutos).<Botao variante="secundario" onClick={() => void ponte.retomar(pasta, n)}>Tentar agora</Botao></div>}
        {r.estado === 'erro' && <div className="at-testar__erro" role="alert">{textoDaTrava(r.motivo ?? 'erro', 'O teste')} <Botao variante="secundario" onClick={() => void ponte.retomar(pasta, n)}>Continuar de onde parou</Botao></div>}
        <ol className="at-testar__fases">
          {FASES.map((f, i) => <li key={i} className={i < idx || r.estado === 'pronto' ? 'feito' : i === idx ? 'agora' : ''}><i>{i < idx ? '✓' : i + 1}</i>{f.texto(r)}</li>)}
        </ol>
        <div className="at-testar__placar">
          <div><b className="az">{t ? mil(t.usaria) : 0}</b><span>usariam</span></div>
          <div><b className="vm">{t ? mil(t.nao) : 0}</b><span>não usariam</span></div>
          <div><b>{t ? mil(t.duvida) : 0}</b><span>em dúvida</span></div>
        </div>
        <div className="at-testar__barra"><i className="az" style={{ width: pct(t?.pctUsaria ?? 0) }} /><i className="vm" style={{ width: pct(t?.pctNao ?? 0) }} /></div>
        <span className="at-testar__r">O QUE ELAS ESTÃO DIZENDO</span>
        <div className="at-testar__feed" aria-live="polite">
          {feed.length === 0 && <span className="at-testar__nota">As falas aparecem aqui quando a conversa começar.</span>}
          {feed.map((e, i) => { const a = quem.get(e.de); return <div key={`${e.rodada}-${e.de}-${i}`} className={`at-testar__fala at-testar__fala--${e.r}`}><b>{a ? `${a.nome}, ${a.idade}` : 'Agente'}</b> {e.texto}</div> })}
        </div>
        <span className="at-testar__nota">{AVISO_IA}</span>
      </div>
    </div>
  )
}

function ListaDeTestes({ pasta, ponte, testes, onNovo, onAbrir, onDeNovo }: { pasta: string; ponte: PonteTestar; testes: ResumoTeste[]; onNovo: () => void; onAbrir: (n: number) => void; onDeNovo: (n: number) => void }) {
  const prontos = testes.filter((t) => t.estado === 'pronto')
  const [sel, setSel] = useState<number | null>(prontos[0]?.n ?? null)
  const atual = prontos.find((t) => t.n === sel) ?? null
  const base = atual ? (prontos.find((t) => t.n === atual.mesmosDe) ?? prontos.find((t) => t.n < atual.n) ?? null) : null
  const [rels, setRels] = useState<Record<number, RelatorioTeste | null>>({})
  useEffect(() => {
    for (const t of [atual, base]) if (t && !(t.n in rels)) ponte.relatorio(pasta, t.n).then((x) => setRels((m) => ({ ...m, [t.n]: x })), () => setRels((m) => ({ ...m, [t.n]: null })))
  }, [atual, base, rels, ponte, pasta])
  const rodando = testes.some((t) => t.estado === 'rodando' || t.estado === 'pausado-cota')
  return (
    <div className="at-testar__lista">
      <div className="at-testar__col">
        <div className="at-testar__cab"><span className="at-testar__r">SEUS TESTES · FICAM SALVOS</span><Botao disabled={rodando} title={rodando ? 'Espere o teste que está rodando terminar' : undefined} onClick={onNovo}>+ Novo teste</Botao></div>
        {testes.map((t) => {
          const e = t.termometro
          return (
            <div key={t.n} className={`at-testar__ht${t.n === sel ? ' at-testar__ht--on' : ''}`} onClick={() => t.estado === 'pronto' && setSel(t.n)}>
              <div className="at-testar__htn"><b>Teste {t.n}</b><span>{quando(t.criadoEm)}</span></div>
              <div className="at-testar__tags">{t.versao && <span>PROTÓTIPO {t.versao.toUpperCase()}</span>}<span>{mil(t.quantidade)} AGENTES</span>{t.mesmosDe && <span>MESMOS DO TESTE {t.mesmosDe}</span>}{t.estado !== 'pronto' && <span className="lime">{t.estado === 'pausado-cota' ? 'PAUSADO · COTA' : t.estado === 'erro' ? 'PAROU' : 'RODANDO'}</span>}</div>
              {e && <div className="at-testar__htb"><div className="at-testar__barra"><i className="az" style={{ width: pct(e.pctUsaria) }} /><i className="vm" style={{ width: pct(e.pctNao) }} /></div><b className="az">{e.pctUsaria}%</b></div>}
              {t.maisContra && <span className="at-testar__htq">Mais citado contra: <b>{t.maisContra}</b></span>}
              <div className="at-testar__acoes at-testar__acoes--esq"><Botao variante="secundario" onClick={(ev) => { ev.stopPropagation(); onAbrir(t.n) }}>{t.estado === 'pronto' ? 'Abrir relatório' : 'Acompanhar'}</Botao></div>
            </div>
          )
        })}
      </div>
      {atual && <Comparar atual={atual} base={base} relA={rels[atual.n]} relB={base ? rels[base.n] : undefined} onDeNovo={() => onDeNovo(atual.mesmosDe ?? atual.n)} rodando={rodando} />}
    </div>
  )
}

function Comparar({ atual, base, relA, relB, onDeNovo, rodando }: { atual: ResumoTeste; base: ResumoTeste | null; relA?: RelatorioTeste | null; relB?: RelatorioTeste | null; onDeNovo: () => void; rodando: boolean }) {
  const mesmos = base && atual.mesmosDe === base.n
  return (
    <Cartao className="at-testar__card at-testar__cmp">
      <span className="at-testar__r">{base ? `COMPARAR · TESTE ${base.n} × TESTE ${atual.n}` : `TESTE ${atual.n}${atual.versao ? ` · PROTÓTIPO ${atual.versao.toUpperCase()}` : ''} · USARIAM`}</span>
      <div className="at-testar__cmpn">
        {base && <><div><small>TESTE {base.n}{base.versao ? ` · ${base.versao.toUpperCase()}` : ''}</small><b>{base.termometro?.pctUsaria ?? 0}%</b></div><span aria-hidden="true">→</span></>}
        <div>{base && <small>TESTE {atual.n}{atual.versao ? ` · ${atual.versao.toUpperCase()}` : ''}</small>}<b className="az">{atual.termometro?.pctUsaria ?? 0}%</b></div>
      </div>
      {!base && <span className="at-testar__txt">Quando você rodar outro teste, a comparação aparece aqui. Mude o protótipo e rode de novo com os mesmos agentes para ver o que mudou.</span>}
      {base && relA && relB && (
        <div className="at-testar__itens">
          {compararTemas(relA, relB).map((x) => <div key={x.tema} className={`at-testar__it ${x.depois <= x.antes ? 'az' : 'vm'}`}><b>“{x.tema}”{x.antes === 0 ? ' (novo)' : ''}</b><span>{x.antes} → {x.depois}</span></div>)}
        </div>
      )}
      {base && <span className="at-testar__nota">{mesmos ? `O teste ${atual.n} usou os mesmos agentes do teste ${base.n}, para a comparação ser justa.` : `Os testes ${base.n} e ${atual.n} usaram agentes diferentes: a comparação é menos justa.`} Mesmo assim, é termômetro: diferenças pequenas podem ser só variação da IA.</span>}
      <div className="at-testar__acoes at-testar__acoes--esq"><Botao variante="secundario" disabled={rodando} onClick={onDeNovo}>Rodar de novo com os mesmos agentes</Botao></div>
    </Cartao>
  )
}
