import { useEffect, useState } from 'react'
import { guiaAsaas, guiaStripe, type Guia } from './guias-site'
import { PaginaVendas } from './PaginaVendas'
import type { NumerosVendas, PonteVendas } from './ponte-vendas'
import { GATEWAYS, type EstadoLancamento, type ItemLancamento, type PonteLancamento } from './ponte-lancamento'
import './colocar-no-ar.css'
import './lancamento.css'

interface Props {
  obra: { nome: string; pasta: string }
  lancamento: PonteLancamento
  /** Passo a passo da conta do gateway (site ao lado). */
  onGuia: (g: Guia) => void
  onVoltar?: () => void
  /** M61: a página de vendas (protótipo com marcações). */
  vendas?: PonteVendas
}

const ROTULO_FASE: Record<ItemLancamento['fase'], string> = { comecar: 'COMEÇANDO', recebimento: 'ESCOLHENDO ONDE O DINHEIRO CAI', pagina: 'MONTANDO O STAND' }

/** Lançamento de uma obra (M60; prototipo/caminho-novo/LC1Lancamento, telas comecar e recebimento). Opcional: sem começar, nada muda. */
export function Lancamento({ obra, lancamento, onGuia, onVoltar, vendas }: Props) {
  const [e, setE] = useState<EstadoLancamento | null>(null)
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    let vivo = true
    void lancamento.estado(obra.pasta).then((x) => { if (vivo) setE(x) }, () => {})
    return () => { vivo = false }
  }, [lancamento, obra.pasta])
  const fazer = async (f: () => Promise<EstadoLancamento>) => {
    setAviso('')
    try { setE(await f()) } catch (x) { setAviso((x as Error).message === 'obra-fora-do-ar' ? 'Primeiro o sistema precisa estar no ar.' : 'Não deu certo agora. Tente de novo em instantes.') }
  }
  const nome = obra.nome.toLocaleUpperCase('pt-BR')

  return (
    <main className="at-lanc">
      <div className="at-lanc__topo">
        {onVoltar && <button type="button" className="at-noar__voltar" onClick={onVoltar}>← LANÇAMENTOS</button>}
        <h1>{obra.nome} · Lançamento</h1>
        {e?.endereco && <span className="at-noar__mudo">{e.endereco}</span>}
      </div>
      {!e && <p role="status" className="at-noar__txt">Abrindo…</p>}

      {e?.fase === 'comecar' && (
        <section className="at-noar__card at-noar__card--cheio at-lanc__card">
          <span className="at-noar__rot">OPCIONAL · VENDER O {nome} PARA OUTRAS EMPRESAS</span>
          <b className="at-noar__tit at-noar__tit--m">O prédio ficou pronto. Agora é montar o stand e vender os apartamentos.</b>
          <div className="at-lanc__dupla">
            <div><b>Incorporador</b><span>traz o cliente: página de vendas, preços e a cobrança na sua conta de recebimento.</span></div>
            <div><b>Síndico</b><span>administra o cliente: o seu painel de dono, com quem paga, quem atrasou, plano grátis e financeiro.</span></div>
          </div>
          <span className="at-noar__rot">PREÇOS QUE O ATLAS SUGERE · DÁ PARA MUDAR DEPOIS</span>
          <ul className="at-lanc__planos">{e.planos.map((p) => <li key={p.nome}><span>{p.nome} · {p.limite}</span><b>{p.preco}</b></li>)}</ul>
          <button type="button" className="at-noar__prim" onClick={() => void fazer(() => lancamento.comecar(obra.pasta))}>Começar o lançamento →</button>
          <span className="at-noar__nota">O dinheiro cai na sua conta, no seu CPF ou CNPJ. O Atlas nunca toca nele. Quer só usar na sua empresa? É só não começar: nada muda.</span>
        </section>
      )}

      {e?.fase === 'recebimento' && (
        <section className="at-lanc__receb" aria-label="Onde o dinheiro das vendas vai cair">
          <span className="at-noar__rot">ONDE O DINHEIRO DAS VENDAS VAI CAIR · VOCÊ ESCOLHE</span>
          <p className="at-noar__txt">As duas são como uma maquininha de cartão da internet. O dinheiro cai na sua conta do banco, no seu CPF ou CNPJ. O Atlas liga qualquer uma das duas do mesmo jeito, com o passo a passo clique por clique. Dá para trocar depois.</p>
          <div className="at-lanc__gateways">
            {GATEWAYS.map((g) => {
              const escolhido = e.gateway === g.id
              return (
                <section key={g.id} className={`at-noar__card at-lanc__gw ${escolhido ? 'at-noar__card--lime' : ''}`} aria-label={g.nome}>
                  <b className="at-noar__tit at-noar__tit--m">{g.nome}</b>
                  <span className="at-noar__rot at-noar__rot--lime">A FAVOR</span>
                  <ul>{g.pros.map((t) => <li key={t}>✓ {t}</li>)}</ul>
                  <span className="at-noar__rot">CONTRA</span>
                  <ul className="at-lanc__contra">{g.contras.map((t) => <li key={t}>— {t}</li>)}</ul>
                  {!escolhido && <button type="button" className="at-noar__sec" onClick={() => void fazer(() => lancamento.escolherGateway(obra.pasta, g.id))}>Escolher o {g.nome} →</button>}
                  {escolhido && (
                    <>
                      <button type="button" className="at-noar__prim" onClick={() => onGuia(g.id === 'stripe' ? guiaStripe() : guiaAsaas())}>Criar a conta do {g.nome} com o passo a passo →</button>
                      <button type="button" className="at-noar__sec" onClick={() => void fazer(() => lancamento.contaPronta(obra.pasta))}>Já criei a conta</button>
                    </>
                  )}
                </section>
              )
            })}
          </div>
          <span className="at-noar__nota">Ficou em dúvida? Pergunte ao Atlas: "qual é melhor para quem vende para padarias?". Ele responde com o seu caso.</span>
        </section>
      )}

      {e?.fase === 'pagina' && (
        <section className="at-noar__card at-noar__card--lime at-lanc__card">
          <span className="at-noar__rot at-noar__rot--lime">PRONTO PARA A PÁGINA DE VENDAS</span>
          <b className="at-noar__tit at-noar__tit--m">A conta do {e.gateway === 'stripe' ? 'Stripe' : 'Asaas'} está ligada. O dinheiro das vendas cai nela.</b>
          <span className="at-noar__txt">O próximo passo é do Incorporador: ele monta a página de vendas com as cores e as letras do {obra.nome}, e você confere antes de publicar.</span>
          {!vendas && <button type="button" className="at-noar__sec" onClick={() => void fazer(() => lancamento.escolherGateway(obra.pasta, e.gateway === 'stripe' ? 'asaas' : 'stripe'))}>Trocar para o {e.gateway === 'stripe' ? 'Asaas' : 'Stripe'}</button>}
        </section>
      )}
      {e?.fase === 'pagina' && vendas && e.gateway && <PaginaVendas obra={obra} gateway={e.gateway} vendas={vendas} onGuia={onGuia} />}
      {aviso && <p className="at-noar__nota" role="alert">{aviso}</p>}
    </main>
  )
}

