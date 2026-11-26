// App-modelo RESTAURANTE — cardápio: criar, editar, remover e marcar item como disponível/esgotado (pela porta de dados).
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import { CATEGORIAS, formatarPreco, precoParaCentavos, type ItemCardapio, type PortaDados, type Resp } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.'

export function Cardapio({ dados }: { dados: PortaDados }) {
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[1])
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => setItens(await dados.listarCardapio()), [dados])
  useEffect(() => {
    let vivo = true
    void dados.listarCardapio().then((l) => { if (vivo) setItens(l) }).catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  const limpar = () => { setEditando(null); setNome(''); setPreco(''); setCategoria(CATEGORIAS[1]); setErro('') }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const n = { nome, precoCentavos: precoParaCentavos(preco), categoria }
    try {
      const r = editando ? await dados.editarItem(editando, n) : await dados.criarItem(n)
      if (!r.ok) { setErro(r.mensagem); return }
      limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function acao(f: () => Promise<Resp<ItemCardapio>>, depois?: () => void) {
    try {
      const r = await f()
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      depois?.()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  const editar = (i: ItemCardapio) => {
    setEditando(i.id); setNome(i.nome); setPreco((i.precoCentavos / 100).toFixed(2).replace('.', ',')); setCategoria(i.categoria); setErro('')
  }

  return (
    <section aria-label="Cardápio">
      <h2>Cardápio</h2>
      <form className="rt-form" onSubmit={salvar} aria-label={editando ? 'Editar item' : 'Novo item'}>
        <CampoFalado rotulo="Nome do prato" valor={nome} onChange={setNome} placeholder="Ex.: Feijoada completa" autoComplete="off" />
        <CampoFalado rotulo="Preço" valor={preco} onChange={setPreco} placeholder="25,90" autoComplete="off" juntar={(a, f) => (a + f).replace(/[^\d,.]/g, '')} />
        <label>Categoria
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {erro && <p role="alert" className="rt-erro">{erro}</p>}
        <div className="rt-acoes">
          <Botao type="submit">{editando ? 'Salvar item' : 'Adicionar item'}</Botao>
          {editando && <Botao type="button" variante="secundario" onClick={limpar}>Cancelar edição</Botao>}
        </div>
      </form>
      {itens.length === 0 && <p className="rt-mute">O cardápio está vazio. Adicione o primeiro prato.</p>}
      {CATEGORIAS.map((cat) => {
        const doGrupo = itens.filter((i) => i.categoria === cat)
        if (doGrupo.length === 0) return null
        return (
          <div key={cat}>
            <p className="rt-etiqueta">{cat}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {doGrupo.map((i) => (
                <li key={i.id} className={`rt-cartao${i.disponivel ? '' : ' rt-esgotado'}`}>
                  <div className="rt-linha">
                    <span>{i.nome} <span className="rt-preco">{formatarPreco(i.precoCentavos)}</span>{!i.disponivel && <span className="rt-mute"> · Esgotado</span>}</span>
                    <div className="rt-acoes">
                      <Botao variante="secundario" onClick={() => void acao(() => dados.definirDisponivel(i.id, !i.disponivel))} aria-label={`${i.disponivel ? 'Marcar esgotado' : 'Marcar disponível'}: ${i.nome}`}>{i.disponivel ? 'Esgotou' : 'Voltou'}</Botao>
                      <Botao variante="secundario" onClick={() => editar(i)} aria-label={`Editar ${i.nome}`}>Editar</Botao>
                      <Botao variante="secundario" onClick={() => void acao(() => dados.removerItem(i.id), () => { if (editando === i.id) limpar() })} aria-label={`Remover ${i.nome}`}>Remover</Botao>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
