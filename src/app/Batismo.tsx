import { useEffect, useRef, useState } from 'react'
import { Botao, Icone, Microfone, useVoz } from '../ui'
import type { ObraDoEstilo } from './Estilo'
import { limparNome, LOGOS, resumoDaConferencia, type Conferencia, type Marca, type NomeProposto, type PonteBatismo, type PonteNomes } from './ponte-batismo'
import './batismo.css'

interface Props {
  obra: ObraDoEstilo
  batismo: PonteBatismo
  /** Confere nomes parecidos e se o endereço está livre (.app, .com.br). */
  nomes: PonteNomes
  onVoltar: () => void
  /** Segue para a aprovação (F08, M18) com a marca já gravada na pasta da obra. */
  onConcluir?: (marca: Marca, caminho: string) => void
}

const FASES = [['✓', 'Estilo', true], ['✓', 'Telas', true], ['3', 'Nome e marca', false]] as const

export const recadoDoErroBatismo = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'O Claude que sugere os nomes ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; por enquanto, não há nada que você precise refazer.'
    case 'nome-invalido': return 'Esse nome está curto demais ou tem símbolos que não dá para usar. Escreva ou fale de novo.'
    default: return 'Não consegui fazer isso agora. Tente de novo em instantes.'
  }
}

const Logo = ({ id, tamanho }: { id: string; tamanho: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="#D9A066" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <path d={id in LOGOS ? LOGOS[id as keyof typeof LOGOS] : ''} />
  </svg>
)

/** Linha de conferência de um nome: ✓ livre, ⚠ já existe algo parecido ou endereço ocupado. */
function Verificacao({ c }: { c: Conferencia | null | undefined }) {
  if (c === undefined) return <span className="at-bat__check" role="status">conferindo nome e endereço…</span>
  if (c === null) return <span className="at-bat__check">não consegui conferir agora; tente de novo daqui a pouco</span>
  const r = resumoDaConferencia(c)
  return <span className={`at-bat__check ${r.ok ? '' : 'at-bat__check--aviso'}`}><span aria-hidden="true">{r.ok ? '✓' : '⚠'}</span> {r.texto}</span>
}

/** Os 8 "apps" do celular de mentirinha: o do cliente aparece entre os outros, como no protótipo. */
const OUTROS = [['Fotos', '#E9E3DA'], ['Mapas', '#CFE3D2'], ['Banco', '#D7CDE8'], ['Música', '#F2C9C4'], ['Câmera', '#DADDD3'], ['Clima', '#C9DDF0'], ['Notas', '#F4E7B5']] as const

function CelularMarca({ nome, slogan, logo }: { nome: string; slogan: string; logo: string }) {
  const apps = [...OUTROS.slice(0, 4).map(([n, bg]) => ({ n, bg, meu: false })), { n: nome, bg: '#2B211B', meu: true }, ...OUTROS.slice(4).map(([n, bg]) => ({ n, bg, meu: false }))]
  return (
    <aside className="at-bat__lado" aria-label="Como fica no celular">
      <span className="at-bat__dica">Assim fica no celular dos seus clientes:</span>
      <div className="at-bat__celular">
        <div className="at-bat__tela">
          <div className="at-bat__barra"><span>9:41</span><span>●●● 5G</span></div>
          <div className="at-bat__apps">
            {apps.map((a) => (
              <div key={a.n} className="at-bat__app">
                <span className="at-bat__icone" style={{ background: a.bg, boxShadow: a.meu ? '0 0 0 3px #D9A066' : 'none' }}>{a.meu && <Logo id={logo} tamanho={26} />}</span>
                <span style={{ fontWeight: a.meu ? 700 : 400 }}>{a.n}</span>
              </div>
            ))}
          </div>
          <div className="at-bat__cartao">
            <div className="at-bat__cartao-cab"><span className="at-bat__cartao-logo"><Logo id={logo} tamanho={20} /></span><b>{nome}</b></div>
            {slogan && <span className="at-bat__cartao-slogan">{slogan}</span>}
            <span className="at-bat__cartao-botao">Marcar horário</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

/** F07b: batismo (projeto 3/3). O Atlas sugere 3 nomes com logo, slogan e motivo. */
export function Batismo({ obra, batismo, nomes: conferidor, onVoltar, onConcluir }: Props) {
  const [nomes, setNomes] = useState<NomeProposto[]>([])
  // Conferência por nome: undefined = conferindo, null = não deu para conferir agora.
  const [conferencias, setConferencias] = useState<Record<string, Conferencia | null>>({})
  const [vistos, setVistos] = useState<string[]>([])
  const [escolhido, setEscolhido] = useState('')
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [ideia, setIdeia] = useState('')
  const [falando, setFalando] = useState(false)
  const iniciou = useRef(false)
  const { gravando, alternar, suportado } = useVoz((falado) => setIdeia((p) => [p, falado].filter(Boolean).join(' ')))

  const pedir = async (pedido: { ideia?: string; evitar?: string[] }) => {
    setOcupado(true)
    setErro('')
    try {
      const lista = await batismo.sugerir(obra.pasta, obra.nome, pedido)
      setNomes(lista)
      setVistos((v) => [...new Set([...v, ...lista.map((n) => n.nome)])])
      setEscolhido(lista[0]?.id ?? '')
      for (const n of lista) {
        conferidor.conferir(n.nome).then((c) => setConferencias((m) => ({ ...m, [n.nome]: c })), () => setConferencias((m) => ({ ...m, [n.nome]: null })))
      }
    } catch (x) { setErro(recadoDoErroBatismo(x)) } finally { setOcupado(false); setPronto(true) }
  }

  useEffect(() => {
    if (iniciou.current) return
    iniciou.current = true
    void pedir({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const atual = nomes.find((n) => n.id === escolhido) ?? nomes[0]

  const batizar = async () => {
    if (!atual || ocupado) return
    setOcupado(true)
    setErro('')
    const marca: Marca = { origem: 'sugestao', nome: atual.nome, slogan: atual.slogan, logo: atual.logo }
    try {
      const { caminho } = await batismo.batizar(obra.pasta, marca)
      if (onConcluir) onConcluir(marca, caminho)
      else onVoltar()
    } catch (x) { setErro(recadoDoErroBatismo(x)) } finally { setOcupado(false) }
  }

  return (
    <div className="at-bat">
      <div className="at-bat__principal">
        <div className="at-bat__fases">
          {FASES.map(([n, nome, feito]) => <div key={nome} className={`at-bat__fase ${feito ? '' : 'at-bat__fase--agora'}`} aria-current={feito ? undefined : 'step'}><span>{n}</span>{nome}</div>)}
          <span className="at-bat__proj">PROJETO · {obra.nome.toUpperCase()}</span>
        </div>
        <header className="at-bat__cab">
          <h1>Hora do batismo.</h1>
          <span>Agora o Atlas já sabe o que o sistema faz, para quem é e qual é a cara dele. Por isso o nome vem no final: ele nasce de tudo o que vocês construíram.</span>
        </header>

        {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
        {!pronto && <p role="status">O Claude está pensando nos nomes…</p>}

        <div className="at-bat__nomes" role="radiogroup" aria-label="Nomes sugeridos">
          {nomes.map((n) => (
            <button key={n.id} type="button" role="radio" aria-checked={n.id === atual?.id} className={`at-bat__nome ${n.id === atual?.id ? 'at-bat__nome--on' : ''}`} onClick={() => setEscolhido(n.id)}>
              <span className="at-bat__amostra"><span className="at-bat__amostra-logo"><Logo id={n.logo} tamanho={26} /></span><span className="at-bat__amostra-nome">{n.nome}</span></span>
              <b>{n.nome}</b>
              <span className="at-bat__slogan">“{n.slogan}”</span>
              <span className="at-bat__porque">{n.porque}</span>
              <Verificacao c={conferencias[n.nome]} />
            </button>
          ))}
        </div>
        <div className="at-bat__acoes-meio">
          <Botao variante="secundario" disabled={ocupado} onClick={() => void pedir({ evitar: vistos })}>↻ Sugerir outros</Botao>
          <button type="button" className="at-bat__falar" aria-expanded={falando} onClick={() => setFalando((f) => !f)}><Icone nome="microfone" tamanho={16} />Falar uma ideia de nome</button>
        </div>
        {falando && (
          <form className="at-bat__ideia" onSubmit={(e) => { e.preventDefault(); if (ideia.trim() && !ocupado) void pedir({ ideia, evitar: vistos }) }}>
            <Microfone gravando={gravando} onAlternar={alternar} />
            <label htmlFor="ideia-nome" className="at-bat__so-leitor">Sua ideia de nome</label>
            <input id="ideia-nome" value={ideia} onChange={(e) => setIdeia(e.target.value)} placeholder="Fale ou escreva uma ideia: “Barba Boa”…" autoComplete="off" />
            <Botao type="submit" disabled={!limparNome(ideia) || ocupado}>Pensar nisso</Botao>
          </form>
        )}
        {falando && !suportado && <span className="at-bat__dica">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}

        <p className="at-bat__nota">Antes de você decidir, o Atlas procura nomes parecidos e confere se o endereço na internet está livre.</p>

        <div className="at-bat__rodape">
          <Botao variante="secundario" onClick={onVoltar}>← Voltar às telas</Botao>
          <Botao disabled={!atual || ocupado} onClick={() => void batizar()}>Batizar como “{atual?.nome ?? '…'}” →</Botao>
        </div>
      </div>
      <CelularMarca nome={atual?.nome ?? obra.nome} slogan={atual?.slogan ?? ''} logo={atual?.logo ?? 'cadeira'} />
    </div>
  )
}
