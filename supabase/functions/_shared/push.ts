// M41 — aviso no celular do dono (Web Push). Luiz, 24/11/2026: "não pode ficar no escuro". O celular (login do Portal) aceita
// receber avisos; o notebook (credencial da ativação) avisa quando a cota volta, quando a obra para ou fica pronta.
// A chave privada (VAPID) só existe nos segredos do Supabase; aqui só passam o endereço do serviço de aviso e as chaves PÚBLICAS
// da assinatura do navegador. Nunca vai código nem dado do cliente no aviso: só título, texto curto e o link do app.
import type { DepsPortal } from './portal.ts'
import { clienteLogado } from './portal.ts'
import { limparTexto } from './status-obras.ts'
import { ErroRegra, type Deps } from './tipos.ts'
import { motivoDaLicenca, verificar } from './verificar.ts'

export interface AssinaturaPush { endpoint: string; p256dh: string; auth: string; criada_em: Date }
export interface CanalPush {
  guardar(licencaId: string, a: AssinaturaPush): Promise<void>
  listar(licencaId: string): Promise<AssinaturaPush[]>
  apagar(licencaId: string, endpoint: string): Promise<void>
}
/** Envia um aviso. 'fim' = a assinatura não vale mais (404/410): apagar. 'erro' = falhou agora (tenta no próximo aviso). */
export type EnvioPush = (a: AssinaturaPush, corpo: string) => Promise<'ok' | 'fim' | 'erro'>

export const MAX_ASSINATURAS = 5
// Só os serviços de aviso dos navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge/Windows): o servidor nunca chama outro lugar.
const SERVICOS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.push\.apple\.com)\//
const B64URL = /^[A-Za-z0-9_-]+$/

const invalido = () => new ErroRegra('assinatura_invalida', 'Este celular não conseguiu ligar os avisos. Tente de novo.', 400)
const semChave = () => new ErroRegra('aviso_indisponivel', 'Os avisos no celular ainda não estão disponíveis.', 503)

async function licencaDoCelular(d: DepsPortal, jwt: string) {
  const { licenca } = await clienteLogado(d, jwt)
  if (motivoDaLicenca(licenca as never, d.agora()) !== 'ok') throw new ErroRegra('licenca_inativa', 'Seu acesso ao Atlas não está ativo.', 403)
  return licenca.id as string
}

export function chavePublica(chave: string | undefined) {
  if (!chave || !B64URL.test(chave)) throw semChave()
  return { chave }
}

export async function assinarPush(d: DepsPortal, canal: CanalPush | undefined, chave: string | undefined, jwt: string, assinatura: unknown) {
  if (!canal || !chave) throw semChave()
  const lic = await licencaDoCelular(d, jwt)
  const a = assinatura as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  const endpoint = a && typeof a.endpoint === 'string' ? a.endpoint : ''
  const p256dh = a && a.keys && typeof a.keys.p256dh === 'string' ? a.keys.p256dh : ''
  const auth = a && a.keys && typeof a.keys.auth === 'string' ? a.keys.auth : ''
  if (endpoint.length > 800 || !SERVICOS.test(endpoint) || !B64URL.test(p256dh) || p256dh.length > 200 || !B64URL.test(auth) || auth.length > 100) throw invalido()
  const atuais = await canal.listar(lic)
  if (!atuais.some((x) => x.endpoint === endpoint) && atuais.length >= MAX_ASSINATURAS) {
    const velha = atuais.slice().sort((x, y) => x.criada_em.getTime() - y.criada_em.getTime())[0]
    await canal.apagar(lic, velha.endpoint) // o celular mais antigo sai: troca de aparelho não trava
  }
  await canal.guardar(lic, { endpoint, p256dh, auth, criada_em: d.agora() })
  return { ok: true }
}

type Auth = { email: unknown; computador_hash: unknown; token_dispositivo: string }

export async function avisarCelular(d: Deps, canal: CanalPush | undefined, envio: EnvioPush | undefined, a: Auth & { titulo: unknown; texto: unknown }) {
  if (!canal || !envio) throw semChave()
  const v = await verificar(d, { email: typeof a.email === 'string' ? a.email : '', computador_hash: typeof a.computador_hash === 'string' ? a.computador_hash : '', token_dispositivo: a.token_dispositivo })
  if (!v.pode_construir || !v.licenca_id) throw new ErroRegra('nao_autorizado', 'Não foi possível confirmar este computador.', 403)
  const titulo = limparTexto(a.titulo, 60)
  const texto = limparTexto(a.texto, 180)
  if (!titulo || !texto) throw new ErroRegra('aviso_invalido', 'Aviso vazio.', 400)
  if (!(await d.store.tentarEvento(`celular-aviso:${v.licenca_id}`, 30, 60 * 60_000, d.agora()))) throw new ErroRegra('muitas_solicitacoes', 'Muitos avisos agora.', 429)
  const corpo = JSON.stringify({ titulo, texto, url: '/app' })
  let enviados = 0
  for (const s of await canal.listar(v.licenca_id)) {
    const r = await envio(s, corpo).catch(() => 'erro' as const)
    if (r === 'ok') enviados++
    else if (r === 'fim') await canal.apagar(v.licenca_id, s.endpoint)
  }
  return { enviados }
}
