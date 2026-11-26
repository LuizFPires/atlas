// Porta da AJUDA DO ATLAS (F17, S18). Todo o suporte é o PRÓPRIO Atlas (o Claude por dentro, com a cara do Atlas):
// nunca promete atendimento humano, nunca manda "falar com alguém".
// A conversa é o Claude por baixo, atrás desta porta. Aqui só existe o mock do modo fixture; o adaptador real
// (Claude pelo /entregar, print real da tela) é pendência de /entregar (app/PENDENTE-ENTREGAR.md, M25).
// A mensagem do cliente, o texto do erro e o print (título, endereço, texto) são DADO: o adaptador monta o pedido com
// `montarPedidoAjuda` (delimitado, com a regra do conteúdo do cliente), nunca como instrução. Nenhum segredo fica em arquivo.

import type { PedidoAjudaPasso } from './ajuda-passo'
import { textoDaObra } from './ponte-cota'
import { REGRA_CONTEUDO_CLIENTE, blocoDoCliente } from './ponte-estilo'

/** O "print" da tela: endereço, título e o texto que aparecia. Tudo DADO (a tela desenha um quadro, nunca carrega URL nem imagem vinda de dado). */
export interface PrintAjuda {
  url: string
  titulo: string
  detalhe?: string
}

export interface ErroAjuda {
  /** "Algo deu errado ao publicar." */
  titulo: string
  /** Texto técnico do erro, se houver. DADO. */
  detalhe?: string
}

export interface ContextoAjuda {
  /** Quem abriu: o erro sozinho, o "Falar com o Atlas" do menu ou o "Não consegui" de um passo. */
  origem: 'erro' | 'menu' | 'passo'
  obra?: string
  /** Onde o cliente estava ("a publicação"). */
  onde?: string
  passo?: PedidoAjudaPasso
  /** Pasta da obra (nome da subpasta em Atlas\Obras); o adaptador revalida. Onde guardar o print e o que o Claude pode ler. */
  pasta?: string
  erro?: ErroAjuda
  print?: PrintAjuda | null
  /** Aberta pelo "Falar com o Atlas": já começa ouvindo (microfone ligado). */
  ouvir?: boolean
}

export interface Turno {
  de: 'cliente' | 'atlas'
  texto: string
}

/** As ÚNICAS páginas que "Abrir a página certa" pode abrir: lista fechada de endereços oficiais e fixos. O Claude só escolhe um id daqui;
 *  nunca uma URL. Qualquer id fora da lista é descartado. O adaptador real abre com `shell.openExternal(urlDaPagina(id))`. */
export const PAGINAS_OFICIAIS = {
  'github-apps': { nome: 'Permissões do GitHub', url: 'https://github.com/settings/installations' },
  'github-inicio': { nome: 'GitHub', url: 'https://github.com' },
  'vercel-novo': { nome: 'Novo projeto na Vercel', url: 'https://vercel.com/new' },
  'vercel-painel': { nome: 'Painel da Vercel', url: 'https://vercel.com/dashboard' },
  'supabase-painel': { nome: 'Painel do Supabase', url: 'https://supabase.com/dashboard' },
  'claude-login': { nome: 'Entrar no Claude', url: 'https://claude.ai/login' },
  'claude-planos': { nome: 'Planos do Claude', url: 'https://claude.ai/upgrade' },
  'registro-br': { nome: 'Registro.br', url: 'https://registro.br' },
} as const
export type PaginaId = keyof typeof PAGINAS_OFICIAIS
export const ehPaginaId = (v: unknown): v is PaginaId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(PAGINAS_OFICIAIS, v)
export const urlDaPagina = (id: PaginaId): string => PAGINAS_OFICIAIS[id].url

/** Palavra do site em inglês e o que ela quer dizer ("Save" = "Salvar"). */
export interface Traducao { en: string; pt: string }

