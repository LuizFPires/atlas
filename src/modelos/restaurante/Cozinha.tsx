// App-modelo RESTAURANTE — cozinha: pedidos "na cozinha" com os itens a preparar e botão de pronto.
import { useCallback, useEffect, useState } from 'react'
import { Botao } from '../../ui'
import type { Pedido, PortaDados } from './dados'
import type { PortaComanda } from './comanda'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.'

interface Props { dados: PortaDados; comanda?: PortaComanda }

export function Cozinha({ dados, comanda }: Props) {
  const [fila, setFila] = useState<Pedido[]>([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const recarregar = useCallback(async () => setFila((await dados.listarPedidos()).filter((p) => p.status === 'na_cozinha')), [dados])
  useEffect(() => {
    let vivo = true
    void dados.listarPedidos().then((l) => { if (vivo) setFila(l.filter((p) => p.status === 'na_cozinha')) }).catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  async function pronto(p: Pedido) {
    try {
      const r = await dados.mudarStatus(p.id, 'pronto')
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function imprimir(p: Pedido) {
    if (!comanda) return
    try {
      const r = await comanda.imprimir(p)
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      setAviso(r.valor.deVerdade ? `Comanda de ${p.rotulo} enviada para a impressora.` : `Comanda de ${p.rotulo} preparada, mas ainda não sai na impressora de verdade (isso será ligado na entrega do seu app).`)
    } catch { setErro('Não deu pra imprimir agora: confira se a impressora está ligada e conectada a este aparelho, e tente de novo.') }
  }

  return (
    <section aria-label="Cozinha">
      <h2>Cozinha</h2>
      {erro && <p role="alert" className="rt-erro">{erro}</p>}
      {aviso && <p role="status" className="rt-mute">{aviso}</p>}
      {fila.length === 0 && !erro && <p className="rt-mute">Nenhum pedido na cozinha agora. Quando um pedido for mandado para cá, ele aparece nesta tela.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {fila.map((p) => (
          <li key={p.id} className="rt-cartao">
            <section aria-label={`Preparar ${p.rotulo}`}>
              <strong>{p.rotulo}</strong>
              <ul>{p.linhas.map((l) => <li key={l.itemId}>{l.qtd}x {l.nome}</li>)}</ul>
              <div className="rt-acoes">
                <Botao onClick={() => void pronto(p)} aria-label={`Marcar pronto: ${p.rotulo}`}>Pronto</Botao>
                {comanda && <Botao variante="secundario" onClick={() => void imprimir(p)} aria-label={`Imprimir comanda: ${p.rotulo}`}>Imprimir comanda</Botao>}
              </div>
            </section>
          </li>
        ))}
      </ul>
    </section>
  )
}
