import { useState } from 'react'
import { Botao, CampoFalado, Icone, useVoz } from '../ui'
import type { PonteArquivos } from './ponte-arquivos'
import type { EntradaEstilo, EstiloProposto, PonteEstilo } from './ponte-estilo'
import { FASES, linkCurto, MAX_REFERENCIAS, MIN_REFERENCIAS, normalizarLink, SENTIMENTOS } from './estilo-dados'
import './estilo.css'

/** A obra que acabou de ser criada (nome e subpasta dentro de Atlas\Obras). */
export interface ObraDoEstilo { nome: string; pasta: string }

interface Props {
  obra: ObraDoEstilo
  arquivos: PonteArquivos
  estilo: PonteEstilo
  onVoltar: () => void
  /** Depois que o design system foi guardado na pasta da obra. */
  onConcluir?: (resultado: { estilo: EstiloProposto; caminho: string }) => void
}

interface Ref { tipo: 'link' | 'print'; valor: string; texto: string }

const recado = (e: unknown) => {
  const m = e instanceof Error ? e.message : ''
  if (m === 'tipo-nao-aceito') return 'Esse tipo de arquivo eu não consigo ler. Pode ser PNG, JPG ou WEBP.'
  if (m === 'grande-demais') return 'Esse arquivo é grande demais. Tente um print menor, de até 20 MB.'
  return 'Não consegui pegar esse arquivo agora. Tente de novo em instantes.'
}

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
  const [guardado, setGuardado] = useState<{ estilo: EstiloProposto; caminho: string } | null>(null)

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
      const g = await arquivos.guardar(obra.pasta, 'estilo/referencias', a)
      setAviso('')
      setRefs((r) => [...r, { tipo: 'print', valor: g.nome, texto: `Print: ${g.nome}` }])
    } catch (e) { setAviso(recado(e)) }
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
      const p = await estilo.propor(entrada())
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

      <div className="at-estilo__grade">
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

      <section className="at-estilo__estilos" aria-label="Estilos">
        <div className="at-estilo__estilos-cab"><b>O Atlas montou 3 estilos para você</b><span>toque para escolher</span></div>
        {propostos ? (
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
      </section>
      </div>

      {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
      {guardado && (
        <div className="at-estilo__feito" role="status">
          <b>Estilo "{guardado.estilo.nome}" guardado!</b>
          <span>Ele já é o design system do seu sistema, guardado na pasta da obra. Dá para ajustar depois.</span>
          <code>{guardado.caminho}</code>
        </div>
      )}
      <div className="at-estilo__rodape">
        <Botao variante="secundario" onClick={onVoltar}>← Voltar</Botao>
        {guardado
          ? <Botao onClick={() => onConcluir?.(guardado)}>Ver minhas obras →</Botao>
          : <Botao disabled={!propostos || ocupado !== ''} onClick={usar}>{ocupado === 'guardando' ? 'Guardando…' : `Usar "${propostos?.find((p) => p.id === escolhido)?.nome ?? ''}" e desenhar as telas →`}</Botao>}
        <span>Vira o design system do seu sistema. Dá para ajustar depois.</span>
      </div>
    </div>
  )
}