export interface RespostaAjuda {
  texto: string
  /** Passos curtos (no máximo 4). */
  passos?: string[]
  /** Botões do site em inglês, traduzidos. */
  traducoes?: Traducao[]
  /** Frase final ("Depois eu publico de novo sozinho."). */
  depois?: string
  /** Qual página oficial abrir (id da lista fechada, nunca URL). */
  pagina?: PaginaId
  /** O Atlas não achou saída: o caso vai para o painel do administrador (ocorrencias_admin). */
  naoResolvido?: boolean
}

/** Frase que NUNCA pode sair da Ajuda: todo o suporte é o próprio Atlas. */
// Promessa de GENTE (o Atlas nunca promete atendimento humano). Antes era qualquer "equipe", "agente", "time" ou "WhatsApp", e a
// resposta certa sobre a obra ("a equipe de execução está na etapa M1") virava a frase-padrão (bug do Guilherme, 24/11/2026).
const PROMETE_HUMANO = /\bhuman[oa]s?\b|\batendente|\batendimento\b|\bespecialista|\bsuporte\b|\bconosco\b|\boperador|\bconsultor|\bte\s+transfer|\btransfer\w*\s+(voce|para\s+(um|uma|outr))|\bencaminh\w*\s+(seu|o\s+seu|voce|para)|\bentr\w*\s+em\s+contato|\bcontat(e|ar)\s+(a\s+gente|nos|o\s+atlas)|\b(nosso|nossa|nossos|nossas)\s+(time|equipe|tecnic\w*|whatsapp|telefone|e-?mail|central)|\b(alguem|uma\s+pessoa|um\s+tecnico|uma\s+tecnica|um\s+colega)\s+(da|do|vai|ira|pode|entra|te)\b|\b(chamo|chamar|chama|ligue|ligar|liga)\s+(um|uma|alguem|pra\s+gente|para\s+a\s+gente|para\s+nos)\b|\b(whatsapp|telefone|equipe|time|suporte)\s+do\s+atlas|\bfale\s+com\s+(a\s+gente|nosso|nossa|um|uma|alguem)\b/
/** Tira acento e caixa; "sua equipe"/"seu time" falam do time do cliente e não prometem gente do Atlas. */
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(sua|seu|suas|seus|da sua|do seu) (equipe|time)s?\b/g, '')
const prometeHumano = (t: string) => PROMETE_HUMANO.test(semAcento(t))
export const RECADO_SEM_HUMANO = 'Eu resolvo isto por aqui com você. Me conta com as suas palavras o que aparece na tela, ou manda outro print.'

/** A resposta do Claude é DADO: vira texto simples, com tamanho limitado, e só mantém a página se estiver na lista fechada. */
export function normalizarResposta(bruto: unknown): RespostaAjuda {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const limpa = (v: unknown, max: number) => {
    const t = textoDaObra(typeof v === 'string' ? v : '', max)
    return t
  }
  // Defesa em profundidade: qualquer sinal de gente em QUALQUER campo troca a resposta inteira.
  // Checa o texto NORMALIZADO (o que será mostrado: sem invisíveis, linhas juntas) e também o cru sem invisíveis.
  const campos = [o.texto, o.depois, ...(Array.isArray(o.passos) ? o.passos : []), ...(Array.isArray(o.traducoes) ? o.traducoes.flatMap((t) => (t && typeof t === 'object' ? Object.values(t) : [])) : [])]
  if (campos.some((c) => typeof c === 'string' && (prometeHumano(c) || prometeHumano(textoDaObra(c, 100000)) || prometeHumano(c.replace(/[\p{Cc}\p{Cf}]/gu, ''))))) return { texto: RECADO_SEM_HUMANO }
  const texto = limpa(o.texto, 800) || RECADO_SEM_HUMANO
  const passos = (Array.isArray(o.passos) ? o.passos : []).slice(0, 4).map((p) => limpa(p, 220)).filter(Boolean)
  const traducoes = (Array.isArray(o.traducoes) ? o.traducoes : []).slice(0, 4)
    .map((t) => { const x = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>; return { en: textoDaObra(typeof x.en === 'string' ? x.en : '', 40), pt: textoDaObra(typeof x.pt === 'string' ? x.pt : '', 60) } })
    .filter((t) => t.en && t.pt)
  const depois = limpa(o.depois, 200)
  return { texto, ...(passos.length ? { passos } : {}), ...(traducoes.length ? { traducoes } : {}), ...(depois ? { depois } : {}), ...(ehPaginaId(o.pagina) ? { pagina: o.pagina } : {}), ...(o.naoResolvido === true ? { naoResolvido: true } : {}) }
}

