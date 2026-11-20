// App-modelo BARBEARIA — agenda do dia: ver, marcar, editar e cancelar horários (pela porta de dados).
import { useCallback, useEffect, useState } from 'react'
import { Botao } from '../../ui'
import { SERVICOS, type Cliente, type Horario, type PortaDados } from './dados'

interface Props { dados: PortaDados; dia: string }

export function Agenda({ dados, dia }: Props) {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [hora, setHora] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [servico, setServico] = useState<string>(SERVICOS[0])
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    const [h, c] = await Promise.all([dados.listarHorarios(dia), dados.listarClientes()])
    setHorarios(h)
    setClientes(c)
  }, [dados, dia])
  useEffect(() => { void recarregar() }, [recarregar])

  const nomeDe = (id: string) => clientes.find((c) => c.id === id)?.nome ?? 'Cliente'
  const limpar = () => { setEditando(null); setHora(''); setClienteId(''); setServico(SERVICOS[0]); setErro('') }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const n = { dia, hora, clienteId, servico }
    const r = editando ? await dados.editarHorario(editando, n) : await dados.criarHorario(n)
    if (!r.ok) { setErro(r.mensagem); return }
    limpar()
    await recarregar()
  }
  async function cancelar(id: string) {
    const r = await dados.cancelarHorario(id)
    if (!r.ok) { setErro(r.mensagem); return }
    if (editando === id) limpar()
    await recarregar()
  }
  function editar(h: Horario) { setEditando(h.id); setHora(h.hora); setClienteId(h.clienteId); setServico(h.servico); setErro('') }

  return (
    <section aria-label="Agenda do dia">
      <h2>Agenda de hoje</h2>
      <form className="bb-form" onSubmit={salvar} aria-label={editando ? 'Editar horário' : 'Novo horário'}>
        <label>Cliente
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Escolha o cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label>Serviço
          <select value={servico} onChange={(e) => setServico(e.target.value)}>
            {SERVICOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Hora
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        {erro && <p role="alert" className="bb-erro">{erro}</p>}
        <div className="bb-acoes">
          <Botao type="submit">{editando ? 'Salvar mudança' : 'Marcar horário'}</Botao>
          {editando && <Botao variante="secundario" onClick={limpar}>Deixar como estava</Botao>}
        </div>
      </form>
      {horarios.length === 0 && <p className="bb-mute">Nenhum horário marcado para hoje ainda.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {horarios.map((h) => (
          <li key={h.id} className="bb-cartao" data-estado={h.estado}>
            <div className="bb-linha">
              <span className={h.estado === 'cancelado' ? 'bb-cancelado' : ''}>
                <span className="bb-hora">{h.hora}</span> · {nomeDe(h.clienteId)} · {h.servico}
              </span>
              {h.estado === 'cancelado' && <span className="bb-mute">Cancelado</span>}
              {h.estado === 'marcado' && (
                <span className="bb-acoes">
                  <Botao variante="secundario" onClick={() => editar(h)} aria-label={`Editar ${h.hora}`}>Editar</Botao>
                  <Botao variante="secundario" onClick={() => void cancelar(h.id)} aria-label={`Cancelar ${h.hora}`}>Cancelar</Botao>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
