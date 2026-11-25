import { useCallback, useEffect, useRef, useState } from 'react'
import { PASSOS_DOMINIO, explicarErroDominio, limparDominio, type ConferidoDominio, type EstadoDominio, type PonteDominio } from './ponte-dominio'

interface Props {
  pasta: string
  dominio: PonteDominio
  /** Nome do endereço grátis, para o exemplo do campo (ex.: pontoampla → pontoampla.com.br). */
  sugestao?: string
  /** Abre o Registro.br (lista fechada de sites oficiais). */
  abrirRegistro: () => Promise<void>
  /** O domínio abriu com cadeado: a tela troca o QR e o WhatsApp para o endereço novo. */
  onNoAr?: (endereco: string) => void
  onVoltar?: () => void
  onAjuda?: (contexto: { onde: string; erro?: string }) => void
  /** M58: abre o passo a passo clique por clique com o Registro.br ao lado (no lugar de só abrir o site). */
  onAbrirGuia?: (estado: EstadoDominio) => void
  intervaloMs?: number
}

const ICONE_OK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>

/**
 * Domínio próprio (M57; prototipo/caminho-novo/PB6Dominio e PB7DominioOk). O cliente digita o domínio e aperta UM botão:
 * o Atlas confere, liga na Vercel dele e mostra só o que colar no Registro.br. Daí em diante vigia sozinho até o cadeado.
 */
