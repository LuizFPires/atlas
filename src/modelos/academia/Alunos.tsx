// App-modelo ACADEMIA — alunos: cadastrar, editar, remover e escolher o aluno que está sendo atendido.
import { useCallback, useEffect, useState } from 'react'
import { Botao, CampoFalado } from '../../ui'
import type { Aluno, PortaDados, Resp } from './dados'

const ERRO_PORTA = 'Não deu pra carregar/salvar agora: a internet ou o servidor do app não respondeu. Confira a conexão e tente de novo.'

interface Props { dados: PortaDados; escolhido: string | null; onEscolher: (id: string | null) => void; onIrTreino?: () => void }

export function Alunos({ dados, escolhido, onEscolher, onIrTreino }: Props) {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => setAlunos(await dados.listarAlunos()), [dados])
  useEffect(() => {
    let vivo = true
    void dados.listarAlunos().then((l) => { if (vivo) setAlunos(l) }).catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  const limpar = () => { setEditando(null); setNome(''); setTelefone(''); setErro('') }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      const r = editando ? await dados.editarAluno(editando, { nome, telefone }) : await dados.criarAluno({ nome, telefone })
      if (!r.ok) { setErro(r.mensagem); return }
      limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  async function remover(a: Aluno) {
    try {
      const r: Resp<Aluno> = await dados.removerAluno(a.id)
      if (!r.ok) { setErro(r.mensagem); return }
      if (escolhido === a.id) onEscolher(null)
      if (editando === a.id) limpar()
      await recarregar()
    } catch { setErro(ERRO_PORTA) }
  }
  const editar = (a: Aluno) => { setEditando(a.id); setNome(a.nome); setTelefone(a.telefone); setErro('') }

  return (
    <section aria-label="Alunos">
      <h2>Alunos</h2>
      <form className="ac-form" onSubmit={salvar} aria-label={editando ? 'Editar aluno' : 'Novo aluno'}>
        <CampoFalado rotulo="Nome do aluno" valor={nome} onChange={setNome} placeholder="Ex.: Carla Mendes" autoComplete="off" />
        <CampoFalado rotulo="Telefone" valor={telefone} onChange={setTelefone} placeholder="(11) 91234-5678" autoComplete="off" juntar={(a, f) => (a + f).replace(/[^\d()\s-]/g, '')} />
        {erro && <p role="alert" className="ac-erro">{erro}</p>}
        <div className="ac-acoes">
          <Botao type="submit">{editando ? 'Salvar aluno' : 'Adicionar aluno'}</Botao>
          {editando && <Botao type="button" variante="secundario" onClick={limpar}>Cancelar edição</Botao>}
        </div>
      </form>
      {alunos.length === 0 && <p className="ac-mute">Nenhum aluno ainda. Adicione o primeiro.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {alunos.map((a) => (
          <li key={a.id} className="ac-cartao">
            <div className="ac-linha">
              <span>{a.nome} <span className="ac-mute">{a.telefone}</span></span>
              {escolhido === a.id && <span className="ac-etiqueta">Escolhido</span>}
            </div>
            <div className="ac-acoes">
              <Botao variante="secundario" onClick={() => { onEscolher(a.id); onIrTreino?.() }} aria-label={`Escolher ${a.nome}`}>Escolher</Botao>
              <Botao variante="secundario" onClick={() => editar(a)} aria-label={`Editar ${a.nome}`}>Editar</Botao>
              <Botao variante="secundario" onClick={() => void remover(a)} aria-label={`Remover ${a.nome}`}>Remover</Botao>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
