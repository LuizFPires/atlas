import { useState } from 'react'
import { Botao, CampoFalado, Icone, useVoz } from '../ui'
import type { PonteArquivos } from './ponte-arquivos'
import type { EntradaEstilo, EstiloProposto, PonteEstilo } from './ponte-estilo'
import { FASES, linkCurto, MAX_REFERENCIAS, MIN_REFERENCIAS, MODOS, normalizarLink, SENTIMENTOS, UPLOADS } from './estilo-dados'
import { PaletaCores } from './PaletaCores'
import { Pintor } from './Pintor'
import './estilo.css'

/** A obra que acabou de ser criada (nome e subpasta dentro de Atlas\Obras). */
export interface ObraDoEstilo { nome: string; pasta: string }

interface Props {
  obra: ObraDoEstilo
  arquivos: PonteArquivos
  estilo: PonteEstilo
  onVoltar: () => void
  /** Depois que o design system foi guardado na pasta da obra. */
  onConcluir?: (resultado: { estilo: EstiloProposto | null; caminho: string }) => void
}

interface Ref { tipo: 'link' | 'print'; valor: string; texto: string }

const recado = (e: unknown, aceita: string, maior: string) => {
  const m = e instanceof Error ? e.message : ''
  if (m === 'tipo-nao-aceito') return `Esse tipo de arquivo eu não consigo ler. Pode ser ${aceita}.`
  if (m === 'grande-demais') return `Esse arquivo é grande demais. Tente ${maior}, de até 20 MB.`
  return 'Não consegui pegar esse arquivo agora. Tente de novo em instantes.'
}
const recadoPrint = (e: unknown) => recado(e, 'PNG, JPG ou WEBP', 'um print menor')
const recadoUpload = (e: unknown) => recado(e, 'PNG, JPG, WEBP, PDF ou o design-system.md', 'um menor')

