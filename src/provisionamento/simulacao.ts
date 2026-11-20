// M32 (e1) — ADAPTADOR DE SIMULAÇÃO das portas. Nenhuma chamada externa, nenhuma credencial usada.
// Tudo é determinístico (derivado do id da compra) e dá para forçar a falha de um passo. NÃO cria app de verdade.
import { slugDoNome } from '../web/entrega'
import type { NomePasso, PortasProvisionamento, RegistroProvisionamento, RepoCriado, BancoCriado, ContextoPasso } from './portas'

export interface Simulacao {
  portas: PortasProvisionamento
  /** Quantas vezes cada operação de escrita rodou (para provar idempotência). */
  chamadas: Record<NomePasso, number>
  /** Passo que deve falhar na próxima tentativa (null = nenhum). Falha uma vez só se `uma` for true. */
  falharEm(passo: Exclude<NomePasso, 'publicar'> | null, uma?: boolean): void
}

export function criarSimulacao(): Simulacao {
  const chamadas: Record<NomePasso, number> = { repo: 0, banco: 0, deploy: 0, guardiao: 0, publicar: 0 }
  const repos = new Map<string, RepoCriado>()
  const bancos = new Map<string, BancoCriado>()
  const deploys = new Map<string, { endereco: string }>()
  const amarrados = new Set<string>()
  const registros = new Map<string, RegistroProvisionamento>()
  let falha: NomePasso | null = null
  let falhaUma = false

  const testa = (n: NomePasso) => {
    if (falha === n) {
      if (falhaUma) falha = null
      throw new Error('falha simulada')
    }
  }
  const slug = (c: ContextoPasso) => `${slugDoNome(c.compra.personalizacao.nome_negocio)}-${c.compra.id}`

  const portas: PortasProvisionamento = {
    codigo: {
      async existe(c) { return repos.get(c.compra.id) ?? null },
      async criar(c) {
        testa('repo'); chamadas.repo++
        const r = { repo: `simulado/${slug(c)}`, url: `https://github.simulado/${slug(c)}` }
        repos.set(c.compra.id, r)
        return r
      },
    },
    banco: {
      async existe(c) { return bancos.get(c.compra.id) ?? null },
      async criarEMigrar(c) {
        testa('banco'); chamadas.banco++
        const b = { projeto: `proj-${slug(c)}`, url: `https://${slug(c)}.supabase.simulado` }
        bancos.set(c.compra.id, b)
        return b
      },
    },
    hospedagem: {
      async existe(c) { return deploys.get(c.compra.id) ?? null },
      async deploy(c) {
        testa('deploy'); chamadas.deploy++
        const d = { endereco: `https://${slug(c)}.vercel.simulado` }
        deploys.set(c.compra.id, d)
        return d
      },
    },
    guardiao: {
      async amarrado(c) { return amarrados.has(c.compra.licenca.id) },
      async amarrar(c) { testa('guardiao'); chamadas.guardiao++; amarrados.add(c.compra.licenca.id) },
    },
    registro: {
      async ler(id) { const r = registros.get(id); return r ? structuredClone(r) : null },
      async gravar(r) { registros.set(r.compra_id, structuredClone(r)) },
    },
  }
  return { portas, chamadas, falharEm(p, uma = false) { falha = p; falhaUma = uma } }
}
