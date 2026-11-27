// "Usar o sistema" (P5, aprovado pelo Luiz em 24/11/2026): o protótipo em tela cheia, como se fosse de verdade. Setas e números
import { Esperando } from '../ui/Progresso'
// passam de tela em tela; a bolinha verde piscando mostra o que já funciona; "Pedir mudança nesta tela" volta com a tela marcada.
// Marcações (Milestone 40): "Marcar um ponto" põe um pino onde a pessoa tocar; o Atlas diz o que há ali (ajustar o que existe,
// desenhar o que falta ou criar algo novo) e sugere a ação (Aceitar, Sugerir outra, Editar por texto ou voz). Todas vão juntas em
// "Mandar para o Atlas fazer", que vira uma versão nova do protótipo. O HTML da tela continua só no iframe (sandbox só com o script do Atlas, por nonce; as telas não rodam script): o ponto
// é medido no quadro de fora (nunca dentro da tela).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { textoDaTrava } from './explicar-trava'
import { Icone, Microfone, useVoz } from '../ui'
import { CelularPreview, ComputadorPreview } from './Prototipo'
import { aparelhoDaTela, type SugestaoMarcacao, type TelaDesenhada } from './ponte-prototipo'
import { ALTURA_CELULAR, ALTURA_COMPUTADOR, LARGURA_CELULAR, LARGURA_COMPUTADOR } from './tamanhos-tela'

interface Props {
  obraNome: string
  telas: TelaDesenhada[]
  inicial: string
  onFechar: () => void
  onPedirMudanca: (id: string) => void
  /** O Atlas olha o ponto e sugere. Sem: a marcação pede o texto direto. */
  sugerir?: (telaId: string, x: number, y: number) => Promise<SugestaoMarcacao>
  /** Manda todas as marcações juntas (vira uma versão nova). */
  onMandar?: (pedido: string) => Promise<void>
}

interface Marca {
  id: number
  telaId: string
  x: number
  y: number
  fase: 'olhando' | 'sugestao' | 'escrevendo' | 'guardada'
  tipo: SugestaoMarcacao['tipo']
  alvo: string
  sugestoes: string[]
  idx: number
  texto: string
}

const TIPO: Record<SugestaoMarcacao['tipo'], { rotulo: string; classe: string; sobre: (alvo: string) => string; pergunta: string }> = {
  ajustar: { rotulo: 'AJUSTAR O QUE JÁ EXISTE', classe: 'ajustar', sobre: (a) => `${a ? `"${a}"` : 'Isto'} já funciona. Diga o que mudar e o Atlas ajusta.`, pergunta: 'O que você quer mudar aqui?' },
  desenhar: { rotulo: 'DESENHAR O QUE FALTA', classe: 'desenhar', sobre: (a) => `${a ? `"${a}"` : 'Isto'} ainda não leva a lugar nenhum. Diga o que deve acontecer e o Atlas desenha.`, pergunta: 'O que deve acontecer quando tocar aqui?' },
  criar: { rotulo: 'CRIAR ALGO NOVO AQUI', classe: 'criar', sobre: () => 'Aqui não tem nada ainda. Diga o que você quer neste lugar e o que ele faz.', pergunta: 'O que você quer neste lugar?' },
}

const tamanho = (t: TelaDesenhada) => (aparelhoDaTela(t) === 'computador' ? { w: LARGURA_COMPUTADOR, h: ALTURA_COMPUTADOR } : { w: LARGURA_CELULAR, h: ALTURA_CELULAR })

