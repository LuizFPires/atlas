import { useEffect, useId, useRef, useState } from 'react'
import { Microfone, useVoz } from '../ui'
import { buscarMunicipios, carregarMunicipios, municipioUnicoExato, rotuloMunicipio, type Municipio } from './municipios-busca'

interface Props {
  valor: string
  uf: string
  /** Chamado ao digitar/falar (a UF se apaga até escolher uma sugestão). */
  onDigitar: (texto: string) => void
  /** Chamado ao escolher uma sugestão "Cidade – UF". */
  onEscolher: (cidade: string, uf: string) => void
}

/** Cidade com sugestões (combobox + listbox) e microfone. Escolher a sugestão já preenche o estado. Base do IBGE baixada só no primeiro foco/dígito. */
export function CampoCidade({ valor, uf, onDigitar, onEscolher }: Props) {
  const id = useId()
  const [base, setBase] = useState<Municipio[] | null>(null)
  const [aberta, setAberta] = useState(false)
  const [ativa, setAtiva] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  const [falhou, setFalhou] = useState(false)

  const carregar = () => {
    if (base || carregando) return
    setCarregando(true); setFalhou(false)
    carregarMunicipios().then(setBase).catch(() => { setCarregando(false); setFalhou(true) })
  }
  const { gravando, alternar, suportado } = useVoz((falado) => { onDigitar([valor, falado].filter(Boolean).join(' ')); carregar(); setAberta(true) })

  const sugestoes = base && !uf ? buscarMunicipios(base, valor) : []
  const mostrar = aberta && !uf && valor.trim().length > 0
  const semResultado = mostrar && !!base && sugestoes.length === 0

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const escolher = (m: Municipio) => { onEscolher(m.nome, m.uf); setAberta(false) }
  /** Nome inteiro certo e único na base (ex.: "São Paulo"): aceita sem exigir o clique. */
  const aceitarExato = () => {
    if (!base || uf) return false
    const m = municipioUnicoExato(base, valor)
    if (!m) return false
    escolher(m)
    return true
  }
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setAberta(false); return }
    if (e.key === 'Enter' && !sugestoes.length && aceitarExato()) { e.preventDefault(); return }
    if (!sugestoes.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberta(true); if (mostrar) setAtiva((a) => (a + 1) % sugestoes.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtiva((a) => (a - 1 + sugestoes.length) % sugestoes.length) }
    else if (e.key === 'Enter' && mostrar) { e.preventDefault(); escolher(sugestoes[Math.min(ativa, sugestoes.length - 1)]) }
  }
  const opId = (i: number) => `${id}-op-${i}`

  return (
    <div className="at-campo" ref={caixa}>
      <label htmlFor={id} className="at-campo-rotulo">De qual cidade você é? <span>(comece a digitar)</span></label>
      <div className="at-campo-linha cc-linha">
        <input
          id={id} type="text" value={valor} placeholder="Ex.: Campinas" autoComplete="off"
          role="combobox" aria-expanded={mostrar && sugestoes.length > 0} aria-controls={`${id}-lista`} aria-autocomplete="list"
          aria-activedescendant={mostrar && sugestoes.length ? opId(Math.min(ativa, sugestoes.length - 1)) : undefined}
          onFocus={() => { carregar(); setAberta(true) }}
          onChange={(e) => { carregar(); setAberta(true); setAtiva(0); onDigitar(e.target.value) }}
          onKeyDown={teclas}
          onBlur={() => { aceitarExato() }}
        />
        {uf && <span className="cc-uf" aria-label={`Estado: ${uf}`}>{uf}</span>}
        <Microfone gravando={gravando} onAlternar={alternar} className="at-mic--campo" />
        <ul id={`${id}-lista`} role="listbox" aria-label="Cidades sugeridas" className="cc-lista" hidden={!(mostrar && sugestoes.length > 0)}>
          {sugestoes.map((m, i) => (
            <li key={m.nome + m.uf} id={opId(i)} role="option" aria-selected={i === ativa} className={i === ativa ? 'cc-op cc-op--ativa' : 'cc-op'}
              onMouseDown={(e) => { e.preventDefault(); escolher(m) }} onMouseEnter={() => setAtiva(i)}>
              {rotuloMunicipio(m)}
            </li>
          ))}
        </ul>
      </div>
      <span className="at-campo-ajuda" role="status">
        {uf ? `Estado: ${uf}. Se não for essa, apague e escolha outra.`
          : falhou && !base ? <>Não consegui carregar a lista de cidades (talvez a internet tenha oscilado). <button type="button" className="cc-retry" onClick={carregar}>Tentar de novo</button></>
          : semResultado ? 'Não achei essa cidade. Confira se está escrita certinha e escolha uma da lista.'
          : mostrar && !base ? 'Procurando…'
          : 'Escolha a sua cidade na lista: o estado aparece sozinho.'}
      </span>
      {!suportado && <span className="at-campo-ajuda">Este navegador não escuta a sua voz. Pode digitar normalmente.</span>}
    </div>
  )
}
