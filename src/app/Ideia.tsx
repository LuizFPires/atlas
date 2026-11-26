import { useEffect, useRef, useState } from 'react'
import { Botao, CampoFalado, Icone, Microfone, useVoz } from '../ui'
import { TOPICOS, type Conferencia, type IdTopico, type PonteIdeia } from './ponte-ideia'
import { BloqueioPolitica } from './BloqueioPolitica'
import { politicaIndisponivel, type PontePolitica } from './ponte-politica'
import './ideia.css'

/** O que a pessoa contou fica guardado (sair pelo menu ou fechar o Atlas não perde nada; pedido do Luiz, 23/11/2026). */
const CHAVE = 'atlas:rascunho:ideia'
type Rascunho = { relato: string; pulados: IdTopico[] }
const lerRascunho = (): Rascunho => {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Rascunho | null
    if (r && typeof r.relato === 'string' && Array.isArray(r.pulados)) return r
  } catch { /* sem rascunho */ }
  return { relato: '', pulados: [] }
}
const guardar = (r: Rascunho) => { try { localStorage.setItem(CHAVE, JSON.stringify(r)) } catch { /* sem espaço: segue na memória */ } }
const apagar = () => { try { localStorage.removeItem(CHAVE) } catch { /* nada */ } }

const MIN_PALAVRAS = 15
const palavras = (t: string) => t.split(/\s+/).filter(Boolean).length

interface Props {
  ideia: PonteIdeia
  onVoltar: () => void
  /** relato (com as respostas do que faltou) e o título curto sugerido ('' se o Claude não respondeu). */
  /** paraVender (M64): o cliente confirmou se é para vender a outras empresas (ausente = o Atlas não soube dizer). */
  onConcluir: (r: { relato: string; titulo: string; paraVender?: boolean }) => void | Promise<void>
  /** Voltou do estilo para cá: mostra de novo o que já tinha contado. */
  relatoInicial?: string
  /** Pausa sem digitar/falar antes de conferir o roteiro (teste usa pouco). */
  esperaMs?: number
  /** "Tenho uma planilha" (prototipo/caminho-novo/X1): começa pela planilha que a pessoa já usa. */
  onPlanilha?: () => void
  /** M65: "Acha que é engano? Explique" quando a ideia é bloqueada pela política. */
  politica?: PontePolitica
}

/**
 * Caminho novo, passo 1 (pedido do Luiz, 23/11/2026; protótipo prototipo/caminho-novo/CN1Ideia e CN2Complemento): a pessoa conta a
 * ideia livremente, falando. O roteiro à esquerda é só um guia: a cada pausa o Claude (rápido) diz quais tópicos já foram
 * respondidos e a bolinha fica verde. No fim, o Atlas pergunta só o que faltou.
 */
/** M64: o que muda na construção quando é para vender (vai no relato: o protótipo e os documentos já nascem assim). */
export const ITENS_VENDA = ['Os dados de cada empresa separados desde o começo', 'Cadastro sozinho para quem assinar', 'Planos e limites (grátis, mensal, anual)', 'Termos e privacidade (LGPD) para o público']
export const MARCA_VENDA = '## Para vender a outras empresas'
const BLOCO_VENDA = [`${MARCA_VENDA} (confirmado pelo cliente)`, '- Os dados de cada empresa separados desde o começo (várias empresas no mesmo sistema, cada uma vê só o que é dela).', '- Cadastro sozinho para quem assinar (a empresa e o dono nascem com o pagamento ou no plano grátis).', '- Planos e limites (grátis, mensal, anual).', '- Termos de uso e política de privacidade (LGPD) para o público.'].join('\n')

