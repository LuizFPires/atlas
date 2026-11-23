// Cartão "Plano Claude" do menu (pedido do Luiz, 22/11/2026): antes era texto fixo do protótipo ("Pro · 64% da cota ·
// Renova hoje, 14h"). O app só sabe se o Claude está conectado e qual assinatura ele informa; cota e horário de renovação
// o Claude Code não informa, então não aparecem. Lê de novo a cada 5 minutos (o cliente pode trocar de plano no site).
import { createContext, useEffect, useState } from 'react'
import type { EstadoClaude, PonteClaude } from './ponte-claude'

export interface PlanoNoMenu { valor: string; sub: string }

export function textoDoPlano(e: EstadoClaude | null): PlanoNoMenu | null {
  if (!e) return null
  if (!e.conectado) return { valor: 'Não conectado', sub: 'Conecte o Claude para construir' }
  const nome = e.assinatura ?? e.plano
  return { valor: nome ? nome[0].toUpperCase() + nome.slice(1) : 'Conectado', sub: 'Conectado neste computador' }
}

export const ContextoPlano = createContext<PlanoNoMenu | null>(null)

const CINCO_MIN = 5 * 60_000

export function usePlanoNoMenu(claude: PonteClaude): PlanoNoMenu | null {
  const [plano, setPlano] = useState<PlanoNoMenu | null>(null)
  useEffect(() => {
    let vivo = true
    const ler = () => { claude.estado().then((e) => { if (vivo) setPlano(textoDoPlano(e)) }, () => {}) }
    ler()
    const t = setInterval(ler, CINCO_MIN)
    return () => { vivo = false; clearInterval(t) }
  }, [claude])
  return plano
}