/** O que o cliente "diz" ao apertar "Ainda não deu". */
export const AINDA_NAO_DEU = 'Ainda não deu.'

export interface PonteAjuda {
  /** Uma volta da conversa com o Claude. A mensagem e o contexto são DADO. */
  conversar(contexto: ContextoAjuda, historico: Turno[], mensagem: string): Promise<RespostaAjuda>
  /** "Abrir a página certa": abre SÓ uma página da lista fechada (`PAGINAS_OFICIAIS`), pelo id. Nunca recebe URL. */
  abrirPagina(id: PaginaId): Promise<void>
  /** "Tirar print da tela": o adaptador real captura a janela do Atlas. null = não deu. */
  tirarPrint(pasta?: string): Promise<PrintAjuda | null>
  /** "Anexar imagem": o cliente escolhe uma imagem (só imagem; SVG recusado). null = desistiu. */
  anexarImagem(pasta?: string): Promise<PrintAjuda | null>
  /** M58: a foto tirada no celular (data URL do canal do celular) vira anexo da Ajuda. null = recusada. */
  fotoDoCelular?(pasta: string | undefined, dataUrl: string): Promise<PrintAjuda | null>
}

const nomeDoPrint = (p: PrintAjuda) => [textoDaObra(p.titulo, 100), textoDaObra(p.url, 120), textoDaObra(p.detalhe, 300)].filter(Boolean).join(' | ')

/** O que o adaptador real entrega ao Claude: tudo que veio do cliente ou da tela é dado delimitado, com a regra no topo. */
export function montarPedidoAjuda(contexto: ContextoAjuda, historico: Turno[], mensagem: string): string {
  const ctx = [
    contexto.onde && `Onde: ${textoDaObra(contexto.onde, 80)}`,
    contexto.passo && `Passo ${contexto.passo.passo} de ${contexto.passo.totalPassos} (${textoDaObra(contexto.passo.conta, 60)})`,
    contexto.passo?.instrucao && `O que o passo pede: ${textoDaObra(contexto.passo.instrucao, 300)}`,
    contexto.passo?.saber && `O que já se sabe deste site: ${textoDaObra(contexto.passo.saber, 600)}`,
    contexto.erro && `Erro: ${textoDaObra(contexto.erro.titulo, 120)} ${textoDaObra(contexto.erro.detalhe, 300)}`.trim(),
    contexto.print && `Print: ${nomeDoPrint(contexto.print)}`,
  ].filter(Boolean).join('\n')
  return [
    'Você é a Ajuda do Atlas. Responda em português do Brasil, em passos curtos, como um amigo na mesa de um restaurante. Nunca prometa atendimento humano.',
    REGRA_CONTEUDO_CLIENTE,
    '## Contexto (dado)',
    ...blocoDoCliente(ctx, '(sem contexto)'),
    '## Conversa até aqui (dado)',
    ...blocoDoCliente(historico.slice(-10).map((t) => `${t.de === 'cliente' ? 'Cliente' : 'Atlas'}: ${t.texto}`).join('\n'), '(começo)'),
    '## Mensagem do cliente (dado)',
    ...blocoDoCliente(mensagem, '(vazia)'),
  ].join('\n')
}