export function Ideia({ ideia, onVoltar, onConcluir, relatoInicial, esperaMs = 2500, onPlanilha, politica = politicaIndisponivel }: Props) {
  const [rascunho, setRascunho] = useState<Rascunho>(() => { const r = lerRascunho(); return relatoInicial && !r.relato ? { ...r, relato: relatoInicial } : r })
  const [erro, setErro] = useState('')
  const [cobertos, setCobertos] = useState<Partial<Record<IdTopico, string>>>({})
  const [etapa, setEtapa] = useState<'contar' | 'conferindo' | 'faltou' | 'politica' | 'venda'>('contar')
  const [sinaisPolitica, setSinaisPolitica] = useState<string[]>([])
  const [faltou, setFaltou] = useState<{ itens: Conferencia['faltam']; titulo: string }>({ itens: [], titulo: '' })
  const [respostas, setRespostas] = useState<string[]>([])
  const { relato, pulados } = rascunho

  const mudar = (r: Partial<Rascunho>) => setRascunho((a) => { const n = { ...a, ...r }; guardar(n); return n })
  const voz = useVoz((falado) => setRascunho((a) => { const n = { ...a, relato: [a.relato, falado].filter(Boolean).join(' ') }; guardar(n); return n }))

  // Conferência do roteiro depois de uma pausa. Uma por vez; o que chegar depois de uma resposta velha não apaga o que já ficou verde.
  const conferindo = useRef(false)
  useEffect(() => {
    if (etapa !== 'contar' || !relato.trim()) return
    const t = setTimeout(() => {
      if (conferindo.current) return
      conferindo.current = true
      void ideia.conferir(relato, false)
        .then((c) => setCobertos((a) => { const n = { ...a }; for (const x of c.cobertos) n[x.id] = x.resumo; return n }), () => {})
        .finally(() => { conferindo.current = false })
    }, esperaMs)
    return () => clearTimeout(t)
  }, [relato, etapa, ideia, esperaMs])

  const estadoDe = (id: IdTopico) => (cobertos[id] !== undefined ? 'feito' : pulados.includes(id) ? 'pulado' : null)
  const daVez = TOPICOS.find((t) => !estadoDe(t.id)) ?? null
  const feitos = TOPICOS.filter((t) => estadoDe(t.id) === 'feito').length
  const pronto = palavras(relato) >= MIN_PALAVRAS

  // Só apaga o rascunho quando a obra foi criada de verdade (falhou: avisa e nada se perde).
  const [venda, setVenda] = useState<{ paraVender: boolean; motivo: string; conf: Conferencia } | null>(null)
  const [paraVender, setParaVender] = useState<boolean | undefined>(undefined)
  const concluir = async (texto: string, titulo: string, vender: boolean | undefined = paraVender) => {
    setErro('')
    const relatoFinal = vender ? `${texto}\n\n${BLOCO_VENDA}` : texto
    try { await onConcluir({ relato: relatoFinal, titulo, ...(vender !== undefined ? { paraVender: vender } : {}) }); apagar() } catch {
      setErro('Não consegui criar a pasta da obra agora. O que você contou está guardado: tente de novo em instantes.')
      setEtapa('contar')
    }
  }

  const terminar = async () => {
    if (voz.gravando) voz.alternar()
    setEtapa('conferindo')
    const c: Conferencia | null = await ideia.conferir(relato, true).catch(() => null)
    const titulo = c?.titulo ?? ''
    // M65: o Atlas não constrói outro Atlas — a ideia não vira obra.
    if (c?.politica?.bloqueia) { setSinaisPolitica(c.politica.sinais); setEtapa('politica'); return }
    // M64: o Atlas deduziu se é para vender: confirma numa linha antes de seguir.
    if (c?.venda) { setVenda({ ...c.venda, conf: c }); setEtapa('venda'); return }
    await seguirDepoisDaVenda(c, titulo, undefined)
  }
  const seguirDepoisDaVenda = async (c: Conferencia | null, titulo: string, vender: boolean | undefined) => {
    setParaVender(vender)
    if (!c || c.faltam.length === 0) { await concluir(relato, titulo, vender); return }
    setFaltou({ itens: c.faltam, titulo })
    setRespostas(c.faltam.map(() => ''))
    setEtapa('faltou')
  }

  const seguir = () => {
    const extras = faltou.itens.map((f, i) => (respostas[i]?.trim() ? `${f.pergunta} ${respostas[i].trim()}` : '')).filter(Boolean)
    void concluir([relato, ...extras].join('\n\n'), faltou.titulo)
  }

  if (etapa === 'politica') {
    return (
      <div className="at-ideia at-ideia--faltou">
        <BloqueioPolitica modo="ideia" sinais={sinaisPolitica} obra="nova-obra" politica={politica} onVoltar={() => { mudar({ relato: '' }); setCobertos({}); setEtapa('contar') }} />
      </div>
    )
  }

  if (etapa === 'venda' && venda) {
    const escolher = (v: boolean) => { const c = venda.conf; void seguirDepoisDaVenda(c, c.titulo ?? '', v) }
    return (
      <div className="at-ideia at-ideia--faltou">
        <section className="at-ideia__cartao">
          <div className="at-ideia__cab">
            <span className="at-ideia__rotulo">NOVA OBRA · 1 · A IDEIA · UMA CONFIRMAÇÃO</span>
            <h1>{venda.paraVender ? 'Pelo que você contou, é para vender a outras empresas. Certo?' : 'Pelo que você contou, é para usar na sua empresa. Certo?'}</h1>
            {venda.motivo && <p>{venda.motivo}</p>}
          </div>
          <div className="at-ideia__falta">
            <span className="at-ideia__rotulo at-ideia__rotulo--lime">{venda.paraVender ? 'PARA VENDER, O ATLAS JÁ CONSTRÓI COM' : 'PARA USO INTERNO'}</span>
            <ul className="at-ideia__venda">{(venda.paraVender ? ITENS_VENDA : ['Uma empresa só: a sua', 'Login para a sua equipe', 'Sem página de vendas nem planos']).map((t) => <li key={t}>✓ {t}</li>)}</ul>
          </div>
          <div className="at-ideia__acoes">
            <Botao onClick={() => escolher(venda.paraVender)}>{venda.paraVender ? 'Sim, é para vender' : 'Sim, é só para a minha empresa'}</Botao>
            <Botao variante="secundario" onClick={() => escolher(!venda.paraVender)}>{venda.paraVender ? 'Não, é só para a minha empresa' : 'Não, é para vender'}</Botao>
          </div>
          <p className="at-ideia__porque">Dá para mudar depois. Se um sistema de uso interno virar venda, o Atlas faz uma obra de adaptação (leva mais tempo).</p>
        </section>
      </div>
    )
  }

  if (etapa === 'faltou') {
    return (
      <div className="at-ideia at-ideia--faltou">
        <section className="at-ideia__cartao">
          <div className="at-ideia__cab">
            <span className="at-ideia__rotulo">NOVA OBRA · 1 · A IDEIA</span>
            <h1>Só faltou {faltou.itens.length === 1 ? '1 coisa' : `${faltou.itens.length} coisas`}.</h1>
            <p>O Atlas só pergunta o que não ficou claro. Responda falando ou pule: dá para mudar depois, no protótipo.</p>
          </div>
          {faltou.itens.map((f, i) => (
            <div key={f.pergunta} className="at-ideia__falta">
              <span className="at-ideia__rotulo at-ideia__rotulo--lime">FALTOU {i + 1} DE {faltou.itens.length}</span>
              <p className="at-ideia__porque">{f.porque}</p>
              <CampoFalado rotulo={f.pergunta} valor={respostas[i] ?? ''} onChange={(v) => setRespostas((a) => a.map((x, j) => (j === i ? v : x)))} placeholder="Toque no microfone ou escreva…" />
            </div>
          ))}
          <div className="at-ideia__acoes">
            <Botao variante="secundario" onClick={() => setEtapa('contar')}>← Voltar à conversa</Botao>
            <Botao onClick={seguir}>Seguir para o visual →</Botao>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="at-ideia">
      <header className="at-ideia__topo">
        <div>
          <span className="at-ideia__rotulo">NOVA OBRA · PRIMEIRO PASSO</span>
          <h1>Conte a sua ideia para o Atlas</h1>
        </div>
        <div className="at-ideia__topo-acoes">
          {onPlanilha && <Botao variante="secundario" onClick={onPlanilha}>Tenho uma planilha →</Botao>}
          <Botao variante="secundario" onClick={onVoltar}>← Minhas obras</Botao>
        </div>
      </header>
      <div className="at-ideia__grade">
        <aside className="at-ideia__roteiro">
          <span className="at-ideia__rotulo">ROTEIRO · {feitos} DE {TOPICOS.length}</span>
          <p>É só um guia. Fale do seu jeito: o Atlas percebe o que você já contou e marca sozinho.</p>
          <ol aria-label="Roteiro da conversa">
            {TOPICOS.map((t) => {
              const e = estadoDe(t.id) ?? (daVez?.id === t.id ? 'agora' : 'depois')
              return (
                <li key={t.id} data-estado={e} className="at-ideia__topico">
                  <span className="at-ideia__bola" aria-hidden="true">{e === 'feito' ? <Icone nome="check" tamanho={14} /> : null}</span>
                  <div>
                    <b>{t.pergunta}</b>
                    {e === 'agora' && <span className="at-ideia__dica">{t.dica}</span>}
                    {e === 'agora' && <button type="button" className="at-ideia__pular" onClick={() => mudar({ pulados: [...pulados, t.id] })}>Pular este tópico</button>}
                    {e === 'feito' && <span className="at-ideia__resumo">{cobertos[t.id]}</span>}
                    {e === 'pulado' && <span className="at-ideia__dica">Pulado. Pode falar dele quando quiser.</span>}
                  </div>
                </li>
              )
            })}
          </ol>
        </aside>
        <section className="at-ideia__cartao" aria-label="A sua ideia">
          <div className="at-ideia__cab-relato">
            <h2>{daVez ? daVez.pergunta : 'Algo mais? Pode seguir quando quiser.'}</h2>
            <span className="at-ideia__rotulo">{palavras(relato)} PALAVRAS</span>
          </div>
          <label htmlFor="at-ideia-relato" className="at-ideia__escondido">O que você contou</label>
          <textarea id="at-ideia-relato" aria-label="O que você contou" className="at-ideia__relato" value={relato} onChange={(e) => mudar({ relato: e.target.value })} placeholder="Toque no microfone e conte com as suas palavras. O texto vai aparecendo aqui, e dá para corrigir depois." />
          <div className="at-ideia__rodape">
            <Microfone gravando={voz.gravando} onAlternar={voz.alternar} className="at-ideia__mic" />
            <div className="at-ideia__mic-txt">
              <b>{voz.gravando ? 'Ouvindo… o texto aparece a cada pausa' : 'Toque no microfone e conte com as suas palavras'}</b>
              <span>Nada é construído sem você aprovar.</span>
            </div>
            <Botao onClick={() => void terminar()} disabled={!pronto || etapa === 'conferindo'}>
              {etapa === 'conferindo' ? 'Conferindo o que você contou…' : pronto ? 'Pronto: começar o protótipo →' : 'Conte um pouco mais…'}
            </Botao>
          </div>
          {erro && <p className="at-ideia__erro" role="alert">{erro}</p>}
          {!voz.suportado && <span className="at-ideia__dica">Este computador não liberou o microfone. Pode digitar normalmente.</span>}
        </section>
      </div>
    </div>
  )
}
