// App-modelo BARBEARIA — PORTA de dados (single-tenant: os dados são de UMA empresa só, a dona do app).
// Hoje só existe o adaptador FIXTURE (memória). O adaptador real aponta para o banco da obra do cliente
// (pendência: app/PENDENTE-ENTREGAR.md). Nenhum segredo e nenhum backend do Atlas aqui.

export const SERVICOS = ['Corte', 'Barba', 'Corte e barba', 'Sobrancelha'] as const

export type EstadoHorario = 'marcado' | 'cancelado' | 'feito'

export interface Cliente { id: string; nome: string; telefone: string }
export interface Horario {
  id: string
  /** AAAA-MM-DD */
  dia: string
  /** HH:MM */
  hora: string
  clienteId: string
  servico: string
  estado: EstadoHorario
}
export interface NovoHorario { dia: string; hora: string; clienteId: string; servico: string }
export interface NovoCliente { nome: string; telefone: string }

export type Resp<T> = { ok: true; valor: T } | { ok: false; mensagem: string }

export interface PortaDados {
  listarClientes(): Promise<Cliente[]>
  listarHorarios(dia: string): Promise<Horario[]>
  criarHorario(n: NovoHorario): Promise<Resp<Horario>>
  editarHorario(id: string, n: NovoHorario): Promise<Resp<Horario>>
  cancelarHorario(id: string): Promise<Resp<Horario>>
  criarCliente(n: NovoCliente): Promise<Resp<Cliente>>
  /** Atendimentos já feitos do cliente, do mais recente para o mais antigo. */
  historico(clienteId: string): Promise<Horario[]>
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/

export function validarHorario(n: NovoHorario): string | null {
  if (!DIA_RE.test(n.dia)) return 'Escolha o dia.'
  if (!HORA_RE.test(n.hora)) return 'Escolha uma hora válida, como 14:30.'
  if (!n.clienteId) return 'Escolha o cliente.'
  if (!(SERVICOS as readonly string[]).includes(n.servico)) return 'Escolha o serviço.'
  return null
}

export function normalizarTelefone(t: string): string { return t.replace(/\D/g, '') }

export function validarCliente(n: NovoCliente): string | null {
  const nome = n.nome.trim()
  if (nome.length < 2) return 'Escreva o nome do cliente.'
  if (nome.length > 80) return 'O nome ficou comprido demais.'
  const tel = normalizarTelefone(n.telefone)
  if (tel.length < 10 || tel.length > 11) return 'Escreva o telefone com DDD, por exemplo 11 91234-5678.'
  return null
}

const dia = (base: Date, delta: number): string => {
  const d = new Date(base)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const diaDeHoje = (agora: Date = new Date()): string => dia(agora, 0)

/** Adaptador FIXTURE: dados de exemplo em memória. Não persiste nada. */
export function criarDadosFixture(agora: Date = new Date()): PortaDados {
  let seq = 100
  const clientes: Cliente[] = [
    { id: 'c1', nome: 'João Pereira', telefone: '11912345678' },
    { id: 'c2', nome: 'Marcos Lima', telefone: '11987654321' },
    { id: 'c3', nome: 'Rafael Souza', telefone: '1133334444' },
  ]
  const horarios: Horario[] = [
    { id: 'h1', dia: dia(agora, 0), hora: '09:00', clienteId: 'c1', servico: 'Corte', estado: 'marcado' },
    { id: 'h2', dia: dia(agora, 0), hora: '10:30', clienteId: 'c2', servico: 'Corte e barba', estado: 'marcado' },
    { id: 'h3', dia: dia(agora, 0), hora: '15:00', clienteId: 'c3', servico: 'Barba', estado: 'marcado' },
    { id: 'h4', dia: dia(agora, -7), hora: '09:00', clienteId: 'c1', servico: 'Corte', estado: 'feito' },
    { id: 'h5', dia: dia(agora, -21), hora: '11:00', clienteId: 'c1', servico: 'Corte e barba', estado: 'feito' },
    { id: 'h6', dia: dia(agora, -14), hora: '16:00', clienteId: 'c2', servico: 'Barba', estado: 'feito' },
  ]
  const conflito = (n: NovoHorario, ignorar?: string) =>
    horarios.some((h) => h.id !== ignorar && h.estado === 'marcado' && h.dia === n.dia && h.hora === n.hora)
  const checar = (n: NovoHorario, ignorar?: string): string | null => {
    const e = validarHorario(n)
    if (e) return e
    if (!clientes.some((c) => c.id === n.clienteId)) return 'Esse cliente não está na lista.'
    if (conflito(n, ignorar)) return 'Já tem alguém marcado nesse horário. Escolha outra hora.'
    return null
  }
  return {
    async listarClientes() { return clientes.map((c) => ({ ...c })) },
    async listarHorarios(d) {
      return horarios.filter((h) => h.dia === d).sort((a, b) => a.hora.localeCompare(b.hora)).map((h) => ({ ...h }))
    },
    async criarHorario(n) {
      const e = checar(n)
      if (e) return { ok: false, mensagem: e }
      const h: Horario = { id: `h${++seq}`, ...n, estado: 'marcado' }
      horarios.push(h)
      return { ok: true, valor: { ...h } }
    },
    async editarHorario(id, n) {
      const h = horarios.find((x) => x.id === id)
      if (!h) return { ok: false, mensagem: 'Não achei esse horário.' }
      if (h.estado !== 'marcado') return { ok: false, mensagem: 'Esse horário já foi cancelado ou atendido.' }
      const e = checar(n, id)
      if (e) return { ok: false, mensagem: e }
      Object.assign(h, n)
      return { ok: true, valor: { ...h } }
    },
    async cancelarHorario(id) {
      const h = horarios.find((x) => x.id === id)
      if (!h) return { ok: false, mensagem: 'Não achei esse horário.' }
      if (h.estado === 'feito') return { ok: false, mensagem: 'Esse atendimento já foi feito.' }
      h.estado = 'cancelado'
      return { ok: true, valor: { ...h } }
    },
    async criarCliente(n) {
      const e = validarCliente(n)
      if (e) return { ok: false, mensagem: e }
      const tel = normalizarTelefone(n.telefone)
      if (clientes.some((c) => c.telefone === tel)) return { ok: false, mensagem: 'Já existe um cliente com esse telefone.' }
      const c: Cliente = { id: `c${++seq}`, nome: n.nome.trim(), telefone: tel }
      clientes.push(c)
      return { ok: true, valor: { ...c } }
    },
    async historico(clienteId) {
      return horarios
        .filter((h) => h.clienteId === clienteId && h.estado === 'feito')
        .sort((a, b) => b.dia.localeCompare(a.dia))
        .map((h) => ({ ...h }))
    },
  }
}
