import { useEffect, useState } from 'react'
import { palavras } from './plataforma'
import { Botao, Icone, Trabalhando } from '../ui'
import type { ObraDoEstilo } from './Estilo'
import type { PonteClaude, Plano } from './ponte-claude'
import { NOME_PLANO } from './claude-plano'
import { MODO_RECOMENDADO, MODOS_OBRA, PARADAS_REAIS, TEXTO_MODO, type Etapa, type ModoObra, type Planejamento, type PonteConstrucao, type PonteModoObra } from './ponte-construcao'
import './aprovar.css'

/** O notebook é o canteiro (TP1Tampa): ajustar a tampa na tomada (powercfg, com o clique da pessoa). Só no Atlas instalado. */
export interface PonteTampa { ajustada(): Promise<boolean>; ajustar(): Promise<{ ok: true } | { ok: false; motivo: string }> }
const CHAVE_EU_CUIDO = 'atlas:tampa:eu-cuido'

interface Props {
  obra: ObraDoEstilo
  construcao: PonteConstrucao
  claude: PonteClaude
  /** Preferência do modo, guardada na pasta da obra (o painel da obra, M19, lê a mesma). */
  modos: PonteModoObra
  /** Volta ao protótipo (batismo). */
  onVoltar: () => void
  /** Depois que a obra começou (PLAN.md gerado e construção disparada no modo escolhido): segue para o painel da obra (M19); até lá, volta às obras. */
  onComecou?: () => void
  tampa?: PonteTampa
}

export const recadoDoErroAprovar = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'indisponivel': return 'Quem monta o plano da obra ainda não está ligado neste computador. Quando estiver, esta tela passa a funcionar; você não precisa refazer nada.'
    case 'ja-iniciada': return 'Esta obra já foi começada antes. Nada se perdeu: é só abrir o painel da obra.'
    case 'ja-rodando': return 'O Atlas já está trabalhando nesta obra. Abra o painel para acompanhar.'
    case 'claude-nao-logado': return 'O Claude não está conectado neste computador. Conecte o Claude (o Atlas te guia) e toque em Começar a obra de novo.'
    case 'claude-nao-instalado': return 'O Claude não está instalado neste computador. Peça ajuda ao Atlas no botão Falar com o Atlas: ele te guia para instalar.'
    case 'plan-nao-gravado': case 'plan-invalido': return 'Não consegui gravar o plano da obra na pasta. Confira se a pasta da obra existe e tente de novo.'
    case 'claude-falhou': return 'O Claude não respondeu agora (pode ser o limite do seu plano por algumas horas). Tente de novo daqui a pouco.'
    case 'plano-invalido': return 'Não consegui ler o plano que o Claude montou. Toque em Começar a obra de novo: ele monta outro.'
    case 'kit-indisponivel': return 'Não consegui buscar no servidor do Atlas as instruções da obra. Confira a internet e toque em Começar a obra de novo.'
    case 'sem-etapas': return 'O plano da obra ainda não ficou pronto. Espere ele aparecer à esquerda e toque em Começar a obra.'
    default: {
      // Luiz, 23/11/2026: "erro na hora de começar uma obra" sem pista nenhuma. Um código curto (sem caminho nem dado) diz o que foi.
      const m = e instanceof Error ? /^([A-Za-z][\w-]{1,30})/.exec(e.message)?.[1] : undefined
      return `Não consegui começar a obra agora. Tente de novo em instantes.${m ? ` (código: ${m})` : ''}`
    }
  }
}

/** Texto do prazo em dias de obra (nunca em tokens). */
export const textoDias = (dias: number) => `≈ ${dias} ${dias === 1 ? 'dia' : 'dias'}`

/** Texto do consumo da cota, em palavras simples. */
export function textoCota(pausas: number): string {
  if (pausas <= 0) return 'A obra deve caber na cota do seu plano, sem parar.'
  return `A obra deve usar a cota do seu plano até o fim ${pausas === 1 ? 'uma vez' : `umas ${pausas} vezes`}. Quando isso acontece, ela pausa sozinha e volta quando a cota renova. Nada se perde.`
}

