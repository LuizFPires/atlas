// Entry real do instalador: roda a MESMA lógica testada (passos.ts) com executor de verdade.
// Uso (feito por instalar.ps1): node --experimental-strip-types executar.mjs
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { userInfo } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rodarInstalacao } from './passos.ts'

const recursos = dirname(fileURLToPath(import.meta.url))

function arquivos(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? arquivos(p) : [p]
    })
}

/** SHA-256 determinístico da pasta (caminho relativo + conteúdo, em ordem). */
function hashDaPasta(dir) {
  const h = createHash('sha256')
  for (const f of arquivos(dir)) {
    h.update(relative(dir, f).replaceAll('\\', '/'))
    h.update('\0')
    h.update(readFileSync(f))
  }
  return h.digest('hex')
}

const integridade = async (esperado) => {
  try {
    return hashDaPasta(join(recursos, 'plugin-atlas')) === esperado.toLowerCase()
  } catch {
    return false
  }
}

const exec = {
  roda: (comando) =>
    new Promise((resolve) => {
      const p = spawn(comando, { shell: true, stdio: 'inherit' })
      p.on('error', () => resolve({ codigo: 1 }))
      p.on('close', (c) => resolve({ codigo: c ?? 1 }))
    }),
}

const codigo = await rodarInstalacao(userInfo().username, { recursos, integridade }, exec, (m) => console.log(m))
process.exit(codigo)
