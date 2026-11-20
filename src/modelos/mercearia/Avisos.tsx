// App-modelo MERCEARIA — avisos: o que repor (estoque baixo) e o que retirar/vender logo (validade próxima ou vencida).
import { useEffect, useState } from 'react'
import { formatarData, ymd, type PortaDados, type Produto } from './dados'
import { calcularAvisos, DIAS_AVISO_VALIDADE, ESTOQUE_MINIMO } from './regrasAvisos'

const ERRO_PORTA = 'Não deu pra carregar agora. Tente de novo.'

function quando(dias: number): string {
  if (dias < 0) return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`
  if (dias === 0) return 'vence hoje'
  return dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`
}

export function Avisos({ dados, hoje }: { dados: PortaDados; hoje?: string }) {
  const [produtos, setProdutos] = useState<Produto[] | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let vivo = true
    void dados.listarProdutos().then((l) => { if (vivo) setProdutos(l) }).catch(() => { if (vivo) setErro(ERRO_PORTA) })
    return () => { vivo = false }
  }, [dados])

  const a = produtos ? calcularAvisos(produtos, hoje ?? ymd(new Date())) : null
  return (
    <section aria-label="Avisos">
      <h2>Avisos</h2>
      {erro && <p role="alert" className="mc-erro">{erro}</p>}
      {a && (
        <>
          <p className="mc-etiqueta">Repor (menos de {ESTOQUE_MINIMO} no estoque)</p>
          {a.estoqueBaixo.length === 0 && <p className="mc-mute">Nada acabando. Está tudo com estoque bom.</p>}
          <ul aria-label="Estoque baixo" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {a.estoqueBaixo.map((p) => (
              <li key={p.id} className="mc-cartao">
                <div className="mc-linha"><span>{p.nome}</span><span className="mc-baixo">{p.quantidade === 0 ? 'Acabou' : `Só ${p.quantidade} em estoque`}</span></div>
              </li>
            ))}
          </ul>
          <p className="mc-etiqueta">Validade (vencidos e que vencem em até {DIAS_AVISO_VALIDADE} dias)</p>
          {a.validade.length === 0 && <p className="mc-mute">Nenhum produto perto de vencer.</p>}
          <ul aria-label="Validade" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {a.validade.map(({ produto: p, dias, vencido }) => (
              <li key={p.id} className="mc-cartao">
                <div className="mc-linha">
                  <span>{p.nome} <span className="mc-mute">· {formatarData(p.validade)}</span></span>
                  <span className={vencido ? 'mc-baixo' : undefined}>{vencido ? 'Vencido, retire da prateleira: ' : 'Atenção: '}{quando(dias)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
