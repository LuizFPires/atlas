// App-modelo ACADEMIA — evolução do aluno escolhido: peso, cintura e carga de um exercício, por data.
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import { formatarData, hojeLocal, numeroDoTexto, type Aluno, type Exercicio, type Medida, type PortaDados } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora. Tente de novo.'
const soNumero = (a: string, f: string) => (a + f).replace(/[^\d,.]/g, '')
const kg = (v: number | null, un: string) => (v === null ? '—' : `${String(v).replace('.', ',')} ${un}`)

/** `hoje` é injetável: é a data sugerida no formulário (dia LOCAL por padrão). */
export function Evolucao({ dados, alunoId, hoje }: { dados: PortaDados; alunoId: string | null; hoje?: string }) {
  const dia = hoje ?? hojeLocal()
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [treino, setTreino] = useState<Exercicio[]>([])
  const [medidas, setMedidas] = useState<Medida[]>([])
  const [data, setData] = useState(dia)
  const [peso, setPeso] = useState('')
  const [cintura, setCintura] = useState('')
  const [exercicio, setExercicio] = useState('')
  const [carga, setCarga] = useState('')
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (alunoId) setMedidas(await dados.listarEvolucao(alunoId))
  }, [dados, alunoId])
  useEffect(() => {
    let vivo = true
    setAluno(null); setMedidas([]); setTreino([])
    if (!alunoId) return
    void Promise.all([dados.listarAlunos(), dados.listarEvolucao(alunoId), dados.listarTreino(alunoId)])
      .then(([as, m, t]) => { if (vivo) { setAluno(as.find((a) => a.id === alunoId) ?? null); setMedidas(m); setTreino(t) } })
      .catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados, alunoId])

  if (!alunoId) {
    return <section aria-label="Evolução"><h2>Evolução</h2><p className="ac-mute">Escolha um aluno na aba Alunos para ver a evolução.</p></section>
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const n = { data, pesoKg: numeroDoTexto(peso), cinturaCm: numeroDoTexto(cintura), exercicio, cargaKg: numeroDoTexto(carga) }
    try {
      const r = await dados.registrarEvolucao(alunoId as string, n)
      if (!r.ok) { setErro(r.mensagem); return }
      setPeso(''); setCintura(''); setCarga(''); setErro('')
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function remover(m: Medida) {
    try {
      const r = await dados.removerEvolucao(m.id)
      if (!r.ok) { setErro(r.mensagem); return }
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }

  return (
    <section aria-label="Evolução">
      <h2>Evolução</h2>
      <p className="ac-mute">Aluno: <strong>{aluno?.nome ?? '…'}</strong></p>
      <form className="ac-form" onSubmit={salvar} aria-label="Novo registro de evolução">
        <label>Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <CampoFalado rotulo="Peso em kg" valor={peso} onChange={setPeso} placeholder="67,5" autoComplete="off" juntar={soNumero} />
        <CampoFalado rotulo="Cintura em cm" valor={cintura} onChange={setCintura} placeholder="76" autoComplete="off" juntar={soNumero} />
        <label>Exercício da carga
          <select value={exercicio} onChange={(e) => setExercicio(e.target.value)}>
            <option value="">Nenhum</option>
            {treino.map((x) => <option key={x.id} value={x.nome}>{x.nome}</option>)}
          </select>
        </label>
        <CampoFalado rotulo="Carga em kg" valor={carga} onChange={setCarga} placeholder="40" autoComplete="off" juntar={soNumero} />
        {erro && <p role="alert" className="ac-erro">{erro}</p>}
        <div className="ac-acoes"><Botao type="submit">Registrar evolução</Botao></div>
      </form>
      {medidas.length === 0
        ? <p className="ac-mute">Sem registros ainda. Registre o primeiro acima.</p>
        : (
          <table className="ac-tabela" aria-label="Evolução por data">
            <thead><tr><th>Data</th><th>Peso</th><th>Cintura</th><th>Carga</th><th /></tr></thead>
            <tbody>
              {medidas.map((m) => (
                <tr key={m.id}>
                  <td className="ac-num">{formatarData(m.data)}</td>
                  <td>{kg(m.pesoKg, 'kg')}</td>
                  <td>{kg(m.cinturaCm, 'cm')}</td>
                  <td>{m.cargaKg === null ? '—' : `${m.exercicio}: ${kg(m.cargaKg, 'kg')}`}</td>
                  <td><Botao variante="secundario" onClick={() => void remover(m)} aria-label={`Remover registro de ${formatarData(m.data)}`}>Remover</Botao></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  )
}
