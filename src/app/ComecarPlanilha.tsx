import { useEffect, useState } from 'react'
import { textoDaTrava } from './explicar-trava'
import { Botao, Icone, Microfone, useVoz } from '../ui'
import { BloqueioPolitica } from './BloqueioPolitica'
import type { PonteArquivos } from './ponte-arquivos'
import { politicaIndisponivel, type PontePolitica } from './ponte-politica'
import type { Entendimento, PontePlanilha, VisaoPlanilha } from './ponte-planilha'
import './comecar-planilha.css'

interface Props {
  planilha: PontePlanilha
  arquivos: PonteArquivos
  /** Cria a pasta da obra (PonteObras.criarSubpasta). */
  criarObra: (nome: string) => Promise<{ pasta: string }>
  onVoltar: () => void
  /** Segue o caminho (visual, nome, protótipo) com o relato que nasceu da planilha. */
  onConcluir: (r: { pasta: string; nome: string; relato: string }) => void | Promise<void>
  /** Intervalo entre uma aba e outra aparecer na leitura (teste usa 0). */
  revelarMs?: number
  /** M65: "Acha que é engano? Explique" quando o porteiro barra a planilha. */
  politica?: PontePolitica
}

type Fase = 'escolher' | 'lendo' | 'entendendo' | 'entendi'

const RECADO: Record<string, string> = {
  'formato-antigo': 'Essa planilha está no formato antigo do Excel (.xls). Abra no Excel e use Arquivo › Salvar como › Pasta de Trabalho do Excel (.xlsx). Depois escolha de novo.',
  'grande-demais': 'Essa planilha passa de 50 MB. Se tiver abas de histórico antigo, salve uma cópia só com o que você usa hoje.',
  'nao-e-planilha': 'Não consegui abrir esse arquivo como planilha. Confira se ele abre no Excel e tente de novo.',
  'tipo-nao-aceito': 'Esse tipo de arquivo não é planilha. Use Excel (.xlsx, .xlsm) ou .csv.',
}
const recado = (e: unknown) => RECADO[e instanceof Error ? e.message : ''] ?? textoDaTrava(e, 'Não consegui ler a planilha.')

/** "compras-2026.xlsx" → "Compras 2026" (nome provisório; o nome de verdade vem no batismo). */
export const nomeDaPlanilha = (arquivo: string) => {
  const base = arquivo.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Minha planilha'
  return base[0].toLocaleUpperCase('pt-BR') + base.slice(1)
}

/**
 * Começar por uma planilha (prototipo/caminho-novo/X1–X3, aprovadas pelo Luiz em 24/11/2026). A pessoa escolhe a planilha, o
 * Atlas lê tudo aqui no computador (raio-X), confere as contas com o Excel e conta o que entendeu. O mesmo botão de voz responde
 * as dúvidas e pede acréscimos e mudanças (pedido do Luiz). Depois segue o caminho normal: visual, nome, protótipo.
 */
