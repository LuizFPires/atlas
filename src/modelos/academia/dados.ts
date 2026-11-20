// App-modelo ACADEMIA — PORTA de dados (single-tenant: os dados são de UMA academia só, a dona do app).
// Hoje só existe o adaptador FIXTURE (memória). O adaptador real aponta para o banco da obra do cliente
// (pendência: app/PENDENTE-ENTREGAR.md). Nenhum segredo e nenhum backend do Atlas aqui.

export interface Aluno { id: string; nome: string; telefone: string }
export interface NovoAluno { nome: string; telefone: string }

export interface Exercicio {
  id: string
  alunoId: string
  nome: string
  series: number
  repeticoes: number
  /** carga em kg; null = sem carga (peso do corpo) */
  cargaKg: number | null
}
export interface NovoExercicio { nome: string; series: number; repeticoes: number; cargaKg: number | null }

export interface Presenca { id: string; alunoId: string; /** AAAA-MM-DD (dia local) */ data: string }

export type Resp<T> = { ok: true; valor: T } | { ok: false; mensagem: string }

export interface PortaDados {
  listarAlunos(): Promise<Aluno[]>
  criarAluno(n: NovoAluno): Promise<Resp<Aluno>>
  editarAluno(id: string, n: NovoAluno): Promise<Resp<Aluno>>
  /** Remove o aluno e tudo dele (treino). */
  removerAluno(id: string): Promise<Resp<Aluno>>
  listarTreino(alunoId: string): Promise<Exercicio[]>
  criarExercicio(alunoId: string, n: NovoExercicio): Promise<Resp<Exercicio>>
  editarExercicio(id: string, n: NovoExercicio): Promise<Resp<Exercicio>>
  removerExercicio(id: string): Promise<Resp<Exercicio>>
  listarPresencas(): Promise<Presenca[]>
  /** Marca a presença do aluno no dia. Não duplica: o mesmo aluno no mesmo dia só vale uma vez. */
  marcarPresenca(alunoId: string, data: string): Promise<Resp<Presenca>>
}

