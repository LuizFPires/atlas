// Entrega do kit POR OBRA (S19, M26 item 5): o app pede ao servidor de licenças (/entregar-kit, M2) as instruções dos agentes
// daquela obra. Cada arquivo chega com a marca d'água HMAC do cliente e o aviso de licença (Lei 9.609/98) no topo.
// Invariantes: o kit NÃO fica no repositório do cliente e NÃO é gravado no disco do cliente; vive só na memória e é
// descartado ao fim da obra. O token do dispositivo vem do cofre (nunca de arquivo).
import { cabecalhoDispositivo, lerAtivacao } from '../app/ativacao-api'
import type { PonteDesktop } from '../app/ponte'

export const LEI = 'Lei 9.609/98'

export interface ArquivoKit { caminho: string; conteudo: string }

export interface KitDaObra {
  obraId: string
  marca: string
  /** Só leitura, só na memória. */
  arquivos(): readonly ArquivoKit[]
  /** Esquece tudo (fim da obra). Depois disso, `arquivos()` volta vazio. */
  descartar(): void
}

export type RespKit = { ok: true; kit: KitDaObra } | { ok: false; mensagem: string }

export interface PonteKit {
  entregar(obraId: string): Promise<RespKit>
}

/** O aviso de licença e a marca do cliente precisam estar no TOPO (primeiras linhas) de cada arquivo. */
export function avisoNoTopo(a: ArquivoKit, marca: string): boolean {
  if (a.caminho.toLowerCase().endsWith('.json')) {
    try {
      const o = JSON.parse(a.conteudo) as Record<string, unknown>
      return typeof o._licenca === 'string' && o._licenca.includes(LEI) && o._marca === marca && Object.keys(o)[0] === '_licenca'
    } catch { return false }
  }
  const topo = a.conteudo.split(/\r?\n/).slice(0, 4).join('\n')
  return topo.includes(LEI) && topo.includes(marca)
}

/** Caminho do kit precisa ser relativo e sem "..": o kit nunca escreve fora do lugar combinado. */
export function caminhoSeguro(c: string): boolean {
  if (!c || c.startsWith('/') || /^[a-zA-Z]:/.test(c) || c.includes('\0')) return false
  return !c.split(/[\\/]/).some((p) => p === '..')
}

/** Valida a resposta do servidor e monta o kit em memória. Falha fechado: um arquivo sem aviso derruba a entrega. */
export function montarKitDaObra(obraId: string, resp: unknown): RespKit {
  const r = resp as { marca_dagua?: unknown; arquivos?: unknown }
  const invalido: RespKit = { ok: false, mensagem: 'O kit chegou incompleto. Tente de novo em instantes; nada foi guardado.' }
  if (typeof r?.marca_dagua !== 'string' || r.marca_dagua.length < 8 || !Array.isArray(r.arquivos) || !r.arquivos.length) return invalido
  const marca = r.marca_dagua
  let lista: ArquivoKit[] = []
  for (const a of r.arquivos as Partial<ArquivoKit>[]) {
    if (typeof a?.caminho !== 'string' || typeof a?.conteudo !== 'string' || !caminhoSeguro(a.caminho)) return invalido
    if (!avisoNoTopo({ caminho: a.caminho, conteudo: a.conteudo }, marca)) return invalido
    lista.push({ caminho: a.caminho, conteudo: a.conteudo })
  }
  return {
    ok: true,
    kit: {
      obraId,
      marca,
      arquivos: () => lista,
      descartar: () => { lista = [] },
    },
  }
}

export interface ConfigKit { api: string }

export function criarKitApi(
  ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>,
  cfg: ConfigKit | null,
  f: typeof fetch = fetch,
): PonteKit {
  return {
    async entregar(obraId) {
      if (!cfg) return { ok: false, mensagem: 'A entrega do kit ainda não está aberta por aqui. Volte daqui a pouco.' }
      const g = await lerAtivacao(ponte.cofre)
      if (!g) return { ok: false, mensagem: 'Ative este computador antes de começar a obra.' }
      try {
        const r = await f(`${cfg.api}/entregar-kit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await cabecalhoDispositivo(ponte.cofre)) },
          body: JSON.stringify({ email: g.email, computador_hash: await ponte.hashComputador(), obra_id: obraId }),
        })
        const d = (await r.json().catch(() => ({}))) as { mensagem?: string }
        if (!r.ok) return { ok: false, mensagem: d.mensagem ?? 'Não foi possível liberar o kit agora. Confira a sua licença.' }
        return montarKitDaObra(obraId, d)
      } catch { return { ok: false, mensagem: 'Sem internet no momento. Confira a conexão e tente de novo.' } }
    },
  }
}

/** Modo fixture: devolve um kit pequeno já com marca e aviso, sem rede. */
export function criarKitFixture(marca = 'fixture-marca-0123456789ab'): PonteKit {
  const aviso = `Software proprietário do Atlas, licenciado a Zé (marca ${marca}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`
  return {
    async entregar(obraId) {
      return montarKitDaObra(obraId, {
        marca_dagua: marca,
        arquivos: [
          { caminho: '.claude/agents/implementador.md', conteudo: `---\n# ${aviso}\nname: implementador\n---\nTexto\n` },
          { caminho: '.claude/hooks/progresso.cjs', conteudo: `// ${aviso}\nconst ATLAS_LICENCA = '${marca}'\n` },
        ],
      })
    },
  }
}
