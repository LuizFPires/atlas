// @vitest-environment node
// O ícone do calendário dos campos de data do painel é verde-limão (destaque do design system), não o cinza padrão do navegador.
// (O Vitest devolve CSS vazio no import ?raw; lemos o arquivo pelo Node, que entra por nome em variável — sem @types/node.)
const mod = (nome: string): Promise<unknown> => import(/* @vite-ignore */ nome)
let css = ''

beforeAll(async () => {
  const fs = (await mod('node:fs')) as { readFileSync(p: string, e: string): string }
  const { fileURLToPath } = (await mod('node:url')) as { fileURLToPath(u: string): string }
  const path = (await mod('node:path')) as { resolve(...p: string[]): string }
  css = fs.readFileSync(path.resolve(fileURLToPath(import.meta.url), '..', 'admin.css'), 'utf8')
})

describe('admin.css — ícone do calendário', () => {
  const regra = () => css.match(/\.ad-campo-data input\[type="date"\]::-webkit-calendar-picker-indicator\s*\{([^}]*)\}/)

  it('existe uma regra para o ícone do calendário dos campos de data', () => {
    expect(regra()).not.toBeNull()
  })

  it('pinta o ícone com o verde-limão por máscara (troca o desenho cinza do navegador)', () => {
    const corpo = regra()?.[1] ?? ''
    expect(corpo).toMatch(/background:\s*var\(--lime\)/)
    expect(corpo).toMatch(/-webkit-mask:\s*url\("data:image\/svg\+xml/)
    expect(corpo).toMatch(/(^|[;\s])mask:\s*url\("data:image\/svg\+xml/)
  })
})
