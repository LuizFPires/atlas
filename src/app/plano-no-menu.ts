// Cartão "Plano Claude" do menu (pedido do Luiz, 22/11/2026): antes era texto fixo do protótipo ("Pro · 64% da cota ·
// Renova hoje, 14h"). O app só sabe se o Claude está conectado e qual assinatura ele informa; cota e horário de renovação
// o Claude Code não informa, então não aparecem. Lê de novo a cada 5 minutos (o cliente pode trocar de plano no site);
// NÃO conectado confere a cada 3 s e ao voltar para a janela, para o botão "Conectar o Claude" sumir assim que ele conectar (23/11/2026).
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
const TRES_SEG = 3_000

export function usePlanoNoMenu(claude: PonteClaude): PlanoNoMenu | null {
  const [plano, setPlano] = useState<PlanoNoMenu | null>(null)
  const conectado = plano !== null && plano.valor !== 'Não conectado'
  useEffect(() => {
    let vivo = true
    const ler = () => { claude.estado().then((e) => { if (vivo) setPlano(textoDoPlano(e)) }, () => {}) }
    ler()
    // Cada leitura roda `claude auth status`: de 3 em 3 s só com a janela do Atlas na frente (ao voltar, o 'focus' relê na hora).
    const t = setInterval(() => { if (conectado || document.hasFocus()) ler() }, conectado ? CINCO_MIN : TRES_SEG)
    window.addEventListener('focus', ler)
    return () => { vivo = false; clearInterval(t); window.removeEventListener('focus', ler) }
  }, [claude, conectado])
  return plano
}
