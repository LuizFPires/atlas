// Item 6 — /entregar-kit: instruções dos agentes da obra com marca d'água por cliente.
// O conteúdo só existe em memória e na resposta (Cache-Control: no-store); nada é gravado em disco aqui.
import { hmac } from './cripto.ts'
import { type Deps, ErroRegra } from './tipos.ts'
import { verificar } from './verificar.ts'

export interface ArquivoKit { caminho: string; conteudo: string }
/** Fonte das instruções (no servidor: bucket privado/tabela do Luiz). Injetada para teste. */
export type CarregarKit = (obraId: string) => Promise<ArquivoKit[]>

export const LEI = 'Lei 9.609/98'

/** Marca d'água estável por licença: HMAC do id (não dá para forjar nem inverter sem o segredo). */
export async function marcaDagua(d: Deps, licencaId: string): Promise<string> {
  return (await hmac(d.segredo, `marca:${licencaId}`)).slice(0, 24)
}

export function aviso(nome: string, marca: string): string {
  return `Software proprietário do Atlas, licenciado a ${nome} (marca ${marca}). Cópia, redistribuição ou revenda são proibidas (${LEI}).`
}

export function aplicarMarca(a: ArquivoKit, nome: string, marca: string): ArquivoKit {
  const av = aviso(nome, marca)
  const ext = a.caminho.slice(a.caminho.lastIndexOf('.')).toLowerCase()
  if (ext === '.json') {
    // Sem marca não há entrega: JSON inválido ou que não seja objeto quebraria o invariante da marca por cliente.
    let o: unknown
    try { o = JSON.parse(a.conteudo) } catch { o = null }
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      throw new ErroRegra('kit_invalido', 'Um arquivo do kit não pôde receber a marca do cliente.', 500)
    }
    return { ...a, conteudo: JSON.stringify({ _licenca: av, _marca: marca, ...o }, null, 2) }
  }
  if (['.js', '.cjs', '.mjs', '.ts', '.tsx'].includes(ext)) {
    // Linha #! (hooks executáveis) precisa continuar sendo a primeira; o aviso vem logo abaixo, ainda no topo.
    const sb = a.conteudo.match(/^#![^\n]*\n/)
    const resto = sb ? a.conteudo.slice(sb[0].length) : a.conteudo
    return { ...a, conteudo: `${sb ? sb[0] : ''}// ${av}\nconst ATLAS_LICENCA = '${marca}'\n${resto}` }
  }
  if (ext === '.html') return { ...a, conteudo: `<!-- ${av} -->\n<meta name="atlas-licenca" content="${marca}">\n${a.conteudo}` }
  // Agente/skill (.md com frontmatter): o Claude Code exige o '---' na primeira linha. O aviso entra como comentário YAML
  // logo na linha 2 (continua no topo) e a marca fecha o arquivo.
  if (ext === '.md') {
    const abre = a.conteudo.match(/^---\r?\n/)
    if (abre) {
      return { ...a, conteudo: `${abre[0]}# ${av} atlas-licenca:${marca}\n${a.conteudo.slice(abre[0].length)}\n<!-- atlas-licenca:${marca} -->\n` }
    }
  }
  // .md e demais: comentário HTML invisível na renderização + rodapé com a marca
  return { ...a, conteudo: `<!-- ${av} -->\n${a.conteudo}\n<!-- atlas-licenca:${marca} -->\n` }
}

/** Confere se o arquivo entregue leva o aviso de licença (Lei 9.609/98) e a marca do cliente nas primeiras linhas. */
export function temAvisoNoTopo(a: ArquivoKit, marca: string): boolean {
  if (a.caminho.toLowerCase().endsWith('.json')) {
    try {
      const o = JSON.parse(a.conteudo) as Record<string, unknown>
      return typeof o._licenca === 'string' && o._licenca.includes(LEI) && o._marca === marca && Object.keys(o)[0] === '_licenca'
    } catch { return false }
  }
  const topo = a.conteudo.split(/\r?\n/).slice(0, 4).join('\n')
  return topo.includes(LEI) && topo.includes(marca)
}

export async function entregarKit(
  d: Deps,
  carregar: CarregarKit,
  a: { email: string; computador_hash: string; token_dispositivo: string; obra_id: string },
) {
  if (!/^[\w.-]{1,80}$/.test(a.obra_id)) throw new ErroRegra('obra_invalida', 'Identificação da obra inválida.')
  const v = await verificar(d, a)
  if (!v.pode_construir || !v.licenca_id) throw new ErroRegra('negado', 'Não foi possível liberar o kit.', 403)
  const cliente = await d.store.clientePorEmail(a.email.trim().toLowerCase())
  const marca = await marcaDagua(d, v.licenca_id)
  const nome = cliente?.nome_tratamento ?? 'cliente'
  const arquivos = (await carregar(a.obra_id)).map((f) => aplicarMarca(f, nome, marca))
  // Pós-condição do invariante: nenhum arquivo sai sem o aviso no topo e a marca do cliente.
  if (!arquivos.every((f) => temAvisoNoTopo(f, marca))) throw new ErroRegra('kit_invalido', 'Um arquivo do kit não pôde receber a marca do cliente.', 500)
  await d.store.inserirEntrega({ licenca_id: v.licenca_id, obra_id: a.obra_id, marca_dagua: marca, baixado_em: d.agora() })
  return {
    marca_dagua: marca,
    arquivos,
    valido_ate: v.valido_ate,
    /** O app deve manter só em memória e descartar ao fim da obra. */
    cabecalhos: { 'Cache-Control': 'no-store', 'X-Atlas-Persistir': 'nunca' },
  }
}
