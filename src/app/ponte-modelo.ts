// Modelo do Claude escolhido pelo cliente (decisão do Luiz em 23/11/2026: um só para todo o Atlas; recomendado Opus 5.5).
// O adaptador real (app/adaptadores/modelo.cjs) guarda a escolha e põe --model <id> em toda chamada ao Claude.
import { createContext, useCallback, useEffect, useState } from 'react'

export interface ModeloClaude { id: string; nome: string; explica: string; recomendado: boolean }
export interface PonteModelo {
  ler(): Promise<{ atual: string; lista: ModeloClaude[] }>
  gravar(id: string): Promise<string>
}
export interface ModeloNoMenu { atual: string; lista: ModeloClaude[]; escolher(id: string): void }

export const MODELOS_EXEMPLO: ModeloClaude[] = [
  { id: 'claude-opus-5-5', nome: 'Opus 5.5', explica: 'O melhor resultado, no protótipo e na obra. Gasta mais da cota do seu plano.', recomendado: true },
  { id: 'claude-sonnet-5-5', nome: 'Sonnet 5.5', explica: 'Mais rápido e econômico. Bom resultado, gasta menos cota.', recomendado: false },
  { id: 'claude-haiku-5-5', nome: 'Haiku 5.5', explica: 'O mais rápido. Só para obras bem simples.', recomendado: false },
]

export function criarModeloFixture(): PonteModelo {
  let atual = 'claude-opus-5-5'
  return {
    async ler() { return { atual, lista: MODELOS_EXEMPLO.map((m) => ({ ...m })) } },
    async gravar(id) { if (!MODELOS_EXEMPLO.some((m) => m.id === id)) throw new Error('modelo-invalido'); atual = id; return id },
  }
}

export const ContextoModelo = createContext<ModeloNoMenu | null>(null)

/** Lê a escolha uma vez e grava na troca. Sem ponte (site), não há seletor. */
export function useModeloNoMenu(ponte: PonteModelo | undefined): ModeloNoMenu | null {
  const [d, setD] = useState<{ atual: string; lista: ModeloClaude[] } | null>(null)
  useEffect(() => {
    let vivo = true
    ponte?.ler().then((r) => { if (vivo) setD(r) }, () => {})
    return () => { vivo = false }
  }, [ponte])
  const escolher = useCallback((id: string) => {
    if (!ponte) return
    setD((x) => (x ? { ...x, atual: id } : x))
    ponte.gravar(id).catch(() => { void ponte.ler().then(setD, () => {}) })
  }, [ponte])
  return ponte && d ? { ...d, escolher } : null
}
