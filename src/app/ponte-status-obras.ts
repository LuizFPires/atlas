// Lado do COMPUTADOR do relay de status das obras (M30). O app PUBLICA um resumo na API do Atlas; o Portal lê no celular.
// Aqui só existem a PORTA, o contrato e o mock do modo fixture. O adaptador real (Electron: ler o PLAN/linha de cada obra,
// montar o resumo e chamar POST {ATLAS_API_URL}/status-obras/publicar com o token do dispositivo) é pendência de /entregar.
// Contrato do servidor (supabase/functions/_shared/status-obras.ts): corpo { email, computador_hash, obras: ObraStatus[] };
// cabeçalho X-Atlas-Dispositivo; a licença é decidida no servidor; a lista SUBSTITUI o conjunto da licença.
// Só resumo: nunca código, caminho de arquivo, e-mail, link nem segredo (o servidor limpa de novo, mas o app já não deve mandar).
import type { ObraStatus } from '../web/obras-status'

export type { ObraStatus }

export interface PonteStatusObrasPublicar {
  /** Publica o resumo atual de TODAS as obras do cliente (substitui o que o servidor tinha). */
  publicar(obras: ObraStatus[]): Promise<{ ok: true } | { ok: false; mensagem: string }>
}

export interface PublicarStatusFixture extends PonteStatusObrasPublicar {
  readonly publicados: ObraStatus[][]
}

export function criarPublicarStatusFixture(): PublicarStatusFixture {
  const f = {
    publicados: [] as ObraStatus[][],
    async publicar(obras: ObraStatus[]) { f.publicados.push(structuredClone(obras)); return { ok: true as const } },
  }
  return f
}

/** Produção sem adaptador: não finge que publicou (o celular segue mostrando "ainda não chegou nada"). */
export const publicarStatusIndisponivel: PonteStatusObrasPublicar = {
  async publicar() { return { ok: false, mensagem: 'O envio do status para o celular ainda não está ligado neste computador.' } },
}
