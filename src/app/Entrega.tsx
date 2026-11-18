import { useMemo, useState } from 'react'
import { Icone } from '../ui'
import canteiroImagem from '../assets/canteiro-3d.jpg'
import { textoDaObra } from './ponte-cota'
import { caminhoQr, enderecoDoSistema, linkWhatsapp, matrizQr, recadoEquipe } from './entrega-dados'
import './entrega.css'

export interface ResumoEntrega { etapas: number; tarefas: number; duracao?: string }

interface Props {
  obra: { nome: string }
  /** O que o M22 publicou (PontePublicar.publicarNoAr). É DADO: só vira QR/link se for um endereço http/https do próprio sistema. null = ainda não está no ar. */
  endereco: string | null
  /** Números da obra (do painel). Sem eles, os cartões somem em vez de inventar. */
  resumo?: ResumoEntrega | null
  /** "Quero mudar algo" leva ao pós-obra (F14). */
  onMudar?: () => void
}

/**
 * F13: a entrega das chaves. Tom de festa, calmo. O QR e o link só existem se o sistema está MESMO no ar:
 * sem endereço real, o Atlas diz isso com calma em vez de mostrar um QR ou endereço de mentira. O QR é gerado aqui, sem serviço externo.
 */
export function Entrega({ obra, endereco, resumo, onMudar }: Props) {
  const link = useMemo(() => enderecoDoSistema(endereco), [endereco])
  const nome = textoDaObra(obra.nome, 80)
  const matriz = useMemo(() => (link ? matrizQr(link) : null), [link])
  const [copiou, setCopiou] = useState<'sim' | 'nao' | null>(null)
  const mostrado = link ? link.replace(/^https?:\/\//, '') : ''

  const copiar = () => {
    if (!link) return
    if (!navigator.clipboard) { setCopiou('nao'); return }
    navigator.clipboard.writeText(link).then(() => setCopiou('sim'), () => setCopiou('nao'))
  }

  return (
    <main className="at-ent">
      <div className="at-ent__col">
        <span className="at-ent__selo"><Icone nome="check" tamanho={14} /> Obra entregue</span>
        <h1>{link ? `${nome} está no ar.` : `${nome} está pronta.`}</h1>
        {resumo && (
          <div className="at-ent__nums">
            <div className="at-ent__num"><b>{resumo.etapas}</b><span>etapas</span></div>
            <div className="at-ent__num"><b>{resumo.tarefas}</b><span>tarefas testadas</span></div>
            {resumo.duracao && <div className="at-ent__num"><b>{resumo.duracao}</b><span>de obra</span></div>}
          </div>
        )}
        <div className="at-ent__qr">
          {link && matriz ? (
            <svg width="136" height="136" viewBox={`0 0 ${matriz.length} ${matriz.length}`} shapeRendering="crispEdges" role="img" aria-label="QR code para abrir o sistema no celular" data-endereco={link}>
              <path d={caminhoQr(matriz)} fill="#141619" />
            </svg>
          ) : (
            <div className="at-ent__vazio" aria-hidden="true"><Icone nome="celular" tamanho={40} /></div>
          )}
          <div className="at-ent__txt">
            {link ? (
              <>
                <b>Aponte a câmera do celular</b>
                <span>Abre o sistema. Toque em "Adicionar à tela inicial" e ele vira um aplicativo.</span>
                <span className="at-ent__end">{mostrado}</span>
              </>
            ) : (
              <>
                <b>O QR e o link aparecem aqui</b>
                <span>Assim que o sistema estiver no ar, o QR e o link aparecem aqui. Sem o endereço de verdade, eu prefiro esperar a mostrar um que não funciona.</span>
              </>
            )}
          </div>
        </div>
        <div className="at-ent__acoes">
          {link ? (
            <a className="at-ent__zap" href={linkWhatsapp(recadoEquipe(nome, link))} target="_blank" rel="noopener noreferrer">Mandar para a equipe pelo WhatsApp</a>
          ) : (
            <span className="at-ent__zap" role="link" aria-disabled="true">Mandar para a equipe pelo WhatsApp</span>
          )}
          {link && <button type="button" className="at-ent__sec" onClick={copiar}>Copiar o link</button>}
          <button type="button" className="at-ent__sec" onClick={onMudar}>Quero mudar algo</button>
        </div>
        {copiou === 'sim' && <p className="at-ent__nota" role="status">Link copiado. É só colar na conversa.</p>}
        {copiou === 'nao' && <p className="at-ent__nota" role="status">Não consegui copiar agora. Selecione o endereço acima e copie por aí.</p>}
      </div>
      <div className="at-ent__cena">
        <img src={canteiroImagem} alt="Prédio concluído no canteiro 3D" />
        <span>Prédio pronto. O código é seu, guardado no seu GitHub, para sempre.</span>
      </div>
    </main>
  )
}
