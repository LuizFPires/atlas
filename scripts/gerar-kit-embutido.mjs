// Gera supabase/functions/_shared/kit-embutido.ts a partir do kit do repositório (.claude/agents, skills, hooks).
// Por quê (24/11/2026, "código: kit-indisponivel" no Guilherme): o kit só vinha do bucket privado do Storage, que dependia de
// alguém subir os arquivos à mão; sem eles, nenhuma obra começava. Agora o kit vai junto da função (publicada sozinha a cada
// merge) e o bucket só acrescenta ou substitui arquivos. As instruções continuam só no servidor e na memória do app (invariante).
// Uso: node scripts/gerar-kit-embutido.mjs   (o teste kit-embutido.test.ts falha se o arquivo ficar desatualizado)
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const PASTAS = ['agents', 'skills', 'hooks', 'commands']

export function lerKitDoRepositorio(raiz = RAIZ) {
  const out = []
  const andar = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const d of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const c = path.join(dir, d.name)
      if (d.isDirectory()) andar(c)
      else if (d.isFile()) out.push({ caminho: path.relative(raiz, c).split(path.sep).join('/'), conteudo: fs.readFileSync(c, 'utf8') })
    }
  }
  for (const p of PASTAS) andar(path.join(raiz, '.claude', p))
  return out
}

export function montarModulo(arquivos) {
  return `// GERADO por scripts/gerar-kit-embutido.mjs a partir de .claude/ — não edite à mão.\n// O kit dos agentes que vai para as obras (o /entregar-kit põe marca d'água e aviso em cada arquivo).\nexport const KIT_EMBUTIDO: { caminho: string; conteudo: string }[] = ${JSON.stringify(arquivos, null, 1)}\n`
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const destino = path.join(RAIZ, 'supabase', 'functions', '_shared', 'kit-embutido.ts')
  fs.writeFileSync(destino, montarModulo(lerKitDoRepositorio()))
  console.log(`kit embutido: ${lerKitDoRepositorio().length} arquivos → ${path.relative(RAIZ, destino)}`)
}
