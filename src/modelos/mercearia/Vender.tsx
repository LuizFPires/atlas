// App-modelo MERCEARIA — venda no balcão: monta a venda, mostra o total, fecha e dá baixa no estoque (pela porta de dados).
import { useEffect, useState } from 'react'
import { Botao } from '../../ui'
import { formatarPreco, totalDasLinhas, type PortaDados, type Produto, type Venda } from './dados'
import type { PortaCupom } from './cupom'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora. Tente de novo.'

export function Vender({ dados, cupom }: { dados: PortaDados; cupom?: PortaCupom }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carrinho, setCarrinho] = useState<Record<string, number>>({})
  const [erro, setErro] = useState('')
  const [feita, setFeita] = useState<Venda | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true
    void dados.listarProdutos().then((l) => { if (vivo) setProdutos(l) }).catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  const linhas = produtos
    .filter((p) => (carrinho[p.id] ?? 0) > 0)
    .map((p) => ({ produtoId: p.id, nome: p.nome, precoCentavos: p.precoCentavos, qtd: carrinho[p.id] }))
  const total = totalDasLinhas(linhas)

  function adicionar(p: Produto) {
    const atual = carrinho[p.id] ?? 0
    if (atual + 1 > p.quantidade) { setErro(`Só tem ${p.quantidade} de ${p.nome} no estoque.`); return }
    setErro(''); setFeita(null); setAviso('')
    setCarrinho({ ...carrinho, [p.id]: atual + 1 })
  }
  function tirar(p: Produto) {
    const atual = (carrinho[p.id] ?? 0) - 1
    const { [p.id]: _, ...resto } = carrinho
    setErro('')
    setCarrinho(atual > 0 ? { ...resto, [p.id]: atual } : resto)
  }
  async function fechar() {
    try {
      const r = await dados.fecharVenda(linhas.map((l) => ({ produtoId: l.produtoId, qtd: l.qtd })))
      if (!r.ok) { setErro(r.mensagem); return }
      setErro(''); setCarrinho({}); setFeita(r.valor); setAviso('')
      setProdutos(await dados.listarProdutos())
    } catch { setErro(ERRO_PORTA) }
  }
  async function imprimir() {
    if (!cupom || !feita) return
    try {
      const r = await cupom.imprimir(feita)
      if (!r.ok) { setErro(r.mensagem); return }
      setAviso(r.valor.deVerdade ? 'Cupom enviado para a impressora.' : 'Cupom de teste: nenhuma impressora está ligada neste modelo, então nada foi impresso de verdade.')
    } catch { setErro(ERRO_PORTA) }
  }

  return (
    <section aria-label="Vender">
      <h2>Vender</h2>
      {erro && <p role="alert" className="mc-erro">{erro}</p>}
      {feita && (
        <p role="status" className="mc-cartao">Venda fechada: {formatarPreco(feita.totalCentavos)}. O estoque já foi atualizado.</p>
      )}
      {feita && cupom && <div className="mc-acoes"><Botao variante="secundario" onClick={() => void imprimir()}>Imprimir cupom</Botao></div>}
      {aviso && <p role="status" className="mc-mute">{aviso}</p>}
      <p className="mc-etiqueta">Produtos</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {produtos.map((p) => (
          <li key={p.id} className="mc-cartao">
            <div className="mc-linha">
              <span>{p.nome} <span className="mc-preco">{formatarPreco(p.precoCentavos)}</span> <span className="mc-mute">· {p.quantidade} em estoque</span></span>
              <Botao variante="secundario" disabled={p.quantidade === 0} onClick={() => adicionar(p)} aria-label={`Adicionar à venda: ${p.nome}`}>Adicionar</Botao>
            </div>
          </li>
        ))}
      </ul>
      <p className="mc-etiqueta">Venda atual</p>
      {linhas.length === 0 && <p className="mc-mute">Nenhum produto na venda ainda.</p>}
      <ul aria-label="Itens da venda" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {linhas.map((l) => (
          <li key={l.produtoId} className="mc-cartao">
            <div className="mc-linha">
              <span>{l.qtd}x {l.nome} <span className="mc-preco">{formatarPreco(l.precoCentavos * l.qtd)}</span></span>
              <Botao variante="secundario" onClick={() => tirar(produtos.find((p) => p.id === l.produtoId) as Produto)} aria-label={`Tirar da venda: ${l.nome}`}>Tirar</Botao>
            </div>
          </li>
        ))}
      </ul>
      <p>Total: <strong className="mc-preco" data-testid="total-venda">{formatarPreco(total)}</strong></p>
      <div className="mc-acoes">
        <Botao disabled={linhas.length === 0} onClick={() => void fechar()}>Fechar venda</Botao>
      </div>
    </section>
  )
}
