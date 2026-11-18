// Portas do batismo (F07b, projeto 3/3): dar nome e marca ao sistema.
//  - PonteBatismo: o Claude por baixo sugere 3 nomes com logo, slogan e motivo (com todo o contexto da obra: telas.md, regras.md,
//    design-system.md na pasta da obra) e grava a marca escolhida na pasta da obra. Adaptador real: pendência de /entregar.
//  - PonteNomes: confere nomes parecidos e se o endereço (.app, .com.br) está livre. Adaptador real: pendência de /entregar
//    (só domínios públicos, sem SSRF, com tempo-limite; ver app/PENDENTE-ENTREGAR.md).
// Aqui só existem os mocks do modo fixture. Tudo que o cliente escreveu/falou é DADO para o Claude (comoDado/blocoDoCliente).
// O logo sugerido NUNCA é SVG vindo do Claude: é um id de uma lista fechada de ícones do próprio Atlas (LOGOS).
// O logo que o cliente sobe passa pela PonteArquivos (tipo 'logo': PNG, JPG, WebP ou PDF; SVG é recusado). Nunca guarda segredo.

import { nomeLivre } from './ponte-arquivos'
import { blocoDoCliente, comoDado, REGRA_CONTEUDO_CLIENTE } from './ponte-estilo'

/** Ícones de traço permitidos como logo sugerida (lista fechada; o caminho é do Atlas, nunca texto vindo de fora). */
export const LOGOS = {
  cadeira: 'M7 3v9h10V3M5 12h14M7 12v9M17 12v9',
  navalha: 'M4 20L20 4M14 4h6v6',
  hora: 'M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0M12 7v5l3 2',
  folha: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l8-8',
  estrela: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  chave: 'M14 10a4 4 0 1 1-1-2.6L21 15v3h-3v-2h-2v-2h-2l-1.5-1.5',
} as const
export type IdLogo = keyof typeof LOGOS
export const logoValido = (id: string): id is IdLogo => Object.prototype.hasOwnProperty.call(LOGOS, id)

export interface NomeProposto {
  /** Id curto e seguro ([a-z0-9-]). */
  id: string
  nome: string
  slogan: string
  /** Por que o Atlas escolheu esse nome, em palavras simples. */
  porque: string
  logo: IdLogo
}

export type Marca =
  | { origem: 'sugestao'; nome: string; slogan: string; logo: IdLogo }
  | { origem: 'cliente'; nome: string; slogan: string; logo: { arquivo: string } | null }

export interface PedidoSugestao {
  /** Ideia de nome que o cliente falou ou escreveu (opcional). É DADO, não ordem. */
  ideia?: string
  /** Nomes que já foram mostrados, para "Sugerir outros" não repetir. */
  evitar?: string[]
}

export interface PonteBatismo {
  /** Pede ao Claude 3 nomes com logo, slogan e motivo, usando todo o contexto da obra. */
  sugerir(pasta: string, obraNome: string, pedido?: PedidoSugestao): Promise<NomeProposto[]>
  /** Grava a marca escolhida (nome, slogan, logo) na pasta da obra. Nunca sobrescreve. Devolve o caminho, só para mostrar. */
  batizar(pasta: string, marca: Marca): Promise<{ caminho: string }>
}

export interface Conferencia {
  /** Frases curtas e simples sobre nomes parecidos já em uso ("um salão com nome parecido em SP"). Vazio = nada parecido. */
  parecidos: string[]
  /** Endereços conferidos. livre null = não deu para conferir agora (nunca vira "livre" por palpite). */
  enderecos: { dominio: string; livre: boolean | null }[]
}

export interface PonteNomes {
  conferir(nome: string): Promise<Conferencia>
}

// ---- Nome do sistema --------------------------------------------------------------------------------------------------------

export const NOME_MIN = 2
export const NOME_MAX = 40

/** O nome que o cliente digitou/falou vira um nome limpo: sem controle, sem HTML, uma linha, até 40 letras. '' se curto demais. */
export function limparNome(texto: string): string {
  const nome = comoDado(texto, 200).join(' ').slice(0, NOME_MAX).trim()
  return [...nome].length >= NOME_MIN ? nome : ''
}

