import { useEffect, useMemo, useRef, useState } from 'react'
import { CampoFalado } from '../ui'
import { guiaChaveGateway, type Guia } from './guias-site'
import { montarSrcDoc } from './ponte-prototipo'
import { explicarErroVendas, type EstadoVendas, type Marcacao, type PonteVendas } from './ponte-vendas'
import type { Gateway } from './ponte-lancamento'
import './pagina-vendas.css'

interface Props {
  obra: { nome: string; pasta: string }
  gateway: Gateway
  vendas: PonteVendas
  onGuia: (g: Guia) => void
  intervaloMs?: number
}

const ALTURA = 2400
const NOME_GW: Record<Gateway, string> = { stripe: 'Stripe', asaas: 'Asaas' }

/**
 * Página de vendas (M61; prototipo/caminho-novo/LC4Pagina): o mesmo jeito do protótipo do app. A página aparece num quadro protegido
 * (sem script); tocar num ponto cria uma marcação, falar ou escrever o ajuste, mandar e receber a versão seguinte. Só vai para a
 * internet depois de "Aprovar e publicar", e só abre as vendas depois da compra de teste.
 */
export function PaginaVendas({ obra, gateway, vendas, onGuia, intervaloMs = 15_000 }: Props) {
  const [e, setE] = useState<EstadoVendas | null>(null)
  const [marcas, setMarcas] = useState<Marcacao[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [aprovando, setAprovando] = useState(false)
  const [chaveTeste, setChaveTeste] = useState('')
  const [chaveReal, setChaveReal] = useState('')
  const [aviso, setAviso] = useState('')
  const area = useRef<HTMLDivElement>(null)
  const gw = NOME_GW[gateway]

  useEffect(() => {
    let vivo = true
    void vendas.estado(obra.pasta).then((x) => { if (vivo) setE(x) }, () => {})
    return () => { vivo = false }
  }, [vendas, obra.pasta])
  const andando = !!e && ['aprovada', 'construindo', 'testando', 'abrindo'].includes(e.fase)
  useEffect(() => {
    if (!andando) return
    const t = setInterval(() => { void vendas.estado(obra.pasta).then(setE, () => {}) }, intervaloMs)
    return () => clearInterval(t)
  }, [andando, vendas, obra.pasta, intervaloMs])

  const html = e?.html ?? ''
  const srcDoc = useMemo(() => (html ? montarSrcDoc(html) : null), [html])
  const fazer = async (f: () => Promise<EstadoVendas>, depois?: () => void) => {
    setAviso(''); setOcupado(true)
    try { setE(await f()); depois?.() } catch (x) { setAviso(explicarErroVendas((x as Error).message)) } finally { setOcupado(false) }
  }
  const marcar = (ev: React.MouseEvent<HTMLButtonElement>) => {
    const r = area.current?.getBoundingClientRect()
    const x = Math.max(0, Math.round(ev.clientX - (r?.left ?? 0)))
    const y = Math.max(0, Math.round(ev.clientY - (r?.top ?? 0)))
    setMarcas((m) => (m.length >= 20 ? m : [...m, { x, y, texto: '' }]))
  }
  const prontas = marcas.filter((m) => m.texto.trim())

  if (!e) return <p role="status" className="at-noar__txt">Abrindo…</p>
  if (e.fase === 'nada') {
    return (
      <section className="at-noar__card at-noar__card--cheio at-lanc__card">
        <span className="at-noar__rot">INCORPORADOR · A PÁGINA DE VENDAS</span>
        <b className="at-noar__tit at-noar__tit--m">Primeiro um protótipo da página, com o mesmo visual do {obra.nome}. Você marca o que quer mudar, e só publica quando aprovar.</b>
        <button type="button" className="at-noar__prim" disabled={ocupado} onClick={() => void fazer(() => vendas.desenhar(obra.pasta, obra.nome))}>{ocupado ? 'Desenhando…' : 'Desenhar a página de vendas →'}</button>
        {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
      </section>
    )
  }

  const editando = e.fase === 'pronta' && !aprovando
  return (
    <div className="at-pv">
      <div className="at-pv__quadro">
        <span className="at-noar__rot">protótipo · página de vendas do {obra.nome} {editando && <b className="at-pv__selo">MARCANDO · TOQUE NA PÁGINA</b>}</span>
        <div className="at-pv__rolagem">
          <div ref={area} className="at-pv__area" style={{ height: ALTURA }}>
            {srcDoc && <iframe title={`Página de vendas do ${obra.nome}, versão ${e.versao}`} sandbox="" srcDoc={srcDoc} referrerPolicy="no-referrer" style={{ height: ALTURA }} />}
            {editando && <button type="button" className="at-pv__camada" aria-label="Tocar para marcar um ponto da página" onClick={marcar} />}
            {marcas.map((m, i) => <span key={`${m.x}-${m.y}-${i}`} className="at-pv__pino" style={{ left: m.x - 13, top: m.y - 13 }} aria-hidden="true">{i + 1}</span>)}
          </div>
        </div>
      </div>

      <aside className="at-pv__lado">
        {editando && (
          <section className="at-noar__card at-noar__card--cheio">
            <span className="at-noar__rot">PÁGINA DE VENDAS · VERSÃO {e.versao} · CONFIRA</span>
            <span className="at-noar__txt">{e.versao === 1 ? `Feita com o mesmo visual do ${obra.nome} (cores, letras e botões).` : e.resumo} Toque em qualquer ponto da página e fale ou escreva o que quer mudar.</span>
            {marcas.length > 0 && <span className="at-noar__rot">SUAS MARCAÇÕES · {marcas.length}</span>}
            {marcas.map((m, i) => (
              <div key={`${m.x}-${m.y}-${i}`} className="at-pv__marca">
                <CampoFalado rotulo={`Marcação ${i + 1}`} valor={m.texto} placeholder="o que mudar aqui?" onChange={(t) => setMarcas((l) => l.map((x, j) => (j === i ? { ...x, texto: t } : x)))} />
                <button type="button" className="at-lojas__guia" onClick={() => setMarcas((l) => l.filter((_, j) => j !== i))}>Tirar</button>
              </div>
            ))}
            {prontas.length > 0 && (
              <button type="button" className="at-noar__prim" disabled={ocupado} onClick={() => void fazer(() => vendas.ajustar(obra.pasta, prontas), () => setMarcas([]))}>
                {ocupado ? 'O Atlas está ajustando…' : `Mandar ${prontas.length} ${prontas.length === 1 ? 'ajuste' : 'ajustes'} para o Atlas`}
              </button>
            )}
            <span className="at-noar__nota">O Atlas ajusta e mostra a versão seguinte. Vocês vão e voltam quantas vezes quiser.</span>
            <button type="button" className="at-noar__sec" onClick={() => setAprovando(true)}>Aprovar e publicar a página →</button>
          </section>
        )}

        {e.fase === 'pronta' && aprovando && (
          <section className="at-noar__card at-noar__card--cheio">
            <span className="at-noar__rot at-noar__rot--lime">ANTES DE ABRIR · UMA COMPRA DE TESTE</span>
            <span className="at-noar__txt">O Incorporador constrói a página aprovada e liga a cobrança no modo de teste do {gw}. Depois o Atlas compra como um cliente, sem dinheiro de verdade: pagou → a conta é criada → o acesso chega no e-mail.</span>
            <button type="button" className="at-lojas__guia" onClick={() => onGuia(guiaChaveGateway(gateway, 'teste'))}>Pegar a chave de teste do {gw} (passo a passo) →</button>
            <span className="at-lojas__campo">
              <input aria-label={`Chave de teste do ${gw}`} placeholder={gateway === 'stripe' ? 'sk_test_…' : '$aact_hmlg_…'} value={chaveTeste} onChange={(x) => setChaveTeste(x.target.value)} autoComplete="off" spellCheck={false} />
            </span>
            <button type="button" className="at-noar__prim" disabled={ocupado || !chaveTeste.trim()} onClick={() => void fazer(() => vendas.aprovar(obra.pasta, chaveTeste), () => setChaveTeste(''))}>Construir e testar</button>
            <span className="at-noar__nota">A chave vai direto para o servidor do seu sistema. O Atlas não guarda nenhuma cópia.</span>
            <button type="button" className="at-noar__sec" onClick={() => setAprovando(false)}>Voltar a marcar</button>
            {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
          </section>
        )}

        {andando && (
          <section className="at-noar__card at-noar__card--cheio">
            <span className="at-noar__rot at-noar__rot--lime"><span className="at-noar__pisca" aria-hidden="true" />{e.fase === 'testando' ? 'FAZENDO A COMPRA DE TESTE' : e.fase === 'abrindo' ? 'ABRINDO AS VENDAS' : 'INCORPORADOR CONSTRUINDO A PÁGINA'}</span>
            <span className="at-noar__txt">Pode deixar o Atlas trabalhando. Ele avisa quando a compra de teste terminar.</span>
          </section>
        )}

        {(e.fase === 'teste-ok' || e.fase === 'teste-falhou') && (
          <section className={`at-noar__card at-noar__card--cheio ${e.fase === 'teste-ok' ? 'at-noar__card--lime' : 'at-noar__card--ambar'}`}>
            <span className={`at-noar__rot ${e.fase === 'teste-ok' ? 'at-noar__rot--lime' : 'at-noar__rot--ambar'}`}>{e.fase === 'teste-ok' ? 'COMPRA DE TESTE: DEU CERTO' : 'COMPRA DE TESTE: NÃO DEU CERTO'}</span>
            <ul className="at-pv__etapas">{e.etapas.map((t) => <li key={t}>✓ {t}</li>)}</ul>
            {e.fase === 'teste-falhou' && <span className="at-noar__txt">{e.erro ?? 'A compra de teste não terminou.'} O Atlas não abre as vendas sem isso. Toque em "Construir e testar de novo".</span>}
            {e.fase === 'teste-falhou' && <button type="button" className="at-noar__sec" onClick={() => { setAprovando(true); setE({ ...e, fase: 'pronta' }) }}>Construir e testar de novo</button>}
            {e.fase === 'teste-ok' && (
              <>
                <span className="at-noar__txt">Agora é com a chave de verdade: a partir daí, as compras cobram de verdade e o dinheiro cai na sua conta do {gw}.</span>
                <button type="button" className="at-lojas__guia" onClick={() => onGuia(guiaChaveGateway(gateway, 'real'))}>Pegar a chave de verdade do {gw} (passo a passo) →</button>
                <span className="at-lojas__campo">
                  <input aria-label={`Chave de verdade do ${gw}`} placeholder={gateway === 'stripe' ? 'sk_live_…' : '$aact_prod_…'} value={chaveReal} onChange={(x) => setChaveReal(x.target.value)} autoComplete="off" spellCheck={false} />
                </span>
                <button type="button" className="at-noar__prim" disabled={ocupado || !chaveReal.trim()} onClick={() => void fazer(() => vendas.abrir(obra.pasta, chaveReal), () => setChaveReal(''))}>Abrir as vendas →</button>
              </>
            )}
            {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
          </section>
        )}

        {e.fase === 'aberta' && (
          <section className="at-noar__card at-noar__card--lime">
            <span className="at-noar__rot at-noar__rot--lime">AS VENDAS ESTÃO ABERTAS</span>
            <span className="at-noar__txt">A página está no ar no endereço do {obra.nome} + /vendas. Cada venda cai direto na sua conta do {gw}.</span>
          </section>
        )}
        {e.fase === 'erro' && <p className="at-noar__nota" role="alert">{e.erro ?? 'Não deu certo agora.'}</p>}
      </aside>
    </div>
  )
}
