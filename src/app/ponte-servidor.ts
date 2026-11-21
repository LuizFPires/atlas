// Chamadas da tela do app ao servidor de licenças, pelo processo principal (app/adaptadores/servidor.cjs).
// A tela abre de um arquivo (file://) e o servidor só aceita navegador vindo do site (CORS): um fetch direto daqui é barrado.
// `fetchPelaPonte` tem a mesma forma do fetch, então os clientes (ativação, licença) não mudam: só recebem este no lugar.

export interface PonteServidor {
  /** POST numa rota da lista fechada do processo principal. Devolve status e corpo (texto). Falha de rede lança erro. */
  postar(rota: string, corpo: object, cabecalhos: Record<string, string>): Promise<{ status: number; corpo: string }>
}

const CABECALHO_DISPOSITIVO = 'X-Atlas-Dispositivo'

export function fetchPelaPonte(servidor: PonteServidor, api: string): typeof fetch {
  const base = api.replace(/[/]+$/, '')
  return (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(entrada)
    // Só o servidor do Atlas: qualquer outro endereço é erro, nunca chamada.
    if (!url.startsWith(`${base}/`)) throw new TypeError('endereço fora do servidor do Atlas')
    const corpo = typeof init.body === 'string' && init.body ? (JSON.parse(init.body) as object) : {}
    const disp = new Headers(init.headers).get(CABECALHO_DISPOSITIVO)
    const r = await servidor.postar(url.slice(base.length), corpo, disp ? { [CABECALHO_DISPOSITIVO]: disp } : {})
    return new Response(r.corpo, { status: r.status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}
