import { useEffect, useRef, useState } from 'react'
import { Botao, Icone, Microfone, Trabalhando, useVoz } from '../ui'
import { andamentoDoDesenho } from './andamento-telas'
import { Pintor } from './Pintor'
import { JanelaCelular } from './JanelaCelular'
import { DicaDoAtlas } from './DicaDoAtlas'
import { VersoesDaTela } from './VersoesDaTela'
import { QuadroDeTelas } from './QuadroDeTelas'
import { UsarSistema } from './UsarSistema'
import { ALTURA_CELULAR, ALTURA_COMPUTADOR, LARGURA_CELULAR, LARGURA_COMPUTADOR } from './tamanhos-tela'
import { dicasDaTela } from './dicas-do-atlas'
import { conferirTelas, pedidoDaConferencia } from './conferencia-telas'
import type { PonteArquivos } from './ponte-arquivos'
import type { EstiloProposto } from './ponte-estilo'
import { aparelhoDaTela, montarNavegavel, montarSrcDoc, SANDBOX_PREVIEW, type Aparelho, type EstadoProto, type PontePrototipo, type ProgressoProto, type TelaDesenhada, type VersaoDaTela } from './ponte-prototipo'
import type { ObraDoEstilo } from './Estilo'
import './prototipo.css'

interface Props {
  obra: ObraDoEstilo
  /** O estilo escolhido no M14 (null se o cliente trouxe a própria identidade). */
  estilo: EstiloProposto | null
  prototipo: PontePrototipo
  /** Para mandar um print ou foto junto do pedido (opcional). */
  arquivos?: PonteArquivos
  onVoltar: () => void
  /** Segue para a próxima etapa do caminho: as contas (5). */
  onConcluir?: () => void
  /** Como o protótipo abre: o quadro negro com todas as telas (P4, padrão) ou uma tela por vez. */
  vistaInicial?: 'quadro' | 'navegar'
}

interface Msg { quem: 'CLAUDE' | 'VOCÊ'; txt: string }

export const recadoDoErroProto = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'O Claude que desenha as telas ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; por enquanto, não há nada que você precise refazer.'
    case 'pedido-vazio': return 'Escreva ou fale o que você quer mudar.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

export { LARGURA_CELULAR, ALTURA_CELULAR, LARGURA_COMPUTADOR, ALTURA_COMPUTADOR } from './tamanhos-tela'

/** Quanto reduzir o telefone para caber INTEIRO na moldura (pedido do Luiz, 23/11/2026: nada de rolar para o lado). Nunca aumenta. */
export function escalaDoCelular(largura: number, altura: number): number {
  if (!(largura > 0) || !(altura > 0)) return 1
  return Math.min(1, largura / LARGURA_CELULAR, altura / ALTURA_CELULAR)
}

/** Preview do celular: o HTML (gerado/importado, NÃO confiável) só vive dentro de um iframe com sandbox vazio. Nunca no DOM do app.
 *  O iframe tem SEMPRE o tamanho de um telefone de verdade (390 × 844) e é reduzido para caber: a tela fica igual à do celular,
 *  sem rolagem de lado nem texto quebrando diferente (antes ele tinha a largura da moldura, ~220 px num notebook). */
export function CelularPreview({ html, titulo, telas, inicial, realce = false }: { html: string; titulo: string; telas?: TelaDesenhada[]; inicial?: string; realce?: boolean }) {
  // Com todas as telas: protótipo NAVEGÁVEL (tocar num botão leva à outra tela). Sem elas: só esta tela.
  const doc = telas && inicial ? montarNavegavel(telas, inicial, { realce }) : montarSrcDoc(html)
  const vidro = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const el = vidro.current
    if (!el) return
    const medir = () => setEscala(escalaDoCelular(el.clientWidth, el.clientHeight))
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  return (
    <div className="at-proto__celular">
      <div className="at-proto__vidro" ref={vidro}>
        {doc === null
          ? <div className="at-proto__seguro" role="img" aria-label="Tela grande demais para mostrar">Esta tela é grande demais para eu mostrar aqui com segurança. O Claude vai deixá-la mais leve.</div>
          : <iframe className="at-proto__tela" title={titulo} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer"
              style={{ width: `${LARGURA_CELULAR}px`, height: `${ALTURA_CELULAR}px`, transform: `scale(${escala})` }} />}
      </div>
    </div>
  )
}


