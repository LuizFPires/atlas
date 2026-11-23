import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Botao, Trabalhando } from '../ui'
import { montarSrcDoc, SANDBOX_PREVIEW, type TelaDesenhada, type VersaoDaTela } from './ponte-prototipo'
import { ALTURA_CELULAR, ALTURA_COMPUTADOR, LARGURA_CELULAR, LARGURA_COMPUTADOR, useEscala } from './tamanhos-tela'

// 3 jeitos de uma tela, lado a lado (Milestone 36; protótipo prototipo/caminho-novo/P3Versoes, aprovado pelo Luiz em 23/11/2026).
// Nada muda no protótipo até a pessoa escolher ("Quero esta") ou pedir para misturar.

interface Props {
  tela: TelaDesenhada
  carregar: () => Promise<VersaoDaTela[]>
  onEscolher: (v: VersaoDaTela) => Promise<void>
  /** "a foto da 3 com os passos da 2": vira um ajuste normal do protótipo. */
  onMisturar: (texto: string) => Promise<void>
  onFechar: () => void
}

export function VersoesDaTela({ tela, carregar, onEscolher, onMisturar, onFechar }: Props) {
  const [versoes, setVersoes] = useState<VersaoDaTela[] | null>(null)
  const [erro, setErro] = useState('')
  const [rodada, setRodada] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [mistura, setMistura] = useState('')
  useEffect(() => {
    let vivo = true
    void carregar().then((v) => { if (vivo) setVersoes(v) }, () => { if (vivo) setErro('Não consegui desenhar as 3 versões agora. Tente de novo daqui a pouco.') })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma rodada por clique em "Desenhar mais 3"
  }, [rodada])
  const computador = tela.aparelho === 'computador'
  const [w, h] = computador ? [LARGURA_COMPUTADOR, ALTURA_COMPUTADOR] : [LARGURA_CELULAR, ALTURA_CELULAR]
  const fazer = async (f: () => Promise<void>) => { setOcupado(true); setErro(''); try { await f() } catch { setErro('Não deu certo agora. Tente de novo.'); setOcupado(false) } }

  return (
    <section className="at-versoes" aria-label={`3 jeitos de ${tela.nome}`}>
      <div className="at-versoes__cab">
        <div>
          <button type="button" className="at-versoes__voltar" onClick={onFechar}>← Voltar ao protótipo</button>
          <h2>3 jeitos de {tela.nome}</h2>
        </div>
        <span className="at-versoes__nota">Toque nas versões para testar. Nada muda no seu protótipo até você escolher.</span>
      </div>
      {erro && <p className="at-nova__erro" role="alert">{erro}</p>}
      {!versoes && !erro && <Trabalhando titulo="O Claude está desenhando 3 jeitos desta tela" segundos={150} etapas={['Lendo a tela de agora', 'Pensando em 3 jeitos diferentes de resolver', 'Desenhando no seu estilo']} />}
      {versoes && (
        <>
          <div className="at-versoes__lista">
            {versoes.map((v, i) => {
              const doc = montarSrcDoc(v.html)
              return (
                <div key={`${rodada}-${i}`} role="group" aria-label={`Versão ${i + 1}: ${v.titulo}`} className="at-versoes__item">
                  <span className="at-versoes__rot">VERSÃO {i + 1}</span>
                  <b>{v.titulo}</b>
                  {v.desc && <span className="at-versoes__desc">{v.desc}</span>}
                  <Moldura w={w} h={h} computador={computador}>
                    {doc && <iframe title={`Versão ${i + 1}: ${v.titulo}`} sandbox={SANDBOX_PREVIEW} srcDoc={doc} referrerPolicy="no-referrer" className="at-versoes__tela" />}
                  </Moldura>
                  {v.bom && <span className="at-versoes__desc"><b>Bom para:</b> {v.bom}</span>}
                  {v.cuidado && <span className="at-versoes__desc"><b>Cuidado:</b> {v.cuidado}</span>}
                  <Botao disabled={ocupado} onClick={() => void fazer(() => onEscolher(v))}>Quero esta</Botao>
                </div>
              )
            })}
          </div>
          <form className="at-versoes__mistura" onSubmit={(e) => { e.preventDefault(); if (mistura.trim()) void fazer(() => onMisturar(mistura.trim())) }}>
            <label htmlFor="mistura" className="at-proto__so-leitor">Misturar as versões</label>
            <input id="mistura" value={mistura} onChange={(e) => setMistura(e.target.value)} placeholder={'Gostou de partes de cada uma? Ex.: "a foto da 3 com os passos da 2"'} />
            <Botao type="submit" disabled={!mistura.trim() || ocupado}>Misturar</Botao>
            <Botao variante="secundario" disabled={ocupado} onClick={() => { setVersoes(null); setErro(''); setRodada((r) => r + 1) }}>Desenhar mais 3</Botao>
          </form>
        </>
      )}
    </section>
  )
}

/** A tela no tamanho real do aparelho, reduzida para caber na coluna (mesma regra do celular do protótipo). */
function Moldura({ w, h, computador, children }: { w: number; h: number; computador: boolean; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null)
  const escala = useEscala(caixa, w, h)
  return (
    <div className={`at-versoes__moldura${computador ? ' at-versoes__moldura--computador' : ''}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <div className="at-versoes__vidro" ref={caixa}>
        <div style={{ width: `${w}px`, height: `${h}px`, transform: `scale(${escala})`, transformOrigin: 'center center', flex: 'none', display: 'flex' }}>{children}</div>
      </div>
    </div>
  )
}