export function ComecarPlanilha({ planilha, arquivos, criarObra, onVoltar, onConcluir, revelarMs = 700, politica = politicaIndisponivel }: Props) {
  const [fase, setFase] = useState<Fase>('escolher')
  const [obra, setObra] = useState<{ pasta: string; nome: string } | null>(null)
  const [visao, setVisao] = useState<VisaoPlanilha | null>(null)
  const [mostradas, setMostradas] = useState(0)
  const [ent, setEnt] = useState<Entendimento | null>(null)
  const [fala, setFala] = useState('')
  const [falando, setFalando] = useState(false)
  const [levar, setLevar] = useState(true)
  const [erro, setErro] = useState('')
  const voz = useVoz((t) => setFala((f) => [f, t].filter(Boolean).join(' ')))

  // As abas aparecem uma a uma (a leitura de verdade já terminou; isto é para a pessoa acompanhar).
  useEffect(() => {
    if (fase !== 'lendo' || !visao || mostradas >= visao.abas.length) return
    const t = setTimeout(() => setMostradas((n) => n + 1), revelarMs)
    return () => clearTimeout(t)
  }, [fase, visao, mostradas, revelarMs])

  const escolher = async () => {
    setErro('')
    try {
      const a = await arquivos.escolher('planilha')
      if (!a) return
      const nome = nomeDaPlanilha(a.nome)
      const o = obra ?? { ...(await criarObra(nome)), nome }
      setObra(o)
      const g = await arquivos.guardar(o.pasta, 'planilha', a.token)
      setFase('lendo')
      setMostradas(0)
      setVisao(await planilha.ler(o.pasta, g.nome))
    } catch (e) { setFase('escolher'); setVisao(null); setErro(recado(e)) }
  }

  const entender = async () => {
    if (!obra) return
    setErro('')
    setFase('entendendo')
    try { setEnt(await planilha.entender(obra.pasta)); setFase('entendi') } catch (e) { setFase('lendo'); setErro(textoDaTrava(e, 'O Claude não conseguiu entender a planilha (ela já está lida).')) }
  }

  const enviarFala = async () => {
    if (!obra || !fala.trim()) return
    setErro('')
    setFalando(true)
    try { setEnt(await planilha.entender(obra.pasta, fala.trim())); setFala('') } catch { setErro('Não consegui juntar o que você falou agora. Tente de novo.') } finally { setFalando(false) }
  }

  const seguir = async () => {
    if (!obra) return
    setErro('')
    try {
      await planilha.levarDados(obra.pasta, levar)
      await onConcluir({ ...obra, relato: await planilha.relato(obra.pasta) })
    } catch (e) { setErro(textoDaTrava(e, 'Não consegui seguir.')) }
  }

  const tudoBate = visao && visao.contas.conferidas > 0 && visao.contas.divergem === 0

  // M65: o porteiro barrou a planilha (ou o que o cliente falou sobre ela): a obra não segue por aqui.
  if (ent?.politica?.bloqueia && obra) {
    const s = ent.politica.situacao
    return (
      <div className="at-pl">
        <BloqueioPolitica modo={s === 'embargada' || s === 'recusada' ? 'embargada' : 'pedido'} sinais={ent.politica.sinais} obra={obra.pasta} politica={politica} onVoltar={onVoltar} />
      </div>
    )
  }

  return (
    <div className="at-pl">
      <header className="at-pl__cab">
        <span className="at-pl__rotulo">NOVA OBRA · 1 · A IDEIA</span>
        <h1>{fase === 'escolher' ? 'Começar por uma planilha' : fase === 'entendi' ? 'O que entendi da sua planilha' : 'Lendo a sua planilha'}</h1>
      </header>
      {erro && <p className="at-ativ__erro" role="alert">{erro}</p>}

      {fase === 'escolher' && (
        <div className="at-pl__grade">
          <section className="at-pl__soltar">
            <b>Escolha a planilha que você usa hoje</b>
            <Botao onClick={() => void escolher()}>Escolher no computador</Botao>
            <span className="at-pl__nota">Excel (.xlsx, .xlsm, .xls) ou .csv · até 50 MB · do Google Planilhas: Arquivo › Fazer download › Excel</span>
            <button type="button" className="at-ativ__link" onClick={onVoltar}>← Prefiro contar a ideia</button>
          </section>
          <aside className="at-pl__lado">
            <span className="at-pl__rotulo at-pl__rotulo--lime">DA PLANILHA AO SISTEMA</span>
            <b>O Atlas lê tudo: abas, colunas, fórmulas, listas, cores e gráficos.</b>
            <ol>
              <li>Lê a planilha aqui no seu computador</li>
              <li>Conta o que entendeu, em português</li>
              <li>Confere as contas com o seu Excel</li>
              <li>Desenha o protótipo a partir dela</li>
            </ol>
            <p className="at-pl__privado"><b>Seus dados ficam no seu computador.</b> Para o Claude vão só a estrutura e poucas linhas de exemplo. Os dados de verdade entram no sistema só quando você mandar.</p>
          </aside>
        </div>
      )}

      {(fase === 'lendo' || fase === 'entendendo') && (
        <section className="at-pl__lendo">
          <div className="at-pl__status" role="status">
            {!visao || mostradas < visao.abas.length ? <><span className="at-pl__gira" aria-hidden="true" />Lendo a planilha…</> : <><Icone nome="check" tamanho={18} /> Pronto: li a planilha inteira.</>}
            {visao && <span className="at-pl__conta">{Math.min(mostradas, visao.abas.length)} DE {visao.abas.length} ABAS</span>}
          </div>
          {visao?.abas.slice(0, mostradas).map((a) => (
            <div key={a.nome} className="at-pl__aba">
              <span className="at-pl__ok" aria-hidden="true"><Icone nome="check" tamanho={14} /></span>
              <div>
                <b>Aba {a.nome} <span>· {a.linhas} linhas · {a.colunas} colunas</span></b>
                {a.achados.map((x) => <span key={x} className="at-pl__achado">{x}</span>)}
              </div>
            </div>
          ))}
          {visao && mostradas >= visao.abas.length && visao.macros && <p className="at-pl__macro"><b>Tem macro.</b> O Atlas não roda nem lê o código dela; no próximo passo pergunta o que ela faz.</p>}
          {visao && mostradas >= visao.abas.length && (
            <div className="at-pl__acoes">
              <Botao onClick={() => void entender()} disabled={fase === 'entendendo'}>{fase === 'entendendo' ? 'O Claude está lendo…' : 'Ver o que entendi →'}</Botao>
              <span className="at-pl__nota">Tudo lido aqui no seu computador.</span>
            </div>
          )}
        </section>
      )}

      {fase === 'entendi' && ent && visao && (
        <div className="at-pl__grade">
          <section className="at-pl__entendi">
            {visao.contas.conferidas > 0 && (
              <div className={`at-pl__conferencia${tudoBate ? '' : ' at-pl__conferencia--aviso'}`} role="status">
                <span className="at-pl__ok"><Icone nome={tudoBate ? 'check' : 'ajuda'} tamanho={16} /></span>
                <div>
                  <b>{tudoBate ? `Conferi ${visao.contas.conferidas} contas da sua planilha: todas batem.` : `Conferi ${visao.contas.conferidas} contas: ${visao.contas.divergem} não batem com o que o Excel guardou.`}</b>
                  <span>{tudoBate ? 'Refiz os totais com as regras abaixo e comparei com o seu Excel. Elas viram os testes do seu sistema.' : 'Pode ser uma conta digitada por cima da fórmula. O sistema vai seguir a regra; confira essas linhas na planilha.'}</span>
                </div>
              </div>
            )}
            <p className="at-pl__resumo">{ent.resumo}</p>
            <span className="at-pl__rotulo">O QUE VOCÊ CONTROLA</span>
            <div className="at-pl__entidades">
              {ent.entidades.map((e) => (
                <div key={e.nome} className="at-pl__entidade"><b>{e.nome}</b>{e.quantos !== null && <em>{e.quantos.toLocaleString('pt-BR')}</em>}<span>{e.campos}</span></div>
              ))}
            </div>
            {ent.relacoes.map((r) => <span key={r} className="at-pl__nota">{r}</span>)}
            {ent.regras.length > 0 && <><span className="at-pl__rotulo">AS REGRAS QUE ESTAVAM NAS FÓRMULAS</span><ul className="at-pl__regras">{ent.regras.map((r) => <li key={r}>{r}</li>)}</ul></>}
            {ent.relatorios.length > 0 && <><span className="at-pl__rotulo">RELATÓRIOS</span><ul className="at-pl__regras">{ent.relatorios.map((r) => <li key={r}>{r}</li>)}</ul></>}
            <div className="at-pl__acoes">
              <Botao onClick={() => void seguir()}>Está certo, seguir →</Botao>
              <button type="button" className="at-ativ__link" onClick={() => { setFase('escolher'); setVisao(null); setEnt(null) }}>Trocar a planilha</button>
            </div>
          </section>
          <aside className="at-pl__lado">
            {ent.perguntas.length > 0 && (
              <>
                <span className="at-pl__rotulo at-pl__rotulo--lime">{ent.perguntas.length === 1 ? '1 COISA QUE NÃO ENTENDI' : `${ent.perguntas.length} COISAS QUE NÃO ENTENDI`}</span>
                {ent.perguntas.map((p) => <div key={p.pergunta} className="at-pl__pergunta"><b>{p.pergunta}</b><span>{p.porque}</span></div>)}
              </>
            )}
            <label htmlFor="pl-fala" className="at-pl__rotulo at-pl__rotulo--caixa">Responder ou pedir mudança, falando</label>
            <div className="at-pl__fala">
              <textarea id="pl-fala" rows={3} value={fala} onChange={(e) => setFala(e.target.value)} placeholder="Ex.: Quem aprova é o Marcos, do financeiro. E quero foto da nota fiscal no pedido." />
              <Microfone gravando={voz.gravando} onAlternar={voz.alternar} />
            </div>
            <span className="at-pl__nota">Quer acrescentar algo ou mudar alguma regra? Use o mesmo botão e fale. O Atlas entende, ajusta o que entendeu e já leva isso para o protótipo.</span>
            <Botao variante="secundario" onClick={() => void enviarFala()} disabled={!fala.trim() || falando}>{falando ? 'O Atlas está ajustando…' : 'Enviar para o Atlas'}</Botao>
            {ent.mudancas.length > 0 && <ul className="at-pl__mudancas" role="status">{ent.mudancas.map((m) => <li key={m}><Icone nome="check" tamanho={14} /> {m}</li>)}</ul>}
            <label className="at-pl__levar">
              <input type="checkbox" checked={levar} onChange={(e) => setLevar(e.target.checked)} />
              <span><b>Levar os seus dados para o sistema</b> <em className="at-pl__tag">RECOMENDADO</em><br />Tudo o que está na planilha entra no sistema no primeiro dia. Ninguém digita nada de novo.</span>
            </label>
            {(ent.aparelho.celular || ent.aparelho.computador) && <p className="at-pl__nota"><b>Sugestão do Atlas:</b> no celular, {ent.aparelho.celular || '—'}; no computador, {ent.aparelho.computador || '—'}.</p>}
          </aside>
        </div>
      )}
    </div>
  )
}
