import { useId, useState } from 'react'
import { Botao, Icone, useVoz } from '../ui'
import type { ObraCriada, PonteObras } from './ponte-obras'
import { PERGUNTAS, type IdPergunta } from './obras-dados'
import './obras.css'

export type Respostas = Record<IdPergunta, string>

/** O que a nova obra entrega ao próximo passo (estilo, M14): as respostas e a pasta criada. */
export interface ObraNova { respostas: Respostas; quem: string[]; pasta: ObraCriada }

interface Props {
  obras: PonteObras
  /** Ideia escolhida na lista de exemplos: vira o nome provisório da obra. */
  ideia?: string
  onVoltar: () => void
  /** Obra recém-criada (voltando do estilo). */
  criada?: ObraNova | null
  onConcluir: (obra: ObraNova) => void
  /** Segue para o estilo do sistema (F06b). Com ele, é o único caminho (o "Ver minhas obras" saía do fluxo no meio). Sem ele, só mostra "Ver minhas obras". */
  onEstilo?: (obra: ObraNova) => void
}

const VAZIAS: Respostas = { nome: '', problema: '', quem: '', precisa: '', parecido: '' }

/** Microfone grande + transcrição editável (prototipo/F06NovaObra). O que for falado cai no texto, que o cliente pode corrigir ou digitar. */
function BlocoVoz({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const id = useId()
  const [digitando, setDigitando] = useState(false)
  const { gravando, alternar, suportado } = useVoz((falado) => onChange([valor, falado].filter(Boolean).join(' ')))
  const mostrar = valor !== '' || digitando
  return (
    <div className="at-nova__voz">
      <div className="at-nova__voz-linha">
        <button type="button" className={`at-nova__mic ${gravando ? 'at-nova__mic--gravando' : ''}`} aria-pressed={gravando} aria-label={gravando ? 'Parar de gravar' : 'Falar'} onClick={alternar}>
          <Icone nome="microfone" tamanho={32} />
        </button>
        <div className="at-nova__voz-txt">
          <b>{gravando ? 'Pode falar, estou ouvindo.' : 'Aperte e fale, como se contasse para um amigo na mesa de um restaurante.'}</b>
          <span>{gravando ? 'Fale do seu jeito, sem pressa, como num papo de restaurante. Pode errar e voltar atrás: o Atlas entende.' : 'Não precisa falar bonito. Conte como funciona hoje e o que te incomoda. O Atlas escreve tudo para você.'}</span>
        </div>
      </div>
      {gravando && <div className="at-nova__ouvindo" role="status"><i /> Ouvindo… <span>Aperte de novo para terminar</span></div>}
      {mostrar && (
        <div className="at-nova__edit">
          <label htmlFor={id}>{valor ? 'O Atlas escreveu assim. Pode corrigir se quiser:' : 'Escreva aqui:'}</label>
          <textarea id={id} rows={3} value={valor} onChange={(e) => { setDigitando(true); onChange(e.target.value) }} />
        </div>
      )}
      {!suportado && <span className="at-nova__digitar">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
      {!mostrar && <span className="at-nova__digitar">Prefere escrever? <button type="button" onClick={() => setDigitando(true)}>Digitar em vez de falar</button></span>}
    </div>
  )
}

/** F06: nova obra com perguntas guiadas, uma por vez, cada uma com microfone (u06). Ao terminar cria a subpasta da obra em Atlas\Obras. */
export function NovaObra({ obras, ideia = '', criada = null, onVoltar, onConcluir, onEstilo }: Props) {
  const [i, setI] = useState(0)
  const [resp, setResp] = useState<Respostas>({ ...VAZIAS, nome: ideia })
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  // Voltando do estilo: a obra já existe, mostra o "Obra começada!" dela (Voltar volta uma etapa, não para o início).
  const [pronta, setPronta] = useState<ObraNova | null>(criada)

  const p = PERGUNTAS[i]
  const ultima = i === PERGUNTAS.length - 1
  // Quem usa: a pessoa conta do jeito dela (sem opções prontas de um ramo só).
  const nomesQuem = resp.quem.trim() ? [resp.quem.trim()] : []
  const mudar = (v: string) => { setErro(''); setResp({ ...resp, [p.id]: v }) }

  const avancar = async () => {
    if (p.id === 'nome' && !resp.nome.trim()) { setErro('Dê um nome para a obra, mesmo que provisório. Pode falar ou digitar.'); return }
    if (!ultima) { setErro(''); setI(i + 1); return }
    setCriando(true)
    setErro('')
    try {
      const nome = resp.nome.trim()
      const pasta = await obras.criarSubpasta(nome)
      setPronta({ respostas: { ...resp, nome }, quem: nomesQuem, pasta })
    } catch {
      setErro('Não consegui criar a pasta da obra agora. Suas respostas continuam aqui; tente de novo em instantes.')
    } finally { setCriando(false) }
  }

  const lado = (
    <aside className="at-nova__lado" aria-label="O que o Atlas já entendeu">
      <span className="at-obras__rotulo">O QUE O ATLAS JÁ ENTENDEU</span>
      <div className="at-nova__item"><span>Nome da obra</span><b>{resp.nome.trim() || 'Ainda sem nome'}</b></div>
      <div className="at-nova__item"><span>O problema</span><span>{resp.problema.trim() || 'Ainda não contado'}</span></div>
      <div className="at-nova__item"><span>Quem usa</span><span>{nomesQuem.join(', ') || 'Ainda não contado'}</span></div>
      <div className="at-nova__fim">Nada aqui é definitivo. No protótipo você vê as telas e muda o que quiser.</div>
    </aside>
  )

  if (pronta) {
    return (
      <div className="at-nova">
        <div className="at-nova__col">
          <div className="at-nova__topo"><span className="at-obras__rotulo">NOVA OBRA · PRONTO</span></div>
          <h1>Obra começada!</h1>
          <p className="at-nova__dica">Criei a pasta da sua obra aqui no computador. Tudo o que o Claude desenhar e construir vai ficar guardado nela.</p>
          <div className="at-nova__pronto"><b>{pronta.respostas.nome}</b><code>{pronta.pasta.caminho}</code></div>
          <div className="at-nova__rodape">
            {onEstilo && <Botao onClick={() => onEstilo(pronta)}>Escolher o estilo →</Botao>}
            {!onEstilo && <Botao onClick={() => onConcluir(pronta)}>Ver minhas obras →</Botao>}
          </div>
        </div>
        {lado}
      </div>
    )
  }

  return (
    <div className="at-nova">
      <div className="at-nova__col">
        <div className="at-nova__topo">
          <span className="at-obras__rotulo">NOVA OBRA · PERGUNTA {i + 1} DE {PERGUNTAS.length}</span>
          <div className="at-nova__barra" role="progressbar" aria-valuemin={1} aria-valuemax={PERGUNTAS.length} aria-valuenow={i + 1}><div style={{ width: `${((i + 1) / PERGUNTAS.length) * 100}%` }} /></div>
        </div>
        <h1>{p.titulo}</h1>
        <p className="at-nova__dica">{p.dica}</p>
        <BlocoVoz key={p.id} valor={resp[p.id]} onChange={mudar} />
        {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
        <div className="at-nova__rodape">
          <Botao variante="secundario" onClick={i === 0 ? onVoltar : () => { setErro(''); setI(i - 1) }}>Voltar</Botao>
          <Botao disabled={criando} onClick={avancar}>{ultima ? (criando ? 'Criando a pasta…' : 'Começar a obra') : 'Próxima pergunta'}</Botao>
        </div>
      </div>
      {lado}
    </div>
  )
}
