import { Fragment, type ReactNode } from 'react'

// Renderizador mínimo de Markdown (títulos, parágrafos, listas, tabelas, **negrito**, *itálico*, ---).
// Seguro por construção: devolve elementos React (o texto é sempre escapado pelo React). Nunca usa HTML bruto.

function inline(t: string, k = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    if (m.index > i) out.push(t.slice(i, m.index))
    out.push(m[1] !== undefined ? <strong key={`${k}-${m.index}`}>{inline(m[1], m.index)}</strong> : <em key={`${k}-${m.index}`}>{m[2]}</em>)
    i = m.index + m[0].length
  }
  if (i < t.length) out.push(t.slice(i))
  return out
}

const celulas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
const ehSeparador = (l: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(l.trim())
const ehItem = (l: string) => /^\s*[-*]\s+/.test(l)
const ehRegua = (l: string) => /^-{3,}$/.test(l.trim())

export function Markdown({ texto }: { texto: string }) {
  const ls = texto.replace(/\r/g, '').split('\n')
  const blocos: ReactNode[] = []
  let n = 0
  let i = 0
  while (i < ls.length) {
    const l = ls[i]
    const k = n++
    if (!l.trim()) { i++; continue }
    const h = l.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const Tag = `h${h[1].length}` as 'h1' | 'h2' | 'h3' | 'h4'
      blocos.push(<Tag key={k}>{inline(h[2])}</Tag>)
      i++
    } else if (ehRegua(l)) {
      blocos.push(<hr key={k} />)
      i++
    } else if (l.trim().startsWith('|') && i + 1 < ls.length && ehSeparador(ls[i + 1])) {
      const cab = celulas(l)
      const linhas: string[][] = []
      i += 2
      while (i < ls.length && ls[i].trim().startsWith('|')) linhas.push(celulas(ls[i++]))
      blocos.push(
        <div className="lg-tabela" key={k}>
          <table>
            <thead><tr>{cab.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
            <tbody>{linhas.map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
    } else if (ehItem(l)) {
      const itens: string[] = []
      while (i < ls.length && ehItem(ls[i])) itens.push(ls[i++].replace(/^\s*[-*]\s+/, ''))
      blocos.push(<ul key={k}>{itens.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)
    } else {
      // Parágrafo: junta linhas seguidas até uma linha em branco ou outro tipo de bloco.
      const partes: string[] = [ls[i++].trim()]
      while (i < ls.length && ls[i].trim() && !/^#{1,4}\s/.test(ls[i]) && !ehItem(ls[i]) && !ls[i].trim().startsWith('|') && !ehRegua(ls[i])) partes.push(ls[i++].trim())
      blocos.push(<p key={k}>{partes.map((t, j) => <Fragment key={j}>{j > 0 && <br />}{inline(t)}</Fragment>)}</p>)
    }
  }
  return <>{blocos}</>
}