/** Parte do endereço (antes do .app): só letras e números, sem acento. '' se não sobrar nada. */
export function slugDominio(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 63)
}

/** Terminações conferidas. */
export const DOMINIOS = ['app', 'com.br'] as const

/** Linha de resumo no cartão, no jeito do protótipo ("nome livre · cadeira1.app livre"). */
export function resumoDaConferencia(c: Conferencia): { ok: boolean; texto: string } {
  if (c.parecidos.length) return { ok: false, texto: `existe ${c.parecidos[0]}` }
  const livres = c.enderecos.filter((e) => e.livre === true).map((e) => e.dominio)
  const ocupados = c.enderecos.filter((e) => e.livre === false).map((e) => e.dominio)
  if (ocupados.length) return { ok: false, texto: `nome livre, mas ${ocupados.join(' e ')} já ${ocupados.length > 1 ? 'estão' : 'está'} em uso` }
  if (c.enderecos.some((e) => e.livre === null)) return { ok: true, texto: 'não consegui conferir o endereço agora; tente de novo daqui a pouco' }
  return { ok: true, texto: `nome livre · ${livres[0] ?? ''} livre` }
}

// ---- Pedido ao Claude -------------------------------------------------------------------------------------------------------

/** O que o adaptador real entrega ao Claude em `sugerir`: a ideia do cliente é DADO delimitado, com a regra no topo. */
export function montarPedidoSugerir(obraNome: string, pedido: PedidoSugestao = {}): string {
  return [
    REGRA_CONTEUDO_CLIENTE,
    'Sugira 3 nomes para o sistema desta obra, cada um com: nome curto fácil de falar, slogan, motivo em palavras simples e um ícone da lista fechada de logos.',
    'Use o contexto da obra (telas.md, regras.md e design-system.md na pasta da obra). Não rode comandos e não escreva fora da pasta da obra.',
    '',
    'Nome da obra:',
    ...blocoDoCliente(obraNome, '(sem nome)'),
    '',
    'Ideia de nome do cliente:',
    ...blocoDoCliente(pedido.ideia ?? '', '(nenhuma)'),
    '',
    'Nomes que já foram mostrados (não repita):',
    ...blocoDoCliente((pedido.evitar ?? []).join('\n'), '(nenhum)'),
  ].join('\n')
}

/** Texto do marca.md gravado na pasta da obra (lido depois pelo Claude e por outras IAs). */
export function montarMarcaMd(marca: Marca): string {
  return [
    '# Marca da obra',
    '',
    `> ${REGRA_CONTEUDO_CLIENTE}`,
    '',
    marca.origem === 'sugestao' ? 'Origem: nome sugerido pelo Atlas e escolhido pelo cliente.' : 'Origem: nome e logo que o cliente já tinha.',
    '',
    '## Nome',
    ...blocoDoCliente(marca.nome, '(sem nome)'),
    '',
    '## Slogan',
    ...blocoDoCliente(marca.slogan, '(sem slogan)'),
    '',
    '## Logo',
    marca.origem === 'sugestao' ? `- ícone do Atlas: ${marca.logo}` : marca.logo ? `- arquivo: marca/${marca.logo.arquivo}` : '- (o cliente ainda não mandou)',
    '',
  ].join('\n')
}

// ---- Mocks do modo fixture --------------------------------------------------------------------------------------------------

const RODADAS: NomeProposto[][] = [
  [
    { id: 'cadeira', nome: 'Cadeira 1', slogan: 'Sua vez, sem fila.', porque: 'Lembra a cadeira do barbeiro e a ideia de ser o próximo. Curto e fácil de falar.', logo: 'cadeira' },
    { id: 'navalha', nome: 'Navalha', slogan: 'Agenda afiada.', porque: 'Forte, tem cara de barbearia e combina com o estilo clássico que você escolheu.', logo: 'navalha' },
    { id: 'hora', nome: 'Horinha', slogan: 'Marcou, tá marcado.', porque: 'Leve e simpático, do jeito que o cliente fala: "marca uma horinha pra mim?".', logo: 'hora' },
  ],
  [
    { id: 'folha', nome: 'Folha Fina', slogan: 'Tudo no seu tempo.', porque: 'Passa calma e capricho, como um bom corte feito sem pressa.', logo: 'folha' },
    { id: 'estrela', nome: 'Estrela do Corte', slogan: 'Todo dia é dia de ficar bem.', porque: 'Alegre e fácil de lembrar. Faz o cliente se sentir o centro das atenções.', logo: 'estrela' },
    { id: 'chave', nome: 'Chave da Porta', slogan: 'Chegou, é só entrar.', porque: 'Passa a ideia de acesso fácil: abriu o app, marcou, pronto.', logo: 'chave' },
  ],
]

