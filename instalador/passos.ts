import { pastaObras, pastaObrasSegura } from './caminhos.ts'

export type Passo = {
  id: 'node' | 'git' | 'gh' | 'claude-code' | 'obras' | 'app'
  titulo: string
  /** Se já estiver pronto, o passo é pulado (a instalação pode ser refeita sem estragar nada). */
  verificar?: string
  /** Depois de rodar o comando, roda o verificar de novo e só aceita se passar (verificação real). */
  confirmar?: boolean
  comando?: string
  /** Passo em código (ex.: checksum); true = ok. */
  funcao?: () => Promise<boolean>
}

export type Executor = {
  roda: (comando: string) => Promise<{ codigo: number }>
}

export const TELA_ATIVACAO = 'F02'
export const TELA_OBRAS = 'F05'
export const TELA_RETOMAR = 'F12'

/** Plano de instalação (o Node já vem do bootstrap): Git, GitHub CLI, Claude Code, pasta das obras e app.
 *  O kit (agentes e skills) NÃO é instalado aqui: o app o recebe do servidor a cada obra (app/adaptadores/kit.cjs),
 *  porque as instruções dos agentes nunca ficam salvas no disco do cliente. */
export function planoDeInstalacao(usuario: string): Passo[] {
  const obras = pastaObras(usuario)
  if (!pastaObrasSegura(obras)) throw new Error('Pasta das obras em local proibido.')
  return [
    {
      id: 'node',
      titulo: 'Conferindo o Node',
      verificar: 'node --version',
      comando: 'winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements',
    },
    {
      // O Claude Code no Windows precisa do Git Bash; e a obra vira um repositório (git) no GitHub do cliente.
      // Logo depois do winget o PATH deste processo ainda é o antigo: a conferência também olha a pasta padrão.
      id: 'git',
      titulo: 'Instalando o Git',
      verificar: 'where git >nul 2>&1 || if exist "%ProgramFiles%\\Git\\cmd\\git.exe" (exit /b 0) else (exit /b 1)',
      comando: 'winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements',
      confirmar: true,
    },
    {
      // O GitHub CLI (gh) cria o repositório e abre os PRs da obra; o login dele é feito pelo app, na etapa das contas.
      id: 'gh',
      titulo: 'Instalando o GitHub CLI',
      verificar: 'where gh >nul 2>&1 || if exist "%ProgramFiles%\\GitHub CLI\\gh.exe" (exit /b 0) else (exit /b 1)',
      comando: 'winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements',
      confirmar: true,
    },
    {
      id: 'claude-code',
      titulo: 'Instalando o Claude Code',
      verificar: 'claude --version',
      comando: 'npm install -g @anthropic-ai/claude-code',
    },
    {
      id: 'obras',
      titulo: 'Criando a pasta das suas obras',
      verificar: `if exist "${obras}\\" (exit /b 0) else (exit /b 1)`,
      comando: `mkdir "${obras}"`,
    },
    {
      // O app é instalado pelo próprio instalador (NSIS); aqui só se confere que ficou lá.
      id: 'app',
      titulo: 'Conferindo o app Atlas',
      verificar: 'if exist "%LOCALAPPDATA%\\Programs\\Atlas\\Atlas.exe" (exit /b 0) else (exit /b 1)',
      comando: 'echo Atlas.exe nao encontrado && exit /b 1',
    },
  ]
}

export type Resultado = { feitos: string[]; pulados: string[]; falhou?: string }

/** Executa o plano em ordem; para no primeiro erro, para poder retomar de onde parou. */
export async function executarPlano(passos: Passo[], exec: Executor): Promise<Resultado> {
  const r: Resultado = { feitos: [], pulados: [] }
  for (const p of passos) {
    if (p.funcao) {
      if (!(await p.funcao())) {
        r.falhou = p.id
        return r
      }
      r.feitos.push(p.id)
      continue
    }
    if (p.verificar && (await exec.roda(p.verificar)).codigo === 0) {
      r.pulados.push(p.id)
      continue
    }
    if (!p.comando || (await exec.roda(p.comando)).codigo !== 0) {
      r.falhou = p.id
      return r
    }
    if (p.confirmar && p.verificar && (await exec.roda(p.verificar)).codigo !== 0) {
      r.falhou = p.id
      return r
    }
    r.feitos.push(p.id)
  }
  return r
}

/** Ponto de entrada real (chamado por executar.mjs): devolve o código de saída do processo. */
export async function rodarInstalacao(
  usuario: string,
  exec: Executor,
  log: (msg: string) => void = () => {},
): Promise<number> {
  const plano = planoDeInstalacao(usuario)
  const r = await executarPlano(plano, exec)
  r.pulados.forEach((id) => log(`pronto: ${id}`))
  r.feitos.forEach((id) => log(`feito: ${id}`))
  if (r.falhou) {
    log(`FALHOU: ${r.falhou}`)
    return 1
  }
  return 0
}

/** Tela inicial do app: a flag manda; sem flag, não ativado cai na ativação (F02); ativado com obra em andamento abre
 *  Retomar (F12); ativado sem obra em andamento cai em "minhas obras" (F05). */
export function telaInicial(argv: string[], jaAtivado = false, obraEmAndamento = false): string {
  const a = argv.find((x) => x.startsWith('--tela='))
  if (a) return a.slice('--tela='.length)
  if (!jaAtivado) return TELA_ATIVACAO
  return obraEmAndamento ? TELA_RETOMAR : TELA_OBRAS
}