export function dataValida(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

/** Dia LOCAL (do computador de quem usa) no formato AAAA-MM-DD. Não usa UTC: à noite no Brasil (UTC-3) não adianta um dia. */
export function hojeLocal(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`
}
/** Soma dias a uma data AAAA-MM-DD (só aritmética de calendário, sem fuso). */
export function somarDias(d: string, dias: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + dias)
  return t.toISOString().slice(0, 10)
}
export function formatarData(d: string): string {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

export function validarAluno(n: NovoAluno): string | null {
  const nome = n.nome.trim()
  if (nome.length < 2) return 'Escreva o nome do aluno.'
  if (nome.length > 60) return 'O nome ficou comprido demais.'
  const tel = n.telefone.replace(/\D/g, '')
  if (tel.length < 10 || tel.length > 11) return 'Escreva o telefone com DDD, por exemplo (11) 91234-5678.'
  return null
}

export function validarExercicio(n: NovoExercicio): string | null {
  const nome = n.nome.trim()
  if (nome.length < 2) return 'Escreva o nome do exercício.'
  if (nome.length > 60) return 'O nome ficou comprido demais.'
  if (!Number.isInteger(n.series) || n.series < 1 || n.series > 20) return 'As séries precisam ser de 1 a 20.'
  if (!Number.isInteger(n.repeticoes) || n.repeticoes < 1 || n.repeticoes > 200) return 'As repetições precisam ser de 1 a 200.'
  if (n.cargaKg !== null && (!Number.isFinite(n.cargaKg) || n.cargaKg <= 0 || n.cargaKg > 1000)) return 'A carga precisa ser maior que 0 (ou deixe em branco).'
  return null
}

/** "12", "12,5" ou "12.5" vira número; vazio vira null (sem carga); texto inválido vira NaN (a validação recusa). */
export function numeroDoTexto(t: string): number | null {
  const s = t.trim().replace(',', '.')
  if (s === '') return null
  return /^\d+(\.\d{1,2})?$/.test(s) ? parseFloat(s) : NaN
}

export const formatarCarga = (kg: number | null): string => (kg === null ? 'sem carga' : `${String(kg).replace('.', ',')} kg`)

/** Adaptador FIXTURE: dados de exemplo em memória. Não persiste nada. */
export function criarDadosFixture(hoje: string = hojeLocal()): PortaDados {
  let seq = 100
  const alunos: Aluno[] = [
    { id: 'a1', nome: 'Carla Mendes', telefone: '(11) 91234-5678' },
    { id: 'a2', nome: 'Bruno Lima', telefone: '(21) 98765-4321' },
  ]
  const exercicios: Exercicio[] = [
    { id: 'e1', alunoId: 'a1', nome: 'Agachamento', series: 4, repeticoes: 12, cargaKg: 40 },
    { id: 'e2', alunoId: 'a1', nome: 'Prancha', series: 3, repeticoes: 30, cargaKg: null },
    { id: 'e3', alunoId: 'a2', nome: 'Supino reto', series: 3, repeticoes: 10, cargaKg: 30 },
  ]
  const presencas: Presenca[] = [
    { id: 'p1', alunoId: 'a1', data: somarDias(hoje, -2) },
    { id: 'p2', alunoId: 'a2', data: somarDias(hoje, -1) },
    { id: 'p3', alunoId: 'a1', data: somarDias(hoje, -1) },
  ]
  const nao = (o: string) => ({ ok: false, mensagem: `Não achei ${o}.` }) as const
  const aluno = (id: string) => alunos.find((a) => a.id === id)
  return {
    async listarAlunos() { return alunos.map((a) => ({ ...a })) },
    async criarAluno(n) {
      const e = validarAluno(n)
      if (e) return { ok: false, mensagem: e }
      const a: Aluno = { id: `a${++seq}`, nome: n.nome.trim(), telefone: n.telefone.trim() }
      alunos.push(a)
      return { ok: true, valor: { ...a } }
    },
    async editarAluno(id, n) {
      const a = aluno(id)
      if (!a) return nao('esse aluno')
      const e = validarAluno(n)
      if (e) return { ok: false, mensagem: e }
      Object.assign(a, { nome: n.nome.trim(), telefone: n.telefone.trim() })
      return { ok: true, valor: { ...a } }
    },
    async removerAluno(id) {
      const k = alunos.findIndex((x) => x.id === id)
      if (k < 0) return nao('esse aluno')
      const [a] = alunos.splice(k, 1)
      for (let i = presencas.length - 1; i >= 0; i--) if (presencas[i].alunoId === id) presencas.splice(i, 1)
      for (let i = exercicios.length - 1; i >= 0; i--) if (exercicios[i].alunoId === id) exercicios.splice(i, 1)
      return { ok: true, valor: { ...a } }
    },
    async listarTreino(alunoId) { return exercicios.filter((x) => x.alunoId === alunoId).map((x) => ({ ...x })) },
    async criarExercicio(alunoId, n) {
      if (!aluno(alunoId)) return nao('esse aluno')
      const e = validarExercicio(n)
      if (e) return { ok: false, mensagem: e }
      const x: Exercicio = { id: `e${++seq}`, alunoId, nome: n.nome.trim(), series: n.series, repeticoes: n.repeticoes, cargaKg: n.cargaKg }
      exercicios.push(x)
      return { ok: true, valor: { ...x } }
    },
    async editarExercicio(id, n) {
      const x = exercicios.find((y) => y.id === id)
      if (!x) return nao('esse exercício')
      const e = validarExercicio(n)
      if (e) return { ok: false, mensagem: e }
      Object.assign(x, { nome: n.nome.trim(), series: n.series, repeticoes: n.repeticoes, cargaKg: n.cargaKg })
      return { ok: true, valor: { ...x } }
    },
    async removerExercicio(id) {
      const k = exercicios.findIndex((x) => x.id === id)
      if (k < 0) return nao('esse exercício')
      const [x] = exercicios.splice(k, 1)
      return { ok: true, valor: { ...x } }
    },
    async listarPresencas() { return presencas.map((p) => ({ ...p })) },
    async marcarPresenca(alunoId, data) {
      if (!aluno(alunoId)) return nao('esse aluno')
      if (!dataValida(data)) return { ok: false, mensagem: 'Essa data não é válida.' }
      if (presencas.some((p) => p.alunoId === alunoId && p.data === data)) return { ok: false, mensagem: 'Esse aluno já marcou presença nesse dia.' }
      const p: Presenca = { id: `p${++seq}`, alunoId, data }
      presencas.push(p)
      return { ok: true, valor: { ...p } }
    },
  }
}