/** Menu "Lançamentos" (LC6): só as obras que o cliente decidiu vender. */
export function Lancamentos({ lancamento, onAbrir, vendas }: { lancamento: PonteLancamento; onAbrir: (pasta: string) => void; vendas?: PonteVendas }) {
  const [lista, setLista] = useState<ItemLancamento[] | null>(null)
  const [nums, setNums] = useState<Record<string, NumerosVendas | null>>({})
  useEffect(() => {
    let vivo = true
    void lancamento.listar().then(async (l) => {
      if (!vivo) return
      setLista(l)
      if (!vendas) return
      const pares = await Promise.all(l.map(async (x) => [x.pasta, await vendas.numeros(x.pasta).catch(() => null)] as const))
      if (vivo) setNums(Object.fromEntries(pares))
    }, () => { if (vivo) setLista([]) })
    return () => { vivo = false }
  }, [lancamento, vendas])
  return (
    <main className="at-lanc">
      <div className="at-lanc__topo"><span className="at-noar__rot">AS OBRAS QUE VOCÊ ESTÁ VENDENDO</span><h1>Lançamentos</h1></div>
      <p className="at-noar__txt">Só aparecem aqui as obras que você decidiu vender. As de uso interno continuam em Obras concluídas.</p>
      {lista && lista.length === 0 && <p className="at-noar__txt">Nenhuma obra à venda ainda.</p>}
      <div className="at-lanc__lista">
        {lista?.map((l) => (
          <button key={l.pasta} type="button" className="at-noar__card at-lanc__item" onClick={() => onAbrir(l.pasta)}>
            <span className="at-noar__rot at-noar__rot--ambar">{ROTULO_FASE[l.fase]}</span>
            <b>{l.pasta}</b>
            <span className="at-noar__mudo">{l.endereco ?? ''}</span>
            <span className="at-noar__mudo">{nums[l.pasta] ? `${nums[l.pasta]?.pagando} clientes pagando · ${((nums[l.pasta]?.mes ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} por mês` : '— clientes pagando · — por mês'}</span>
          </button>
        ))}
      </div>
      <span className="at-noar__nota">Para lançar outra obra, abra a obra concluída e toque em "Quer vender este sistema?".</span>
    </main>
  )
}
