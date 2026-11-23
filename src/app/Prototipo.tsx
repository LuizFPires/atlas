import { useEffect, useRef, useState } from 'react'
import { Botao, Icone, Microfone, Trabalhando, useVoz } from '../ui'
import { andamentoDoDesenho } from './andamento-telas'
import { Pintor } from './Pintor'
import { JanelaCelular } from './JanelaCelular'
import type { PonteArquivos } from './ponte-arquivos'
import type { EstiloProposto } from './ponte-estilo'
import { montarNavegavel, montarSrcDoc, SANDBOX_PREVIEW, type EstadoProto, type PontePrototipo, type ProgressoProto, type TelaDesenhada } from './ponte-prototipo'
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
  /** Segue para dar o nome (F07b, Batismo). */
  onConcluir?: () => void
}

interface Msg { quem: 'CLAUDE' | 'VOCÊ'; txt: string }

export const recadoDoErroProto = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'O Claude que desenha as telas ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; por enquanto, não há nada que você precise refazer.'
    case 'pedido-vazio': return 'Escreva ou fale o que você quer mudar.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

/** Preview do celular: o HTML (gerado/importado, NÃO confiável) só vive dentro de um iframe com sandbox vazio. Nunca no DOM do app. */
export function CelularPreview({ html, titulo, telas, inicial }: { html: string; titulo: string; telas?: TelaDesenhada[]; inicial?: string }) {
  // Com todas as telas: protótipo NAVEGÁVEL (tocar num botão leva à outra tela). Sem elas: só esta tela.
  const doc = telas && inicial ? montarNavegavel(telas, inicial) : montarSrcDoc(html)
  return (
    <div className="at-proto__celular">
      {doc === null
        ? <div className="at-proto__seguro" role="img" aria-label="Tela grande demais para mostrar">Esta tela é grande demais para eu mostrar aqui com segurança. O Claude vai deixá-la mais leve.</div>
        : <iframe className="at-proto__tela" title={titulo} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer" />}
    </div>
  )
}

/** F07: telas desenhadas com o Claude no estilo escolhido, com o celular ao lado. */
export function Prototipo({ obra, estilo, prototipo, arquivos, onVoltar, onConcluir }: Props) {
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
  const [vista, setVista] = useState<'navegar' | 'todas'>('navegar')
  const [celular, setCelular] = useState(false)
  const iniciou = useRef(false)
  const [pedido, setPedido] = useState('')
  const [prints, setPrints] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  // Microfone: a transcrição cai no campo e continua editável antes de enviar.
  const { gravando, alternar, suportado } = useVoz((falado) => setPedido((p) => [p, falado].filter(Boolean).join(' ')))
  const vozRelato = useVoz((falado) => setRelato((r) => [r, falado].filter(Boolean).join(' ')))

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    void (async () => {
      try {
        const e = await prototipo.estado(obra.pasta)
        if (!e.versoes.length) { setPedeRelato(true); return }
        setEstado(e)
        setAba(e.versoes.find((v) => v.numero === e.atual)?.telas[0]?.id ?? '')
      } catch (x) { setErro(recadoDoErroProto(x)) } finally { setPronto(true) }
    })()
  }, [prototipo, obra])

  // Desenha a partir do relato. Sem um dos 3 estilos (veio de "Já tenho a minha identidade visual"): o Claude segue o design-system.md.
  // Estimativa real (andamento-telas.ts): quando o desenho começou e quando o mapa de telas saiu.
  const inicioDesenho = useRef(0)
  const mapaSaiuEm = useRef<number | null>(null)
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
    const completo = [texto, ...prints.map((n) => `print guardado: ${n}`)].join('\n')
    setMsgs((m) => [...m, { quem: 'VOCÊ', txt: texto }])
    setPedido('')
    setPrints([])
    try {
      const r = await prototipo.ajustar(obra.pasta, completo)
      setEstado(r.estado)
      setMsgs((m) => [...m, { quem: 'CLAUDE', txt: r.resposta }])
    } catch (x) { setErro(recadoDoErroProto(x)); setPedido(texto) } finally { setOcupado(false) }
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
          <span className="at-proto__rotulo">Projeto 2 de 3 · Telas{estilo ? ` · Estilo "${estilo.nome}"` : ''}{versao ? ` · Versão ${versao.numero}` : ''}</span>
          <h1>{obra.nome}</h1>
        </div>
        {versao && (
          <div className="at-proto__vistas" role="group" aria-label="Como ver o protótipo">
            <button type="button" aria-pressed={vista === 'navegar'} onClick={() => setVista('navegar')}>Navegar</button>
            <button type="button" aria-pressed={vista === 'todas'} onClick={() => setVista('todas')}>Todas as telas ({versao.telas.length})</button>
          </div>
        )}
        <div className="at-proto__acoes">
          {versao && prototipo.linkCelular && <Botao variante="secundario" onClick={() => setCelular(true)}>Ver no celular</Botao>}
          {anterior && <Botao variante="secundario" disabled={ocupado} onClick={() => void irPara(anterior.numero)}>↶ Voltar à versão {anterior.numero}</Botao>}
          <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
          <Botao disabled={!versao} onClick={() => onConcluir ? onConcluir() : onVoltar()}>Telas do meu jeito: dar o nome →</Botao>
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

      {versao && vista === 'navegar' && tela && (
        <section className="at-proto__palco" aria-label="Preview do celular">
          <div className="at-proto__abas" role="tablist" aria-label="Telas do sistema">
            {versao.telas.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={t.id === tela.id} className={`at-proto__aba ${t.id === tela.id ? 'at-proto__aba--on' : ''}`} onClick={() => setAba(t.id)}>{t.nome}</button>
            ))}
          </div>
          <CelularPreview html={tela.html} telas={versao.telas} inicial={tela.id} titulo={`Tela ${tela.nome} no celular (dá para tocar e navegar)`} />
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

      {versao && vista === 'todas' && (
        <section className="at-proto__palco" aria-label="Todas as telas">
          <ul className="at-proto__galeria">
            {versao.telas.map((t) => {
              const doc = montarSrcDoc(t.html)
              return (
                <li key={t.id} className="at-proto__miniatura at-proto__miniatura--pronta">
                  <button type="button" className="at-proto__mini-abrir" aria-label={`Abrir ${t.nome}`} onClick={() => { setAba(t.id); setVista('navegar') }}>
                    <div className="at-proto__mini-celular">{doc && <iframe title={`Miniatura: ${t.nome}`} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer" tabIndex={-1} />}</div>
                    <span>{t.nome}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
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
