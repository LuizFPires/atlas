// Código do link de instalação (uso único) dentro da tela do app. Ele chega de dois jeitos (app/link-instalacao.cjs):
// na abertura do app (`--token=` nos argumentos) ou depois, com o app já aberto, quando o cliente clica em
// "Liberar o Atlas neste computador" na página do e-mail (o navegador abre atlas://ativar?t=<código>).
import { useEffect, useState } from 'react'
import type { PonteDesktop } from './ponte'
import { flag } from './tela'

const TOKEN_RE = /^[\w-]{20,128}$/

export function useTokenDoLink(ponte: Pick<PonteDesktop, 'argv' | 'aoReceberLink'>): string {
  const [token, setToken] = useState(() => flag(ponte.argv, 'token'))
  useEffect(() => {
    ponte.aoReceberLink?.((t) => { if (TOKEN_RE.test(t)) setToken(t) })
  }, [ponte])
  return token
}
