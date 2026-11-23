import { useEffect, useState } from 'react'
import './nova-versao.css'
import { descreverDownload, SEGUNDOS_INSTALACAO } from './tempo-atualizacao'

/** O que a tela usa do atualizador (main.cjs): versão já baixada e conferida, e "instalar agora" (fecha, instala e reabre). */
export type SituacaoAtualizacao = { estado: string; versaoAtual: string }
export type PonteAtualizacao = {
  pronta(): Promise<string | null>
  instalar(): Promise<boolean>
  /** Última procura (estado do atualizador.cjs). Opcional: versões antigas do app não têm. */
  situacao?(): Promise<SituacaoAtualizacao | null>
  procurar?(): Promise<SituacaoAtualizacao>
  /** Download em curso, para a barra de progresso. */
  andamento?(): Promise<Andamento | null>
}
export type Andamento = { versao: string; baixados: number; total: number; inicio: number }

function Barra({ pct }: { pct?: number }) {
  return (
    <span className={`at-novaversao__barra${pct === undefined ? ' at-novaversao__barra--continua' : ''}`} role="progressbar"
      aria-label="Progresso da atualização" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={pct === undefined ? undefined : { width: `${pct}%` }} />
    </span>
  )
}

/** Motivos que merecem aviso (23/11/2026, caso do Guilherme: não atualizava e ninguém sabia por quê). "atual", "sem-rede" e
 *  "ocupado" não incomodam: resolvem sozinhos na próxima procura. */
const MOTIVO: Record<string, string> = {
  'servidor-sem-rota': 'o servidor do Atlas ainda não tem a atualização ligada',
  'servidor-sem-versao': 'o servidor ainda não tem a versão nova guardada',
  'sem-licenca': 'o servidor não reconheceu a licença deste computador',
  'erro-servidor': 'o servidor do Atlas respondeu com erro',
  'sem-servidor': 'este Atlas não sabe o endereço do servidor',
  erro: 'o arquivo da versão nova chegou diferente e foi jogado fora',
}

type Props = { ponte?: PonteAtualizacao; intervaloMs?: number }

/**
 * Faixa no topo do Atlas quando uma versão nova já está baixada (pedido do Luiz, 23/11/2026): um clique em "Atualizar agora"
 * fecha o Atlas, instala em silêncio e abre de novo. Sem versão pronta não aparece nada. Se não clicar, instala ao fechar (como antes).
 */
export function NovaVersao({ ponte, intervaloMs = 10_000 }: Props) {
  const [versao, setVersao] = useState<string | null>(null)
  const [estado, setEstado] = useState<'parado' | 'instalando' | 'falhou'>('parado')
  const [situacao, setSituacao] = useState<SituacaoAtualizacao | null>(null)
  const [procurando, setProcurando] = useState(false)
  const [respondeu, setRespondeu] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<{ a: Andamento; agora: number } | null>(null)

  // Barra do download: confere a cada segundo (pedido pequeno, só dentro do computador).
  useEffect(() => {
    if (!ponte?.andamento) return
    let vivo = true
    const ler = async () => {
      try {
        const a = await ponte.andamento?.()
        if (!vivo) return
        setBaixando(a && a.total > 0 ? { a, agora: Date.now() } : null)
        if (!a) { const v = await ponte.pronta(); if (vivo && typeof v === 'string' && v) setVersao(v) }
      } catch { /* tenta de novo */ }
    }
    void ler()
    const id = setInterval(() => { void ler() }, 1000)
    return () => { vivo = false; clearInterval(id) }
  }, [ponte])

  useEffect(() => {
    if (!ponte) return
    let vivo = true
    const conferir = async () => {
      try { const v = await ponte.pronta(); if (vivo) setVersao(typeof v === 'string' && v ? v : null) } catch { /* tenta de novo no próximo ciclo */ }
      try { const s = (await ponte.situacao?.()) ?? null; if (vivo) setSituacao(s) } catch { /* idem */ }
    }
    void conferir()
    const id = setInterval(() => { void conferir() }, intervaloMs)
    return () => { vivo = false; clearInterval(id) }
  }, [ponte, intervaloMs])

  if (!ponte) return null

  if (!versao && baixando) {
    const { pct, falta } = descreverDownload({ ...baixando.a, agora: baixando.agora })
    return (
      <div className="at-novaversao" role="status">
        <span className="at-novaversao__texto">
          <strong>Baixando a versão nova do Atlas · {pct}%</strong>
          <Barra pct={pct} />
          <span>{falta === 'calculando o tempo…' ? 'Calculando o tempo…' : `${falta[0].toUpperCase()}${falta.slice(1)}.`} Pode continuar usando; quando terminar, aparece o botão para atualizar.</span>
        </span>
      </div>
    )
  }

  if (!versao) {
    const motivo = situacao ? MOTIVO[situacao.estado] : undefined
    if (!motivo && !respondeu) return null
    const procurar = async () => {
      if (!ponte.procurar) return
      setProcurando(true)
      try {
        const s = await ponte.procurar()
        setSituacao(s)
        const v = await ponte.pronta()
        if (typeof v === 'string' && v) setVersao(v)
        else setRespondeu(s.estado === 'atual' ? 'Pronto: este Atlas já está na versão mais nova.' : MOTIVO[s.estado] ? `Ainda não deu: ${MOTIVO[s.estado]}.` : 'Sem internet agora. O Atlas tenta de novo sozinho.')
      } catch { setRespondeu('Não deu para procurar agora. O Atlas tenta de novo sozinho.') }
      setProcurando(false)
    }
    return (
      <div className="at-novaversao at-novaversao--aviso" role="status">
        <span className="at-novaversao__texto">
          <strong>{respondeu && !motivo ? 'Atualização' : 'Não consegui procurar versão nova'}</strong>
          <span>{respondeu ?? `Motivo: ${motivo}. Você está na versão ${situacao?.versaoAtual ?? '?'}. Se continuar, mande uma foto desta faixa na Ajuda.`}</span>
        </span>
        {ponte.procurar && (
          <button type="button" className="at-novaversao__botao" onClick={() => { void procurar() }} disabled={procurando}>
            {procurando ? 'Procurando…' : 'Procurar de novo'}
          </button>
        )}
      </div>
    )
  }

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
        <strong>{estado === 'instalando' ? 'Atualizando o Atlas…' : 'Nova versão do Atlas pronta'}</strong>
        {estado === 'instalando' && <Barra />}
        <span>
          {estado === 'falhou'
            ? 'Não deu para atualizar agora. Ela instala sozinha quando você fechar o Atlas.'
            : estado === 'instalando'
              ? `O Atlas fecha e volta sozinho em uns ${SEGUNDOS_INSTALACAO} segundos, já na versão ${versao}. Suas obras continuam onde estavam.`
              : `Versão ${versao}. Leva uns ${SEGUNDOS_INSTALACAO} segundos: o Atlas fecha e abre de novo já atualizado.`}
        </span>
      </span>
      <button type="button" className="at-novaversao__botao" onClick={() => { void atualizar() }} disabled={estado === 'instalando'}>
        {estado === 'instalando' ? 'Atualizando…' : 'Atualizar agora'}
      </button>
    </div>
  )
}
