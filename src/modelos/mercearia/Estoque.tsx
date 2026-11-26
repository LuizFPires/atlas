// App-modelo MERCEARIA — estoque: criar, editar, remover produto e registrar entrada/saída (pela porta de dados).
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import { formatarData, formatarPreco, precoParaCentavos, type PortaDados, type Produto, type Resp } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.'

export function Estoque({ dados }: { dados: PortaDados }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [qtd, setQtd] = useState('0')
  const [validade, setValidade] = useState('')
  const [ajuste, setAjuste] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => setProdutos(await dados.listarProdutos()), [dados])
  useEffect(() => {
    let vivo = true
    void dados.listarProdutos().then((l) => { if (vivo) setProdutos(l) }).catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  const limpar = () => { setEditando(null); setNome(''); setPreco(''); setQtd('0'); setValidade(''); setErro('') }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const n = { nome, precoCentavos: precoParaCentavos(preco), quantidade: /^\d+$/.test(qtd.trim()) ? Number(qtd) : -1, validade }
    try {
      const r = editando ? await dados.editarProduto(editando, n) : await dados.criarProduto(n)
      if (!r.ok) { setErro(r.mensagem); return }
      limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function acao(f: () => Promise<Resp<Produto>>, depois?: () => void) {
    try {
      const r = await f()
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      depois?.()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  const editar = (p: Produto) => {
    setEditando(p.id); setNome(p.nome); setPreco((p.precoCentavos / 100).toFixed(2).replace('.', ',')); setQtd(String(p.quantidade)); setValidade(p.validade); setErro('')
  }
  const valorAjuste = (id: string) => {
    const t = (ajuste[id] ?? '1').trim()
    return /^\d+$/.test(t) ? Number(t) : 0
  }

  return (
    <section aria-label="Estoque">
      <h2>Estoque</h2>
      <form className="mc-form" onSubmit={salvar} aria-label={editando ? 'Editar produto' : 'Novo produto'}>
        <CampoFalado rotulo="Nome do produto" valor={nome} onChange={setNome} placeholder="Ex.: Arroz 5 kg" autoComplete="off" />
        <CampoFalado rotulo="Preço" valor={preco} onChange={setPreco} placeholder="4,50" autoComplete="off" juntar={(a, f) => (a + f).replace(/[^\d,.]/g, '')} />
        <CampoFalado rotulo="Quantidade" valor={qtd} onChange={setQtd} placeholder="0" autoComplete="off" juntar={(a, f) => (a + f).replace(/\D/g, '')} />
        <label>Validade (se tiver)
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
        </label>
        {erro && <p role="alert" className="mc-erro">{erro}</p>}
        <div className="mc-acoes">
          <Botao type="submit">{editando ? 'Salvar produto' : 'Adicionar produto'}</Botao>
          {editando && <Botao type="button" variante="secundario" onClick={limpar}>Cancelar edição</Botao>}
        </div>
      </form>
      {produtos.length === 0 && <p className="mc-mute">O estoque está vazio. Adicione o primeiro produto.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {produtos.map((p) => (
          <li key={p.id} className="mc-cartao">
            <div className="mc-linha">
              <span>{p.nome} <span className="mc-preco">{formatarPreco(p.precoCentavos)}</span></span>
              <span>Em estoque: <strong>{p.quantidade}</strong>{p.validade && <span className="mc-mute"> · Validade {formatarData(p.validade)}</span>}</span>
            </div>
            <div className="mc-acoes">
              <input
                type="number" min={1} aria-label={`Quantidade para ajustar: ${p.nome}`} style={{ width: 80 }}
                value={ajuste[p.id] ?? '1'} onChange={(e) => setAjuste({ ...ajuste, [p.id]: e.target.value })}
              />
              <Botao variante="secundario" onClick={() => void acao(() => dados.registrarEntrada(p.id, valorAjuste(p.id)))} aria-label={`Entrada: ${p.nome}`}>Entrada</Botao>
              <Botao variante="secundario" onClick={() => void acao(() => dados.registrarSaida(p.id, valorAjuste(p.id)))} aria-label={`Saída: ${p.nome}`}>Saída</Botao>
              <Botao variante="secundario" onClick={() => editar(p)} aria-label={`Editar ${p.nome}`}>Editar</Botao>
              <Botao variante="secundario" onClick={() => void acao(() => dados.removerProduto(p.id), () => { if (editando === p.id) limpar() })} aria-label={`Remover ${p.nome}`}>Remover</Botao>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
