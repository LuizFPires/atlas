import { useRef, useState } from 'react'
import { CampoFalado, Icone } from '../ui'
import { Monograma, NomeAtlas } from '../marca/Marca'
import { useTema } from '../tema/tema'
import { prateleira, type SegmentoPronto } from './conteudo'
import { COR_APOIO_PADRAO, COR_PRINCIPAL_PADRAO, corLegivel, MAX_NOME, normalizarHex, PALETA_APOIO, PALETA_PRINCIPAL, type Personalizacao } from './personalizacao'
import './web.css'

const EXEMPLOS: Record<SegmentoPronto, { titulo: string; itens: Array<[string, string]>; botao: string }> = {
  barbearia: { titulo: 'HOJE · AGENDA', itens: [['09:00 · João', 'Corte + barba'], ['10:30 · Pedro', 'Corte']], botao: 'Agendar horário' },
  restaurante: { titulo: 'HOJE · PEDIDOS', itens: [['Mesa 4', 'Feijoada + suco'], ['Entrega · Ana', 'Marmita grande']], botao: 'Novo pedido' },
  mercearia: { titulo: 'HOJE · ESTOQUE', itens: [['Arroz 5 kg', 'Faltam 3 unidades'], ['Leite integral', 'Vence em 4 dias']], botao: 'Registrar venda' },
  academia: { titulo: 'HOJE · TREINOS', itens: [['07:00 · Marcos', 'Treino A · peito'], ['08:00 · Carla', 'Treino B · pernas']], botao: 'Fazer check-in' },
}

type Resultado = { ok: true } | { ok: false; mensagem: string }

