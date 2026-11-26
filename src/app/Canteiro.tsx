import { textoAvanco } from './avanco'
import { textoDaTrava } from './explicar-trava'
import { palavras } from './plataforma'
import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../ui'
import type { PonteObras } from './ponte-obras'
import { RetratoCanteiro } from './RetratoCanteiro'
import { faseDaObra, nomeDaPasta, type EtapaObra, type FaseObra, type SituacaoObra } from './fase-obra'
import type { ObraParaContinuar } from './Obras'
import type { ParadaReal, QuemTrabalha } from './ponte-painel'
import { quandoParou, type PonteRetomar } from './ponte-retomar'
import { fichaDaTrava, type TravaObra } from './travas'
import { EscolherComeco } from './EscolherComeco'
import type { ComoComecar, EstadoFila, PonteConstrucao } from './ponte-construcao'
import type { Plano } from './ponte-claude'
import './canteiro.css'

// Canteiro de obras e Obras concluídas (Milestone 37; protótipo prototipo/caminho-novo/K1Canteiro e K2Concluidas, aprovado pelo
// Luiz em 23/11/2026). O Canteiro mostra só as obras vivas (inacabadas primeiro, depois em construção); as prontas ficam em
// Obras concluídas. Cada cartão abre a obra na etapa em que ela está.

/** Número da etapa no caminho de 6 (ideia, visual, nome, protótipo, contas, começar) e o próximo passo, para obra inacabada. */
const PASSO: Record<Exclude<EtapaObra, 'obra'>, { n: number; proximo: string; parou: string }> = {
  estilo: { n: 2, proximo: 'escolher o visual', parou: 'no visual' },
  batismo: { n: 3, proximo: 'escolher o nome', parou: 'no nome' },
  telas: { n: 4, proximo: 'conferir o protótipo', parou: 'no protótipo' },
  aprovar: { n: 5, proximo: 'abrir as contas', parou: 'nas contas' },
}

/** Capa da obra que falta terminar (Luiz, 24/11/2026): o lote com tapume e a placa de obra "EM BREVE", o nome e onde paramos. */
function PlacaDeObra({ nome, parou }: { nome: string; parou: string }) {
  const curto = nome.length > 20 ? `${nome.slice(0, 19).trimEnd()}…` : nome
  return (
    <svg className="at-ct__placa" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect className="at-ct__ceu" width="400" height="150" />
      <circle className="at-ct__lua" cx="352" cy="30" r="11" />
      <path className="at-ct__terra" d="M0 120 H400 V150 H0 Z" />
      <path className="at-ct__terra-linha" d="M0 120 H400" />
      <g className="at-ct__tapume"><rect x="-6" y="92" width="64" height="28" /><rect x="62" y="92" width="64" height="28" /><rect x="130" y="92" width="40" height="28" /></g>
      <path className="at-ct__faixa" d="M-6 106 H170" />
      <path className="at-ct__poste" d="M214 104 V120 M330 104 V120" />
      <rect className="at-ct__placa-fundo" x="196" y="40" width="152" height="66" rx="5" />
      <text className="at-ct__placa-rot" x="272" y="58" textAnchor="middle">EM BREVE</text>
      <text className="at-ct__placa-nome" x="272" y="78" textAnchor="middle">{curto}</text>
      <text className="at-ct__placa-onde" x="272" y="96" textAnchor="middle">({`paramos ${parou}`})</text>
      <path className="at-ct__cone" d="M372 120 L379 98 L386 120 Z" /><path className="at-ct__cone-faixa" d="M375 111 H383" />
    </svg>
  )
}

/** O que o painel da obra diz (só o que o cartão usa). */
type LeituraPainel = { pct: number; parada?: ParadaReal | null; pausadaPorVoce?: boolean; agora?: QuemTrabalha[]; trava?: TravaObra | null; naFila?: { depoisDe: string; nome: string } | null }
/** Situação de uma obra em construção, para o selo e a linha do cartão. */
type Vivo = { selo: string; linha: string; acao: string; tom: 'lime' | 'cinza' | 'ambar'; religar?: boolean; volta?: string; travaVoce?: boolean; travaResumo?: string; travaLinha?: string }
type Lida = { pasta: string; nome: string; fase: FaseObra; vivo?: Vivo; noAr?: SituacaoObra['noAr'] }