export interface BatismoFixture extends PonteBatismo {
  /** Pedidos montados para o Claude (já como dado) e marcas "gravadas" (só na memória). */
  readonly pedidos: string[]
  readonly escritos: { pasta: string; caminho: string; texto: string }[]
}

/** Mock do modo fixture: devolve 3 nomes de exemplo (outra rodada em "sugerir outros") e não toca no disco. */
export function criarBatismoFixture(raiz = 'C:\\Users\\Zé\\Atlas\\Obras'): BatismoFixture {
  const pedidos: string[] = []
  const escritos: BatismoFixture['escritos'] = []
  return {
    pedidos,
    escritos,
    async sugerir(pasta, obraNome, pedido = {}) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(pasta)) throw new Error('pasta-invalida')
      pedidos.push(montarPedidoSugerir(obraNome, pedido))
      const evitar = new Set((pedido.evitar ?? []).map((n) => n.toLowerCase()))
      const base = (RODADAS.find((r) => r.every((n) => !evitar.has(n.nome.toLowerCase()))) ?? RODADAS[0]).map((n) => ({ ...n }))
      const ideia = limparNome(pedido.ideia ?? '')
      if (ideia) return [{ id: 'ideia', nome: ideia, slogan: 'Do jeito que você imaginou.', porque: 'Partiu da sua ideia; o Atlas só deixou o nome pronto para usar.', logo: 'estrela' }, ...base.slice(0, 2)]
      return base
    },
    async batizar(pasta, marca) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(pasta)) throw new Error('pasta-invalida')
      const nome = limparNome(marca.nome)
      if (!nome) throw new Error('nome-invalido')
      if (marca.origem === 'sugestao' && !logoValido(marca.logo)) throw new Error('logo-invalido')
      const ocupados = escritos.filter((x) => x.pasta === pasta).map((x) => x.caminho.slice(x.caminho.lastIndexOf('\\') + 1))
      const caminho = `${raiz}\\${pasta}\\marca\\${nomeLivre('marca.md', ocupados)}`
      escritos.push({ pasta, caminho, texto: montarMarcaMd({ ...marca, nome }) })
      return { caminho }
    },
  }
}

export interface NomesFixture extends PonteNomes {
  /** Nomes conferidos, na ordem (para teste). */
  readonly conferidos: string[]
}

// Nomes de mentirinha que o mock trata como "já existe" / "endereço ocupado".
const PARECIDOS: Record<string, string> = { navalha: 'um salão com nome parecido em SP', atlas: 'um aplicativo com nome parecido' }
const OCUPADOS = new Set(['atlas.app', 'agenda.app', 'agenda.com.br'])

/** Mock do modo fixture: respostas fixas e previsíveis, sem rede. */
export function criarNomesFixture(): NomesFixture {
  const conferidos: string[] = []
  return {
    conferidos,
    async conferir(nome) {
      const limpo = limparNome(nome)
      const slug = slugDominio(limpo)
      if (!limpo || !slug) throw new Error('nome-invalido')
      conferidos.push(limpo)
      return {
        parecidos: PARECIDOS[slug] ? [PARECIDOS[slug]] : [],
        enderecos: DOMINIOS.map((d) => ({ dominio: `${slug}.${d}`, livre: !OCUPADOS.has(`${slug}.${d}`) })),
      }
    },
  }
}

/** Sem adaptador real e fora do modo fixture: não finge que o Claude batizou nem que conferiu. */
export const batismoIndisponivel: PonteBatismo = {
  async sugerir() { throw new Error('indisponivel') },
  async batizar() { throw new Error('indisponivel') },
}
export const nomesIndisponivel: PonteNomes = {
  async conferir() { throw new Error('indisponivel') },
}
