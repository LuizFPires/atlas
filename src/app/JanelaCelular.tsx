import { useEffect, useRef, useState } from 'react'
import { textoDaTrava } from './explicar-trava'
import QRCode from 'qrcode'
import { Botao, Icone } from '../ui'
import './janela-celular.css'

interface Props {
  /** Gera o link (servidor do Atlas, 7 dias). */
  gerar(): Promise<{ url: string; expira_em: string }>
  /** Abre o WhatsApp com o link gerado (só ele). */
  whatsapp?: (url: string) => Promise<void>
  onFechar(): void
}

type Estado = { fase: 'gerando' } | { fase: 'pronto'; url: string; ate: string; qr: string } | { fase: 'erro'; texto: string }

const recado = (e: unknown) => {
  switch (e instanceof Error ? e.message : '') {
    case 'link-negado': return 'Não consegui conferir a sua licença para gerar o link. Confira a internet e tente de novo.'
    case 'muitos-links': return 'Você gerou muitos links agora há pouco. Espere alguns minutos e tente de novo.'
    case 'sem-conexao': return 'Sem internet agora. Assim que voltar, tente de novo.'
    case 'grande-para-celular': return 'O protótipo ficou grande demais para abrir de uma vez no celular. No computador ele continua inteiro, com todas as telas.'
    default: return textoDaTrava(e, 'Não consegui gerar o link.')
  }
}

/** "Abra no seu celular": QR code para apontar a câmera, o link, copiar e mandar pelo WhatsApp. O link vale 7 dias. */
export function JanelaCelular({ gerar, whatsapp, onFechar }: Props) {
  const [e, setE] = useState<Estado>({ fase: 'gerando' })
  const [copiado, setCopiado] = useState(false)
  // Gera UMA vez por abertura (a tela por trás pode se atualizar; isso não pode criar outro link).
  const gerarRef = useRef(gerar)
  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const r = await gerarRef.current()
        const qr = await QRCode.toString(r.url, { type: 'svg', margin: 1, color: { dark: '#141619', light: '#FFFFFF' } })
        const ate = new Date(r.expira_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
        if (vivo) setE({ fase: 'pronto', url: r.url, ate, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}` })
      } catch (x) { if (vivo) setE({ fase: 'erro', texto: recado(x) }) }
    })()
    return () => { vivo = false }
  }, [])

  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sem área de transferência */ }
  }

  return (
    <div className="at-jc__fundo" onClick={onFechar}>
      <div className="at-jc" role="dialog" aria-modal="true" aria-label="Abra no seu celular" onClick={(x) => x.stopPropagation()} onKeyDown={(x) => { if (x.key === 'Escape') onFechar() }}>
        <button type="button" className="at-jc__x" aria-label="Fechar" autoFocus onClick={onFechar}><Icone nome="x" tamanho={18} /></button>
        <span className="at-jc__selo">PROTÓTIPO NO CELULAR</span>
        <h2>Abra no seu celular</h2>
        {e.fase === 'gerando' && <p className="at-jc__txt" role="status"><span className="at-jc__giro" aria-hidden="true" /> Gerando o link…</p>}
        {e.fase === 'erro' && <p className="at-jc__erro" role="alert">{e.texto}</p>}
        {e.fase === 'pronto' && (
          <>
            <p className="at-jc__txt">Aponte a câmera do celular para o código. O protótipo abre na hora e dá para tocar nos botões e navegar, como no app de verdade.</p>
            <img className="at-jc__qr" src={e.qr} alt="QR code do link do protótipo" width={220} height={220} />
            <code className="at-jc__url">{e.url}</code>
            <div className="at-jc__acoes">
              <Botao variante="secundario" onClick={() => void copiar(e.url)}>{copiado ? 'Copiado!' : 'Copiar link'}</Botao>
              {whatsapp && <Botao onClick={() => void whatsapp(e.url)}>Mandar pelo WhatsApp</Botao>}
            </div>
            <span className="at-jc__nota">O link é secreto e vale até {e.ate} (7 dias). Só as telas vão para ele; cada versão nova pede um link novo.</span>
          </>
        )}
      </div>
    </div>
  )
}
