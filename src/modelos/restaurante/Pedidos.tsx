// App-modelo RESTAURANTE — pedidos: abrir (mesa ou cliente), pôr itens do cardápio, ver o total e acompanhar o status.
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import { ROTULO_STATUS, STATUS, formatarPreco, totalDoPedido, type ItemCardapio, type Pedido, type PortaDados, type Resp, type StatusPedido } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.'
const PROXIMO: Partial<Record<StatusPedido, { para: StatusPedido; rotulo: string }>> = {
  aberto: { para: 'na_cozinha', rotulo: 'Mandar para a cozinha' },
  pronto: { para: 'entregue', rotulo: 'Marcar entregue' },
}

export function Pedidos({ dados }: { dados: PortaDados }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cardapio, setCardapio] = useState<ItemCardapio[]>([])
  const [rotulo, setRotulo] = useState('')
  const [escolhido, setEscolhido] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    const [p, c] = await Promise.all([dados.listarPedidos(), dados.listarCardapio()])
    setPedidos(p)
    setCardapio(c)
  }, [dados])
  useEffect(() => {
    let vivo = true
    void Promise.all([dados.listarPedidos(), dados.listarCardapio()])
      .then(([p, c]) => { if (vivo) { setPedidos(p); setCardapio(c) } })
      .catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  async function acao(f: () => Promise<Resp<Pedido>>, depois?: () => void) {
    try {
      const r = await f()
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      depois?.()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  function abrir(e: React.FormEvent) {
    e.preventDefault()
    void acao(() => dados.abrirPedido(rotulo), () => setRotulo(''))
  }
  const disponiveis = cardapio.filter((i) => i.disponivel)

  return (
    <section aria-label="Pedidos">
      <h2>Pedidos</h2>
      <form className="rt-form" onSubmit={abrir} aria-label="Novo pedido">
        <CampoFalado rotulo="Mesa ou nome do cliente" valor={rotulo} onChange={setRotulo} placeholder="Ex.: Mesa 3" autoComplete="off" />
        {erro && <p role="alert" className="rt-erro">{erro}</p>}
        <div className="rt-acoes"><Botao type="submit">Abrir pedido</Botao></div>
      </form>
      {pedidos.length === 0 && <p className="rt-mute">Nenhum pedido ainda.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {pedidos.map((p) => {
          const prox = PROXIMO[p.status]
          const sel = escolhido[p.id] ?? disponiveis[0]?.id ?? ''
          return (
            <li key={p.id} className="rt-cartao">
              <section aria-label={`Pedido ${p.rotulo}`}>
                <div className="rt-linha">
                  <strong>{p.rotulo}</strong>
                  <span className="rt-etiqueta" data-testid={`status-${p.id}`}>{ROTULO_STATUS[p.status]}</span>
                </div>
                <ol className="rt-etiqueta" aria-label="Etapas" style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0 }}>
                  {STATUS.map((s) => <li key={s} aria-current={s === p.status ? 'step' : undefined} style={{ opacity: STATUS.indexOf(s) <= STATUS.indexOf(p.status) ? 1 : 0.4 }}>{ROTULO_STATUS[s]}</li>)}
                </ol>
                {p.linhas.length === 0 && <p className="rt-mute">Ainda sem itens.</p>}
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {p.linhas.map((l) => (
                    <li key={l.itemId} className="rt-linha">
                      <span>{l.qtd}x {l.nome} <span className="rt-preco">{formatarPreco(l.precoCentavos * l.qtd)}</span></span>
                      {p.status === 'aberto' && <Botao variante="secundario" onClick={() => void acao(() => dados.removerDoPedido(p.id, l.itemId))} aria-label={`Tirar ${l.nome} do pedido ${p.rotulo}`}>Tirar</Botao>}
                    </li>
                  ))}
                </ul>
                <p>Total: <strong className="rt-preco" data-testid={`total-${p.id}`}>{formatarPreco(totalDoPedido(p))}</strong></p>
                {p.status === 'aberto' && (
                  <div className="rt-acoes">
                    <select aria-label={`Item para o pedido ${p.rotulo}`} value={sel} onChange={(e) => setEscolhido({ ...escolhido, [p.id]: e.target.value })}>
                      {disponiveis.map((i) => <option key={i.id} value={i.id}>{i.nome} · {formatarPreco(i.precoCentavos)}</option>)}
                    </select>
                    <Botao variante="secundario" onClick={() => void acao(() => dados.adicionarAoPedido(p.id, sel, 1))} aria-label={`Adicionar ao pedido ${p.rotulo}`}>Adicionar</Botao>
                  </div>
                )}
                {prox && <div className="rt-acoes"><Botao onClick={() => void acao(() => dados.mudarStatus(p.id, prox.para))} aria-label={`${prox.rotulo}: ${p.rotulo}`}>{prox.rotulo}</Botao></div>}
              </section>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