/** Um seletor de cor: paleta de atalhos + código HEX digitado + chip de prévia. `valor` é o texto digitado (sem o #). */
function CampoCor({ rotulo, paleta, valor, onChange, selecionada }: { rotulo: string; paleta: string[]; valor: string; onChange: (v: string) => void; selecionada: string | null }) {
  const livre = useRef<HTMLInputElement>(null)
  const invalido = valor.trim() !== '' && selecionada === null
  const idErro = `erro-cor-${rotulo.replace(/[^a-z]/gi, '')}`
  return (
    <div className="cf-cor">
      <span className="cf-cor-nome">{rotulo}</span>
      <div className="cf-paleta" role="group" aria-label={`Cores de atalho: ${rotulo}`}>
        {paleta.map((c) => (
          <button key={c} type="button" className="cf-amostra" style={{ background: c }} data-sel={selecionada === c} aria-pressed={selecionada === c} aria-label={`${rotulo}: ${c}`} onClick={() => onChange(c.slice(1))} />
        ))}
        <button type="button" className="cf-amostra cf-amostra--mais" title="mais cores" aria-label={`${rotulo}: escolher outra cor`} onClick={() => livre.current?.click()} />
        <input ref={livre} type="color" className="cf-nativo" tabIndex={-1} aria-hidden="true" value={selecionada ?? '#000000'} onChange={(e) => onChange(e.target.value.slice(1).toUpperCase())} />
      </div>
      <div className="cf-hex" data-erro={invalido}>
        <span className="cf-chip" data-testid={`chip-${rotulo}`} style={{ background: selecionada ?? 'transparent' }} aria-hidden="true" />
        <span className="cf-hex-jogo">#</span>
        <input aria-label={`Código da cor ${rotulo}`} aria-invalid={invalido} aria-describedby={invalido ? idErro : undefined} value={valor} maxLength={7} spellCheck={false} autoCapitalize="characters" placeholder="1E7A46" onChange={(e) => onChange(e.target.value.replace(/^\s*#/, '').toUpperCase())} />
      </div>
      {invalido && <span id={idErro} role="alert" className="cf-hex-erro">Esse código não está certo. Use 6 letras ou números, de 0 a 9 e de A a F, como 1E7A46.</span>}
    </div>
  )
}

/** Configurador do app pronto (F18b): nome, logo e duas cores, com prévia ao vivo. */
export function Configurador({ segmento, inicial, onSalvar }: { segmento: SegmentoPronto; inicial?: Personalizacao | null; onSalvar: (p: Personalizacao) => Promise<Resultado> }) {
  const { tema } = useTema()
  const [nome, setNome] = useState(inicial?.nome_negocio ?? '')
  const [principal, setPrincipal] = useState((inicial?.cor_principal ?? COR_PRINCIPAL_PADRAO).slice(1))
  const [apoio, setApoio] = useState((inicial?.cor_apoio ?? COR_APOIO_PADRAO).slice(1))
  const [logo, setLogo] = useState<{ nome: string; url: string | null } | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const corP = normalizarHex(principal)
  const corA = normalizarHex(apoio)
  const ex = EXEMPLOS[segmento]
  const seg = prateleira.find((x) => x.segmento === segmento)
  // A prévia usa a última cor válida (ou o padrão) para nunca quebrar enquanto a pessoa digita.
  const p = corP ?? COR_PRINCIPAL_PADRAO
  const a = corA ?? COR_APOIO_PADRAO

  const escolherLogo = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setErro('A logomarca precisa ser uma imagem (PNG, JPG ou SVG).')
    if (f.size > 2 * 1024 * 1024) return setErro('Essa imagem é grande demais. Escolha uma de até 2 MB.')
    setErro('')
    setLogo({ nome: f.name, url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : null })
  }

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Diga o nome do seu negócio.')
    if (!corP) return setErro('Confira a cor principal: o código tem 6 letras ou números, como 1E7A46.')
    if (!corA) return setErro('Confira a cor de apoio: o código tem 6 letras ou números, como 2A3A12.')
    setEnviando(true)
    // A imagem da logo ainda não sobe para o servidor (o envio entra com o provisionamento): por ora vai só o resto.
    const r = await onSalvar({ nome_negocio: nome.trim(), logo_url: null, cor_principal: corP, cor_apoio: corA })
    setEnviando(false)
    if (!r.ok) setErro(r.mensagem)
  }

  return (
    <div className="c">
      <header className="c-topo">
        <Monograma fundo="escuro" largura={40} altura={22} /><NomeAtlas fundo="escuro" largura={96} altura={14} />
        <b className="cf-topo-titulo">Deixe com a sua cara</b>
        <span className="cf-passo">PASSO 2 · leva uns 2 minutos</span>
      </header>
      <form className="cf-corpo" onSubmit={enviar} noValidate>
        <div className="cf-esq">
          <div className="cf-titulos"><h1>Sem abrir o Atlas.</h1><p className="c-lead">Nome, logo e duas cores. O resto já vem pronto, e dá pra mudar depois.</p></div>

          <CampoFalado rotulo="Nome do negócio" valor={nome} onChange={(v) => setNome([...v].slice(0, MAX_NOME).join(''))} placeholder="Ex.: Barbearia do Zé" autoComplete="organization" />

          <div className="cf-bloco">
            <span className="cf-rot">Logomarca</span>
            <button type="button" className="cf-upload" onClick={() => arquivo.current?.click()}>
              {logo?.url ? <img src={logo.url} alt="" className="cf-upload-img" /> : <Icone nome="imagem" tamanho={22} />}
              {logo ? logo.nome : 'Enviar uma imagem (ou deixar pra depois)'}
            </button>
            <input ref={arquivo} type="file" accept="image/*" className="cf-nativo" aria-label="Escolher a imagem da logomarca" onChange={(e) => escolherLogo(e.target.files?.[0])} />
          </div>

          <div className="cf-bloco">
            <span className="cf-rot">Cores</span>
            <div className="cf-cores">
              <CampoCor rotulo="Principal" paleta={PALETA_PRINCIPAL} valor={principal} onChange={setPrincipal} selecionada={corP} />
              <CampoCor rotulo="De apoio" paleta={PALETA_APOIO} valor={apoio} onChange={setApoio} selecionada={corA} />
            </div>
            <span className="cf-dica"><Icone nome="paleta" tamanho={16} />Escolha na paleta ou escreva o código exato da sua marca (ex.: #1E7A46).</span>
          </div>

          {erro && <p role="alert" className="v-erro">{erro}</p>}
          <button type="submit" className="v-acao cf-criar" disabled={enviando} data-tema={tema}>
            {enviando ? 'Criando…' : <>Está ótimo, criar o meu app <Icone nome="seta" /></>}
          </button>
        </div>

        <aside className="cf-previa" aria-label="Prévia ao vivo">
          <span className="cf-rot">Prévia ao vivo</span>
          <div className="cf-tel">
            <div className="cf-tel-topo" style={{ background: a }}>
              <span className="cf-tel-logo" style={{ background: p, color: corLegivel(p) }}>{logo?.url ? <img src={logo.url} alt="" /> : seg && <Icone nome={seg.icone} tamanho={18} />}</span>
              <b data-testid="previa-nome">{nome.trim() || 'Nome do seu negócio'}</b>
            </div>
            <div className="cf-tel-corpo">
              <span className="cf-tel-dia">{ex.titulo}</span>
              {ex.itens.map(([t, d]) => <div key={t} className="cf-tel-card" style={{ borderLeftColor: p }}><b>{t}</b><div>{d}</div></div>)}
              <div className="cf-tel-botao" data-testid="previa-botao" style={{ background: p, color: corLegivel(p) }}>{ex.botao}</div>
            </div>
          </div>
        </aside>
      </form>
      <footer className="cf-rodape"><span>Atlas · Comece pronto</span><span>Tela 2 de 3 · configurador</span></footer>
    </div>
  )
}