function vivoDa(l: LeituraPainel | null, parouEm: string | null | undefined): Vivo | undefined {
  if (!l) return undefined
  if (l.parada === 'cota') return { selo: 'ESPERANDO O CLAUDE', linha: 'O limite do Claude acabou. A obra volta sozinha assim que ele renovar.', acao: 'Abrir a obra', tom: 'cinza' }
  if (l.parada === 'voce') return { selo: 'PRECISA DE VOCÊ', linha: 'O Atlas precisa de uma resposta sua para seguir.', acao: 'Responder', tom: 'ambar' }
  if (l.parada === 'billing') return { selo: 'PAGAMENTO PENDENTE', linha: 'Confira o pagamento do serviço para a obra seguir.', acao: 'Ver o que fazer', tom: 'ambar' }
  // Trava de uma conta (T1Travas): o selo diz qual conta e quando volta; âmbar só quando precisa de você.
  if (l.trava) {
    const f = fichaDaTrava(l.trava)
    return { selo: f.selo, linha: f.linha, volta: f.volta, acao: f.precisaDeVoce ? 'Resolver agora' : 'Abrir a obra', tom: f.precisaDeVoce ? 'ambar' : l.trava.tipo === 'github-minutos' ? 'lime' : 'cinza', travaVoce: f.precisaDeVoce, travaResumo: f.precisaDeVoce ? 'precisa de você' : f.volta.toLocaleLowerCase('pt-BR').replace(' · ', ', '), travaLinha: f.linha }
  }
  // M51 (Q4Canteiro): esperando a vez; começa sozinha quando a da frente ficar pronta.
  if (l.naFila) return { selo: 'NA FILA', linha: `Na fila: começa sozinha quando a obra ${l.naFila.nome} ficar pronta.`, acao: 'Abrir a obra', tom: 'ambar' }
  if (l.pausadaPorVoce) return { selo: 'PAUSADA POR VOCÊ', linha: 'A obra está esperando você mandar seguir.', acao: 'Continuar obra', tom: 'cinza' }
  if (parouEm !== undefined) return { selo: 'PARADA', linha: `Parou ${quandoParou(parouEm, new Date()) ?? 'há pouco'}, quando o computador desligou.`, acao: 'Continuar obra', tom: 'cinza', religar: true }
  const ativo = l.agora?.find((q) => q.tom === 'ativo')
  if (ativo) return { selo: 'TRABALHANDO AGORA', linha: `Trabalhando agora: ${ativo.oque}`, acao: 'Abrir a obra', tom: 'lime' }
  return undefined
}
type Filtro = 'todas' | 'falta' | 'construcao'

/** O aviso "enquanto você estava fora" (TF1) aparece uma vez por abertura do Atlas, e só se alguma trava precisa da pessoa. */
let avisoDeTravasMostrado = false

interface Props {
  modo: 'canteiro' | 'concluidas'
  obras: PonteObras
  /** O andamento das obras em construção (painel da obra): %, parada, pausa e quem trabalha agora. */
  painel?: { ler(pasta: string): Promise<LeituraPainel>; enderecoCanteiro?(pasta: string): string | null }
  /** A obra que parou com o computador desligado: o cartão dela religa com um clique. */
  retomar?: PonteRetomar
  onAbrir: (o: ObraParaContinuar) => void
  onNova: () => void
  /** M51: quem trabalha, quem espera na fila e "Mudar a ordem" (Q4Canteiro). */
  construcao?: Pick<PonteConstrucao, 'fila' | 'mudarVez'>
  plano?: Plano
}

