// App-modelo BARBEARIA — ficha do cliente: lista, cadastro simples e histórico de atendimentos (pela porta de dados).
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import type { Cliente, Horario, PortaDados } from './dados'

const formatarDia = (d: string) => d.split('-').reverse().join('/')
export const formatarTelefone = (t: string) =>
  t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t

export function Clientes({ dados }: { dados: PortaDados }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState<Cliente | null>(null)
  const [historico, setHistorico] = useState<Horario[]>([])

  const recarregar = useCallback(async () => setClientes(await dados.listarClientes()), [dados])
  useEffect(() => { void recarregar() }, [recarregar])

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    const r = await dados.criarCliente({ nome, telefone })
    if (!r.ok) { setErro(r.mensagem); return }
    setNome(''); setTelefone(''); setErro('')
    await recarregar()
  }
  async function abrir(c: Cliente) {
    setAberto(c)
    setHistorico(await dados.historico(c.id))
  }

  return (
    <section aria-label="Clientes">
      <h2>Clientes</h2>
      <form className="bb-form" onSubmit={cadastrar} aria-label="Novo cliente">
        <CampoFalado rotulo="Nome do cliente" valor={nome} onChange={setNome} placeholder="Ex.: João Pereira" autoComplete="off" />
        <CampoFalado rotulo="Telefone com DDD" valor={telefone} onChange={setTelefone} placeholder="11 91234-5678" autoComplete="off" juntar={(a, f) => (a + f).replace(/[^\d]/g, '')} />
        {erro && <p role="alert" className="bb-erro">{erro}</p>}
        <div className="bb-acoes"><Botao type="submit">Cadastrar cliente</Botao></div>
      </form>
      {clientes.length === 0 && <p className="bb-mute">Nenhum cliente cadastrado ainda.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {clientes.map((c) => (
          <li key={c.id} className="bb-cartao">
            <div className="bb-linha">
              <span>{c.nome} <span className="bb-mute">{formatarTelefone(c.telefone)}</span></span>
              <Botao variante="secundario" onClick={() => void abrir(c)} aria-label={`Ver ficha de ${c.nome}`}>Ver ficha</Botao>
            </div>
          </li>
        ))}
      </ul>
      {aberto && (
        <section className="bb-cartao" aria-label={`Ficha de ${aberto.nome}`}>
          <h3 style={{ marginTop: 0 }}>{aberto.nome}</h3>
          <p className="bb-mute">{formatarTelefone(aberto.telefone)}</p>
          {historico.length === 0
            ? <p className="bb-mute">Ainda não teve nenhum atendimento.</p>
            : <ul>{historico.map((h) => <li key={h.id}>{formatarDia(h.dia)} às {h.hora} · {h.servico}</li>)}</ul>}
        </section>
      )}
    </section>
  )
}
