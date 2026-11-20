// App-modelo BARBEARIA — agenda do dia: ver, marcar, editar e cancelar horários (pela porta de dados).
import { useCallback, useEffect, useState } from 'react'
import { Botao } from '../../ui'
import { SERVICOS, type Cliente, type Horario, type PortaDados } from './dados'
import { lembretesQueSairiam, type PortaEnvio } from './lembretes'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora. Tente de novo.'

interface Props { dados: PortaDados; dia: string; nomeNegocio?: string; envio?: PortaEnvio }

export function Agenda({ dados, dia, nomeNegocio = 'barbearia', envio }: Props) {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [hora, setHora] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [servico, setServico] = useState<string>(SERVICOS[0])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const recarregar = useCallback(async () => {
    const [h, c] = await Promise.all([dados.listarHorarios(dia), dados.listarClientes()])
    setHorarios(h)
    setClientes(c)
  }, [dados, dia])
  useEffect(() => {
    let vivo = true
    void Promise.all([dados.listarHorarios(dia), dados.listarClientes()])
      .then(([h, c]) => { if (vivo) { setHorarios(h); setClientes(c) } })
      .catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados, dia])

  const nomeDe = (id: string) => clientes.find((c) => c.id === id)?.nome ?? 'Cliente'
  const limpar = () => { setEditando(null); setHora(''); setClienteId(''); setServico(SERVICOS[0]); setErro('') }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const n = { dia, hora, clienteId, servico }
    try {
      const r = editando ? await dados.editarHorario(editando, n) : await dados.criarHorario(n)
      if (!r.ok) { setErro(r.mensagem); return }
      limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function cancelar(id: string) {
    try {
      const r = await dados.cancelarHorario(id)
      if (!r.ok) { setErro(r.mensagem); return }
      if (editando === id) limpar()
      setErro('')
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function alternarLembrete(h: Horario) {
    try {
      const r = await dados.definirLembrete(h.id, !h.lembrete)
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  const saindo = lembretesQueSairiam(nomeNegocio, horarios, clientes)
  async function enviarLembretes() {
    if (!envio) return
    const r = await envio.enviar(saindo)
    setAviso(r.ok ? (r.valor.deVerdade ? `${r.valor.enviados} lembrete(s) enviado(s).` : `Demonstração: ${r.valor.enviados} lembrete(s) preparado(s), mas nada foi enviado de verdade.`) : r.mensagem)
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
      <ul aria-label="Horários" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {horarios.map((h) => (
          <li key={h.id} className="bb-cartao" data-estado={h.estado}>
            <div className="bb-linha">
              <span className={h.estado === 'cancelado' ? 'bb-cancelado' : ''}>
                <span className="bb-hora">{h.hora}</span> · {nomeDe(h.clienteId)} · {h.servico}
              </span>
              {h.estado === 'cancelado' && <span className="bb-mute">Cancelado</span>}
              {h.estado === 'marcado' && (
                <span className="bb-acoes">
                  <label className="bb-mute"><input type="checkbox" checked={h.lembrete} onChange={() => void alternarLembrete(h)} aria-label={`Lembrar o cliente das ${h.hora}`} /> Lembrar</label>
                  <Botao variante="secundario" onClick={() => editar(h)} aria-label={`Editar ${h.hora}`}>Editar</Botao>
                  <Botao variante="secundario" onClick={() => void cancelar(h.id)} aria-label={`Cancelar ${h.hora}`}>Cancelar</Botao>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <section aria-label="Lembretes" style={{ marginTop: 16 }}>
        <h3>Lembretes que vão sair</h3>
        {saindo.length === 0 ? <p className="bb-mute">Nenhum lembrete marcado. Marque &quot;Lembrar&quot; em um horário.</p> : (
          <ul>{saindo.map((l) => <li key={l.horarioId}>{l.mensagem}</li>)}</ul>
        )}
        {envio && saindo.length > 0 && <Botao variante="secundario" onClick={() => void enviarLembretes()}>Enviar lembretes</Botao>}
        {aviso && <p role="status" className="bb-mute">{aviso}</p>}
      </section>
    </section>
  )
}