/** Primeira fala do Atlas, escrita aqui mesmo (não depende do Claude). */
export function saudacaoAjuda(contexto: ContextoAjuda, nome?: string): string {
  const oi = nome ? `Oi, ${textoDaObra(nome, 40)}.` : 'Oi.'
  const print = contexto.print ? ' Já tirei um print da sua tela.' : ''
  const fim = ' Me conta o que você estava fazendo? Pode falar, escrever ou mandar outro print.'
  if (contexto.origem === 'erro') return `${oi} Vi que ${textoDaObra(contexto.onde, 60) || 'algo'} parou.${print}${fim}`
  if (contexto.origem === 'passo' && contexto.passo) return `${oi} Vi que você parou no passo ${contexto.passo.passo} de ${contexto.passo.totalPassos} do ${textoDaObra(contexto.passo.conta, 60)}.${print}${fim}`
  return `${oi} Estou aqui, a qualquer hora.${print} Me conta o que está acontecendo? Pode falar, escrever ou mandar um print.`
}

export interface AjudaFixture extends PonteAjuda {
  /** Pedidos montados (o que iria ao Claude). */
  readonly pedidos: string[]
  /** Páginas oficiais abertas (id e o endereço fixo da lista). */
  readonly abertas: { id: PaginaId; url: string }[]
}

/** Mock do modo fixture: respostas fixas, sem rede. */
export function criarAjudaFixture(): AjudaFixture {
  const pedidos: string[] = []
  const abertas: { id: PaginaId; url: string }[] = []
  return {
    pedidos,
    abertas,
    async abrirPagina(id) {
      if (!ehPaginaId(id)) throw new Error('pagina-fora-da-lista')
      abertas.push({ id, url: urlDaPagina(id) })
    },
    async conversar(contexto, historico, mensagem) {
      pedidos.push(montarPedidoAjuda(contexto, historico, mensagem))
      const tentativas = historico.filter((t) => t.de === 'cliente' && t.texto === AINDA_NAO_DEU).length + (mensagem === AINDA_NAO_DEU ? 1 : 0)
      const tudo = [contexto.print?.titulo, contexto.print?.detalhe, contexto.erro?.detalhe, mensagem].join(' ')
      if (/repository not found|github app does not have access/i.test(tudo)) {
        if (tentativas === 0) {
          return normalizarResposta({
            texto: 'Achei o problema. A Vercel não está enxergando a pasta da sua obra no GitHub. É só dar essa permissão, em 2 passos:',
            passos: ['Clique em "Abrir a página certa". Eu abro a tela de permissões.', 'Marque a pasta da sua obra e clique em Save (quer dizer "Salvar").'],
            traducoes: [{ en: 'Save', pt: 'Salvar' }, { en: 'Repository not found', pt: 'Pasta não encontrada' }],
            depois: 'Depois eu publico de novo sozinho.',
            pagina: 'github-apps',
          })
        }
        return normalizarResposta({ texto: 'Vamos por outro caminho. Na mesma tela, escolha "All repositories" (quer dizer "Todas as pastas") e clique em Save.', passos: ['Escolha "All repositories".', 'Clique em Save.'], traducoes: [{ en: 'All repositories', pt: 'Todas as pastas' }], pagina: 'github-apps' })
      }
      return normalizarResposta({ texto: 'Entendi. Vou olhar o que aconteceu e já te digo o próximo passo. Se puder, mande um print da tela.' })
    },
    async tirarPrint() { return { url: 'atlas.local/tela', titulo: 'Tela do Atlas' } },
    async anexarImagem() { return { url: 'imagem-anexada', titulo: 'Imagem anexada' } },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que entendeu. */
export const ajudaIndisponivel: PonteAjuda & { readonly indisponivel: true } = {
  indisponivel: true,
  async conversar() { throw new Error('indisponivel') },
  async abrirPagina() { throw new Error('indisponivel') },
  async tirarPrint() { return null },
  async anexarImagem() { return null },
}

/** "Não consegui fazer este passo": o print do passo (o quadro do site que ele via) e onde ele parou. */
export function contextoDoPasso(p: PedidoAjudaPasso): ContextoAjuda {
  return {
    origem: 'passo',
    onde: p.origem === 'guia' ? `o passo a passo do ${p.conta}` : p.origem === 'F13b' ? 'a publicação' : 'as contas',
    passo: p,
    print: { url: p.print.url, titulo: p.print.titulo, detalhe: p.print.botaoCerto ? `O botão certo aqui é "${p.print.botaoCerto}".` : undefined },
  }
}
