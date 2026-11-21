// Ponte de instalação (M5): cliente da API pública. O token do link é a prova; abrir NÃO consome o link. Sem segredo aqui.
import { configCompra, type ConfigCompra } from './compra'

export type ResultadoAbertura =
  | { ok: true; celular: boolean; aviso: string | null; podeReenviar: boolean; expiraEm: string | null }
  | { ok: false; mensagem: string }
export type ResultadoReenvio = { ok: true } | { ok: false; mensagem: string; limite?: boolean }

export interface InstalarApi {
  abrir(token: string): Promise<ResultadoAbertura>
  enviarParaComputador(token: string): Promise<ResultadoReenvio>
}

const MSG_REDE = 'Sem conexão com o servidor. Veja a sua internet e tente de novo.'
const MSG_GENERICA = 'Não deu certo agora. Tente de novo em instantes.'
const MSG_OFF = 'A instalação ainda não está aberta por aqui. Volte daqui a pouco.'

export function criarInstalarApi(cfg: Pick<ConfigCompra, 'api'> | null = configCompra(), f: typeof fetch = fetch): InstalarApi {
  const post = async (rota: string, corpo: object) => {
    const r = await f(`${cfg!.api}${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    return { r, c: (await r.json().catch(() => ({}))) as Record<string, unknown> & { mensagem?: string } }
  }
  return {
    async abrir(token) {
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        const largura = typeof window === 'undefined' ? null : window.innerWidth
        const { r, c } = await post('/instalar/abrir', { token, largura })
        if (r.ok && c.valido === true) {
          return { ok: true, celular: c.celular === true, aviso: typeof c.aviso === 'string' ? c.aviso : null, podeReenviar: c.pode_reenviar === true, expiraEm: typeof c.expira_em === 'string' ? c.expira_em : null }
        }
        return { ok: false, mensagem: c.mensagem ?? MSG_GENERICA }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
    async enviarParaComputador(token) {
      if (!cfg) return { ok: false, mensagem: MSG_OFF }
      try {
        const { r, c } = await post('/instalar/enviar-para-computador', { token })
        if (r.ok) return { ok: true }
        return { ok: false, mensagem: c.mensagem ?? MSG_GENERICA, limite: r.status === 429 }
      } catch { return { ok: false, mensagem: MSG_REDE } }
    },
  }
}

/** Fixture para testes e desenvolvimento sem servidor. */
export function criarInstalarFixture(celular = false): InstalarApi {
  return {
    abrir: async () => ({ ok: true, celular, aviso: celular ? 'Abra no computador onde você vai construir.' : null, podeReenviar: celular, expiraEm: null }),
    enviarParaComputador: async () => ({ ok: true }),
  }
}