export function DominioProprio({ pasta, dominio, sugestao, abrirRegistro, onNoAr, onVoltar, onAjuda, onAbrirGuia, intervaloMs = 15_000 }: Props) {
  const [texto, setTexto] = useState('')
  const [conferido, setConferido] = useState<ConferidoDominio | null>(null)
  const [estado, setEstado] = useState<EstadoDominio | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [copiado, setCopiado] = useState('')
  const avisouNoAr = useRef(false)

  useEffect(() => {
    let vivo = true
    void dominio.estado(pasta).then((e) => { if (vivo && e.fase !== 'nenhum') setEstado(e) }, () => {})
    return () => { vivo = false }
  }, [dominio, pasta])

  const acompanhando = estado !== null && estado.fase !== 'nenhum' && estado.fase !== 'noar'
  useEffect(() => {
    if (!acompanhando) return
    const t = setInterval(() => { void dominio.estado(pasta).then(setEstado, () => {}) }, intervaloMs)
    return () => clearInterval(t)
  }, [acompanhando, dominio, pasta, intervaloMs])

  useEffect(() => {
    if (estado?.fase === 'noar' && estado.endereco && !avisouNoAr.current) { avisouNoAr.current = true; onNoAr?.(estado.endereco) }
  }, [estado, onNoAr])

  const conferirELigar = useCallback(async () => {
    const d = limparDominio(texto)
    if (!d) { setAviso(explicarErroDominio('dominio-invalido')); return }
    setAviso(''); setOcupado(true)
    try {
      const c = await dominio.conferir(pasta, d)
      setConferido(c)
      if (c.situacao === 'registrado') setEstado(await dominio.ligar(pasta, d))
    } catch (e) {
      setAviso(explicarErroDominio((e as Error).message))
    } finally { setOcupado(false) }
  }, [dominio, pasta, texto])

  const copiar = (v: string) => { void navigator.clipboard?.writeText(v).then(() => setCopiado(v), () => {}) }
  const abrir = () => { void abrirRegistro().catch(() => setAviso('Não consegui abrir o Registro.br agora. Abra registro.br no navegador.')) }

  if (estado?.fase === 'noar') {
    return (
      <section className="at-noar__card at-noar__card--lime">
        <span className="at-noar__rot at-noar__rot--lime">DOMÍNIO PRÓPRIO NO AR</span>
        <b className="at-noar__tit at-noar__tit--m">{estado.dominio}</b>
        <PassosDominio estado={estado} />
        <span className="at-noar__txt">Com cadeado (https). O QR e o link do WhatsApp já levam para o endereço novo. O .vercel.app continua funcionando.</span>
        {onVoltar && <button type="button" className="at-noar__sec" onClick={onVoltar}>Voltar</button>}
      </section>
    )
  }

  if (estado && acompanhando) {
    const comEmail = estado.modo === 'registros'
    return (
      <section className="at-noar__card at-noar__card--cheio">
        <span className="at-noar__rot">USAR MEU DOMÍNIO · {estado.dominio}</span>
        {conferido && (
          <div className="at-dom__conferiu">
            <span className="at-noar__rot">O ATLAS CONFERIU</span>
            <span className="at-dom__linha"><span>Dono</span><b>{conferido.registrador ? `registrado no ${conferido.registrador}` : 'registrado'}</b></span>
            <span className="at-dom__linha"><span>Tem e-mail nele?</span><b>{conferido.temEmail ? 'sim' : 'não'}</b></span>
            <span className="at-dom__linha"><span>Ligado à sua Vercel</span><b className="at-noar__verde">✓ feito</b></span>
          </div>
        )}
        <span className="at-noar__rot at-noar__rot--lime">A SUA PARTE · 1 TROCA NO REGISTRO.BR</span>
        {comEmail
          ? <span className="at-noar__txt">Seu domínio tem e-mail, então o Atlas não troca os servidores: acrescente só estas {estado.registros.length} linhas na zona DNS, e o e-mail continua funcionando.</span>
          : <span className="at-noar__txt">No Registro.br, em "Alterar servidores DNS", cole estes {estado.servidores.length} nomes e salve:</span>}
        <ul className="at-dom__copiar">
          {comEmail
            ? estado.registros.map((r) => (
              <li key={r.tipo + r.nome}><span className="at-dom__tipo">{r.tipo} · {r.nome === '@' ? 'em branco' : r.nome}</span><code>{r.valor}</code><button type="button" className="at-dom__btn" aria-label={`Copiar ${r.valor}`} onClick={() => copiar(r.valor)}>{copiado === r.valor ? 'copiado' : 'copiar'}</button></li>
            ))
            : estado.servidores.map((s) => (
              <li key={s}><code>{s}</code><button type="button" className="at-dom__btn" aria-label={`Copiar ${s}`} onClick={() => copiar(s)}>{copiado === s ? 'copiado' : 'copiar'}</button></li>
            ))}
        </ul>
        <button type="button" className="at-noar__prim" onClick={() => (onAbrirGuia ? onAbrirGuia(estado) : abrir())}>{onAbrirGuia ? 'Abrir o Registro.br com o passo a passo →' : 'Abrir o Registro.br →'}</button>
        <PassosDominio estado={estado} />
        {estado.fase === 'demorando'
          ? <>
            <span className="at-noar__nota" role="alert">Já passou bastante tempo e a troca ainda não chegou. Confira se você salvou no Registro.br.</span>
            <button type="button" className="at-noar__sec" onClick={() => void dominio.conferirAgora(pasta).then(setEstado, () => {})}>Já salvei, confere de novo</button>
            {onAjuda && <button type="button" className="at-noar__sec" onClick={() => onAjuda({ onde: 'domínio próprio no Registro.br', erro: 'troca-nao-chegou' })}>Falar com o Atlas</button>}
          </>
          : <span className="at-noar__nota">Pode fechar o Atlas. Quando o domínio responder com cadeado, ele avisa no celular.</span>}
        {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
      </section>
    )
  }

  const exemplo = `${sugestao || 'suaempresa'}.com.br`
  return (
    <section className="at-noar__card at-noar__card--cheio">
      <span className="at-noar__rot">USAR MEU DOMÍNIO</span>
      <b className="at-noar__tit at-noar__tit--m">Qual domínio você quer usar?</b>
      <input className="at-dom__campo" aria-label="Seu domínio" placeholder={exemplo} value={texto} onChange={(e) => { setTexto(e.target.value); setConferido(null) }} onKeyDown={(e) => { if (e.key === 'Enter') void conferirELigar() }} autoComplete="off" spellCheck={false} />
      {conferido?.situacao === 'livre' && (
        <div className="at-dom__conferiu" role="status">
          <b>{conferido.dominio} está livre: ainda não é de ninguém.</b>
          <span className="at-noar__txt">Compre no Registro.br (cerca de R$ 40 por ano, pago por você, com Pix). Quando terminar, volte aqui e toque em "Conferir e ligar" de novo.</span>
          <button type="button" className="at-noar__prim" onClick={abrir}>Abrir o Registro.br para comprar →</button>
        </div>
      )}
      {conferido?.situacao === 'incerto' && <p className="at-noar__nota" role="status">Não deu para conferir agora (o Registro.br não respondeu). Tente de novo em instantes.</p>}
      <button type="button" className={conferido?.situacao === 'livre' ? 'at-noar__sec' : 'at-noar__prim'} disabled={ocupado || !texto.trim()} onClick={() => void conferirELigar()}>{ocupado ? 'Conferindo e ligando…' : 'Conferir e ligar →'}</button>
      <span className="at-noar__nota">O Atlas confere o domínio e já liga na sua Vercel. Depois você faz só uma troca no Registro.br. Se o domínio tiver e-mail, o e-mail continua funcionando.</span>
      {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
      {onVoltar && <button type="button" className="at-noar__sec" onClick={onVoltar}>Voltar</button>}
    </section>
  )
}

function PassosDominio({ estado }: { estado: EstadoDominio }) {
  return (
    <ol className="at-noar__passos">
      {PASSOS_DOMINIO.map((p) => {
        const s = estado.passos.find((x) => x.id === p.id)?.estado ?? 'falta'
        const classe = s === 'demorando' ? 'atencao' : s
        const rotulo = s === 'feito' ? 'feito' : s === 'agora' ? 'fazendo agora' : s === 'demorando' ? 'demorando' : 'falta'
        return (
          <li key={p.id} className={`at-noar__passo at-noar__passo--${classe}`} aria-label={`${p.titulo}: ${rotulo}`}>
            <span className="at-noar__bola" aria-hidden="true">{s === 'feito' ? ICONE_OK : s === 'demorando' ? '!' : ''}</span>
            <span className="at-noar__ptxt"><b>{p.titulo}</b><span>{p.sub}</span></span>
          </li>
        )
      })}
    </ol>
  )
}
