// App-modelo ACADEMIA — treino do dia do aluno escolhido: exercícios com séries, repetições e carga opcional.
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import { formatarCarga, numeroDoTexto, type Aluno, type Exercicio, type PortaDados } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.'
const soNumero = (a: string, f: string) => (a + f).replace(/[^\d,.]/g, '')
const soDigitos = (a: string, f: string) => (a + f).replace(/\D/g, '')

export function Treino({ dados, alunoId }: { dados: PortaDados; alunoId: string | null }) {
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [treino, setTreino] = useState<Exercicio[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [series, setSeries] = useState('3')
  const [reps, setReps] = useState('10')
  const [carga, setCarga] = useState('')
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (alunoId) setTreino(await dados.listarTreino(alunoId))
  }, [dados, alunoId])
  useEffect(() => {
    let vivo = true
    if (!alunoId) return
    void Promise.all([dados.listarAlunos(), dados.listarTreino(alunoId)])
      .then(([as, t]) => { if (vivo) { setAluno(as.find((a) => a.id === alunoId) ?? null); setTreino(t) } })
      .catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados, alunoId])

  if (!alunoId) {
    return <section aria-label="Treino"><h2>Treino</h2><p className="ac-mute">Escolha um aluno na aba Alunos para ver ou montar o treino.</p></section>
  }

  const limpar = () => { setEditando(null); setNome(''); setSeries('3'); setReps('10'); setCarga(''); setErro('') }
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const n = { nome, series: series.trim() ? Number(series) : NaN, repeticoes: reps.trim() ? Number(reps) : NaN, cargaKg: numeroDoTexto(carga) }
    try {
      const r = editando ? await dados.editarExercicio(editando, n) : await dados.criarExercicio(alunoId as string, n)
      if (!r.ok) { setErro(r.mensagem); return }
      limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function remover(x: Exercicio) {
    try {
      const r = await dados.removerExercicio(x.id)
      if (!r.ok) { setErro(r.mensagem); return }
      if (editando === x.id) limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  const editar = (x: Exercicio) => {
    setEditando(x.id); setNome(x.nome); setSeries(String(x.series)); setReps(String(x.repeticoes)); setCarga(x.cargaKg === null ? '' : String(x.cargaKg).replace('.', ',')); setErro('')
  }

  return (
    <section aria-label="Treino">
      <h2>Treino</h2>
      <p className="ac-mute">Aluno: <strong>{aluno?.nome ?? '…'}</strong></p>
      <form className="ac-form" onSubmit={salvar} aria-label={editando ? 'Editar exercício' : 'Novo exercício'}>
        <CampoFalado rotulo="Exercício" valor={nome} onChange={setNome} placeholder="Ex.: Agachamento" autoComplete="off" />
        <CampoFalado rotulo="Séries" valor={series} onChange={setSeries} placeholder="3" autoComplete="off" juntar={soDigitos} />
        <CampoFalado rotulo="Repetições" valor={reps} onChange={setReps} placeholder="10" autoComplete="off" juntar={soDigitos} />
        <CampoFalado rotulo="Carga em kg (se tiver)" valor={carga} onChange={setCarga} placeholder="20" autoComplete="off" juntar={soNumero} />
        {erro && <p role="alert" className="ac-erro">{erro}</p>}
        <div className="ac-acoes">
          <Botao type="submit">{editando ? 'Salvar exercício' : 'Adicionar exercício'}</Botao>
          {editando && <Botao type="button" variante="secundario" onClick={limpar}>Cancelar edição</Botao>}
        </div>
      </form>
      {treino.length === 0 && <p className="ac-mute">Esse aluno ainda não tem treino. Adicione o primeiro exercício.</p>}
      <ul aria-label="Exercícios do treino" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {treino.map((x) => (
          <li key={x.id} className="ac-cartao">
            <div className="ac-linha">
              <span>{x.nome}</span>
              <span className="ac-num">{x.series} x {x.repeticoes} · {formatarCarga(x.cargaKg)}</span>
            </div>
            <div className="ac-acoes">
              <Botao variante="secundario" onClick={() => editar(x)} aria-label={`Editar ${x.nome}`}>Editar</Botao>
              <Botao variante="secundario" onClick={() => void remover(x)} aria-label={`Remover ${x.nome}`}>Remover</Botao>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
