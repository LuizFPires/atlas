// Ativação do computador (M2 / S4): e-mail da compra -> código de 6 dígitos -> token do dispositivo.
// O token do dispositivo é segredo: vai SÓ para o cofre do sistema (port Cofre), nunca para arquivo,
// localStorage ou log. Nas chamadas seguintes ele viaja apenas no cabeçalho X-Atlas-Dispositivo.
import { EMAIL_RE, configCompra } from '../web/compra'
import type { Cofre, PonteDesktop } from './ponte'

export type Resp<T = object> = ({ ok: true } & T) | { ok: false; mensagem: string }

export interface AtivacaoApi {
  pedirCodigo(email: string): Promise<Resp>
  /** Confirma o código, registra este computador e guarda o token no cofre. */
  confirmar(email: string, codigo: string): Promise<Resp<{ nome: string }>>
}

export const CHAVE_COFRE = 'atlas/dispositivo'
const MSG_REDE = 'Sem internet no momento. Confira a conexão e tente de novo.'
const MSG_OFF = 'A ativação ainda não está aberta por aqui. Volte daqui a pouco.'

/** O que fica no cofre: o token (segredo) e quem é o dono. */
interface Guardado { token: string; email: string; nome: string }

export async function lerAtivacao(cofre: Cofre): Promise<Guardado | null> {
  const bruto = await cofre.ler(CHAVE_COFRE)
  if (!bruto) return null
  try {
    const g = JSON.parse(bruto) as Partial<Guardado>
    return typeof g.token === 'string' && g.token ? { token: g.token, email: g.email ?? '', nome: g.nome ?? '' } : null
  } catch { return null }
}

export const jaAtivado = async (cofre: Cofre) => (await lerAtivacao(cofre)) !== null

/** Cabeçalhos para as chamadas que exigem computador ativado (/verificar, /entregar-kit). */
export async function cabecalhoDispositivo(cofre: Cofre): Promise<Record<string, string>> {
  const g = await lerAtivacao(cofre)
  return g ? { 'X-Atlas-Dispositivo': g.token } : {}
}

export interface ConfigAtivacao {
  api: string
  /** Token de uso único do link de instalação (~48 h), vindo do instalador (--token=). */
  linkToken: string
}

export function criarAtivacaoApi(
  ponte: Pick<PonteDesktop, 'cofre' | 'hashComputador'>,
  cfg: ConfigAtivacao | null = ((c) => (c ? { api: c.api, linkToken: '' } : null))(configCompra()),
  f: typeof fetch = fetch,
): AtivacaoApi {
  const post = async (rota: string, corpo: object) => {
    const r = await f(`${cfg!.api}${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    return { r, d: (await r.json().catch(() => ({}))) as Record<string, unknown> & { mensagem?: string } }
  }
  const emailOk = (email: string) => EMAIL_RE.test(email.trim().toLowerCase())
  return {
    async pedirCodigo(email) {
      if (!emailOk(email)) return { ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' }
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        const { r, d } = await post('/ativar/solicitar-codigo', { email: email.trim().toLowerCase() })
        if (r.status === 429) return { ok: false, mensagem: d.mensagem ?? 'Você pediu códigos demais. Espere uns minutos e tente de novo.' }
        // O servidor responde igual com ou sem cliente (não revela quem comprou).
        return r.ok ? { ok: true } : { ok: false, mensagem: 'Não deu para mandar o código agora. Tente de novo em instantes.' }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    async confirmar(email, codigo) {
      const c = codigo.replace(/\s+/g, '')
      if (!/^\d{6}$/.test(c)) return { ok: false, mensagem: 'O código tem 6 números. Confira o e-mail que mandamos.' }
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      if (!cfg.linkToken) return { ok: false, mensagem: 'Falta liberar este computador. Volte à página que abriu pelo e-mail e clique em "Liberar o Atlas neste computador".' }
      try {
        const e = email.trim().toLowerCase()
        const { r, d } = await post('/ativar/confirmar', { email: e, codigo: c, token: cfg.linkToken, computador_hash: await ponte.hashComputador() })
        if (!r.ok || typeof d.token_dispositivo !== 'string') {
          return { ok: false, mensagem: d.mensagem ?? 'Código incorreto ou vencido. Peça um novo.' }
        }
        const nome = typeof d.nome_tratamento === 'string' ? d.nome_tratamento : ''
        await ponte.cofre.guardar(CHAVE_COFRE, JSON.stringify({ token: d.token_dispositivo, email: e, nome } satisfies Guardado))
        return { ok: true, nome }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
  }
}

/** Modo fixture (só em desenvolvimento ou VITE_FIXTURE=1): o código é sempre 482071, nada vai à rede. */
export function criarAtivacaoFixture(ponte: Pick<PonteDesktop, 'cofre'>): AtivacaoApi {
  return {
    async pedirCodigo(email) {
      return emailOkSimples(email) ? { ok: true } : { ok: false, mensagem: 'Confira o e-mail: ele precisa ter um @ e um final, como .com.br.' }
    },
    async confirmar(email, codigo) {
      if (codigo.replace(/\s+/g, '') !== '482071') return { ok: false, mensagem: 'Código incorreto ou vencido. Peça um novo.' }
      await ponte.cofre.guardar(CHAVE_COFRE, JSON.stringify({ token: 'fixture-token', email, nome: 'Zé' }))
      return { ok: true, nome: 'Zé' }
    },
  }
}
const emailOkSimples = (e: string) => EMAIL_RE.test(e.trim().toLowerCase())

export const modoFixture = (): boolean => import.meta.env.DEV || import.meta.env.VITE_FIXTURE === '1'
