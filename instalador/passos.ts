import { pastaObras, pastaObrasSegura } from './caminhos.ts'

export type Passo = {
  id: 'node' | 'claude-code' | 'plugin' | 'obras' | 'app' | 'ativacao'
  titulo: string
  /** Se já estiver pronto, o passo é pulado (a instalação pode ser refeita sem estragar nada). */
  verificar?: string
  comando: string
}

export type Executor = {
  roda: (comando: string) => Promise<{ codigo: number }>
}

export const TELA_ATIVACAO = 'F02'

/** Plano de instalação: Node, Claude Code, plugin Atlas, pasta das obras, app e ativação. */
export function planoDeInstalacao(usuario: string): Passo[] {
  const obras = pastaObras(usuario)
  if (!pastaObrasSegura(obras)) throw new Error('Pasta das obras em local proibido.')
  return [
    {
      id: 'node',
      titulo: 'Instalando o Node',
      verificar: 'node --version',
      comando: 'winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements',
    },
    {
      id: 'claude-code',
      titulo: 'Instalando o Claude Code',
      verificar: 'claude --version',
      comando: 'npm install -g @anthropic-ai/claude-code',
    },
    {
      id: 'plugin',
      titulo: 'Instalando o plugin do Atlas',
      verificar: 'claude plugin list',
      comando: 'claude plugin marketplace add atlas-kit/atlas && claude plugin install atlas@atlas-kit',
    },
    { id: 'obras', titulo: 'Criando a pasta das suas obras', comando: `mkdir "${obras}"` },
    { id: 'app', titulo: 'Instalando o app Atlas', comando: 'atlas-app --instalar' },
    {
      id: 'ativacao',
      titulo: 'Abrindo a ativação',
      comando: `"%LOCALAPPDATA%\\Programs\\Atlas\\Atlas.exe" --tela=${TELA_ATIVACAO}`,
    },
  ]
}

export type Resultado = { feitos: string[]; pulados: string[]; falhou?: string }

/** Executa o plano em ordem; para no primeiro erro, para poder retomar de onde parou. */
export async function executarPlano(passos: Passo[], exec: Executor): Promise<Resultado> {
  const r: Resultado = { feitos: [], pulados: [] }
  for (const p of passos) {
    if (p.verificar && (await exec.roda(p.verificar)).codigo === 0) {
      r.pulados.push(p.id)
      continue
    }
    if ((await exec.roda(p.comando)).codigo !== 0) {
      r.falhou = p.id
      return r
    }
    r.feitos.push(p.id)
  }
  return r
}

/** Argumento de linha de comando -> tela inicial do app (encadeamento com a ativação). */
export function telaInicial(argv: string[]): string {
  const a = argv.find((x) => x.startsWith('--tela='))
  return a ? a.slice('--tela='.length) : TELA_ATIVACAO
}
