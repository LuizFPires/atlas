// M32 (e1) — ORQUESTRADOR. provisionar(compra, credenciais, portas): repo -> banco+migrar -> deploy -> guardião -> publicar.
// Cada passo é idempotente (confere se já existe antes de refazer) e o estado é PERSISTIDO por compra, com retomada.
// Credencial só circula como parâmetro: nunca vai ao registro, ao log nem à mensagem de erro (a mensagem do provedor é descartada).
import {
  ORDEM_PASSOS,
  type Compra,
  type ContextoPasso,
  type Credenciais,
  type NomePasso,
  type PortasProvisionamento,
  type RegistroProvisionamento,
} from './portas'

export const MSG_ERRO: Record<NomePasso, string> = {
  repo: 'Não conseguimos criar o código do seu app. Vamos tentar de novo.',
  banco: 'Não conseguimos preparar o banco de dados do seu app. Vamos tentar de novo.',
  deploy: 'Não conseguimos colocar o seu app no ar. Vamos tentar de novo.',
  guardiao: 'Não conseguimos proteger o seu app com a sua licença. Vamos tentar de novo.',
  publicar: 'Não conseguimos publicar o endereço do seu app. Vamos tentar de novo.',
}

export function registroNovo(compraId: string): RegistroProvisionamento {
  return {
    compra_id: compraId,
    passos: { repo: 'pendente', banco: 'pendente', deploy: 'pendente', guardiao: 'pendente', publicar: 'pendente' },
    repo: null,
    banco: null,
    endereco: null,
    erro: null,
  }
}

export function concluido(r: RegistroProvisionamento | null): boolean {
  return !!r && !!r.endereco && ORDEM_PASSOS.every((p) => r.passos[p] === 'feito')
}

/** Roda (ou retoma) o provisionamento. Para no primeiro passo com erro e devolve o registro; reexecutar retoma dali. */
export async function provisionar(compra: Compra, credenciais: Credenciais, p: PortasProvisionamento): Promise<RegistroProvisionamento> {
  const ctx: ContextoPasso = { compra, credenciais }
  const r = (await p.registro.ler(compra.id)) ?? registroNovo(compra.id)
  // "fazendo" que sobrou de uma execução interrompida volta a ser tentado.
  for (const n of ORDEM_PASSOS) if (r.passos[n] === 'fazendo') r.passos[n] = 'pendente'
  r.erro = null

  const executar = async (nome: NomePasso, fazer: () => Promise<void>): Promise<boolean> => {
    if (r.passos[nome] === 'feito') return true
    r.passos[nome] = 'fazendo'
    await p.registro.gravar(structuredClone(r))
    try {
      await fazer()
      r.passos[nome] = 'feito'
      await p.registro.gravar(structuredClone(r))
      return true
    } catch {
      // Descarta a mensagem original de propósito: poderia carregar credencial.
      r.passos[nome] = 'erro'
      r.erro = MSG_ERRO[nome]
      await p.registro.gravar(structuredClone(r))
      return false
    }
  }

  if (!(await executar('repo', async () => { r.repo = (await p.codigo.existe(ctx)) ?? (await p.codigo.criar(ctx)) }))) return r
  if (!(await executar('banco', async () => { r.banco = (await p.banco.existe(ctx)) ?? (await p.banco.criarEMigrar(ctx)) }))) return r
  if (!(await executar('deploy', async () => {
    if (!r.repo || !r.banco) throw new Error('faltam passos anteriores')
    r.endereco = (await p.hospedagem.existe(ctx))?.endereco ?? (await p.hospedagem.deploy(ctx, r.repo, r.banco)).endereco
  }))) return r
  if (!(await executar('guardiao', async () => {
    if (!r.endereco) throw new Error('sem endereço')
    if (!(await p.guardiao.amarrado(ctx))) await p.guardiao.amarrar(ctx, r.endereco)
  }))) return r
  // Publicar: só marca o endereço como o oficial da compra (a entrega lê daqui). Sem endereço, não publica.
  await executar('publicar', async () => { if (!r.endereco) throw new Error('sem endereço') })
  return r
}
