import { pastaObras, pastaObrasSegura } from './caminhos.ts'

export type Passo = {
  id: 'node' | 'claude-code' | 'integridade' | 'plugin' | 'obras' | 'app'
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

/** Id do plugin Atlas dentro do marketplace local empacotado. PLACEHOLDER: ids reais vêm do M9. */
export const PLUGIN_MARKETPLACE = 'atlas-local'
export const PLUGIN_ID = `atlas@${PLUGIN_MARKETPLACE}`
/** PLACEHOLDER (M9): SHA-256 da pasta plugin-atlas empacotada. Enquanto for placeholder, a instalação NÃO prossegue. */
export const PLUGIN_SHA256 = 'PLACEHOLDER-M9-SHA256'

export type OpcoesPlano = {
  /** Pasta resources\instalador do pacote (onde está plugin-atlas). */
  recursos: string
  /** Confere o checksum da pasta do plugin contra o esperado. */
  integridade: (esperado: string) => Promise<boolean>
}

/** Plano de instalação (o Node já vem do bootstrap): Claude Code, plugin Atlas local, pasta das obras e app. */
export function planoDeInstalacao(usuario: string, opc: OpcoesPlano): Passo[] {
  const obras = pastaObras(usuario)
  if (!pastaObrasSegura(obras)) throw new Error('Pasta das obras em local proibido.')
  const pluginDir = `${opc.recursos.replace(/[\\/]+$/, '')}\\plugin-atlas`
  return [
    {
      id: 'node',
      titulo: 'Conferindo o Node',
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
      id: 'integridade',
      titulo: 'Conferindo a integridade do plugin do Atlas',
      funcao: () => opc.integridade(PLUGIN_SHA256),
    },
    {
      id: 'plugin',
      titulo: 'Instalando o plugin do Atlas',
      verificar: `claude plugin list | findstr /i "${PLUGIN_ID}"`,
      confirmar: true,
      comando: `claude plugin marketplace add "${pluginDir}" && claude plugin install ${PLUGIN_ID}`,
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
  opc: OpcoesPlano,
  exec: Executor,
  log: (msg: string) => void = () => {},
): Promise<number> {
  const plano = planoDeInstalacao(usuario, opc)
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
