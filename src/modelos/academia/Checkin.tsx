// App-modelo ACADEMIA — check-in: o aluno marca presença do dia; mostra quem treinou hoje e o histórico.
import { useCallback, useEffect, useState } from 'react'
import { Botao } from '../../ui'
import { formatarData, hojeLocal, type Aluno, type PortaDados, type Presenca } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora. Tente de novo.'

/** `hoje` é injetável (testes estáveis); por padrão é o dia LOCAL do computador. */
export function Checkin({ dados, hoje }: { dados: PortaDados; hoje?: string }) {
  const dia = hoje ?? hojeLocal()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [presencas, setPresencas] = useState<Presenca[]>([])
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => setPresencas(await dados.listarPresencas()), [dados])
  useEffect(() => {
    let vivo = true
    void Promise.all([dados.listarAlunos(), dados.listarPresencas()])
      .then(([a, p]) => { if (vivo) { setAlunos(a); setPresencas(p) } })
      .catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  async function marcar(a: Aluno) {
    try {
      const r = await dados.marcarPresenca(a.id, dia)
      if (!r.ok) { setErro(r.mensagem); return }
      setErro('')
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  const nome = (id: string) => alunos.find((a) => a.id === id)?.nome ?? 'Aluno removido'
  const treinouHoje = (id: string) => presencas.some((p) => p.alunoId === id && p.data === dia)
  const hojeLista = presencas.filter((p) => p.data === dia)
  const historico = presencas.filter((p) => p.data !== dia).sort((x, y) => y.data.localeCompare(x.data))

  return (
    <section aria-label="Check-in">
      <h2>Check-in</h2>
      <p className="ac-mute">Hoje é {formatarData(dia)}.</p>
      {erro && <p role="alert" className="ac-erro">{erro}</p>}
      {alunos.length === 0 && <p className="ac-mute">Cadastre um aluno na aba Alunos para marcar presença.</p>}
      <ul aria-label="Marcar presença" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {alunos.map((a) => (
          <li key={a.id} className="ac-cartao">
            <div className="ac-linha">
              <span>{a.nome}</span>
              {treinouHoje(a.id)
                ? <span className="ac-etiqueta">Presente hoje</span>
                : <Botao variante="secundario" onClick={() => void marcar(a)} aria-label={`Marcar presença: ${a.nome}`}>Marcar presença</Botao>}
            </div>
          </li>
        ))}
      </ul>
      <h3>Quem treinou hoje</h3>
      {hojeLista.length === 0
        ? <p className="ac-mute">Ninguém marcou presença hoje ainda.</p>
        : <ul aria-label="Treinaram hoje">{hojeLista.map((p) => <li key={p.id}>{nome(p.alunoId)}</li>)}</ul>}
      <h3>Histórico de presença</h3>
      {historico.length === 0
        ? <p className="ac-mute">Sem presenças em outros dias.</p>
        : <ul aria-label="Histórico de presença">{historico.map((p) => <li key={p.id}><span className="ac-num">{formatarData(p.data)}</span> · {nome(p.alunoId)}</li>)}</ul>}
    </section>
  )
}