/** Prévia no computador: janela de navegador com a tela em 1280 × 800, reduzida para caber inteira (nunca rola de lado). */
export function ComputadorPreview({ telas, inicial, titulo, realce = false }: { telas: TelaDesenhada[]; inicial: string; titulo: string; realce?: boolean }) {
  const doc = montarNavegavel(telas, inicial, { realce })
  const vidro = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const el = vidro.current
    if (!el) return
    const medir = () => setEscala(el.clientWidth > 0 && el.clientHeight > 0 ? Math.min(1, el.clientWidth / LARGURA_COMPUTADOR, el.clientHeight / ALTURA_COMPUTADOR) : 1)
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  return (
    <div className="at-proto__computador">
      <div className="at-proto__janela" aria-hidden="true"><span /><span /><span /></div>
      <div className="at-proto__vidro at-proto__vidro--computador" ref={vidro}>
        {doc === null
          ? <div className="at-proto__seguro" role="img" aria-label="Tela grande demais para mostrar">Esta tela é grande demais para eu mostrar aqui com segurança. O Claude vai deixá-la mais leve.</div>
          : <iframe className="at-proto__tela" title={titulo} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer"
              style={{ width: `${LARGURA_COMPUTADOR}px`, height: `${ALTURA_COMPUTADOR}px`, transform: `scale(${escala})` }} />}
      </div>
    </div>
  )
}

const PAROU = 'O desenho parou no meio: sem internet ou o Claude não respondeu. Nada se perdeu: o protótipo continua sozinho quando der. Deixe o Atlas aberto.'

