import { useState } from 'react'

const CHAVE = 'atlas.cookies'
export type EscolhaCookies = 'essenciais' | 'medicao'

/** Escolha guardada, ou null se o cliente ainda não decidiu. */
export function lerEscolha(): EscolhaCookies | null {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'essenciais' || v === 'medicao' ? v : null
  } catch {
    return null
  }
}

/** Medição de visitas só roda se o cliente aceitou. Sem escolha = não (LGPD: opção mais privada por padrão). */
export const medicaoPermitida = () => lerEscolha() === 'medicao'

/** Banner de cookies. A opção mais privada é a principal e a única que não exige nada além de um clique. */
export function BannerCookies() {
  const [escolha, setEscolha] = useState<EscolhaCookies | null>(lerEscolha)
  if (escolha) return null
  const guardar = (v: EscolhaCookies) => {
    try { localStorage.setItem(CHAVE, v) } catch { /* sem armazenamento: vale só nesta visita */ }
    setEscolha(v)
  }
  return (
    <div className="v-cookies" role="region" aria-label="Aviso de cookies">
      <p>
        <b>Seus dados, suas regras.</b> Usamos só o necessário para o site funcionar. Se você deixar, também contamos as visitas para melhorar a página.
        Você pode mudar de ideia quando quiser.
      </p>
      <div className="v-cookies-botoes">
        <button type="button" className="v-acao v-acao--pequeno" onClick={() => guardar('essenciais')}>Só o necessário</button>
        <button type="button" className="v-acao v-acao--pequeno v-acao--contorno" onClick={() => guardar('medicao')}>Aceitar a contagem de visitas</button>
      </div>
    </div>
  )
}