/** F06b: estilo do sistema (projeto 1/3). Referências (link, print ou fala) e o sentimento desejado. */
export function Estilo({ obra, arquivos, estilo, onVoltar, onConcluir }: Props) {
  const [refs, setRefs] = useState<Ref[]>([])
  const [link, setLink] = useState('')
  const [fala, setFala] = useState('')
  const [sentir, setSentir] = useState<string[]>([])
  const [extra, setExtra] = useState('')
  const [aviso, setAviso] = useState('')
  const [propostos, setPropostos] = useState<EstiloProposto[] | null>(null)
  const [escolhido, setEscolhido] = useState('')
  const [ocupado, setOcupado] = useState<'' | 'propondo' | 'guardando'>('')
  const [erro, setErro] = useState('')
  const [guardado, setGuardado] = useState<{ estilo: EstiloProposto | null; caminho: string } | null>(null)
  const [modo, setModo] = useState<'criar' | 'tenho'>('criar')
  // Identidade que o cliente já tem: nomes dos arquivos guardados na obra, por tipo.
  const [enviados, setEnviados] = useState<Record<string, string[]>>({})
  const [coresTxt, setCoresTxt] = useState('')
  const [paleta, setPaleta] = useState<string[]>([])
  const [figma, setFigma] = useState('')
  // Nome REALMENTE gravado na raiz da obra do design-system.md pronto ('' = não veio nenhum).
  const [prontoDS, setProntoDS] = useState('')

  const { gravando, alternar, suportado } = useVoz((falado) => setFala((v) => [v, falado].filter(Boolean).join(' ')))
  const total = refs.length + (fala.trim() ? 1 : 0)
  const cheio = total >= MAX_REFERENCIAS

  const adicionarLink = () => {
    if (!link.trim()) return
    const l = normalizarLink(link)
    if (!l) { setAviso('Esse link não parece certo. Cole o endereço do site, tipo aesop.com.'); return }
    if (cheio) { setAviso('Três referências já bastam. Tire uma para colocar outra.'); return }
    if (refs.some((r) => r.valor === l)) { setAviso('Esse link você já mandou.'); return }
    setAviso('')
    setRefs([...refs, { tipo: 'link', valor: l, texto: linkCurto(l) }])
    setLink('')
  }

  const mandarPrint = async () => {
    if (cheio) { setAviso('Três referências já bastam. Tire uma para colocar outra.'); return }
    try {
      const a = await arquivos.escolher('imagem')
      if (!a) return
      const g = await arquivos.guardar(obra.pasta, 'estilo/referencias', a.token)
      setAviso('')
      setRefs((r) => [...r, { tipo: 'print', valor: g.nome, texto: `Print: ${g.nome}` }])
    } catch (e) { setAviso(recadoPrint(e)) }
  }

  const entrada = (): EntradaEstilo => ({
    referencias: [...refs.map((r) => ({ tipo: r.tipo, valor: r.valor })), ...(fala.trim() ? [{ tipo: 'fala' as const, valor: fala.trim() }] : [])],
    sentimentos: sentir,
    extra: extra.trim(),
  })
  const faltaRef = total < MIN_REFERENCIAS
  const faltaSentir = sentir.length === 0 && !extra.trim()

  const propor = async () => {
    if (faltaRef) { setErro('Mande pelo menos 2 referências: link, print ou falando.'); return }
    if (faltaSentir) { setErro('Escolha pelo menos um jeito que o seu cliente deve se sentir.'); return }
    setErro('')
    setOcupado('propondo')
    try {
      const p = await estilo.propor(entrada(), obra.pasta)
      setPropostos(p)
      setEscolhido(p[0]?.id ?? '')
    } catch { setErro('Não consegui montar os estilos agora. Suas referências continuam aqui; tente de novo em instantes.') }
    finally { setOcupado('') }
  }

  const usar = async () => {
    const e = propostos?.find((p) => p.id === escolhido)
    if (!e) return
    setErro('')
    setOcupado('guardando')
    try {
      const { caminho } = await estilo.materializar(obra.pasta, { tipo: 'estilo', estilo: e, entrada: entrada() })
      setGuardado({ estilo: e, caminho })
    } catch { setErro('Não consegui guardar o estilo na pasta da obra agora. Sua escolha continua aqui; tente de novo em instantes.') }
    finally { setOcupado('') }
  }

  const subir = async (id: (typeof UPLOADS)[number]['id']) => {
    try {
      const a = await arquivos.escolher(id)
      if (!a) return
      // Um design-system.md pronto vai direto para a raiz da obra; o resto fica em estilo/identidade.
      const pronto = id === 'manual' && a.nome.toLowerCase() === 'design-system.md'
      const g = await arquivos.guardar(obra.pasta, pronto ? 'raiz' : 'estilo/identidade', a.token)
      setAviso('')
      if (pronto) setProntoDS(g.nome)
      setEnviados((e) => ({ ...e, [id]: [...(e[id] ?? []), g.nome] }))
    } catch (e) { setAviso(recadoUpload(e)) }
  }
  const tirarEnvio = (id: string, nome: string) => {
    setEnviados((e) => ({ ...e, [id]: (e[id] ?? []).filter((n) => n !== nome) }))
    if (nome === prontoDS) setProntoDS('')
  }
  const figmaOk = figma.trim() ? normalizarLink(figma) : null
  const todosArquivos = Object.values(enviados).flat()
  const temIdentidade = todosArquivos.length > 0 || paleta.length > 0 || !!coresTxt.trim() || !!figmaOk

  const usarIdentidade = async () => {
    if (!temIdentidade) { setErro('Mande pelo menos uma coisa: a logo, as cores ou o manual.'); return }
    if (figma.trim() && !figmaOk) { setErro('Esse link do manual não parece certo. Cole o endereço completo.'); return }
    setErro('')
    setOcupado('guardando')
    try {
      const { caminho } = await estilo.materializar(obra.pasta, {
        tipo: 'identidade',
        identidade: { arquivos: todosArquivos.filter((n) => n !== prontoDS), cores: [paleta.length ? `Cores da marca: ${paleta.join(', ')}` : '', coresTxt.trim(), figmaOk ?? ''].filter(Boolean).join(String.fromCharCode(10)), prontoDS: prontoDS || undefined },
      })
      setGuardado({ estilo: null, caminho })
    } catch { setErro('Não consegui guardar o design system na pasta da obra agora. O que você mandou continua aqui; tente de novo em instantes.') }
    finally { setOcupado('') }
  }

  const alternarSentir = (s: string) => setSentir(sentir.includes(s) ? sentir.filter((x) => x !== s) : [...sentir, s])

  return (
    <div className="at-estilo">
      <div className="at-estilo__fases">
        {FASES.map((f, i) => (
          <div key={f.n} className={`at-estilo__fase ${i === 0 ? 'at-estilo__fase--agora' : ''}`} aria-current={i === 0 ? 'step' : undefined}><span>{f.n}</span>{f.nome}</div>
        ))}
        <span className="at-estilo__proj">PROJETO · {obra.nome.toUpperCase()}</span>
      </div>
      <header className="at-estilo__cab">
        <h1>Qual é a cara do seu sistema?</h1>
        <span>Antes de desenhar as telas, vamos escolher as cores, as letras e o jeito dos botões. Assim o protótipo já nasce com a cara da sua barbearia.</span>
      </header>

      <div className="at-estilo__modos" role="group" aria-label="Como você quer começar">
        {MODOS.map((m) => <button key={m.id} type="button" aria-pressed={modo === m.id} className={`at-estilo__modo ${modo === m.id ? 'at-estilo__modo--on' : ''}`} onClick={() => { setModo(m.id); setErro(''); setAviso(''); setGuardado(null) }}>{m.nome}</button>)}
      </div>
      <div className="at-estilo__grade">
      {modo === 'criar' && (
      <div className="at-estilo__card">
        <b className="at-estilo__tit">Mande 2 ou 3 sites ou apps que você acha bonitos</b>
        <span className="at-estilo__sub">Pode ser de qualquer ramo: uma loja, um banco, um restaurante. Vale link ou print da tela.</span>

        <ul className="at-estilo__refs" aria-label="Referências que você mandou">
          {refs.map((r) => (
            <li key={r.valor} className="at-estilo__ref at-estilo__ref--ok">
              <span className="at-estilo__ref-txt">{r.texto}</span>
              <span className="at-estilo__ref-st"><Icone nome="check" tamanho={14} /> anotado</span>
              <button type="button" className="at-estilo__tirar" aria-label={`Tirar ${r.texto}`} onClick={() => setRefs(refs.filter((x) => x !== r))}><Icone nome="x" tamanho={14} /></button>
            </li>
          ))}
          {refs.length === 0 && !fala.trim() && <li className="at-estilo__ref"><span className="at-estilo__ref-txt at-estilo__ref-txt--vazio">Ainda não mandou nenhuma referência</span></li>}
        </ul>

        <form className="at-estilo__link" onSubmit={(e) => { e.preventDefault(); adicionarLink() }}>
          <CampoFalado rotulo="Cole um link" obs="(opcional se você mandar print ou falar)" valor={link} onChange={setLink} placeholder="aesop.com" />
          <Botao type="submit" variante="secundario">Adicionar link</Botao>
        </form>

        <div className="at-estilo__acoes">
          <button type="button" className="at-estilo__btn" onClick={mandarPrint}><Icone nome="clipe" tamanho={16} /> Mandar print</button>
          <button type="button" className={`at-estilo__btn at-estilo__btn--lime ${gravando ? 'at-estilo__btn--gravando' : ''}`} aria-pressed={gravando} onClick={alternar}>
            <Icone nome="microfone" tamanho={16} />{gravando ? 'Parar de gravar' : 'Falar o que você gosta'}
          </button>
        </div>
        {gravando && <div className="at-nova__ouvindo" role="status"><i /> Ouvindo… <span>Conte o que você acha bonito, do seu jeito.</span></div>}
        {(fala || gravando) && (
          <label className="at-estilo__fala">
            <span>O Atlas escreveu assim. Pode corrigir se quiser:</span>
            <textarea rows={3} value={fala} onChange={(e) => setFala(e.target.value)} />
          </label>
        )}
        {!suportado && <span className="at-estilo__sub">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
        {aviso && <p className="at-nova__erro" role="alert">{aviso}</p>}

        <b className="at-estilo__tit at-estilo__tit--pq">O que o seu cliente deve sentir ao abrir o sistema?</b>
        <div className="at-estilo__sentir" role="group" aria-label="O que o cliente deve sentir">
          {SENTIMENTOS.map((s) => {
            const on = sentir.includes(s)
            return <button key={s} type="button" aria-pressed={on} className={`at-estilo__chip ${on ? 'at-estilo__chip--on' : ''}`} onClick={() => alternarSentir(s)}>{on && <Icone nome="check" tamanho={14} />}{s}</button>
          })}
        </div>
        <CampoFalado rotulo="Quer dizer de outro jeito?" obs="(opcional)" valor={extra} onChange={setExtra} placeholder="Ex.: que pareça uma barbearia de bairro, mas com capricho" />
        <span className="at-estilo__sub">{total} de {MIN_REFERENCIAS} a {MAX_REFERENCIAS} referências</span>
        <Botao onClick={propor} disabled={ocupado !== ''}>{ocupado === 'propondo' ? 'Montando os estilos…' : propostos ? 'Montar os 3 estilos de novo' : 'Mostrar 3 estilos'}</Botao>
      </div>
      )}

      {modo === 'tenho' && (
        <div className="at-estilo__card">
          <b className="at-estilo__tit">Mande o que você já tem</b>
          <span className="at-estilo__sub">O Atlas lê tudo e monta o design system do seu sistema a partir disso.</span>
          {UPLOADS.map((u) => {
            const nomes = enviados[u.id] ?? []
            return (
              <div key={u.id} className="at-estilo__up">
                <button type="button" className={`at-estilo__upload ${nomes.length ? 'at-estilo__upload--ok' : ''}`} onClick={() => subir(u.id)} aria-label={`${u.nome}: escolher arquivo`}>
                  <span className="at-estilo__upload-ic"><Icone nome={u.icone} tamanho={24} /></span>
                  <span className="at-estilo__upload-txt"><b>{u.nome}</b><span>{u.desc}</span></span>
                  <span className="at-estilo__upload-go">Escolher arquivo</span>
                </button>
                {nomes.length > 0 && (
                  <ul className="at-estilo__enviados" aria-label={`Arquivos de ${u.nome}`}>
                    {nomes.map((n) => (
                      <li key={n}><Icone nome="check" tamanho={14} /> {n}{u.id === 'manual' && n === prontoDS && <em> · design system pronto</em>}
                        <button type="button" className="at-estilo__tirar" aria-label={`Tirar ${n}`} onClick={() => tirarEnvio(u.id, n)}><Icone nome="x" tamanho={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          <div className="at-estilo__paleta">
            <span className="at-estilo__paleta-tit"><b>As cores da sua marca</b> (opcional)</span>
            <PaletaCores cores={paleta} onChange={setPaleta} />
          </div>
          <CampoFalado rotulo="Ou conte as cores com as suas palavras" obs="(opcional)" valor={coresTxt} onChange={setCoresTxt} placeholder="Ex.: azul-marinho com detalhes dourados" />
          <CampoFalado rotulo="Link do manual ou do Figma" obs="(opcional)" valor={figma} onChange={setFigma} placeholder="figma.com/..." />
          {aviso && <p className="at-nova__erro" role="alert">{aviso}</p>}
        </div>
      )}

      {modo === 'tenho' && (
        <section className="at-estilo__estilos" aria-label="O que o Atlas faz com o que você mandou">
          <div className="at-estilo__estilos-cab"><b>O que o Atlas vai fazer</b></div>
          <div className="at-estilo__vazio">
            <span>Eu leio a logo, as cores e o manual e escrevo o design system do seu sistema na pasta da obra.</span>
            <span>Se você mandar um <b>design-system.md</b> pronto, eu uso ele do jeito que veio.</span>
            <span>Seus arquivos ficam na pasta da obra, no seu computador. O Atlas e o Claude leem esses arquivos para criar o seu estilo.</span>
          </div>
        </section>
      )}

      {modo === 'criar' && <section className="at-estilo__estilos" aria-label="Estilos">
        <div className="at-estilo__estilos-cab"><b>O Atlas montou 3 estilos para você</b><span>toque para escolher</span></div>
        {ocupado === 'propondo' ? (
          <Pintor />
        ) : propostos ? (
          <div className="at-estilo__tres" role="radiogroup" aria-label="Escolha um estilo">
            {propostos.map((e) => (
              <button key={e.id} type="button" role="radio" aria-checked={e.id === escolhido} className={`at-estilo__opcao ${e.id === escolhido ? 'at-estilo__opcao--on' : ''}`} onClick={() => { setEscolhido(e.id); setGuardado(null) }}>
                <div className="at-estilo__previa" style={{ background: e.fundo }}>
                  <div className="at-estilo__previa-topo" style={{ background: e.topo, color: e.topoTxt, fontFamily: e.fonte }}>Marcar horário</div>
                  <div className="at-estilo__previa-corpo">
                    <div className="at-estilo__previa-linha">
                      <span style={{ borderRadius: e.raio, background: e.topo }} />
                      <span style={{ borderRadius: e.raio, border: `1px solid ${e.linha}` }} />
                      <span style={{ borderRadius: e.raio, border: `1px solid ${e.linha}` }} />
                    </div>
                    <div className="at-estilo__previa-grade">
                      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} style={{ borderRadius: e.raio, ...(i === 4 ? { background: e.destaque } : { border: `1px solid ${e.linha}` }) }} />)}
                    </div>
                    <span className="at-estilo__previa-botao" style={{ borderRadius: e.raio, background: e.destaque, color: e.destTxt }}>Marcar</span>
                  </div>
                </div>
                <div className="at-estilo__bolas" aria-hidden="true"><span style={{ background: e.topo }} /><span style={{ background: e.destaque }} /><span style={{ background: e.fundo }} /></div>
                <b>{e.nome}</b>
                <span>{e.de}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="at-estilo__vazio">
            <span>Mande 2 ou 3 referências e diga o que o seu cliente deve sentir. Aí eu monto 3 estilos para você escolher.</span>
          </div>
        )}
      </section>}
      </div>

      {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
      {guardado && (
        <div className="at-estilo__feito" role="status">
          <b>{guardado.estilo ? `Estilo "${guardado.estilo.nome}" guardado!` : 'Identidade visual guardada!'}</b>
          <span>Ele já é o design system do seu sistema, guardado na pasta da obra. Dá para ajustar depois.</span>
          <code>{guardado.caminho}</code>
        </div>
      )}
      <div className="at-estilo__rodape">
        <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
        {guardado
          ? <Botao onClick={() => onConcluir?.(guardado)}>Desenhar as telas →</Botao>
          : modo === 'tenho'
            ? <Botao disabled={!temIdentidade || ocupado !== ''} onClick={usarIdentidade}>{ocupado === 'guardando' ? 'Guardando…' : 'Usar a minha identidade e desenhar as telas →'}</Botao>
            : <Botao disabled={!propostos || ocupado !== ''} onClick={usar}>{ocupado === 'guardando' ? 'Guardando…' : `Usar "${propostos?.find((p) => p.id === escolhido)?.nome ?? ''}" e desenhar as telas →`}</Botao>}
        <span>Vira o design system do seu sistema. Dá para ajustar depois.</span>
      </div>
    </div>
  )
}