/** F07: telas desenhadas com o Claude no estilo escolhido, com o celular ao lado. */
export function Prototipo({ obra, estilo, prototipo, arquivos, onVoltar, onConcluir, vistaInicial = 'quadro' }: Props) {
  const [estado, setEstado] = useState<EstadoProto>({ versoes: [], atual: 0 })
  const [aba, setAba] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  // Obra sem telas: primeiro o RELATO livre do cliente (falado), que vira a base de todas as telas.
  const [pedeRelato, setPedeRelato] = useState(false)
  const [relato, setRelato] = useState('')
  const [desenhando, setDesenhando] = useState(false)
  const [andamento, setAndamento] = useState<ProgressoProto | null>(null)
  const [vista, setVista] = useState<'quadro' | 'navegar'>(vistaInicial)
  // P4/P5: a tela marcada no quadro (vira "TELA N" no pedido) e o Play em tela cheia (a partir de qual tela).
  const [marcada, setMarcada] = useState<string | null>(null)
  const [playEm, setPlayEm] = useState<string | null>(null)
  const [realce, setRealce] = useState(false)
  const [semDicas, setSemDicas] = useState(false)
  const [comparando, setComparando] = useState<string | null>(null)
  const [celular, setCelular] = useState(false)
  const iniciou = useRef(false)
  const [pedido, setPedido] = useState('')
  const [prints, setPrints] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  // Microfone: a transcrição cai no campo e continua editável antes de enviar.
  const { gravando, alternar, suportado } = useVoz((falado) => setPedido((p) => [p, falado].filter(Boolean).join(' ')))
  const vozRelato = useVoz((falado) => setRelato((r) => [r, falado].filter(Boolean).join(' ')))

  // Estimativa real (andamento-telas.ts): quando o desenho começou e quando o mapa de telas saiu.
  const inicioDesenho = useRef(0)
  const mapaSaiuEm = useRef<number | null>(null)

  const mostrarPrimeiras = (e: EstadoProto) => {
    setMsgs([{ quem: 'CLAUDE', txt: estilo ? 'Fiz as primeiras telas no estilo que você escolheu, a partir do que você contou. Toque nos botões do celular ao lado para navegar e me diga o que quer mudar.' : 'Fiz as primeiras telas com a sua identidade visual, a partir do que você contou. Toque nos botões do celular ao lado para navegar e me diga o que quer mudar.' }])
    setEstado(e)
    setAba(e.versoes.find((v) => v.numero === e.atual)?.telas[0]?.id ?? '')
  }

  // Caminho novo: 'mapa' = mapa pronto e nada pintado (começa a pintar agora, com o estilo escolhido);
  // 'mapeando'/'pintando' = o Atlas já está trabalhando: só acompanha até a 1ª versão aparecer.
  const seguirSegundoPlano = async (fase: NonNullable<ProgressoProto['fase']>) => {
    setErro('')
    setDesenhando(true)
    inicioDesenho.current = 0
    mapaSaiuEm.current = null
    const espiar = () => prototipo.progresso?.(obra.pasta).then((a) => {
      if (!a) return
      const agora = Date.now()
      if (inicioDesenho.current === 0) inicioDesenho.current = agora - 1500
      if (a.mapa.length > 0 && mapaSaiuEm.current === null) mapaSaiuEm.current = (agora - inicioDesenho.current) / 1000
      setAndamento(a)
    }, () => {})
    if (fase === 'mapa' && prototipo.pintar) {
      const t = setInterval(() => { void espiar() }, 1500)
      let ok = false
      try { mostrarPrimeiras(await prototipo.pintar(obra.pasta, obra.nome, estilo ?? null)); ok = true } catch { /* sem internet ou o Claude parou: o Atlas tenta de novo sozinho */ } finally { clearInterval(t) }
      if (ok) { setDesenhando(false); setAndamento(null); setPronto(true); return }
      setErro(PAROU)
    }
    await new Promise<void>((fim) => {
      const t = setInterval(() => {
        void (async () => {
          await espiar()
          const e = await prototipo.estado(obra.pasta).catch(() => null)
          if (e?.versoes.length) { clearInterval(t); mostrarPrimeiras(e); fim(); return }
          const a = await prototipo.progresso?.(obra.pasta).catch(() => null)
          if (a?.fase === 'mapa' && !a.parado && prototipo.pintar) { clearInterval(t); fim(); void seguirSegundoPlano('mapa') }
          else if (a?.fase === 'mapa' && a.parado) setErro(PAROU) // o Atlas tenta de novo sozinho (a cada 2 min); segue acompanhando
          else if (a?.fase === 'pintando') setErro('')
          else if (!a) { clearInterval(t); setErro('O desenho das telas parou. Conte de novo o que você quer e o Atlas desenha.'); setPedeRelato(true); fim() }
        })()
      }, 1500)
    })
    setDesenhando(false)
    setAndamento(null)
    setPronto(true)
  }

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    void (async () => {
      try {
        const e = await prototipo.estado(obra.pasta)
        if (!e.versoes.length) {
          // Caminho novo: o mapa (e talvez as telas) já está saindo em segundo plano. Acompanha em vez de pedir o relato de novo.
          const a = prototipo.progresso ? await prototipo.progresso(obra.pasta).catch(() => null) : null
          if (a?.fase) { void seguirSegundoPlano(a.fase); return }
          // (seguirSegundoPlano é estável o bastante: só lê props da obra aberta; a tela é remontada ao trocar de obra)
          setPedeRelato(true)
          return
        }
        setEstado(e)
        setAba(e.versoes.find((v) => v.numero === e.atual)?.telas[0]?.id ?? '')
      } catch (x) { setErro(recadoDoErroProto(x)) } finally { setPronto(true) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por obra (iniciou); seguirSegundoPlano muda a cada render
  }, [prototipo, obra])

  // Desenha a partir do relato. Sem um dos 3 estilos (veio de "Já tenho a minha identidade visual"): o Claude segue o design-system.md.
  const desenhar = async () => {
    setPedeRelato(false)
    setPronto(false)
    setDesenhando(true)
    setAndamento(null)
    setErro('')
    // Ao vivo: o mapa e cada tela pronta aparecem no palco enquanto o Claude desenha o resto.
    inicioDesenho.current = 0
    mapaSaiuEm.current = null
    const espiar = prototipo.progresso ? setInterval(() => {
      void prototipo.progresso?.(obra.pasta).then((a) => {
        if (!a) return
        const agora = Date.now()
        if (inicioDesenho.current === 0) inicioDesenho.current = agora - 1500 // a 1ª espiada sai 1,5 s depois do início
        if (a.mapa.length > 0 && mapaSaiuEm.current === null) mapaSaiuEm.current = (agora - inicioDesenho.current) / 1000
        setAndamento(a)
      }, () => {})
    }, 1500) : null
    try {
      const e = await prototipo.desenhar(obra.pasta, obra.nome, estilo ?? null, relato.trim())
      setMsgs([{ quem: 'CLAUDE', txt: estilo ? 'Fiz as primeiras telas no estilo que você escolheu, a partir do que você contou. Toque nos botões do celular ao lado para navegar e me diga o que quer mudar.' : 'Fiz as primeiras telas com a sua identidade visual, a partir do que você contou. Toque nos botões do celular ao lado para navegar e me diga o que quer mudar.' }])
      setEstado(e)
      setAba(e.versoes.find((v) => v.numero === e.atual)?.telas[0]?.id ?? '')
    } catch (x) { setErro(recadoDoErroProto(x)); setPedeRelato(true) } finally { if (espiar) clearInterval(espiar); setDesenhando(false); setAndamento(null); setPronto(true) }
  }

  const anexar = async () => {
    if (!arquivos) return
    try {
      const a = await arquivos.escolher('imagem')
      if (!a) return
      const g = await arquivos.guardar(obra.pasta, 'estilo/referencias', a.token)
      setPrints((l) => [...l, g.nome])
      setErro('')
    } catch { setErro('Não consegui pegar essa imagem agora. Tente de novo ou descreva com palavras.') }
  }

  const enviar = async () => {
    const texto = pedido.trim()
    if (!texto || ocupado) return
    setOcupado(true)
    setErro('')
    // O pedido (e os nomes dos prints) são DADO para o Claude: o adaptador monta com comoDado/blocoDoCliente.
    const atual = estado.versoes.find((v) => v.numero === estado.atual)
    const alvo = marcada && atual ? atual.telas.findIndex((t) => t.id === marcada) : -1
    const comTela = alvo >= 0 && atual ? `Na tela ${alvo + 1} (${atual.telas[alvo].nome}): ${texto}` : texto
    const completo = [comTela, ...prints.map((n) => `print guardado: ${n}`)].join('\n')
    setMarcada(null)
    setMsgs((m) => [...m, { quem: 'VOCÊ', txt: texto }])
    setPedido('')
    setPrints([])
    try {
      const r = await prototipo.ajustar(obra.pasta, completo)
      setEstado(r.estado)
      setMsgs((m) => [...m, { quem: 'CLAUDE', txt: r.resposta }])
    } catch (x) { setErro(recadoDoErroProto(x)); setPedido(texto) } finally { setOcupado(false) }
  }

  // 3 versões de uma tela: "Quero esta" e "Misturar" (o misturar é um ajuste que cita as versões guardadas na obra).
  const escolherVersao = async (telaId: string, v: VersaoDaTela) => {
    if (!prototipo.escolherVersao) return
    const e = await prototipo.escolherVersao(obra.pasta, telaId, v.html, v.titulo)
    setEstado(e)
    setMsgs((m) => [...m, { quem: 'CLAUDE', txt: `Pronto: fiquei com "${v.titulo}". Está na versão ${e.atual}; a anterior continua guardada.` }])
    setComparando(null)
  }
  const misturarVersoes = async (t: TelaDesenhada, texto: string) => {
    const pedidoMistura = `Na tela "${t.nome}" (id ${t.id}), misture as 3 versões que eu comparei (estão em prototipo/comparar/${t.id}-1.html, ${t.id}-2.html e ${t.id}-3.html): ${texto}`
    setMsgs((m) => [...m, { quem: 'VOCÊ', txt: texto }])
    const r = await prototipo.ajustar(obra.pasta, pedidoMistura)
    setEstado(r.estado)
    setMsgs((m) => [...m, { quem: 'CLAUDE', txt: r.resposta }])
    setComparando(null)
  }

  const versao = estado.versoes.find((v) => v.numero === estado.atual)
  const anterior = [...estado.versoes].reverse().find((v) => v.numero < estado.atual)

  // Desfazer: só muda a versão que o cliente está vendo. Nada é apagado, então dá para voltar para a mais nova também.
  const irPara = async (numero: number) => {
    if (numero === estado.atual || ocupado) return
    setOcupado(true)
    setErro('')
    try {
      const e = await prototipo.voltar(obra.pasta, numero)
      setEstado(e)
      const nova = e.versoes.find((v) => v.numero === e.atual)
      setMsgs((m) => [...m, { quem: 'CLAUDE', txt: `Pronto, voltei para a versão ${numero}. As outras versões continuam guardadas na pasta da obra; dá para ir e voltar quando quiser.` }])
      if (nova && !nova.telas.some((t) => t.id === aba)) setAba(nova.telas[0]?.id ?? '')
    } catch (x) { setErro(recadoDoErroProto(x)) } finally { setOcupado(false) }
  }
  const tela = versao?.telas.find((t) => t.id === aba) ?? versao?.telas[0]
  // Celular ou computador (Luiz, 23/11/2026): mostra só as telas do aparelho da tela aberta; a chave troca de aparelho.
  const aparelho = tela ? aparelhoDaTela(tela) : 'celular'
  const doAparelho = (a: Aparelho) => versao?.telas.filter((t) => aparelhoDaTela(t) === a) ?? []
  const telasAqui = doAparelho(aparelho)
  const temOsDois = doAparelho('celular').length > 0 && doAparelho('computador').length > 0

  const barra = (inicio: boolean) => (
    <form className="at-proto__barra" onSubmit={(e) => { e.preventDefault(); if (inicio) { if (relato.trim() && !vozRelato.gravando) void desenhar() } else void enviar() }}>
      <Microfone gravando={inicio ? vozRelato.gravando : gravando} onAlternar={inicio ? vozRelato.alternar : alternar} className="at-proto__barra-mic" />
      {inicio
        ? <>
            <label htmlFor="relato" className="at-proto__so-leitor">Conte tudo o que você imagina</label>
            <textarea id="relato" rows={2} value={relato} onChange={(e) => setRelato(e.target.value)} placeholder="Aperte o microfone e conte tudo. O que você falar aparece aqui e dá para corrigir." />
            <Botao type="submit" disabled={!relato.trim() || vozRelato.gravando}>Desenhar as telas</Botao>
          </>
        : <>
            <label htmlFor="pedido" className="at-proto__so-leitor">Pedir ajuste</label>
            {marcada && versao && (() => { const n = versao.telas.findIndex((t) => t.id === marcada); return n >= 0 ? <span className="at-proto__chip-tela"><span>TELA {n + 1}</span><button type="button" aria-label="Tirar a tela do pedido" onClick={() => setMarcada(null)}><Icone nome="x" tamanho={12} /></button></span> : null })()}
            <textarea id="pedido" rows={1} value={pedido} onChange={(e) => setPedido(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }} placeholder="Fale o que quer mudar: “troque a cor”, “crie uma tela de estoque”…" />
            {arquivos && <button type="button" className="at-proto__clipe" aria-label="Mandar foto ou print" onClick={() => void anexar()}><Icone nome="clipe" tamanho={20} /></button>}
            <Botao type="submit" disabled={!pedido.trim() || ocupado || !versao}>{ocupado ? 'Ajustando…' : 'Enviar'}</Botao>
          </>}
    </form>
  )
  const mapaAoVivo = andamento?.mapa ?? []
  const prontasAoVivo = new Map((andamento?.telas ?? []).map((t) => [t.id, t]))

  return (
    <div className="at-proto">
      <header className="at-proto__cab">
        <div className="at-proto__tit">
          <span className="at-proto__rotulo">O protótipo{estilo ? ` · Estilo "${estilo.nome}"` : ''}{versao ? ` · Versão ${versao.numero}` : ''}</span>
          <h1>{obra.nome}</h1>
        </div>
        {versao && (
          <div className="at-proto__vistas" role="group" aria-label="Como ver o protótipo">
            <button type="button" aria-pressed={vista === 'quadro'} onClick={() => setVista('quadro')}>Quadro de telas ({versao.telas.length})</button>
            <button type="button" aria-pressed={vista === 'navegar'} onClick={() => setVista('navegar')}>Uma tela por vez</button>
          </div>
        )}
        <div className="at-proto__acoes">
          {versao && <Botao variante="secundario" onClick={() => setPlayEm(marcada ?? versao.telas[0].id)}><Icone nome="play" tamanho={16} /> Usar o sistema</Botao>}
          {versao && prototipo.linkCelular && <Botao variante="secundario" onClick={() => setCelular(true)}>Ver no celular</Botao>}
          {anterior && <Botao variante="secundario" disabled={ocupado} onClick={() => void irPara(anterior.numero)}>↶ Voltar à versão {anterior.numero}</Botao>}
          <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
          <Botao disabled={!versao} onClick={() => onConcluir ? onConcluir() : onVoltar()}>Telas aprovadas: abrir as contas →</Botao>
        </div>
      </header>

      {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
      {celular && versao && prototipo.linkCelular && (
        <JanelaCelular
          gerar={async () => {
            // Vai o protótipo NAVEGÁVEL (o mesmo do celular ao lado), começando na primeira tela.
            const doc = montarNavegavel(versao.telas, versao.telas[0].id)
            if (!doc) throw new Error('prototipo-invalido')
            return prototipo.linkCelular!(obra.nome, doc)
          }}
          whatsapp={prototipo.whatsapp ? (u) => prototipo.whatsapp!(u) : undefined}
          onFechar={() => setCelular(false)}
        />
      )}

      {pedeRelato && (
        <section className="at-proto__convite" aria-label="Conte tudo o que você imagina">
          <div className="at-proto__convite-centro">
            <span className="at-proto__convite-selo">O PROTÓTIPO NASCE DA SUA VOZ</span>
            <h2>Conte tudo o que você imagina.</h2>
            <p>Fale o tempo que quiser, sem pressa, como se contasse para um amigo: o que o sistema faz, quem usa, cada tela, cada botão, o que aparece em cada lista. O Claude desenha <b>todas</b> as telas que você contar, e elas vão aparecendo aqui, uma a uma.</p>
            <span className="at-proto__convite-conta">{relato.trim() ? `${relato.trim().split(/\s+/).length} palavras até agora` : 'Comece pelo microfone aqui embaixo'}</span>
          </div>
          {!vozRelato.suportado && <span className="at-proto__dica">Este computador não liberou o microfone. Pode digitar normalmente.</span>}
          {barra(true)}
        </section>
      )}

      {desenhando && (
        <section className="at-proto__palco at-proto__palco--obra" aria-label="Telas sendo desenhadas">
          <Trabalhando titulo="O Claude está desenhando as telas" segundos={480} andamento={prototipo.progresso ? (seg) => andamentoDoDesenho({ segundos: seg, total: mapaAoVivo.length, prontas: mapaAoVivo.filter((m) => prontasAoVivo.has(m.id)).length, segundosAteMapa: mapaSaiuEm.current }) : undefined} etapas={['Lendo tudo o que você contou', 'Montando o mapa de telas: nada do que você falou fica de fora', 'Desenhando as telas, em lotes, no seu estilo', 'Ligando as telas entre si para dar para navegar', 'Caprichando nos detalhes e conferindo tudo']} />
          {mapaAoVivo.length > 0
            ? <ul className="at-proto__galeria" aria-label="Mapa de telas">
                {mapaAoVivo.map((m) => {
                  const pronta = prontasAoVivo.get(m.id)
                  const doc = pronta ? montarSrcDoc(pronta.html) : null
                  return (
                    <li key={m.id} className={`at-proto__miniatura ${pronta ? 'at-proto__miniatura--pronta' : ''}`}>
                      <div className="at-proto__mini-celular">
                        {doc ? <iframe title={`Miniatura: ${m.nome}`} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer" tabIndex={-1} /> : <div className="at-proto__mini-vazio"><span className="at-proto__mini-giro" aria-hidden="true" /></div>}
                      </div>
                      <span>{m.nome}</span>
                    </li>
                  )
                })}
              </ul>
            : <div className="at-proto__pintor"><Pintor soCena /></div>}
        </section>
      )}

      {versao && comparando && prototipo.versoesDaTela && (() => {
        const t = versao.telas.find((x) => x.id === comparando)
        return t ? <VersoesDaTela tela={t} carregar={() => prototipo.versoesDaTela!(obra.pasta, t.id)} onEscolher={(v) => escolherVersao(t.id, v)} onMisturar={(x) => misturarVersoes(t, x)} onFechar={() => setComparando(null)} /> : null
      })()}

      {versao && !comparando && vista === 'navegar' && tela && (
        <section className="at-proto__palco" aria-label="Preview do celular">
          {temOsDois && (
            <div className="at-proto__aparelhos" role="group" aria-label="Ver o protótipo em">
              {(['celular', 'computador'] as const).map((a) => {
                const n = doAparelho(a).length
                return (
                  <button key={a} type="button" aria-pressed={a === aparelho} className={`at-proto__aparelho ${a === aparelho ? 'at-proto__aparelho--on' : ''}`}
                    onClick={() => { if (a !== aparelho) setAba(doAparelho(a)[0]?.id ?? '') }}>
                    <Icone nome={a === 'celular' ? 'celular' : 'computador'} tamanho={18} />
                    {a === 'celular' ? 'Celular' : 'Computador'} · {n} {n === 1 ? 'tela' : 'telas'}
                  </button>
                )
              })}
            </div>
          )}
          <div className="at-proto__abas" role="tablist" aria-label="Telas do sistema">
            {telasAqui.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={t.id === tela.id} className={`at-proto__aba ${t.id === tela.id ? 'at-proto__aba--on' : ''}`} onClick={() => setAba(t.id)} title={t.origem ? `Veio da aba ${t.origem} da sua planilha` : undefined}>{t.nome}</button>
            ))}
          </div>
          {(() => {
            const pontos = conferirTelas(versao.telas)
            return (
              <div className={`at-proto__conf${pontos.length ? ' at-proto__conf--pontos' : ''}`} role="status" aria-label="Conferência do Atlas">
                <Icone nome={pontos.length ? 'alerta' : 'check'} tamanho={16} />
                {pontos.length === 0
                  ? <span>Conferi as {versao.telas.length} telas: tudo certo (botões, larguras e letras).</span>
                  : <>
                      <span><b>{pontos.length === 1 ? '1 ponto para conferir' : `${pontos.length} pontos para conferir`}:</b> {pontos.slice(0, 3).map((p) => `${p.tela}: ${p.texto}`).join(' ')}{pontos.length > 3 ? ' …' : ''}</span>
                      <button type="button" className="at-proto__conf-btn" onClick={() => setPedido(pedidoDaConferencia(pontos))}>Pedir para corrigir</button>
                    </>}
              </div>
            )
          })()}
          <div className="at-proto__ferramentas">
            <button type="button" aria-pressed={realce} className={`at-proto__ferr ${realce ? 'at-proto__ferr--on' : ''}`} onClick={() => setRealce((r) => !r)}><Icone nome="alvo" tamanho={16} />Onde dá para tocar?</button>
          </div>
          {aparelho === 'computador'
            ? <ComputadorPreview telas={telasAqui} inicial={tela.id} realce={realce} titulo={`Tela ${tela.nome} no computador (dá para clicar e navegar)`} />
            : <CelularPreview html={tela.html} telas={telasAqui} inicial={tela.id} realce={realce} titulo={`Tela ${tela.nome} no celular (dá para tocar e navegar)`} />}
          {!semDicas && (
            <DicaDoAtlas key={tela.id} dicas={dicasDaTela(tela, versao.telas)} onDispensar={() => setSemDicas(true)}
              onUsar={(d) => { if (d.tipo === 'versoes' && prototipo.versoesDaTela) { setComparando(tela.id); return } setPedido(d.pedido); requestAnimationFrame(() => { const c = document.getElementById('pedido') as HTMLTextAreaElement | null; c?.focus(); c?.setSelectionRange(c.value.length, c.value.length) }) }} />
          )}
          {estado.versoes.length > 1 && (
            <div className="at-proto__versoes" role="group" aria-label="Versões do protótipo">
              <span>Versões guardadas:</span>
              {estado.versoes.map((v) => (
                <button key={v.numero} type="button" aria-pressed={v.numero === estado.atual} title={v.resumo} className={`at-proto__versao ${v.numero === estado.atual ? 'at-proto__versao--on' : ''}`} disabled={ocupado} onClick={() => void irPara(v.numero)}>v{v.numero}</button>
              ))}
            </div>
          )}
        </section>
      )}

      {versao && !comparando && vista === 'quadro' && (
        <QuadroDeTelas telas={versao.telas} marcada={marcada} onMarcar={setMarcada} onUsar={(id) => setPlayEm(id)} />
      )}

      {versao && playEm && (
        <UsarSistema obraNome={obra.nome} telas={versao.telas} inicial={playEm} onFechar={() => setPlayEm(null)}
          onPedirMudanca={(id) => { setPlayEm(null); setMarcada(id); requestAnimationFrame(() => document.getElementById('pedido')?.focus()) }} />
      )}

      {!pedeRelato && (
        <div className="at-proto__rodape">
          {msgs.length > 0 && (
            <ul className="at-proto__msgs" aria-live="polite" aria-label="Conversa com o Claude">
              {msgs.slice(-2).map((m, i) => (
                <li key={`${msgs.length}-${i}`} className={`at-proto__msg ${m.quem === 'VOCÊ' ? 'at-proto__msg--eu' : ''}`}><b>{m.quem}</b>{m.txt}</li>
              ))}
            </ul>
          )}
          {!suportado && <span className="at-proto__dica">Este computador não liberou o microfone. Pode digitar normalmente.</span>}
          {prints.length > 0 && <span className="at-proto__dica">Vai junto: {prints.join(', ')}</span>}
          {!desenhando && pronto && barra(false)}
        </div>
      )}
    </div>
  )
}