export function Canteiro({ modo, obras, painel, retomar, onAbrir, onNova, construcao, plano = 'pro' }: Props) {
  const [fila, setFila] = useState<EstadoFila | null>(null)
  const [mudando, setMudando] = useState(false)
  const [erroFila, setErroFila] = useState('')
  const [versao, setVersao] = useState(0)
  const [lidas, setLidas] = useState<Lida[] | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [excluindo, setExcluindo] = useState<Lida | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erroExcluir, setErroExcluir] = useState('')
  const [avisoTravas, setAvisoTravas] = useState(false)
  const excluir = async (o: Lida) => {
    if (!obras.excluir) return
    setOcupado(true)
    setErroExcluir('')
    try {
      await obras.excluir(o.pasta)
      setLidas((l) => (l ?? []).filter((x) => x.pasta !== o.pasta))
      setExcluindo(null)
    } catch (e) {
      setErroExcluir(e instanceof Error && e.message === 'obra-concluida' ? 'Obra concluída não pode ser excluída.' : textoDaTrava(e, 'Não consegui excluir. Feche a pasta da obra se ela estiver aberta.'))
    } finally { setOcupado(false) }
  }

  useEffect(() => {
    let vivo = true
    void (async () => {
      const l = await obras.listar().catch(() => [] as string[])
      const parada = retomar ? await retomar.obraEmAndamento().catch(() => null) : null
      const out: Lida[] = []
      for (const pasta of l.slice(0, 200)) {
        const s = obras.situacao ? await obras.situacao(pasta).catch(() => null) : null
        if (!s) continue
        const leitura = s.plano && painel ? await painel.ler(pasta).catch(() => null) : null
        const fase = faseDaObra(s, leitura ? leitura.pct : null)
        const vivo = fase.etapa === 'obra' && !fase.concluida ? vivoDa(leitura, parada?.pasta === pasta ? parada.paradaEm : undefined) : undefined
        out.push({ pasta, nome: nomeDaPasta(pasta), fase, vivo, noAr: s.noAr })
      }
      const f = modo === 'canteiro' && construcao?.fila ? await construcao.fila().catch(() => null) : null
      if (!vivo) return
      setFila(f)
      setLidas(out)
      if (modo === 'canteiro' && !avisoDeTravasMostrado && out.some((o) => o.vivo?.travaVoce)) { avisoDeTravasMostrado = true; setAvisoTravas(true) }
    })()
    return () => { vivo = false }
  }, [obras, painel, retomar, modo, construcao, versao])

  const daqui = useMemo(() => {
    const todas = (lidas ?? []).filter((o) => (modo === 'concluidas' ? o.fase.concluida : !o.fase.concluida))
    // Inacabadas primeiro (estão esperando a pessoa), depois as em construção.
    return [...todas.filter((o) => o.fase.etapa !== 'obra'), ...todas.filter((o) => o.fase.etapa === 'obra')]
  }, [lidas, modo])
  const nFalta = daqui.filter((o) => o.fase.etapa !== 'obra').length
  const nConstrucao = daqui.length - nFalta
  const termo = busca.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '')
  const mostradas = daqui
    .filter((o) => modo === 'concluidas' || filtro === 'todas' || (filtro === 'falta') === (o.fase.etapa !== 'obra'))
    .filter((o) => !termo || o.nome.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').includes(termo))

  const abrir = async (o: Lida) => {
    // Obra parada com o computador desligado: um clique religa e abre (como o "Continuar obra" do F12).
    if (o.vivo?.religar && retomar) await retomar.continuar({ pasta: o.pasta }).catch(() => {})
    onAbrir({ pasta: o.pasta, nome: o.nome, etapa: o.fase.etapa })
  }

  return (
    <div className="at-ct">
      <header className="at-ct__cab">
        <div className="at-ct__titulo">
          <span className="at-ct__rotulo">{modo === 'canteiro' ? 'CANTEIRO DE OBRAS' : `OBRAS CONCLUÍDAS · ${daqui.length}`}</span>
          <h1>{modo === 'canteiro' ? 'Suas obras em andamento' : 'Prontas e no ar'}</h1>
        </div>
        <label className="at-ct__busca">
          <Icone nome="lupa" tamanho={18} />
          <input type="search" aria-label="Buscar obra pelo nome" placeholder="Buscar obra pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        {modo === 'canteiro' && <button type="button" className="at-ct__nova" onClick={onNova}><Icone nome="mais" tamanho={18} />Nova obra</button>}
      </header>

      {modo === 'canteiro' && daqui.length > 0 && (
        <div className="at-ct__filtros" role="group" aria-label="Filtrar obras">
          {([['todas', 'Todas', daqui.length], ['falta', 'Falta terminar', nFalta], ['construcao', 'Em construção', nConstrucao]] as const).map(([id, nome, n]) => (
            <button key={id} type="button" aria-pressed={filtro === id} className={`at-ct__filtro at-ct__filtro--${id}`} onClick={() => setFiltro(id)}>
              <span className="at-ct__ponto" aria-hidden="true" />{nome} <span className="at-ct__n">{n}</span>
            </button>
          ))}
        </div>
      )}
      {modo === 'canteiro' && painel?.enderecoCanteiro && mostradas.some((o) => o.fase.etapa === 'obra' && !o.fase.concluida) && (
        <p className="at-ct__dica"><span className="at-ct__ponto" aria-hidden="true" />Passe o mouse num cartão para ver a obra ao vivo</p>
      )}
      {modo === 'concluidas' && daqui.length > 0 && (
        <p className="at-ct__nota">Quer mudar alguma coisa numa obra pronta? Abra e converse com o Atlas. Enquanto ele constrói a mudança, a obra volta para o Canteiro; quando termina, volta para cá.</p>
      )}

      {lidas === null && <p className="at-ct__vazio" role="status">Abrindo as suas obras…</p>}
      {lidas !== null && daqui.length === 0 && (
        <div className="at-ct__vazio">
          {modo === 'canteiro'
            ? <><b>Nenhuma obra no canteiro ainda.</b><span>Comece uma obra nova: você conta a ideia e o Atlas desenha as telas junto com você.</span><button type="button" className="at-ct__nova" onClick={onNova}>Começar uma obra</button></>
            : <><b>Nenhuma obra pronta ainda.</b><span>Quando a primeira ficar pronta, ela aparece aqui, já no ar.</span></>}
        </div>
      )}
      {lidas !== null && daqui.length > 0 && mostradas.length === 0 && <p className="at-ct__vazio">Nenhuma obra com esse nome.</p>}

      {modo === 'canteiro' && daqui.some((o) => o.vivo?.travaVoce) && (
        <div className="at-ct__faixa-voce" role="status">
          <b>{daqui.filter((o) => o.vivo?.travaVoce).length === 1 ? '1 obra precisa de você.' : `${daqui.filter((o) => o.vivo?.travaVoce).length} obras precisam de você.`}</b>
          <span>As outras travas o Atlas resolve sozinho.</span>
        </div>
      )}

      {modo === 'canteiro' && fila && fila.fila.length > 0 && (() => {
        const primeira = fila.fila[0]
        const nomeDe = (p: string) => (lidas ?? []).find((o) => o.pasta === p)?.nome ?? nomeDaPasta(p)
        const n = fila.trabalhando.length
        return (
          <section className="at-ct__fila" aria-label="Como as obras estão dividindo o Claude">
            <span className="at-ct__fila-ico" aria-hidden="true"><Icone nome="lista" tamanho={18} /></span>
            <div className="at-ct__fila-txt">
              <b>{n === 1 ? '1 obra trabalhando' : `${n} obras trabalhando`}, {fila.fila.length === 1 ? '1 na fila' : `${fila.fila.length} na fila`}</b>
              <span>{plano === 'max' ? 'Plano Max' : 'Plano Pro'}: uma obra por vez gasta a cota no ritmo de sempre. {nomeDe(primeira.pasta)} começa sozinha quando {nomeDe(primeira.depoisDe)} ficar pronta.</span>
              {erroFila && <span className="at-ct__fila-erro" role="alert">{erroFila}</span>}
            </div>
            <button type="button" className="at-ct__cancelar at-ct__fila-btn" onClick={() => { setErroFila(''); setMudando(true) }}>Mudar a ordem</button>
          </section>
        )
      })()}

      <div className="at-ct__cartoes">
        {mostradas.map((o) => <Cartao key={o.pasta} o={o} enderecoDe={!o.fase.concluida && o.fase.etapa === 'obra' && painel?.enderecoCanteiro ? () => painel.enderecoCanteiro?.(o.pasta) ?? null : undefined} onAbrir={() => { void abrir(o) }} onExcluir={modo === 'canteiro' && obras.excluir && !o.fase.concluida ? () => { setErroExcluir(''); setExcluindo(o) } : undefined} />)}
      </div>

      {avisoTravas && (() => {
        const travadas = (lidas ?? []).filter((o) => o.vivo?.travaResumo)
        const voce = travadas.filter((o) => o.vivo?.travaVoce)
        const primeira = voce[0]
        return (
          <div className="at-ct__fundo">
            <div className="at-ct__confirma at-ct__fora" role="dialog" aria-modal="true" aria-labelledby="ct-fora-tit">
              <span className="at-ct__rotulo">AO ABRIR O ATLAS</span>
              <h2 id="ct-fora-tit">Enquanto você estava fora, {travadas.length === 1 ? '1 obra esbarrou' : `${travadas.length} obras esbarraram`} numa conta.</h2>
              <p>{travadas.length - voce.length > 0 ? `${travadas.length - voce.length === 1 ? 'Uma o Atlas resolve' : `${travadas.length - voce.length} o Atlas resolve`} sozinho. ` : ''}{voce.length === 1 ? 'Uma precisa de você, e leva 1 minuto.' : `${voce.length} precisam de você.`}</p>
              <ul className="at-ct__fora-lista">
                {[...voce, ...travadas.filter((o) => !o.vivo?.travaVoce)].map((o) => (
                  <li key={o.pasta} className={o.vivo?.travaVoce ? 'at-ct__fora-voce' : ''}>
                    <b>{o.nome} · {o.vivo?.travaResumo}</b>
                    <span>{o.vivo?.travaLinha}</span>
                  </li>
                ))}
              </ul>
              <div className="at-ct__confirma-acoes">
                {primeira && <button type="button" className="at-ct__nova" autoFocus onClick={() => { setAvisoTravas(false); void abrir(primeira) }}>Resolver {primeira.nome} (1 min) →</button>}
                <button type="button" className="at-ct__cancelar" onClick={() => setAvisoTravas(false)}>Ver o canteiro</button>
              </div>
            </div>
          </div>
        )
      })()}

      {mudando && fila && fila.fila[0] && construcao?.mudarVez && (() => {
        const espera = fila.fila[0]
        const nomeDe = (p: string) => (lidas ?? []).find((o) => o.pasta === p)?.nome ?? nomeDaPasta(p)
        const atual = fila.trabalhando.find((t) => t.pasta === espera.depoisDe) ?? fila.trabalhando[0] ?? { pasta: espera.depoisDe, nome: nomeDe(espera.depoisDe), restanteMin: null }
        return (
          <EscolherComeco nova={nomeDe(espera.pasta)} atual={{ nome: nomeDe(atual.pasta), restanteMin: atual.restanteMin }} novaH={null} plano={plano} ocupado={ocupado} textoCancelar="Deixar como está"
            onCancelar={() => setMudando(false)}
            onEscolher={(c: ComoComecar) => {
              if (c === 'fila') { setMudando(false); return }
              setOcupado(true)
              construcao.mudarVez!(espera.pasta, c).then(() => { setMudando(false); setVersao((v) => v + 1) }, (e) => { setMudando(false); setErroFila(textoDaTrava(e, 'Não consegui mudar a ordem.')) }).finally(() => setOcupado(false))
            }} />
        )
      })()}

      {excluindo && (
        <div className="at-ct__fundo">
          <div className="at-ct__confirma" role="alertdialog" aria-modal="true" aria-labelledby="ct-exc-tit" aria-describedby="ct-exc-txt">
            <span className="at-ct__confirma-ico" aria-hidden="true"><Icone nome="lixeira" tamanho={22} /></span>
            <h2 id="ct-exc-tit">Excluir a obra "{excluindo.nome}"?</h2>
            <p id="ct-exc-txt">Isso <b>não tem volta</b> pelo Atlas: a construção para, a obra sai do Canteiro e a pasta dela vai para {palavras().lixeira}, com o protótipo e tudo o que já foi feito.</p>
            {erroExcluir && <p className="at-ct__confirma-erro" role="alert">{erroExcluir}</p>}
            <div className="at-ct__confirma-acoes">
              <button type="button" className="at-ct__cancelar" autoFocus onClick={() => setExcluindo(null)} disabled={ocupado}>Cancelar</button>
              <button type="button" className="at-ct__excluir" onClick={() => { void excluir(excluindo) }} disabled={ocupado}>{ocupado ? 'Excluindo…' : 'Excluir para sempre'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const diaDe = (iso: string | null): string | null => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) }

function Cartao({ o, enderecoDe, onAbrir, onExcluir }: { o: Lida; enderecoDe?: () => string | null; onAbrir: () => void; onExcluir?: () => void }) {
  const [emCima, setEmCima] = useState(false)
  const { fase } = o
  const inacabada = fase.etapa !== 'obra'
  const passo = inacabada ? PASSO[fase.etapa as Exclude<EtapaObra, 'obra'>] : null
  const vivo = o.vivo
  const selo = fase.concluida ? 'NO AR' : passo ? `FALTA TERMINAR · ETAPA ${passo.n} DE 6` : vivo?.selo ?? 'EM CONSTRUÇÃO'
  const linha = fase.concluida ? 'Pronta. Abra para ver o endereço ou pedir uma mudança.' : passo ? 'O canteiro ainda não começou. Termine as etapas e o Atlas constrói sozinho.' : vivo?.linha ?? fase.rotulo
  const acao = passo ? `Próximo: ${passo.proximo}` : vivo?.acao ?? 'Abrir a obra'
  return (
    <article onMouseEnter={() => setEmCima(true)} onMouseLeave={() => setEmCima(false)} onFocus={() => setEmCima(true)} onBlur={() => setEmCima(false)} className={`at-ct__cartao${inacabada ? ' at-ct__cartao--falta' : ''}${fase.concluida ? ' at-ct__cartao--pronta' : ''}${vivo ? ` at-ct__cartao--${vivo.tom}` : ''}`} aria-label={`${o.nome}: ${fase.concluida ? 'no ar' : passo ? `falta terminar, etapa ${passo.n} de 6` : `${(vivo?.selo ?? 'em construção').toLocaleLowerCase('pt-BR')}${fase.pct !== undefined ? `, ${textoAvanco(fase.pct)}%` : ''}`}`}>
      <button type="button" className="at-ct__abrir" onClick={onAbrir}>
        <span className="at-ct__cena">
          {inacabada
            ? <PlacaDeObra nome={o.nome} parou={passo ? passo.parou : 'no começo'} />
            : <RetratoCanteiro pasta={o.pasta} endereco={enderecoDe ? enderecoDe() : null} vivo={emCima} />}
          <span className="at-ct__selo"><span className="at-ct__ponto" aria-hidden="true" />{selo}</span>
        </span>
        <span className="at-ct__corpo">
          <span className="at-ct__nome-linha"><b className="at-ct__nome" title={o.pasta}>{o.nome}</b>{!inacabada && !fase.concluida && fase.pct !== undefined && <span className="at-ct__pct">{textoAvanco(fase.pct)}%</span>}</span>
          {!fase.concluida && <span className="at-ct__barra" aria-hidden="true"><i style={{ width: `${inacabada ? ((passo!.n - 1) / 6) * 100 : (fase.pct ?? 0)}%` }} /></span>}
          {fase.concluida && o.noAr
            ? <><span className="at-ct__end">{o.noAr.endereco}</span>{diaDe(o.noAr.quando) && <span className="at-ct__linha">Concluída em {diaDe(o.noAr.quando)}</span>}</>
            : <span className="at-ct__linha">{linha}</span>}
          {vivo?.volta && !passo && !fase.concluida && <span className="at-ct__volta">{vivo.volta}</span>}
          <span className="at-ct__acao">{acao}<Icone nome="seta" tamanho={16} /></span>
        </span>
      </button>
      {onExcluir && <button type="button" className="at-ct__lixeira" aria-label={`Excluir a obra ${o.nome}`} title="Excluir a obra" onClick={onExcluir}><Icone nome="lixeira" tamanho={16} /></button>}
    </article>
  )
}
