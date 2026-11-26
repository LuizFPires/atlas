// M32 (b) — personalização do app pronto: nome, logo e duas cores. O hex é validado AQUI (servidor), nunca só na tela.
import { limparTexto } from './status-obras.ts'
import { clienteLogado, type DepsPortal } from './portal.ts'
import { ErroRegra, type Personalizacao } from './tipos.ts'

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/
export const MAX_NOME = 60

const invalido = (codigo: string, msg: string) => new ErroRegra(codigo, msg, 400)

/** Valida e limpa o pedido inteiro; qualquer campo fora do formato recusa tudo (nada parcial). Cores saem em MAIÚSCULAS. */
export function validarPersonalizacao(entrada: unknown): Personalizacao {
  if (!entrada || typeof entrada !== 'object') throw invalido('personalizacao_invalida', 'Faltam os dados do seu app.')
  const o = entrada as Record<string, unknown>
  if (typeof o.nome_negocio !== 'string' || [...o.nome_negocio].length > MAX_NOME * 2) throw invalido('nome_invalido', `O nome do negócio precisa ter de 1 a ${MAX_NOME} letras.`)
  const nome = limparTexto(o.nome_negocio, MAX_NOME)
  if (!nome) throw invalido('nome_invalido', 'Diga o nome do seu negócio.')
  const cor = (v: unknown, qual: string): string => {
    if (typeof v !== 'string' || !HEX_RE.test(v.trim())) throw invalido('cor_invalida', `A cor ${qual} precisa estar no formato #RRGGBB, como #1E7A46.`)
    return v.trim().toUpperCase()
  }
  const cor_principal = cor(o.cor_principal, 'principal')
  const cor_apoio = cor(o.cor_apoio, 'de apoio')
  let logo_url: string | null = null
  if (o.logo_url !== undefined && o.logo_url !== null && o.logo_url !== '') {
    if (typeof o.logo_url !== 'string' || o.logo_url.length > 500 || !/^https:\/\/[^\s"'<>]+$/.test(o.logo_url)) throw invalido('logo_invalida', 'O endereço da logomarca precisa começar com https://.')
    logo_url = o.logo_url
  }
  return { nome_negocio: nome, logo_url, cor_principal, cor_apoio }
}

/** Segmento do app pronto comprado (gravado pela compra, 0023). Nulo = a licença não é de prateleira. */
async function segmentoDaLicenca(d: DepsPortal, licencaId: string): Promise<string | null> {
  const pags = await d.store.pagamentosDa(licencaId)
  return pags.find((p) => p.status === 'pago' && p.segmento)?.segmento ?? null
}

/** Portal: lê a personalização do DONO logado (licença descoberta pelo login; nada de id no corpo). */
export async function lerPersonalizacao(d: DepsPortal, jwt: string) {
  const { licenca } = await clienteLogado(d, jwt)
  const [segmento, personalizacao] = await Promise.all([segmentoDaLicenca(d, licenca.id), d.store.personalizacaoDaLicenca(licenca.id)])
  return { segmento, personalizacao }
}

/** Portal: salva a personalização do DONO logado. A licença vem do login; qualquer licenca_id no corpo é ignorado. */
export async function salvarPersonalizacaoDoPortal(d: DepsPortal, jwt: string, corpo: unknown) {
  const { licenca } = await clienteLogado(d, jwt)
  const segmento = await segmentoDaLicenca(d, licenca.id)
  if (!segmento) throw new ErroRegra('sem_app_pronto', 'Essa conta não tem um app pronto para personalizar.', 403)
  if (!(await d.store.tentarEvento(`personalizacao:${licenca.id}`, 30, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Muitas alterações seguidas. Espere uns 10 minutos e tente de novo.', 429)
  }
  const p = validarPersonalizacao(corpo)
  await d.store.salvarPersonalizacao(licenca.id, p, d.agora())
  return { ok: true, segmento, personalizacao: p }
}
