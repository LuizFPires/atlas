import { render, screen } from '@testing-library/react'
import { AnelEtapa, Progresso, duracaoCurta, pctDoProgresso } from './Progresso'

const T0 = 1_800_000_000_000

test('a contagem real manda na barra; sem contagem, anda pelo tempo de costume e para em 90%', () => {
  expect(pctDoProgresso({ pct: 62 }, T0)).toBe(62)
  expect(pctDoProgresso({ pct: 140 }, T0)).toBe(100)
  expect(pctDoProgresso({ inicio: T0, costume: [60, 120] }, T0 + 60_000)).toBe(45)
  expect(pctDoProgresso({ inicio: T0, costume: [60, 120] }, T0 + 10 * 60_000)).toBe(90)
  expect(pctDoProgresso({}, T0)).toBe(0)
})

test('duração curta em português', () => {
  expect(duracaoCurta(3.2)).toBe('3 s')
  expect(duracaoCurta(72)).toBe('1 min 12 s')
  expect(duracaoCurta(120)).toBe('2 min')
})

test('mostra o que faz, a %, e o sinal de vida com a última notícia', () => {
  render(<Progresso rotulo="Publicando" agora="Enviando arquivos · 38 de 61" pct={62} inicio={T0} costume={[120, 240]} noticia={T0 + 57_000} fonte="da Vercel" relogio={T0 + 60_000} />)
  const barra = screen.getByRole('progressbar', { name: 'Publicando' })
  expect(barra).toHaveAttribute('aria-valuenow', '62')
  expect(screen.getByText('Enviando arquivos · 38 de 61')).toBeInTheDocument()
  expect(screen.getByText('62%')).toBeInTheDocument()
  expect(screen.getByText('Última notícia da Vercel há 3 s · normalmente leva 2 a 4 min')).toBeInTheDocument()
})

test('sem notícia mostra quanto já passou; passou muito do normal, avisa (sem fingir que travou)', () => {
  const { rerender } = render(<Progresso rotulo="Nomes" agora="Lendo as telas" inicio={T0} costume={[20, 40]} relogio={T0 + 24_000} />)
  expect(screen.getByText('normalmente leva 20 a 40 s · já foram 24 s')).toBeInTheDocument()
  rerender(<Progresso rotulo="Nomes" agora="Lendo as telas" inicio={T0} costume={[20, 40]} relogio={T0 + 70_000} />)
  expect(screen.getByText(/Está levando mais que o normal/)).toBeInTheDocument()
})

test('anel da etapa: número e arco proporcional, sem girar', () => {
  const { container } = render(<AnelEtapa numero={3} pct={40} />)
  expect(container.textContent).toBe('3')
  expect(container.querySelector('.at-anel__arco')).toHaveAttribute('stroke-dashoffset', '60')
})