/** F08: aprovar e começar a obra. Mostra etapas, prazo no plano do cliente e consumo da cota. */
export function Aprovar({ obra, construcao, claude, modos, onVoltar, onComecou, tampa }: Props) {
  const [plano, setPlano] = useState<Plano | undefined>()
  const [plan, setPlan] = useState<Planejamento | null>(null)
  const [erro, setErro] = useState('')
  const [erroComecar, setErroComecar] = useState<{ codigo: string; texto: string } | null>(null)
  const [modo, setModo] = useState<ModoObra>(MODO_RECOMENDADO)
  const [guardado, setGuardado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [comecou, setComecou] = useState<{ modo: ModoObra; plan: string } | null>(null)
  const [avisoTampa, setAvisoTampa] = useState<null | 'aberto' | 'ajustando' | 'ajustado' | 'nao-deu'>(null)

  useEffect(() => {
    let vivo = true
    construcao.planejar(obra.pasta, obra.nome).then((p) => { if (vivo) setPlan(p) }, (x) => { if (vivo) setErro(recadoDoErroAprovar(x)) })
    claude.estado().then((s) => { if (vivo) setPlano(s.plano) }, () => undefined)
    // Se o cliente já tinha escolhido antes (voltou a esta tela), respeita a escolha dele.
    modos.ler(obra.pasta).then((m) => { if (vivo && m) { setModo(m); setGuardado(true) } }, () => undefined)
    return () => { vivo = false }
  }, [construcao, claude, modos, obra.pasta, obra.nome])

  const escolher = async (novo: ModoObra) => {
    const anterior = modo
    setModo(novo)
    setErro('')
    try { await modos.gravar(obra.pasta, novo); setGuardado(true) } catch (x) { setModo(anterior); setErro(recadoDoErroAprovar(x)) }
  }

  // Antes de começar: "o notebook é o canteiro" (TP1Tampa). Aparece até a tampa estar ajustada ou a pessoa dizer que cuida disso.
  const pedirComecar = async () => {
    if (!plan || ocupado || comecou) return
    let euCuido = false
    try { euCuido = localStorage.getItem(CHAVE_EU_CUIDO) === '1' } catch { /* sem armazenamento */ }
    const ajustada = tampa ? await tampa.ajustada().catch(() => false) : true
    if (!tampa || ajustada || euCuido) { void comecar(); return }
    setAvisoTampa('aberto')
  }
  const ajustarTampa = async () => {
    if (!tampa) return
    setAvisoTampa('ajustando')
    const r = await tampa.ajustar().catch(() => ({ ok: false as const, motivo: 'nao-deu' }))
    setAvisoTampa(r.ok ? 'ajustado' : 'nao-deu')
  }

  const comecar = async () => {
    if (!plan || ocupado || comecou) return
    setOcupado(true)
    setErroComecar(null)
    try {
      const r = await construcao.iniciar(obra.pasta, obra.nome, modo, plan.etapas)
      setComecou(r)
      onComecou?.() // deu certo: direto para o painel da obra, onde o prédio começa a subir
    } catch (x) {
      // O recado fica logo acima do botão (não no topo da página, fora da vista de quem rolou até aqui).
      setErroComecar({ codigo: x instanceof Error ? x.message : '', texto: recadoDoErroAprovar(x) })
    } finally { setOcupado(false) }
  }

  const etapas: Etapa[] = plan?.etapas ?? []
  const meu = plano ?? 'pro'
  const previsao = plan?.previsao[meu]
  const outro: Plano = meu === 'pro' ? 'max' : 'pro'
  const previsaoOutro = plan?.previsao[outro]

  return (
    <div className="at-apr">
      <header className="at-apr__cab">
        <span className="at-apr__rotulo">PROTÓTIPO APROVADO · VERSÃO 3</span>
        <h1>Pronto para a obra. Confira antes de começar.</h1>
      </header>
      {erro && <p className="at-apr__erro" role="alert">{erro}</p>}
      {!plan && !erro && <Trabalhando titulo="O Atlas está montando o plano da obra" segundos={90} etapas={['Lendo as telas aprovadas do protótipo', 'Dividindo a obra em etapas', 'Calculando o prazo no seu plano do Claude', 'Conferindo o plano antes de mostrar']} />}
      {plan && (
        <div className="at-apr__grade">
          <section className="at-apr__card" aria-label="O que vai ser construído">
            <span className="at-apr__rotulo">O QUE VAI SER CONSTRUÍDO · {etapas.length} ETAPAS</span>
            {etapas.map((e) => (
              <div key={e.n} className="at-apr__etapa"><span>{e.n}</span><div><b>{e.nome}</b><small>{e.desc}</small></div></div>
            ))}
          </section>
          <div className="at-apr__lado">
            {previsao && (
              <section className="at-apr__card at-apr__previsao" aria-label="Previsão no seu plano">
                <span className="at-apr__rotulo">PREVISÃO NO SEU PLANO ({NOME_PLANO[meu].toUpperCase()})</span>
                <div className="at-apr__dias"><b>{textoDias(previsao.dias)}</b><span>com pausas da cota</span></div>
                <span className="at-apr__texto">{previsaoOutro ? `No ${NOME_PLANO[outro]} seria cerca de ${previsaoOutro.dias} ${previsaoOutro.dias === 1 ? 'dia' : 'dias'}. ` : ''}Você pode deixar rodando à noite: a obra pausa e volta sozinha.</span>
                <span className="at-apr__texto">{textoCota(previsao.pausas)}</span>
              </section>
            )}
            <section className="at-apr__card at-apr__modos" aria-label="Como você quer a obra">
              <span className="at-apr__rotulo">COMO VOCÊ QUER A OBRA</span>
              <div role="radiogroup" aria-label="Modo da obra" className="at-apr__opcoes">
                {MODOS_OBRA.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={modo === m} className={`at-apr__modo ${modo === m ? 'at-apr__modo--on' : ''} ${m === MODO_RECOMENDADO ? 'at-apr__modo--destaque' : ''}`} onClick={() => void escolher(m)}>
                    <span className="at-apr__modo-cab"><b>{TEXTO_MODO[m].titulo}</b>{m === MODO_RECOMENDADO && <span className="at-apr__selo">RECOMENDADO</span>}</span>
                    <span className="at-apr__texto">{TEXTO_MODO[m].explica}</span>
                  </button>
                ))}
              </div>
              {modo === 'automatico' && (
                <div className="at-apr__paradas">
                  <b>O Atlas só vai te chamar nas paradas de verdade:</b>
                  {PARADAS_REAIS.map((t) => <span key={t} className="at-apr__item"><Icone nome="check" tamanho={16} />{t}</span>)}
                  <span className="at-apr__texto">Fora isso, ele segue sozinho do começo ao fim.</span>
                </div>
              )}
              <span className="at-apr__texto" role="status">{guardado ? 'Escolha guardada na pasta da obra. ' : ''}Você pode trocar de modo depois, no painel da obra, sem perder nada.</span>
            </section>
            <section className="at-apr__combinado" aria-label="Combinado antes de começar">
              <b>Combinado antes de começar</b>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Você pode pausar quando quiser.</span>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Pode desligar o computador: a obra é salva a cada passo.</span>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Mudou de ideia? Ajustes entram no pós-obra, sem perder nada.</span>
              <span className="at-apr__item"><Icone nome="check" tamanho={16} />Depois de começar ainda dá para ajustar: é só pedir, falando, e o Atlas muda sem perder o que já está pronto.</span>
            </section>
            <section className="at-apr__combinado" aria-label="Aviso das lojas de aplicativos">
              <b>Quer o app na App Store ou no Google Play?</b>
              <span>Avise já: a papelada das lojas leva alguns dias, e o Atlas adianta durante a obra. Duas coisas costumam pegar quem nunca publicou:</span>
              <span className="at-apr__item"><Icone nome="relogio" tamanho={16} /><span><b>Apple (empresa):</b> pede o número D-U-N-S, que é um cadastro gratuito da sua empresa e pode demorar alguns dias para sair.</span></span>
              <span className="at-apr__item"><Icone nome="pessoas" tamanho={16} /><span><b>Google Play (conta nova):</b> exige 12 pessoas testando o app por 14 dias seguidos antes de poder publicar. O Atlas te ajuda a juntar essa turma.</span></span>
              <span>Se você só quer instalar pelo celular, sem loja, não precisa de nada disso.</span>
            </section>
            {comecou && (
              <p className="at-apr__ok" role="status">
                <b>A obra começou.</b> {comecou.modo === 'automatico' ? 'O Atlas vai tocar tudo sozinho e só te chama nas paradas de verdade.' : 'O Atlas vai parar no fim de cada etapa para você aprovar.'} O plano da obra foi guardado em {comecou.plan}.
                {onComecou && <> <button type="button" className="at-apr__link" onClick={onComecou}>Ver minhas obras</button></>}
              </p>
            )}
            <div className="at-apr__fim" role="group" aria-label="Começar a obra">
              {erroComecar && (
                <div className="at-apr__erro at-apr__erro--perto" role="alert">
                  <span>{erroComecar.texto}</span>
                  {onComecou && (erroComecar.codigo === 'ja-iniciada' || erroComecar.codigo === 'ja-rodando') && <button type="button" className="at-apr__link" onClick={onComecou}>Ver a obra</button>}
                </div>
              )}
              <div className="at-apr__rodape">
                <Botao variante="secundario" onClick={onVoltar}>Voltar ao protótipo</Botao>
                <Botao className="at-apr__comecar" disabled={ocupado || !!comecou} onClick={() => void pedirComecar()}>{ocupado ? 'Começando a obra…' : 'Começar a obra'}</Botao>
              </div>
            </div>
          </div>
        </div>
      )}
      {avisoTampa && (
        <div className="at-apr__tampa-fundo">
          <div role="dialog" aria-modal="true" aria-labelledby="apr-tampa-tit" className="at-apr__tampa">
            <span className="at-apr__rotulo">ANTES DE COMEÇAR</span>
            <h2 id="apr-tampa-tit">O seu notebook é o canteiro. Enquanto ele estiver ligado, a obra anda.</h2>
            <ol>
              <li><b>Deixe na tomada.</b> Na bateria, {palavras().sistema} desliga para economizar.</li>
              <li>
                <b>Fechar a tampa faz o notebook dormir</b>, e a obra para.{palavras().ajustaTampa
                  ? ' O Atlas pode ajustar o Windows para continuar trabalhando de tampa fechada (na tomada) e desfaz sozinho quando a obra terminar.'
                  : ' Deixe a tampa aberta enquanto a obra anda. Se fechar, ela volta sozinha quando você abrir.'}
                <div className="at-apr__tampa-acoes">
                  {!palavras().ajustaTampa
                    ? <Botao onClick={() => { try { localStorage.setItem(CHAVE_EU_CUIDO, '1') } catch { /* nada */ } setAvisoTampa(null); void comecar() }}>Entendi, vou deixar aberta</Botao>
                    : avisoTampa === 'ajustado'
                    ? <span className="at-apr__tampa-ok" role="status">Ajustado ✓</span>
                    : <Botao onClick={() => void ajustarTampa()} disabled={avisoTampa === 'ajustando'}>{avisoTampa === 'ajustando' ? 'Ajustando…' : 'Ajustar para mim'}</Botao>}
                  {palavras().ajustaTampa && avisoTampa !== 'ajustado' && <Botao variante="secundario" onClick={() => { try { localStorage.setItem(CHAVE_EU_CUIDO, '1') } catch { /* nada */ } setAvisoTampa(null); void comecar() }}>Eu deixo a tampa aberta</Botao>}
                </div>
                {avisoTampa === 'nao-deu' && <span className="at-apr__tampa-erro" role="alert">Não consegui ajustar o Windows daqui. Deixe a tampa aberta enquanto a obra anda.</span>}
              </li>
              <li><b>Desligou? Sem problema.</b> Ao ligar de novo, o Atlas continua de onde parou. Nada se perde.</li>
            </ol>
            <div className="at-apr__tampa-acoes">
              <Botao onClick={() => { setAvisoTampa(null); void comecar() }}>Começar a obra →</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
