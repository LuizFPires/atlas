// Link provisório do protótipo para abrir no celular (decisão do Luiz em 22/11/2026: no servidor do Atlas, secreto, 7 dias).
// O app (processo principal, com a credencial da licença) manda o documento navegável JÁ protegido (montarNavegavel: CSP sem
// script). O servidor confere a licença, guarda numa pasta PRIVADA e devolve https://<site>/p/<token>. A página /p/<token> do
// site busca em /prototipo/ver e mostra dentro de um iframe com sandbox vazio. Só as telas sobem: nenhum dado do cliente.
import { ErroRegra, type Deps } from './tipos.ts'
import { verificar } from './verificar.ts'

export const VALIDADE_LINK_PROTOTIPO_MS = 7 * 24 * 60 * 60_000
const MAX_DOCUMENTO = 1_500_000
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/

export interface PrototipoGuardado { nome: string; documento: string; criado_em: string; expira_em: string }
export interface ArmazemPrototipos {
  guardar(token: string, p: PrototipoGuardado): Promise<void>
  ler(token: string): Promise<PrototipoGuardado | null>
}

/** O documento tem de ser o protótipo do Atlas: começa com a CSP que proíbe script (montarNavegavel). */
function ehPrototipoProtegido(doc: string): boolean {
  return doc.length <= MAX_DOCUMENTO && /^<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'/.test(doc)
}

function tokenNovo(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function publicarPrototipo(
  d: Deps,
  armazem: ArmazemPrototipos | undefined,
  origemSite: string | undefined,
  a: { email: string; computador_hash: string; token_dispositivo: string; nome: string; documento: string },
): Promise<{ url: string; expira_em: string }> {
  const v = await verificar(d, a)
  if (!v.licenca_id) throw new ErroRegra('negado', 'Não foi possível gerar o link.', 403)
  if (typeof a.documento !== 'string' || !ehPrototipoProtegido(a.documento)) throw new ErroRegra('prototipo_invalido', 'Esse protótipo não pôde ser publicado.', 400)
  if (!armazem || !origemSite || !/^https:\/\/[a-z0-9.-]+$/.test(origemSite)) throw new ErroRegra('link_indisponivel', 'O link para o celular ainda não está disponível. Tente de novo mais tarde.', 503)
  if (!(await d.store.tentarEvento(`prototipo-link:${v.licenca_id}`, 30, 60 * 60_000, d.agora()))) {
    throw new ErroRegra('muitas_solicitacoes', 'Você gerou muitos links agora há pouco. Espere alguns minutos.', 429)
  }
  const agora = d.agora()
  const expira = new Date(agora.getTime() + VALIDADE_LINK_PROTOTIPO_MS)
  const token = tokenNovo()
  const nome = Array.from(String(a.nome ?? '')).filter((c) => c >= ' ' && c !== '<' && c !== '>').join('').trim().slice(0, 60) || 'Protótipo'
  await armazem.guardar(token, { nome, documento: a.documento, criado_em: agora.toISOString(), expira_em: expira.toISOString() })
  return { url: `${origemSite}/p/${token}`, expira_em: expira.toISOString() }
}

export async function verPrototipo(d: Deps, armazem: ArmazemPrototipos | undefined, token: string): Promise<PrototipoGuardado> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token) || !armazem) throw new ErroRegra('link_invalido', 'Esse link não existe.', 404)
  const p = await armazem.ler(token).catch(() => null)
  if (!p || !ehPrototipoProtegido(p.documento)) throw new ErroRegra('link_invalido', 'Esse link não existe.', 404)
  if (new Date(p.expira_em).getTime() <= d.agora().getTime()) throw new ErroRegra('link_vencido', 'Esse link venceu (ele vale 7 dias). Peça um link novo no Atlas.', 410)
  return p
}