export function UsarSistema({ obraNome, telas, inicial, onFechar, onPedirMudanca, sugerir, onMandar }: Props) {
  const [i, setI] = useState(Math.max(0, telas.findIndex((t) => t.id === inicial)))
  const [realce, setRealce] = useState(true)
  const [marcando, setMarcando] = useState(false)
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [ed, setEd] = useState<number | null>(null)
  const [trabalhando, setTrabalhando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [falha, setFalha] = useState('')
  const [geo, setGeo] = useState({ left: 0, top: 0, escala: 1 })
  // A prévia conta qual tela está aberta (script do Atlas com nonce; o HTML das telas continua sem script). Tocar num botão
  // dentro do protótipo muda `i` sem recarregar; os números e as setas do app mandam a prévia para a tela pedida (irPara).
  const [nonce] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''))
  const [abriu, setAbriu] = useState(() => telas[Math.max(0, telas.findIndex((x) => x.id === inicial))]?.id ?? '')
  const [irPara, setIrPara] = useState<{ id: string; n: number } | null>(null)
  const proximo = useRef(1)
  const fechar = useRef<HTMLButtonElement>(null)
  const aparelho = useRef<HTMLDivElement>(null)
  const t = telas[Math.min(i, telas.length - 1)]
  const total = telas.length
  const vai = useCallback((j: number) => {
    const alvo = telas[j]
    if (!alvo) return
    setI(j)
    const naPrevia = telas.find((x) => x.id === abriu)
    if (naPrevia && aparelhoDaTela(naPrevia) === aparelhoDaTela(alvo)) setIrPara((r) => ({ id: alvo.id, n: (r?.n ?? 0) + 1 }))
    else { setAbriu(alvo.id); setIrPara(null) }
  }, [telas, abriu])
  const aoMudarTela = useCallback((id: string) => {
    const j = telas.findIndex((x) => x.id === id)
    if (j >= 0) setI(j) // "falta" (ainda não desenhada): fica na última tela conhecida
  }, [telas])
  const editando = marcas.find((m) => m.id === ed) ?? null
  const voz = useVoz((falado) => { if (ed !== null) setMarcas((ms) => ms.map((m) => (m.id === ed ? { ...m, texto: [m.texto, falado].filter(Boolean).join(' ') } : m))) })

  // Onde a tela está desenhada (o iframe reduzido): para pôr os pinos no lugar e medir o toque.
  const medir = useCallback(() => {
    const c = aparelho.current
    const f = c?.querySelector('iframe')
    if (!c || !f || !t) return null
    const rc = c.getBoundingClientRect()
    const rf = f.getBoundingClientRect()
    const escala = rf.width > 0 ? rf.width / tamanho(t).w : 1
    return { rf, g: { left: rf.left - rc.left, top: rf.top - rc.top, escala } }
  }, [t])
  useLayoutEffect(() => {
    const atualizar = () => { const m = medir(); if (m) setGeo(m.g) }
    atualizar()
    window.addEventListener('resize', atualizar)
    return () => window.removeEventListener('resize', atualizar)
  }, [medir, i])

  useEffect(() => {
    fechar.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (marcando) setMarcando(false); else onFechar() }
      else if ((e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return
      else if (e.key === 'ArrowRight') vai((i + 1) % total)
      else if (e.key === 'ArrowLeft') vai((i + total - 1) % total)
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onFechar, total, marcando, vai, i])

  if (!t) return null
  const doMesmo = telas.filter((x) => aparelhoDaTela(x) === aparelhoDaTela(t))
  const inicialDaPrevia = doMesmo.some((x) => x.id === abriu) ? abriu : t.id
  const avisoDaPrevia = { nonce, onTela: aoMudarTela, irPara }
  const mudar = (id: number, f: (m: Marca) => Marca) => setMarcas((ms) => ms.map((m) => (m.id === id ? f(m) : m)))

  const fincar = (e: React.MouseEvent) => {
    const m = medir()
    if (!m) return
    const { w, h } = tamanho(t)
    const x = Math.round((e.clientX - m.rf.left) / m.g.escala)
    const y = Math.round((e.clientY - m.rf.top) / m.g.escala)
    if (x < 0 || y < 0 || x > w || y > h) return
    setGeo(m.g)
    const id = proximo.current++
    const nova: Marca = { id, telaId: t.id, x, y, fase: sugerir ? 'olhando' : 'escrevendo', tipo: 'criar', alvo: '', sugestoes: [], idx: 0, texto: '' }
    setMarcas((ms) => [...ms, nova])
    setEd(id)
    setMarcando(false)
    setAviso('')
    if (sugerir) {
      sugerir(t.id, x, y).then(
        (s) => mudar(id, (mm) => (mm.fase === 'olhando' ? { ...mm, fase: 'sugestao', tipo: s.tipo, alvo: s.alvo, sugestoes: s.sugestoes, idx: 0 } : mm)),
        () => mudar(id, (mm) => (mm.fase === 'olhando' ? { ...mm, fase: 'escrevendo' } : mm)),
      )
    }
  }

  const guardadas = marcas.filter((m) => m.fase === 'guardada')
  const numero = (m: Marca) => marcas.indexOf(m) + 1
  const telaN = (id: string) => telas.findIndex((x) => x.id === id) + 1

  const mandar = async () => {
    if (!onMandar || !guardadas.length || trabalhando) return
    const linhas = guardadas.map((m, k) => {
      const n = telaN(m.telaId)
      return `${k + 1}. Tela ${n} (${telas[n - 1]?.nome ?? m.telaId}), no ponto x=${m.x}, y=${m.y} [${m.tipo}${m.alvo ? `: ${m.alvo}` : ''}]: ${m.texto}`
    })
    const pedido = ['Marcações do cliente no protótipo. Faça todas: crie o que falta e ajuste o que já existe, ligando as telas entre si.', ...linhas].join('\n')
    setTrabalhando(true)
    setFalha('')
    try {
      await onMandar(pedido)
      const n = guardadas.length
      setMarcas((ms) => ms.filter((m) => m.fase !== 'guardada'))
      setEd(null)
      setAviso(`${n === 1 ? 'O ajuste foi feito' : `Os ${n} ajustes foram feitos`}. As bolinhas novas já estão na tela.`)
    } catch (e) {
      setAviso('')
      setFalha(textoDaTrava(e, 'Não consegui fazer os ajustes. Suas marcações continuam guardadas.'))
    } finally {
      setTrabalhando(false)
    }
  }

  return (
    <div className="at-play" role="dialog" aria-modal="true" aria-label="Usando o sistema">
      <div className="at-play__topo">
        <button ref={fechar} type="button" className="at-play__fechar" aria-label="Sair da tela cheia" onClick={onFechar}><Icone nome="x" tamanho={18} /></button>
        <div className="at-play__tit"><span>{obraNome.toLocaleUpperCase('pt-BR')} · USANDO O SISTEMA</span><b>Tela {i + 1} de {total} · {t.nome}</b></div>
      </div>
      {marcando && (
        <div className="at-play__faixa" role="status">
          <Icone nome="alvo" tamanho={16} /> Toque no lugar da tela que você quer criar ou mudar
          <button type="button" onClick={() => setMarcando(false)}>Cancelar</button>
        </div>
      )}
      <div className="at-play__numeros" role="group" aria-label="Telas">
        {telas.map((x, j) => (
          <button key={x.id} type="button" aria-label={`Ir para a tela ${j + 1}`} aria-current={j === i ? 'true' : undefined} className={j === i ? 'at-play__n--on' : ''} title={x.nome} onClick={() => vai(j)}>{j + 1}</button>
        ))}
      </div>
      <div className="at-play__palco">
        <button type="button" className="at-play__seta" aria-label="Tela anterior" onClick={() => vai((i + total - 1) % total)}>‹</button>
        <div className={`at-play__aparelho${marcando ? ' at-play__aparelho--marcando' : ''}`} ref={aparelho}>
          {aparelhoDaTela(t) === 'computador'
            ? <ComputadorPreview key={`computador-${inicialDaPrevia}`} telas={doMesmo} inicial={inicialDaPrevia} realce={realce} aviso={avisoDaPrevia} titulo={`Tela ${t.nome} no computador (dá para clicar e navegar)`} />
            : <CelularPreview key={`celular-${inicialDaPrevia}`} html={t.html} telas={doMesmo} inicial={inicialDaPrevia} realce={realce} aviso={avisoDaPrevia} titulo={`Tela ${t.nome} no celular (dá para tocar e navegar)`} />}
          {marcando && <button type="button" className="at-play__alvo" aria-label="Escolher o lugar da marcação" onClick={fincar} />}
          {marcas.filter((m) => m.telaId === t.id).map((m) => (
            <button key={m.id} type="button" className={`at-play__pino${m.id === ed ? ' at-play__pino--on' : ''}`} aria-label={`Marcação ${numero(m)}`}
              style={{ left: geo.left + m.x * geo.escala, top: geo.top + m.y * geo.escala }} onClick={() => { setEd(m.id); setMarcando(false) }}>
              <span>{numero(m)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="at-play__seta" aria-label="Próxima tela" onClick={() => vai((i + 1) % total)}>›</button>
      </div>

      <div className="at-play__lado">
        {editando && (() => {
          const k = TIPO[editando.tipo]
          const n = numero(editando)
          return (
            <div className="at-play__balao" role="dialog" aria-label={`Marcação ${n}`}>
              <div className="at-play__balao-tit"><span className="at-play__bola">{n}</span><span>MARCAÇÃO {n} · TELA {telaN(editando.telaId)}</span></div>
              {editando.fase === 'olhando'
                ? <div className="at-play__olhando" role="status"><span>O Atlas está olhando este ponto…</span><Esperando rotulo="Olhando o ponto marcado" agora="Lendo a tela e o pedido" costume={[10, 40]} /></div>
                : (
                  <>
                    {sugerir && <div className={`at-play__tipo at-play__tipo--${k.classe}`}><b>{k.rotulo}</b><span>{k.sobre(editando.alvo)}</span></div>}
                    {editando.fase === 'sugestao' && (
                      <>
                        <div className="at-play__sug">
                          <span className="at-play__sug-tit"><Icone nome="brilho" tamanho={14} /> O ATLAS SUGERE · {editando.idx + 1} DE {editando.sugestoes.length}</span>
                          <span>{editando.sugestoes[editando.idx]}</span>
                        </div>
                        <div className="at-play__acoes">
                          <button type="button" className="at-play__prim" onClick={() => { mudar(editando.id, (m) => ({ ...m, fase: 'guardada', texto: m.sugestoes[m.idx] })); setEd(null) }}>Aceitar</button>
                          {editando.sugestoes.length > 1 && <button type="button" className="at-play__sec" onClick={() => mudar(editando.id, (m) => ({ ...m, idx: (m.idx + 1) % m.sugestoes.length }))}>Sugerir outra</button>}
                          <button type="button" className="at-play__sec" onClick={() => mudar(editando.id, (m) => ({ ...m, fase: 'escrevendo', texto: m.sugestoes[m.idx] }))}>Editar</button>
                        </div>
                      </>
                    )}
                    {(editando.fase === 'escrevendo' || editando.fase === 'guardada') && (
                      <>
                        <label htmlFor="at-nota" className="at-play__pergunta">{k.pergunta}</label>
                        <div className="at-play__campo">
                          <textarea id="at-nota" rows={4} value={editando.texto} onChange={(e) => { const v = e.target.value; mudar(editando.id, (m) => ({ ...m, texto: v })) }} placeholder="Escreva ou fale do seu jeito." />
                          <Microfone gravando={voz.gravando} onAlternar={voz.alternar} className="at-play__mic-campo" />
                        </div>
                        <div className="at-play__acoes">
                          <button type="button" className="at-play__prim" disabled={!editando.texto.trim()} onClick={() => { mudar(editando.id, (m) => ({ ...m, fase: 'guardada', texto: m.texto.trim() })); setEd(null) }}>Guardar marcação</button>
                        </div>
                      </>
                    )}
                  </>
                )}
              <button type="button" className="at-play__tirar" onClick={() => { setMarcas((ms) => ms.filter((m) => m.id !== editando.id)); setEd(null) }}>Tirar a marcação</button>
            </div>
          )
        })()}
        {!editando && guardadas.length > 0 && (
          <section className="at-play__lista" aria-label="Suas marcações">
            <span className="at-play__lista-tit">SUAS MARCAÇÕES · {guardadas.length}</span>
            {guardadas.map((m) => (
              <button key={m.id} type="button" className="at-play__item" onClick={() => { vai(telaN(m.telaId) - 1); setEd(m.id) }}>
                <span className="at-play__bola">{numero(m)}</span>
                <span><em>TELA {telaN(m.telaId)} · {m.tipo === 'ajustar' ? 'AJUSTAR' : m.tipo === 'desenhar' ? 'DESENHAR' : 'CRIAR'}</em>{m.texto}</span>
              </button>
            ))}
            {trabalhando
              ? <div className="at-play__olhando" role="status"><span>O Atlas está fazendo {guardadas.length === 1 ? 'o ajuste' : `os ${guardadas.length} ajustes`}…</span><Esperando rotulo="Fazendo os ajustes" agora={guardadas.length === 1 ? '1 ajuste' : `${guardadas.length} ajustes`} costume={[60, 60 + 90 * guardadas.length]} /></div>
              : onMandar && <button type="button" className="at-play__prim" onClick={() => void mandar()}>Mandar para o Atlas fazer</button>}
            {falha && <p className="at-play__falha" role="alert">{falha}</p>}
            <span className="at-play__miuda">O Atlas cria o que falta e ajusta o que já existe, do jeito que você explicou.</span>
          </section>
        )}
        {!editando && !guardadas.length && aviso && <p className="at-play__aviso" role="status"><b>Pronto.</b> {aviso}</p>}
      </div>

      <div className="at-play__rodape">
        <div className="at-play__dica">
          <b>Use como se fosse de verdade</b>
          <span>A bolinha verde mostra o que já funciona. Quer criar ou mudar alguma coisa? Marque o lugar e explique.</span>
          <button type="button" className="at-play__marcar" aria-pressed={marcando} onClick={() => { setMarcando((v) => !v); setEd(null) }}><Icone nome="alvo" tamanho={16} /> Marcar um ponto</button>
          <button type="button" className="at-play__realce" aria-pressed={realce} onClick={() => setRealce((r) => !r)}>{realce ? 'Esconder as bolinhas' : 'Mostrar as bolinhas'}</button>
        </div>
        <button type="button" className="at-play__pedir" onClick={() => onPedirMudanca(t.id)}>
          <span className="at-play__mic" aria-hidden="true"><Icone nome="microfone" tamanho={18} /></span>
          <span className="at-play__chip">TELA {i + 1}</span>
          Pedir mudança nesta tela
        </button>
      </div>
    </div>
  )
}
