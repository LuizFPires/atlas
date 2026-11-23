import { useEffect, useState } from 'react'
import './nova-versao.css'

/** O que a tela usa do atualizador (main.cjs): versão já baixada e conferida, e "instalar agora" (fecha, instala e reabre). */
export type PonteAtualizacao = { pronta(): Promise<string | null>; instalar(): Promise<boolean> }

type Props = { ponte?: PonteAtualizacao; intervaloMs?: number }

/**
 * Faixa no topo do Atlas quando uma versão nova já está baixada (pedido do Luiz, 23/11/2026): um clique em "Atualizar agora"
 * fecha o Atlas, instala em silêncio e abre de novo. Sem versão pronta não aparece nada. Se não clicar, instala ao fechar (como antes).
 */
export function NovaVersao({ ponte, intervaloMs = 60_000 }: Props) {
  const [versao, setVersao] = useState<string | null>(null)
  const [estado, setEstado] = useState<'parado' | 'instalando' | 'falhou'>('parado')

  useEffect(() => {
    if (!ponte) return
    let vivo = true
    const conferir = async () => {
      try { const v = await ponte.pronta(); if (vivo) setVersao(typeof v === 'string' && v ? v : null) } catch { /* tenta de novo no próximo ciclo */ }
    }
    void conferir()
    const id = setInterval(() => { void conferir() }, intervaloMs)
    return () => { vivo = false; clearInterval(id) }
  }, [ponte, intervaloMs])

  if (!ponte || !versao) return null

  const atualizar = async () => {
    setEstado('instalando')
    let ok: boolean
    try { ok = await ponte.instalar() } catch { ok = false }
    if (!ok) setEstado('falhou')
  }

  return (
    <div className="at-novaversao" role="status">
      <span className="at-novaversao__selo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
      </span>
      <span className="at-novaversao__texto">
        <strong>Nova versão do Atlas pronta</strong>
        <span>
          {estado === 'falhou'
            ? 'Não deu para atualizar agora. Ela instala sozinha quando você fechar o Atlas.'
            : `Versão ${versao}. O Atlas fecha por alguns segundos e abre de novo já atualizado.`}
        </span>
      </span>
      <button type="button" className="at-novaversao__botao" onClick={() => { void atualizar() }} disabled={estado === 'instalando'}>
        {estado === 'instalando' ? 'Atualizando…' : 'Atualizar agora'}
      </button>
    </div>
  )
}
